import { supabase } from '../config/database.js';
import { getIo } from '../socket/io-instance.js';

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

interface ICreateNotification {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export const notificationService = {
  async createMany(items: ICreateNotification[]): Promise<void> {
    if (items.length === 0) return;

    const rows = items.map(n => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      metadata: n.metadata || {},
    }));

    const { data } = await supabase
      .from('notifications')
      .insert(rows)
      .select();

    // Отправляем через Socket.IO каждому получателю
    const io = getIo();
    if (io && data) {
      for (const notification of data) {
        io.to(`user:${notification.user_id}`).emit('notification_new', notification);
      }
    }
  },

  async getByUser(userId: string, limit = 50, offset = 0): Promise<INotification[]> {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return (data || []) as INotification[];
  },

  async countUnread(userId: string): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    return count || 0;
  },

  async markRead(userId: string, notificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
  },

  async markAllRead(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  },
};
