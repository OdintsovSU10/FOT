import { apiClient } from '../api/client';

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface IChatConversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants: { user_id: string; full_name: string | null }[];
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

export interface IChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface IChatUser {
  id: string;
  full_name: string | null;
}

export const chatService = {
  async getConversations(): Promise<IChatConversation[]> {
    const res = await apiClient.get<ApiResponse<IChatConversation[]>>('/chat/conversations');
    return res.data || [];
  },

  async createConversation(participantId: string): Promise<string> {
    const res = await apiClient.post<ApiResponse<{ id: string }>>('/chat/conversations', { participantId });
    return res.data.id;
  },

  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<IChatMessage[]> {
    const res = await apiClient.get<ApiResponse<IChatMessage[]>>(
      `/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    );
    return res.data || [];
  },

  async sendMessage(conversationId: string, content: string): Promise<IChatMessage> {
    const res = await apiClient.post<ApiResponse<IChatMessage>>(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return res.data;
  },

  async markAsRead(conversationId: string): Promise<void> {
    await apiClient.patch(`/chat/conversations/${conversationId}/read`);
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<{ count: number }>>('/chat/unread-count');
    return res.data.count;
  },

  async searchUsers(query: string): Promise<IChatUser[]> {
    const res = await apiClient.get<ApiResponse<IChatUser[]>>(`/chat/users/search?q=${encodeURIComponent(query)}`);
    return res.data || [];
  },
};
