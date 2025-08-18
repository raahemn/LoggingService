import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import logger from '../config/logger';

export interface Tool {
  name: string;
  description?: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export class MCPClientService {
  private mcp: Client;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];
  private isConnected: boolean = false;
  private mcpLogger = logger.withTraceId('MCP');

  constructor() {
    this.mcp = new Client({ name: "logstream-chatbot", version: "1.0.0" });
  }

  async initialize(): Promise<void> {
    if (this.isConnected) return;

    try {
      // Get MongoDB connection string from environment
      const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
      
      if (!mongoUri) {
        throw new Error("MongoDB URI not found in environment variables (MONGODB_URL or MONGODB_URI)");
      }

            this.mcpLogger.info(`Connecting to MongoDB MCP server with URI: ${mongoUri.substring(0, 20)}...`);
      
      // Connect to MongoDB MCP server
      this.transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', 'mongodb-mcp-server', '--connectionString', mongoUri],
      });

      await this.mcp.connect(this.transport);

      // Get tools from the server
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool: { name: string; description?: string; inputSchema: object }) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as {
          type: 'object';
          properties?: Record<string, unknown>;
          required?: string[];
        },
      }));

      this.isConnected = true;
      this.mcpLogger.info(`Connected to MongoDB MCP server with tools: ${this.tools.map(t => t.name).join(', ')}`);
    } catch (error) {
      this.mcpLogger.error("Failed to connect to MongoDB MCP server", error);
      throw error;
    }
  }

  getTools(): Tool[] {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected) {
      await this.initialize();
    }

    try {
      this.mcpLogger.debug(`Calling tool ${name} with args: ${JSON.stringify(args)}`);
      
      const result = await this.mcp.callTool({
        name,
        arguments: args,
      });

      this.mcpLogger.debug(`Tool ${name} result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.mcpLogger.error(`Tool call failed for ${name}`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.mcp.close();
      this.isConnected = false;
    }
  }
}
