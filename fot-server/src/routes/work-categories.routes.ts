import { Router } from 'express';
import { workCategoriesController } from '../controllers/work-categories.controller.js';
import { authenticate, requireAnyPageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requireAnyPageAccess(['/admin/schedules', '/staff-control'], 'view'), workCategoriesController.list);
router.post('/', requireAnyPageAccess(['/admin/schedules', '/staff-control'], 'edit'), workCategoriesController.create);
router.put('/:code', requireAnyPageAccess(['/admin/schedules', '/staff-control'], 'edit'), workCategoriesController.update);
router.delete('/:code', requireAnyPageAccess(['/admin/schedules', '/staff-control'], 'edit'), workCategoriesController.remove);

export default router;
