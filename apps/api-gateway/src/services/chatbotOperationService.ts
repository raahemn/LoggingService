import { MCPClientService } from "./mcpClientService";
import type { Content } from "@google/genai";
import logger from '../config/logger';

export interface ChatState {
  contents: Content[];
  toolCalls: string[];
  systemMessage: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any;
  remainingIterations: number;
  originalRequest: {
    message: string;
    userId: string;
    isUserAdmin?: boolean;
  };
}

export interface PendingOperation {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  userId: string;
  timestamp: Date;
  chatState: ChatState; // Add the entire chat state
}

export class ChatbotOperationService {
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private mcpClient: MCPClientService;
  private operationLogger = logger.withTraceId('OPERATION');

  private readonly WRITE_OPERATIONS = [
    'mcp_mongodb_insert-many', 'mcp_mongodb_update-many', 'mcp_mongodb_delete-many',
    'insert-many', 'update-many', 'delete-many'
  ];

  private readonly OPERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor(mcpClient: MCPClientService) {
    this.mcpClient = mcpClient;
  }

  requiresConfirmation(toolName: string): boolean {
    const requires = this.WRITE_OPERATIONS.includes(toolName);
    this.operationLogger.debug(`🔍 Checking if tool '${toolName}' requires confirmation: ${requires}`);
    this.operationLogger.debug(`🔍 Available write operations: ${this.WRITE_OPERATIONS.join(', ')}`);
    return requires;
  }

  generateOperationDescription(toolName: string, toolInput: Record<string, unknown>): string {
    const collection = toolInput.collection as string || 'unknown';
    const database = toolInput.database as string || 'unknown';

    const operationMap: Record<string, string> = {
      'mcp_mongodb_insert-many': 'insert-many',
      'mcp_mongodb_update-many': 'update-many',
      'mcp_mongodb_delete-many': 'delete-many'
    };

    const normalizedTool = operationMap[toolName] || toolName;
    return this.getOperationDescription(normalizedTool, toolInput, collection, database);
  }

  private getOperationDescription(
    normalizedTool: string, 
    toolInput: Record<string, unknown>, 
    collection: string, 
    database: string
  ): string {
    switch (normalizedTool) {
      case 'insert-many': {
        const documents = toolInput.documents as unknown[] || [];
        return `Insert ${documents.length} document(s) into collection "${collection}" in database "${database}"`;
      }
      case 'update-many': {
        const filter = toolInput.filter ? JSON.stringify(toolInput.filter) : 'all documents';
        return `Update documents in collection "${collection}" (database: "${database}") matching filter: ${filter}`;
      }
      case 'delete-many': {
        const deleteFilter = toolInput.filter ? JSON.stringify(toolInput.filter) : 'all documents';
        return `Delete documents from collection "${collection}" (database: "${database}") matching filter: ${deleteFilter}`;
      }
      default:
        return `Execute ${normalizedTool} operation on collection "${collection}" in database "${database}"`;
    }
  }

  storePendingOperation(
    toolName: string, 
    toolInput: Record<string, unknown>, 
    userId: string,
    chatState: ChatState
  ): string {
    const operationId = this.generateOperationId();
    const operation: PendingOperation = {
      id: operationId,
      toolName,
      toolInput,
      description: this.generateOperationDescription(toolName, toolInput),
      userId,
      timestamp: new Date(),
      chatState
    };
    
    this.pendingOperations.set(operationId, operation);
    this.scheduleOperationCleanup(operationId);
    return operationId;
  }

  private generateOperationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private scheduleOperationCleanup(operationId: string): void {
    setTimeout(() => this.pendingOperations.delete(operationId), this.OPERATION_TIMEOUT_MS);
  }

  async executePendingOperation(operationId: string, userId: string): Promise<{ success: boolean; result?: unknown; error?: string; operation?: PendingOperation }> {
    const operation = this.pendingOperations.get(operationId);
    
    if (!operation) return this.createOperationResult(false, 'Operation not found or expired');
    if (operation.userId !== userId) return this.createOperationResult(false, 'Unauthorized to execute this operation');
    
    try {
      const result = await this.mcpClient.callTool(operation.toolName, operation.toolInput);
      this.pendingOperations.delete(operationId);
      return this.createOperationResult(true, undefined, result, operation);
    } catch (error) {
      this.pendingOperations.delete(operationId);
      return this.createOperationResult(
        false, 
        error instanceof Error ? error.message : String(error),
        undefined,
        operation
      );
    }
  }

  private createOperationResult(
    success: boolean, 
    error?: string, 
    result?: unknown, 
    operation?: PendingOperation
  ) {
    const resultObj: { success: boolean; result?: unknown; error?: string; operation?: PendingOperation } = { success };
    if (error) resultObj.error = error;
    if (result) resultObj.result = result;
    if (operation) resultObj.operation = operation;
    return resultObj;
  }

  cancelPendingOperation(operationId: string, userId: string): boolean {
    const operation = this.pendingOperations.get(operationId);
    if (!operation || operation.userId !== userId) return false;
    this.pendingOperations.delete(operationId);
    return true;
  }

  getPendingOperation(operationId: string): PendingOperation | undefined {
    return this.pendingOperations.get(operationId);
  }

  extractToolResultContent(result: unknown): string {
    try {
      if (typeof result === 'string') return result;
      if (result && typeof result === 'object') {
        return this.extractObjectContent(result as Record<string, unknown>);
      }
      return JSON.stringify(result);
    } catch (error) {
      return `Error processing result: ${error}`;
    }
  }

  private extractObjectContent(obj: Record<string, unknown>): string {
    if (obj.content) {
      return typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
    }
    return JSON.stringify(obj);
  }
}
