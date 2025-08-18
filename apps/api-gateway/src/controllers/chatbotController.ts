import { Request, Response } from "express";
import { ChatbotService } from "../services/chatbotService";
import createResponse from "../utils/responseHelper";
import logger from '../config/logger';

let chatbotService: ChatbotService | null = null;
const controllerLogger = logger.withTraceId('CHATBOT_CONTROLLER');

// Initialize chatbot service (called from server startup)
export const initializeChatbot = async (): Promise<void> => {
  if (!chatbotService) {
    chatbotService = new ChatbotService();
    await chatbotService.initialize();
  }
};

// Get chatbot service (assumes it's already initialized)
const getChatbotService = (): ChatbotService => {
  if (!chatbotService) {
    throw new Error("Chatbot service not initialized. Call initializeChatbot() first.");
  }
  return chatbotService;
};

export const chat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    const userId = req.user?.userId;
    const isUserAdmin = req.user?.isAdmin;

    if (!message || typeof message !== "string") {
      res.status(400).json(createResponse(400, "Message is required", null));
      return;
    }

    if (!userId) {
      res.status(401).json(createResponse(401, "User authentication required", null));
      return;
    }

    const service = getChatbotService();
    const result = await service.processQuery({ message, userId, isUserAdmin });

    res.status(200).json(createResponse(200, "Chat response generated", result));
  } catch (error) {
    controllerLogger.error("Chat controller error", error);
    res.status(500).json(createResponse(500, "Internal server error", null));
  }
};

export const confirmOperation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { operationId } = req.params;
    const userId = req.user?.userId;

    if (!operationId) {
      res.status(400).json(createResponse(400, "Operation ID is required", null));
      return;
    }

    if (!userId) {
      res.status(401).json(createResponse(401, "User authentication required", null));
      return;
    }

    const service = getChatbotService();
    const result = await service.executePendingOperation(operationId, userId);

    controllerLogger.debug("🔍 executePendingOperation result received");

    // The executePendingOperation now returns a ChatResponse directly
    // and handles the chat continuation internally
    res.status(200).json(createResponse(200, "Operation executed successfully", {
      response: result.response,
      toolCalls: result.toolCalls,
      pendingOperation: result.pendingOperation // Make sure this is included
    }));
  } catch (error) {
    console.error("Confirm operation error:", error);
    res.status(500).json(createResponse(500, "Internal server error", null));
  }
};

export const cancelOperation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { operationId } = req.params;
    const userId = req.user?.userId;

    if (!operationId) {
      res.status(400).json(createResponse(400, "Operation ID is required", null));
      return;
    }

    if (!userId) {
      res.status(401).json(createResponse(401, "User authentication required", null));
      return;
    }

    const service = getChatbotService();
    const success = service.cancelPendingOperation(operationId, userId);

    if (success) {
      res.status(200).json(createResponse(200, "Operation cancelled successfully", null));
    } else {
      res.status(404).json(createResponse(404, "Operation not found or unauthorized", null));
    }
  } catch (error) {
    console.error("Cancel operation error:", error);
    res.status(500).json(createResponse(500, "Internal server error", null));
  }
};

// Cleanup function for graceful shutdown
export const closeChatbot = async (): Promise<void> => {
  if (chatbotService) {
    await chatbotService.close();
    chatbotService = null;
  }
};
