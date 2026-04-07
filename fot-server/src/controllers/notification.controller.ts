import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { notificationService } from '../services/notification.service.js';

const getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const data = await notificationService.getByUser(req.user.id, limit, offset);
    res.json({ success: true, data });
  } catch (err) {
    console.error('notifications.getAll error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения уведомлений' });
  }
};

const getUnreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const count = await notificationService.countUnread(req.user.id);
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error('notifications.getUnreadCount error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения счётчика' });
  }
};

const markRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await notificationService.markRead(req.user.id, id);
    res.json({ success: true });
  } catch (err) {
    console.error('notifications.markRead error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления' });
  }
};

const markAllRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await notificationService.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('notifications.markAllRead error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления' });
  }
};

export const notificationController = { getAll, getUnreadCount, markRead, markAllRead };
