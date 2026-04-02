import { Response } from 'express';
import { z } from 'zod';
import { chatService } from '../services/chat.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const chatController = {
  /**
   * GET /api/chat/conversations
   */
  async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const conversations = await chatService.getConversations(req.user.id);
      res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
    }
  },

  /**
   * POST /api/chat/conversations
   * Body: { participantId: string }
   */
  async createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { participantId } = z.object({ participantId: z.string().uuid() }).parse(req.body);

      if (participantId === req.user.id) {
        res.status(400).json({ success: false, error: 'Cannot create conversation with yourself' });
        return;
      }

      const conversationId = await chatService.getOrCreateConversation(req.user.id, participantId);
      res.json({ success: true, data: { id: conversationId } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }
      console.error('Create conversation error:', error);
      res.status(500).json({ success: false, error: 'Failed to create conversation' });
    }
  },

  /**
   * GET /api/chat/conversations/:id/messages
   */
  async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await chatService.getMessages(id, req.user.id, limit, offset);
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
  },

  /**
   * POST /api/chat/conversations/:id/messages
   * Body: { content: string }
   */
  async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = z.object({ content: z.string().min(1).max(5000) }).parse(req.body);

      const message = await chatService.sendMessage(id, req.user.id, content);
      res.json({ success: true, data: message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }
      console.error('Send message error:', error);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  },

  /**
   * PATCH /api/chat/conversations/:id/read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await chatService.markAsRead(id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ success: false, error: 'Failed to mark as read' });
    }
  },

  /**
   * GET /api/chat/unread-count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const count = await chatService.getUnreadCount(req.user.id);
      res.json({ success: true, data: { count } });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ success: false, error: 'Failed to get unread count' });
    }
  },

  /**
   * GET /api/chat/users/search?q=...
   */
  async searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const q = (req.query.q as string || '').trim();

      const users = await chatService.searchUsers(q, req.user.id);
      res.json({ success: true, data: users });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ success: false, error: 'Failed to search users' });
    }
  },
};
