import { Router } from 'express';
import { salaryRaiseController } from '../controllers/salary-raise.controller.js';
import { authenticate, requireAnyPageAccess, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// POST /api/salary-raise — создать заявку (worker+)
router.post('/', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.create);

// GET /api/salary-raise/my — мои заявки (worker+)
router.get('/my', requirePageAccess('/employee/salary-raise', 'view'), salaryRaiseController.getMy);

// GET /api/salary-raise/pending — на рассмотрении (header+)
router.get('/pending', requirePageAccess('/salary-raise-review', 'view'), salaryRaiseController.getPending);

// GET /api/salary-raise — все заявки (hr+)
router.get('/', requirePageAccess('/salary-raise-review', 'view'), salaryRaiseController.getAll);

// GET /api/salary-raise/:id — одна заявка (worker+)
router.get(
  '/:id',
  requireAnyPageAccess(['/employee/salary-raise', '/salary-raise-review'], 'view'),
  salaryRaiseController.getById,
);

// PUT /api/salary-raise/:id — обновить черновик (worker+)
router.put('/:id', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.update);

// PATCH /api/salary-raise/:id/submit — отправить (worker+)
router.patch('/:id/submit', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.submit);

// PATCH /api/salary-raise/:id/cancel — отменить (worker+)
router.patch('/:id/cancel', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.cancel);

// PATCH /api/salary-raise/:id/supervisor-review — рецензия руководителя (header+)
router.patch('/:id/supervisor-review', requirePageAccess('/salary-raise-review', 'edit'), salaryRaiseController.supervisorReview);

// PATCH /api/salary-raise/:id/hr-review — рецензия HR (hr+)
router.patch('/:id/hr-review', requirePageAccess('/salary-raise-review', 'edit'), salaryRaiseController.hrReview);

// PATCH /api/salary-raise/:id/finance-review — рецензия финансов (admin+)
router.patch('/:id/finance-review', requirePageAccess('/salary-raise-review', 'edit'), salaryRaiseController.financeReview);

// POST /api/salary-raise/:id/upload-url — presigned URL для загрузки (worker+)
router.post('/:id/upload-url', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.getUploadUrl);

// POST /api/salary-raise/:id/attachments — подтвердить загрузку (worker+)
router.post('/:id/attachments', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.confirmAttachment);

// GET /api/salary-raise/:id/attachments — список вложений (worker+)
router.get(
  '/:id/attachments',
  requireAnyPageAccess(['/employee/salary-raise', '/salary-raise-review'], 'view'),
  salaryRaiseController.getAttachments,
);

// DELETE /api/salary-raise/:id/attachments/:aid — удалить вложение (worker+)
router.delete('/:id/attachments/:aid', requirePageAccess('/employee/salary-raise', 'edit'), salaryRaiseController.deleteAttachment);

export default router;
