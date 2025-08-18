import { useState, useEffect } from "preact/hooks";
import StarredMessagesService from "../services/starredMessagesService";

export const useStarredMessages = () => {
  const [starredMessages, setStarredMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStarredMessages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await StarredMessagesService.fetchStarredMessages();
      setStarredMessages(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch starred messages');
    } finally {
      setLoading(false);
    }
  };

  const addStarredMessage = async (message: string) => {
    try {
      const response = await StarredMessagesService.addStarredMessage(message);
      setStarredMessages(response.data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add starred message');
      throw err;
    }
  };

  const removeStarredMessage = async (message: string) => {
    try {
      const response = await StarredMessagesService.removeStarredMessage(message);
      setStarredMessages(response.data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove starred message');
      throw err;
    }
  };

  const isMessageStarred = (message: string): boolean => {
    return starredMessages.includes(message);
  };

  return {
    starredMessages,
    loading,
    error,
    fetchStarredMessages,
    addStarredMessage,
    removeStarredMessage,
    isMessageStarred
  };
};
