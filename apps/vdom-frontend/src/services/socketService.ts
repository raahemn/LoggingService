import { io, Socket } from "socket.io-client";
import { AuthManager } from "../utils/auth";
import ApiLinks from "../network/apiLinks";

class SocketService {
  private static socket: Socket | null = null;

  private static getAuthHeaders(): Record<string, string> {
    const token = AuthManager.getToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  static init(): void {
    if (!AuthManager.isAuthenticated()) {
      throw new Error("User not authenticated");
    }

    console.log("Initializing socket connection...");

    if (!this.socket) {
      this.socket = io(ApiLinks.SOCKET, {
        transports: ["websocket"],
        auth: { token: `Bearer ${AuthManager.getToken()}` },
      });

      this.socket.on("connect", () => {
        console.log("✅ Socket connected:", this.socket?.id);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
      });

      this.socket.on("connect_error", (err) => {
        console.error("⚠️ Socket connection error:", err.message);
      });
    }
  }

  static getSocket(): Socket | null {
    return this.socket;
  }

  static disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default SocketService;
