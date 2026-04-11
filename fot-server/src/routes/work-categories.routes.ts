import { Router } from 'express';
import { workCategoriesController } from '../controllers/work-categories.controller.js';
import { authenticate, requirePosition } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePosition('worker', 'header', 'hr', 'admin', 'super_admin'), workCategoriesController.list);
router.post('/', requirePosition('admin', 'super_admin'), workCategoriesController.create);
router.put('/:code', requirePosition('admin', 'super_admin'), workCategoriesController.update);
router.delete('/:code', requirePosition('admin', 'super_admin'), workCategoriesController.remove);

export default router;
