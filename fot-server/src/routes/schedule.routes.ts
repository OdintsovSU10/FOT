import { Router } from 'express';
import { scheduleController } from '../controllers/schedule.controller.js';
import { authenticate, requirePosition, requireOrganization, injectOrganizationFromQuery } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(injectOrganizationFromQuery);
router.use(requireOrganization);

// Шаблоны графиков
router.get('/', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.list);
router.post('/', requirePosition('admin', 'super_admin'), scheduleController.create);
router.put('/:id', requirePosition('admin', 'super_admin'), scheduleController.update);
router.delete('/:id', requirePosition('admin', 'super_admin'), scheduleController.remove);

// Графики отделов
router.get('/department/:deptId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.getDepartmentSchedule);
router.put('/department/:deptId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.assignDepartment);

// Графики сотрудников
router.get('/employee/:empId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.getEmployeeSchedule);
router.put('/employee/:empId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.assignEmployee);
router.delete('/employee/:empId/:schedId', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.removeEmployeeOverride);

// Resolve
router.get('/resolve/:empId', requirePosition('worker', 'header', 'hr', 'admin', 'super_admin'), scheduleController.resolve);
router.get('/resolve-bulk', requirePosition('header', 'hr', 'admin', 'super_admin'), scheduleController.resolveBulk);

export default router;
