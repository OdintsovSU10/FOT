import { Router } from 'express';
import { timesheetApprovalController } from '../controllers/timesheet-approval.controller.js';
import {
  authenticate,
  requireAnyPermission,
  requirePageAccess,
  requirePermission,
} from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/timesheet-approvals/responsibles — ответственные по отделу
router.get('/responsibles', requirePageAccess('/admin/settings', 'view'), timesheetApprovalController.getResponsibles);

// GET /api/timesheet-approvals/responsibles/candidates — кандидаты из отдела
router.get('/responsibles/candidates', requirePageAccess('/admin/settings', 'view'), timesheetApprovalController.getResponsibleCandidates);

// PUT /api/timesheet-approvals/responsibles — сохранить ответственных по отделу
router.put('/responsibles', requirePageAccess('/admin/settings', 'edit'), timesheetApprovalController.saveResponsibles);

// POST /api/timesheet-approvals/submit — header подтверждает
router.post('/submit', requirePermission('timesheet.workflow.submit'), timesheetApprovalController.submit);

// GET /api/timesheet-approvals/status — статус по отделу + период
router.get('/status', requirePageAccess('/timesheet', 'view'), timesheetApprovalController.getStatus);

// GET /api/timesheet-approvals/pending — hr: все неутверждённые
router.get('/pending', requireAnyPermission(['timesheet.workflow.monitor', 'timesheet.workflow.review']), timesheetApprovalController.getPending);

// GET /api/timesheet-approvals/list?status=... — hr: список по статусу
router.get('/list', requireAnyPermission(['timesheet.workflow.monitor', 'timesheet.workflow.review']), timesheetApprovalController.getByStatus);

// GET /api/timesheet-approvals/:id/history — hr: история согласования
router.get('/:id/history', requireAnyPermission(['timesheet.workflow.monitor', 'timesheet.workflow.review']), timesheetApprovalController.getHistory);

// POST /api/timesheet-approvals/:id/approve — утверждение табеля ответственным/HR
router.post('/:id/approve', requirePermission('timesheet.workflow.review'), timesheetApprovalController.approve);

// POST /api/timesheet-approvals/:id/reject — отклонение табеля ответственным/HR
router.post('/:id/reject', requirePermission('timesheet.workflow.review'), timesheetApprovalController.reject);

// POST /api/timesheet-approvals/:id/return-to-rework — возврат табеля на доработку ответственным/HR
router.post('/:id/return-to-rework', requirePermission('timesheet.workflow.review'), timesheetApprovalController.returnToRework);

export default router;
