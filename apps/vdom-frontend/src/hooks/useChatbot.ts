import { useState } from "preact/hooks";
import ChatbotService, { ChatResponse, PendingOperation } from "../services/chatbotService";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  pendingOperation?: PendingOperation;
}

export const useChatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (messageText: string): Promise<void> => {
    if (!messageText.trim()) return;

    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await ChatbotService.sendMessage(messageText);
      
      // Add AI response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.response,
        isUser: false,
        timestamp: new Date(),
        pendingOperation: response.pendingOperation
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error processing your message. Please try again.',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const confirmOperation = async (operationId: string): Promise<void> => {
    setLoading(true);
    try {
      const result = await ChatbotService.confirmOperation(operationId);
      
      // The result now contains an LLM-generated response and potentially another pending operation
      const confirmMessage: Message = {
        id: Date.now().toString(),
        text: result.response || 'Operation completed successfully.',
        isUser: false,
        timestamp: new Date(),
        pendingOperation: result.pendingOperation // Handle chained operations
      };

      setMessages(prev => [...prev, confirmMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm operation');
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: '❌ Failed to execute the operation. Please try again or contact support if the issue persists.',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const cancelOperation = async (operationId: string): Promise<void> => {
    try {
      await ChatbotService.cancelOperation(operationId);
      
      // Add cancellation message
      const cancelMessage: Message = {
        id: Date.now().toString(),
        text: '🚫 Operation has been cancelled. No changes were made to the database.',
        isUser: false,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, cancelMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel operation');
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    confirmOperation,
    cancelOperation,
    clearMessages
  };
};
