import { apiClient } from '../api/client';

export interface INotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface IListResponse {
  success: boolean;
  data: INotification[];
}

interface ICountResponse {
  success: boolean;
  data: { count: number };
}

export const notificationApi = {
  getAll(limit = 50, offset = 0) {
    return apiClient.get<IListResponse>(`/notifications?limit=${limit}&offset=${offset}`);
  },

  getUnreadCount() {
    return apiClient.get<ICountResponse>('/notifications/unread-count');
  },

  markRead(id: string) {
    return apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead() {
    return apiClient.patch('/notifications/read-all');
  },
};
