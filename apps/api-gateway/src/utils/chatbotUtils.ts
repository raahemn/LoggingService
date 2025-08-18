import type { Content, FunctionCall } from "@google/genai";

export class ChatbotUtils {
  /**
   * Creates a function to add messages to conversation contents
   */
  static createMessageAdder(functionCall: FunctionCall, contents: Content[]) {
    return (toolResult: string) => {
      // Add the model's response with function call
      contents.push({
        role: "model",
        parts: [{ functionCall }]
      });
      // Add the function response
      contents.push({
        role: "user",
        parts: [{ 
          functionResponse: {
            name: functionCall.name,
            response: { result: toolResult }
          }
        }]
      });
    };
  }

  /**
   * Finds the last function call name from conversation contents
   */
  static findLastFunctionCallName(contents: Content[]): string {
    for (let i = contents.length - 1; i >= 0; i--) {
      const content = contents[i];
      if (content.role === "model" && content.parts) {
        for (const part of content.parts) {
          if (part.functionCall && part.functionCall.name) {
            return part.functionCall.name;
          }
        }
      }
    }
    return "unknown";
  }

  /**
   * Creates a standardized error response
   */
  static createErrorResponse(message: string): { response: string } {
    return { response: message };
  }

  /**
   * Formats function call arguments for logging
   */
  static formatFunctionCall(name: string, args: unknown): string {
    return `${name}(${JSON.stringify(args)})`;
  }

  /**
   * Safely extracts error message from unknown error type
   */
  static extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Creates a chat response with optional tool calls
   */
  static createChatResponse(response: string, toolCalls?: string[], pendingOperation?: unknown): {
    response: string;
    toolCalls?: string[];
    pendingOperation?: unknown;
  } {
    const result: {
      response: string;
      toolCalls?: string[];
      pendingOperation?: unknown;
    } = { response };
    
    if (toolCalls && toolCalls.length > 0) {
      result.toolCalls = toolCalls;
    }
    
    if (pendingOperation) {
      result.pendingOperation = pendingOperation;
    }
    
    return result;
  }
}
