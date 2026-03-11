import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate as any);

router.get('/conversations', chatController.getConversations as any);
router.post('/conversations', chatController.createConversation as any);
router.get('/conversations/:id/messages', chatController.getMessages as any);
router.post('/conversations/:id/messages', chatController.sendMessage as any);
router.patch('/conversations/:id/read', chatController.markAsRead as any);
router.get('/unread-count', chatController.getUnreadCount as any);
router.get('/users/search', chatController.searchUsers as any);

export default router;
