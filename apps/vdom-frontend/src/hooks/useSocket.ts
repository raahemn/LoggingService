// useSocket.ts
import { useEffect, useState } from "preact/hooks";
import SocketService from "../services/socketService";

export function useSocket<T = any>(eventName: string) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const socket = SocketService.getSocket();
    if (!socket) return;

    const handler = (payload: T) => {
      setData(payload);
    };

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
    };
  }, [eventName]);

  return data;
}
