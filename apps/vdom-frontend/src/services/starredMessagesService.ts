import ApiLinks from "../network/apiLinks";
import { AuthManager } from "../utils/auth";

interface StarredMessagesResponse {
  status: number;
  message: string;
  data: string[];
}

class StarredMessagesService {
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

  static async fetchStarredMessages(): Promise<StarredMessagesResponse> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(ApiLinks.GET_STARRED_MESSAGES, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching starred messages:', error);
      throw error;
    }
  }

  static async addStarredMessage(message: string): Promise<StarredMessagesResponse> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(ApiLinks.ADD_STARRED_MESSAGE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding starred message:', error);
      throw error;
    }
  }

  static async removeStarredMessage(message: string): Promise<StarredMessagesResponse> {
    if (!AuthManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const response = await fetch(ApiLinks.REMOVE_STARRED_MESSAGE, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error removing starred message:', error);
      throw error;
    }
  }
}

export default StarredMessagesService;
