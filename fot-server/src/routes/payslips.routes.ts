import { Router } from 'express';
import { payslipsController } from '../controllers/payslips.controller.js';
import { authenticate, requirePosition } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/my', requirePosition('worker', 'header', 'hr', 'admin', 'super_admin'), payslipsController.getMy);
router.get('/employee/:empId', requirePosition('hr', 'admin', 'super_admin'), payslipsController.getByEmployee);
router.post('/', requirePosition('hr', 'admin', 'super_admin'), payslipsController.create);
router.post('/import', requirePosition('hr', 'admin', 'super_admin'), payslipsController.importBatch);
router.post('/generate', requirePosition('admin', 'super_admin'), payslipsController.generate);

export default router;
