import { Router } from 'express';
import { salaryRaiseController } from '../controllers/salary-raise.controller.js';
import { authenticate, requireAnyPageAccess, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/candidates', requirePageAccess('/employee/salary-raise', 'view'), salaryRaiseController.getCandidates);
router.get('/objects', requirePageAccess('/employee/salary-raise', 'view'), salaryRaiseController.getObjects);

router.post('/', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.create);
router.get('/my', requirePageAccess('/employee/salary-raise', 'view'), salaryRaiseController.getMy);

router.get('/pending', requirePageAccess('/salary-raise-review', 'view'), salaryRaiseController.getPending);
router.get('/', requirePageAccess('/salary-raise-review', 'view'), salaryRaiseController.getAll);

router.get(
  '/:id',
  requireAnyPageAccess(['/employee/salary-raise', '/salary-raise-review'], 'view'),
  salaryRaiseController.getById,
);

router.get(
  '/:id/review-context',
  requirePageAccess('/salary-raise-review', 'view'),
  salaryRaiseController.getReviewContext,
);

router.put('/:id', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.update);
router.patch('/:id/submit', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.submit);
router.patch('/:id/cancel', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.cancel);
router.patch('/:id/admin-review', requirePageAccess('/salary-raise-review', 'edit'), salaryRaiseController.adminReview);

export default router;
