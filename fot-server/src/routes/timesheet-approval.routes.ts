import { Router } from 'express';
import { timesheetApprovalController } from '../controllers/timesheet-approval.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// POST /api/timesheet-approvals/submit — header подтверждает
router.post('/submit', requirePageAccess('/timesheet', 'edit'), timesheetApprovalController.submit);

// GET /api/timesheet-approvals/status — статус по отделу + период
router.get('/status', requirePageAccess('/timesheet', 'view'), timesheetApprovalController.getStatus);

// GET /api/timesheet-approvals/pending — hr: все неутверждённые
router.get('/pending', requirePageAccess('/timesheet-hr', 'view'), timesheetApprovalController.getPending);

// GET /api/timesheet-approvals/list?status=... — hr: список по статусу
router.get('/list', requirePageAccess('/timesheet-hr', 'view'), timesheetApprovalController.getByStatus);

// POST /api/timesheet-approvals/:id/approve — hr утверждает
router.post('/:id/approve', requirePageAccess('/timesheet-hr', 'edit'), timesheetApprovalController.approve);

// POST /api/timesheet-approvals/:id/reject — hr отклоняет
router.post('/:id/reject', requirePageAccess('/timesheet-hr', 'edit'), timesheetApprovalController.reject);

export default router;
