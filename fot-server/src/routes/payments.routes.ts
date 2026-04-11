import { Router } from 'express';
import { paymentsController } from '../controllers/payments.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/my', requirePageAccess('/employee/payments', 'view'), paymentsController.getMy);
router.get('/employee/:empId', requirePageAccess('/admin/payslips', 'view'), paymentsController.getByEmployee);
router.post('/', requirePageAccess('/admin/payslips', 'edit'), paymentsController.create);
router.post('/import', requirePageAccess('/admin/payslips', 'edit'), paymentsController.importBatch);

export default router;
