import { GoogleGenAI } from "@google/genai";
import type { Content, GenerateContentConfig, FunctionCall } from "@google/genai";
import { MCPClientService } from "./mcpClientService";
import { ChatbotPermissionService } from "./chatbotPermissionService";
import { ChatbotOperationService, PendingOperation, ChatState } from "./chatbotOperationService";
import { ChatbotUtils } from "../utils/chatbotUtils";
import config from "config";
import logger from '../config/logger';

export interface ChatRequest {
  message: string;
  userId: string;
  isUserAdmin?: boolean;
}

export interface ChatResponse {
  response: string;
  toolCalls?: string[];
  pendingOperation?: PendingOperation;
}

export class ChatbotService {
  private genai: GoogleGenAI;
  private mcpClient: MCPClientService;
  private permissionService: ChatbotPermissionService;
  private operationService: ChatbotOperationService;
  private chatbotLogger = logger.withTraceId('CHATBOT');

  private static readonly DEFAULT_MAX_ITERATIONS = 10;
  private static readonly GEMINI_MODEL = "gemini-2.5-flash";
  private static readonly DEFAULT_ERROR_MESSAGE = "I encountered an error processing your request. Please try again.";
  private static readonly FALLBACK_RESPONSE = "Sorry, couldn't process your request.";

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || config.get<string>("gemini.apiKey");
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    this.genai = new GoogleGenAI({ apiKey });
    this.mcpClient = new MCPClientService();
    this.permissionService = new ChatbotPermissionService();
    this.operationService = new ChatbotOperationService(this.mcpClient);
  }

  async initialize(): Promise<void> {
    await this.mcpClient.initialize();
  }

  // Modified to resume chat after executing pending operation
  async executePendingOperation(operationId: string, userId: string): Promise<ChatResponse> {
    const operationResult = await this.operationService.executePendingOperation(operationId, userId);
    
    if (!operationResult.success) {
      return { 
        response: operationResult.error || "Failed to execute operation",
        toolCalls: []
      };
    }

    // If we have the operation and chat state, resume the chat
    if (operationResult.operation?.chatState) {
      this.chatbotLogger.info("🔄 Resuming chat from saved state after operation execution");
      return this.resumeChatFromState(operationResult.operation.chatState, operationResult.result);
    }

    return { 
      response: "Operation completed successfully",
      toolCalls: []
    };
  }

  // Delegate to operation service
  cancelPendingOperation(operationId: string, userId: string): boolean {
    return this.operationService.cancelPendingOperation(operationId, userId);
  }

  async processQuery(request: ChatRequest): Promise<ChatResponse> {
    try {
      const { tools, systemMessage } = await this.prepareConversationContext(request);
      const contents: Content[] = [{ role: "user", parts: [{ text: request.message }] }];
      const toolCalls: string[] = [];

      return await this.executeConversationLoop(
        contents,
        toolCalls,
        systemMessage,
        tools,
        ChatbotService.DEFAULT_MAX_ITERATIONS,
        request
      );
    } catch (error) {
      this.chatbotLogger.error("Chatbot processing error", error);
      return { response: ChatbotService.DEFAULT_ERROR_MESSAGE };
    }
  }

  private async prepareConversationContext(request: ChatRequest): Promise<{ tools: unknown; systemMessage: string }> {
    const allTools = this.mcpClient.getTools();
    const filteredTools = this.permissionService.filterToolsForUser(allTools, request.isUserAdmin || false);
    const userApplications = request.isUserAdmin ? [] : await this.permissionService.getUserApplications(request.userId);

    const tools = filteredTools.length > 0 ? [{
      functionDeclarations: filteredTools.map(tool => ({
        name: tool.name,
        description: tool.description || "",
        parameters: tool.input_schema
      }))
    }] : undefined;

    let systemMessage = `You are a helpful assistant for **LogStream**, a comprehensive log management and analytics platform. Your primary responsibilities include supporting users with logging infrastructure tasks and analyzing log data stored in MongoDB.

==========================
CORE CAPABILITIES
==========================
- Application Management: Create, configure, and monitor applications
- User & Group Management: Handle access control and permissions
- Log Analysis: Search, filter, and aggregate log data
- System Monitoring: Generate alerts and provide real-time visibility

==========================
DATABASE OVERVIEW
==========================
Database: **"temp"**

Key Collections:
• **applications** — Stores application metadata and configuration
• **users** — Contains user authentication and profile data
• **groups** — Defines user groups and roles
• **logs** — Log entries with fields:
   - date
   - logLevel (e.g., "ERROR", "DEBUG", "WARNING", "INFO") [Case Sensitive]
   - message
   - traceId
   - sourceApp: Stored as an **ObjectId**
     → Always query using: { sourceApp: { "$oid": "..." } }
• other collections include: agendaJobs, drp, jobstatuses, alerts

==========================
WORKFLOW RULES
==========================
1. You must always check collection schemas via the collection-schema tool before querying anything.
2. When working with logs:  
   • Fetch schema using the \`mcp_mongodb_collection-indexes\` tool
   • Use appropriate date ranges
3. For advanced insights, use aggregation pipelines.
4. Enforce access controls: Users may only access data tied to their authorized applications.
5. **DELETED OBJECTS RULE: Never access, read, remove, or update objects that are marked as deleted.**
6. Provide responses that are clear, actionable, and relevant.
7. Highlight any data anomalies, trends, or errors during analysis.
8. **When users request changes (like updating application or user group names), you should:**
   • First check the collection schema if needed
   • Then IMMEDIATELY proceed to call the appropriate update-many operation
   • The system will automatically handle user confirmation for write operations
   • DO NOT provide a final text response until you have executed the update operation
9. **CRITICAL: Always use tools to gather information before providing final answers.**
   • Never say you "need to check" something - actually check it using the appropriate tool
   • If you need multiple pieces of information, gather all of them using tools before responding
   • Complete all necessary data gathering in a single conversation turn when possible
   • For update operations: schema check → execute update → provide confirmation response
10. **MULTI-STEP OPERATIONS: When a user requests multiple actions (like "create X and add it to Y"), you must:**
   • Complete ALL parts of the request using appropriate tool calls
   • Do not provide a final response until ALL requested operations are completed
   • If a user asks you to create something AND do something else with it, execute both operations
   • Example: "create app X and add to group Y" requires: create operation + find group + update group
11. **FINAL RESPONSE RULE:**
   • Your final response should only be given when NO MORE TOOL CALLS are needed
   • If any part of the user's request is incomplete, continue making tool calls
   • Only stop when you have fully completed everything the user requested
12. If asked to create an application, you must:
   • Check the collection schema for the applications collection
   • Call the appropriate create operation
   • Add the application to the "Administrators" user group.
   • If a threshold and time period are not provided, use threshold = 10, time period = 5
   • Set active = true and deleted = false

==========================
RESPONSE GUIDELINES
==========================
- Be concise, yet thorough
- Include relevant data samples if helpful
- Never expose raw database internals (IDs, structure, etc.)
- Suggest next steps or related actions
- Always respect user access limitations; inform users if an action is restricted
- When reporting operation results, provide user-friendly summaries instead of technical details
- For successful operations, confirm what was accomplished in natural language with specific details
- Use emojis and positive language for successful operations
- When given operation context, be specific about what changed (e.g., "changed App 200 to App 2" not "updated a record")

`;

    if (!request.isUserAdmin) {
      systemMessage += `
==========================
ACCESS CONTROL (Non-Admin)
==========================
You have restricted access based on your assigned applications.

AUTHORIZED APPLICATIONS:
${userApplications.map(app => `→ ${app._id} (${app.name})`).join('\n')}

ACCESS RULES:
• You may **only query logs** for the applications listed above.
• All log queries **must filter by** \`sourceApp\` using one of your authorized application IDs.
   Example: \`{ sourceApp: { "$oid": "<your-app-id>" } }\`
• You are restricted to **read-only** operations on the \`logs\` and \`alerts\` collections.
• You are **completely blocked** from the following collections:
  → \`agendaJobs\`, \`applications\`, \`drp\`, \`groups\`, \`jobstatuses\`, \`users\`
• Attempting to access unauthorized application data will result in an error.
`;
    }

    return { tools, systemMessage };
  }

  private async executeConversationLoop(
    contents: Content[],
    toolCalls: string[],
    systemMessage: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: any,
    maxIterations: number,
    originalRequest: ChatRequest
  ): Promise<ChatResponse> {
    let finalResponse = "";

    while (maxIterations > 0) {
      const response = await this.generateContentWithTools(systemMessage, contents, tools);
      const processResult = await this.processResponseParts(
        response,
        originalRequest,
        toolCalls,
        contents,
        systemMessage,
        tools,
        maxIterations
      );

      if (processResult.earlyReturn) return processResult.earlyReturn;
      if (processResult.textResponse) finalResponse = processResult.textResponse;
      if (!processResult.hasToolCalls) break;
      
      maxIterations--;
      this.chatbotLogger.debug(`🔄 Continuing conversation loop, ${maxIterations} iterations remaining`);
    }

    this.chatbotLogger.info(`🏁 Conversation ended with final response: "${finalResponse}"`);
    return {
      response: finalResponse || ChatbotService.FALLBACK_RESPONSE,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }

  private async generateContentWithTools(systemMessage: string, contents: Content[], tools: unknown) {
    const config: GenerateContentConfig = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      systemInstruction: systemMessage
    };

    return await this.genai.models.generateContent({
      model: ChatbotService.GEMINI_MODEL,
      contents,
      config
    });
  }

  private async processResponseParts(
    response: unknown,
    originalRequest: ChatRequest,
    toolCalls: string[],
    contents: Content[],
    systemMessage: string,
    tools: unknown,
    maxIterations: number
  ): Promise<{ hasToolCalls: boolean; textResponse?: string; earlyReturn?: ChatResponse }> {
    let hasToolCalls = false;
    let textResponse: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseObj = response as any;
    if (responseObj.candidates && responseObj.candidates.length > 0) {
      const candidate = responseObj.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            textResponse = part.text;
          } else if (part.functionCall) {
            hasToolCalls = true;
            this.chatbotLogger.debug(`🔍 Gemini called function: ${part.functionCall.name} with args: ${JSON.stringify(part.functionCall.args)}`);
            const result = await this.handleGeminiToolUse(
              part.functionCall, 
              originalRequest, 
              toolCalls, 
              contents, 
              systemMessage, 
              tools, 
              maxIterations
            );
            if (result) return { hasToolCalls: false, earlyReturn: result }; // Early return for pending operations
          }
        }
      }
    }

    return { hasToolCalls, textResponse };
  }

  private resumeChatFromState(chatState: ChatState, toolResult: unknown): Promise<ChatResponse> {
    try {
      this.chatbotLogger.info(`🔄 Resuming chat with ${chatState.remainingIterations} iterations remaining`);
      
      // Get the tool result content
      const toolResultContent = this.operationService.extractToolResultContent(toolResult);
      
      // Find the last function call from the conversation
      const functionCallName = ChatbotUtils.findLastFunctionCallName(chatState.contents);
      
      // Add the function response to continue the conversation
      chatState.contents.push({
        role: "user",
        parts: [{ 
          functionResponse: {
            name: functionCallName,
            response: { result: toolResultContent }
          }
        }]
      });

      // Continue the conversation loop
      const continuationResult = this.executeConversationLoop(
        chatState.contents,
        chatState.toolCalls,
        chatState.systemMessage,
        chatState.tools,
        chatState.remainingIterations,
        chatState.originalRequest
      );

      this.chatbotLogger.debug("🔍 continueConversation result received");

      return continuationResult;
    } catch (error) {
      this.chatbotLogger.error("Error resuming chat from state", error);
      return Promise.resolve({ response: "I encountered an error while continuing our conversation. The operation was completed successfully though." });
    }
  }

  private async handleGeminiToolUse(
    functionCall: FunctionCall,
    request: ChatRequest,
    toolCalls: string[],
    contents: Content[],
    systemMessage?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools?: any,
    remainingIterations?: number
  ): Promise<ChatResponse | null> {
    if (!functionCall.name) {
      this.chatbotLogger.error("Function call missing name");
      return null;
    }

    const validation = await this.permissionService.validateToolOperation(
      functionCall.name,
      functionCall.args as Record<string, unknown>,
      request.isUserAdmin || false,
      request.userId
    );

    const addMessages = ChatbotUtils.createMessageAdder(functionCall, contents);

    if (!validation.allowed) {
      this.addBlockedToolCall(functionCall, toolCalls);
      addMessages(validation.reason || "Operation not permitted");
      return null;
    }

    this.chatbotLogger.debug(`Processing tool: ${functionCall.name}`);
    if (this.operationService.requiresConfirmation(functionCall.name)) {
      return this.handleConfirmationRequiredTool(
        functionCall, 
        request, 
        toolCalls, 
        contents, 
        systemMessage, 
        tools, 
        remainingIterations
      );
    } else {
      await this.handleImmediateTool(functionCall, toolCalls, addMessages);
      return null;
    }
  }

  private addBlockedToolCall(functionCall: FunctionCall, toolCalls: string[]) {
    toolCalls.push(`${ChatbotUtils.formatFunctionCall(functionCall.name!, functionCall.args)} - BLOCKED`);
  }

  private handleConfirmationRequiredTool(
    functionCall: FunctionCall,
    request: ChatRequest,
    toolCalls: string[],
    contents: Content[],
    systemMessage?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools?: any,
    remainingIterations?: number
  ): ChatResponse {
    this.chatbotLogger.info(`Tool ${functionCall.name} requires confirmation - storing pending operation`);
    
    // Add the model's response with function call to contents before saving state
    contents.push({
      role: "model",
      parts: [{ functionCall }]
    });
    
    // Create chat state to save the conversation context
    const chatState: ChatState = {
      contents: [...contents], // Clone the array
      toolCalls: [...toolCalls], // Clone the array
      systemMessage: systemMessage || "",
      tools: tools,
      remainingIterations: remainingIterations || 0,
      originalRequest: request
    };
    
    const operationId = this.operationService.storePendingOperation(
      functionCall.name!,
      functionCall.args as Record<string, unknown>,
      request.userId,
      chatState
    );
    
    const operation = this.operationService.getPendingOperation(operationId);
    toolCalls.push(`${ChatbotUtils.formatFunctionCall(functionCall.name!, functionCall.args)} - PENDING CONFIRMATION`);

    const addMessages = ChatbotUtils.createMessageAdder(functionCall, contents);
    addMessages(`USER CONFIRMATION REQUIRED: The user needs to approve this operation: ${operation?.description}. Please wait for user confirmation before proceeding. Explain the operation in user-friendly terms and ask for permission.`);

    return {
      response: `I understand you want to make changes to the database. Let me confirm the details:\n\n**${operation?.description}**\n\nThis operation will modify data in your database. Would you like me to proceed with this change?`,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      pendingOperation: operation || undefined
    };
  }

  private async handleImmediateTool(
    functionCall: FunctionCall,
    toolCalls: string[],
    addMessages: (toolResult: string) => void
  ): Promise<void> {
    this.chatbotLogger.info(`Tool ${functionCall.name} does not require confirmation - executing immediately`);
    try {
      const result = await this.mcpClient.callTool(functionCall.name!, functionCall.args as Record<string, unknown>);
      toolCalls.push(ChatbotUtils.formatFunctionCall(functionCall.name!, functionCall.args));
      addMessages(this.operationService.extractToolResultContent(result));
    } catch (error) {
      const errorMsg = ChatbotUtils.extractErrorMessage(error);
      addMessages(`Error: ${errorMsg}`);
    }
  }

  async close(): Promise<void> {
    await this.mcpClient.close();
  }
}
