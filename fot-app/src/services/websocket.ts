import { io, Socket } from 'socket.io-client';

type MessageHandler = (payload: unknown) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
    }

    this.token = token;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const url = new URL(apiUrl);
    const baseUrl = `${url.protocol}//${url.host}`;

    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
    });
  }

  send(type: string, payload: unknown, callback?: (response: unknown) => void): void {
    if (!this.socket?.connected) return;
    if (callback) {
      this.socket.emit(type, payload, callback);
    } else {
      this.socket.emit(type, payload);
    }
  }

  on(type: string, callback: MessageHandler): () => void {
    if (!this.socket) return () => {};
    this.socket.on(type, callback);
    return () => {
      this.socket?.off(type, callback);
    };
  }

  disconnect(): void {
    this.token = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsService = new WebSocketService();
