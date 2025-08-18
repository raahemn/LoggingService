import ApiLinks from "../network/apiLinks";
import { AuthManager } from "../utils/auth";

interface ChatRequest {
  message: string;
}

interface ChatResponse {
  response: string;
  toolCalls?: string[];
  pendingOperation?: PendingOperation;
}

interface PendingOperation {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  userId: string;
  timestamp: Date;
}

interface ChatApiResponse {
  status: number;
  message: string;
  data: ChatResponse;
}

class ChatbotService {
  private static getAuthHeaders(): HeadersInit {
    const token = AuthManager.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  static async sendMessage(message: string): Promise<ChatResponse> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message is required');
    }

    try {
      const response = await fetch(ApiLinks.CHAT_MESSAGE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message: message.trim() })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatApiResponse = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  static async confirmOperation(operationId: string): Promise<{ response: string; toolCalls?: string[]; pendingOperation?: PendingOperation }> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${ApiLinks.API_BASE_URL}/chatbot/operations/${operationId}/confirm`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error confirming operation:', error);
      throw error;
    }
  }

  static async cancelOperation(operationId: string): Promise<void> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(`${ApiLinks.API_BASE_URL}/chatbot/operations/${operationId}/cancel`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error cancelling operation:', error);
      throw error;
    }
  }
}

export default ChatbotService;
export type { ChatRequest, ChatResponse, ChatApiResponse, PendingOperation };
