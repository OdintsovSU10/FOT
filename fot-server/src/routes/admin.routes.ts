import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Пользователи — доступно admin + super_admin
router.get('/users', requirePageAccess('/admin/users', 'view'), adminController.getAllUsers);
router.get('/users/pending', requirePageAccess('/admin/users', 'view'), adminController.getPendingUsers);
router.post('/users/:id/approve', requirePageAccess('/admin/users', 'edit'), adminController.approveUser);
router.post('/users/:id/reject', requirePageAccess('/admin/users', 'edit'), adminController.rejectUser);
router.delete('/users/:id', requirePageAccess('/admin/users', 'edit'), adminController.deleteUser);
router.post('/users/:id/confirm-email', requirePageAccess('/admin/users', 'edit'), adminController.confirmUserEmail);
router.patch('/users/:id/position', requirePageAccess('/admin/users', 'edit'), adminController.updateUserPosition);
router.patch('/users/:id/name', requirePageAccess('/admin/users', 'edit'), adminController.updateUserName);
router.patch('/users/:id/chat-inbound-mode', requirePageAccess('/admin/users', 'edit'), adminController.updateUserChatInboundMode);
router.patch('/users/:id/employee', requirePageAccess('/admin/users', 'edit'), adminController.updateUserEmployee);
router.patch('/users/:id/department', requirePageAccess('/admin/users', 'edit'), adminController.updateEmployeeDepartment);

// 2FA управление
router.post('/users/:id/generate-2fa', requirePageAccess('/admin/users', 'edit'), adminController.generate2FA);
router.post('/users/:id/disable-2fa', requirePageAccess('/admin/users', 'edit'), adminController.disable2FA);

// Поиск сотрудников (для привязки при одобрении)
router.get('/employees/search', requirePageAccess('/admin/users', 'view'), adminController.searchUnlinkedEmployees);

// Аудит логи
router.get('/audit-logs', requirePageAccess('/admin/audit', 'view'), adminController.getAuditLogs);

export default router;
