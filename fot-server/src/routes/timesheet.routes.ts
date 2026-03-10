import { Router } from 'express';
import { timesheetController } from '../controllers/timesheet.controller.js';
import { authenticate, requirePosition, requireOrganization, injectOrganizationFromQuery } from '../middleware/auth.js';

const router = Router();

router.use(authenticate as any);
router.use(injectOrganizationFromQuery as any);
router.use(requireOrganization as any);

// GET /api/timesheet?month=YYYY-MM&department_id=...
router.get(
  '/',
  requirePosition('worker', 'header', 'admin', 'super_admin') as any,
  timesheetController.getAll as any
);

// GET /api/timesheet/export?month=YYYY-MM&department_id=...
router.get(
  '/export',
  requirePosition('header', 'admin', 'super_admin') as any,
  timesheetController.export as any
);

// POST /api/timesheet
router.post(
  '/',
  requirePosition('header', 'admin', 'super_admin') as any,
  timesheetController.create as any
);

// PUT /api/timesheet/:id
router.put(
  '/:id',
  requirePosition('header', 'admin', 'super_admin') as any,
  timesheetController.update as any
);

export default router;
