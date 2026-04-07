import { Router } from 'express';
import { productionCalendarController } from '../controllers/production-calendar.controller.js';
import { authenticate, requirePosition } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePosition('header', 'hr', 'admin', 'super_admin'), productionCalendarController.getByYear);
router.put('/:year/:month', requirePosition('admin', 'super_admin'), productionCalendarController.update);

export default router;
