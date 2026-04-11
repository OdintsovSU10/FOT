import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller.js';
import { authenticate, requirePosition } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Шаблоны графиков
router.get('/', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.list);
router.get('/employees', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.listEmployeeAssignments);
router.put('/employee/:employeeId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.assignEmployee);
router.delete('/employee/:employeeId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.removeEmployeeAssignment);
router.post('/', requirePosition('admin', 'super_admin'), scheduleController.create);
router.put('/:id', requirePosition('admin', 'super_admin'), scheduleController.update);
router.delete('/:id', requirePosition('admin', 'super_admin'), scheduleController.remove);

// Графики категорий труда
router.get('/categories', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.listCategories);
router.put('/category/:category', requirePosition('admin', 'super_admin'), scheduleController.assignCategory);
router.delete('/category/:category', requirePosition('admin', 'super_admin'), scheduleController.removeCategoryAssignment);

// Resolve
router.get('/resolve/:empId', requirePosition('worker', 'header', 'hr', 'admin', 'super_admin'), scheduleController.resolve);
router.get('/resolve-bulk', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.resolveBulk);

export default router;
