import { Router } from 'express';
import { productionCalendarController } from '../controllers/production-calendar.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePageAccess('/admin/schedules', 'view'), productionCalendarController.getByYear);
router.put('/:year/:month', requirePageAccess('/admin/schedules', 'edit'), productionCalendarController.update);

export default router;
