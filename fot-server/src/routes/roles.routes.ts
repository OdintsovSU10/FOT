import { Router } from 'express';
import { rolesController } from '../controllers/roles.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/available-pages', requirePageAccess('/admin/roles', 'view'), rolesController.getAvailablePages);
router.get('/page-access', requirePageAccess('/admin/roles', 'view'), rolesController.getPageAccess);
router.put('/page-access', requirePageAccess('/admin/roles', 'edit'), rolesController.updatePageAccess);
router.get('/permission-catalog', requirePageAccess('/admin/roles', 'view'), rolesController.getPermissionCatalog);

// GET доступен всем аутентифицированным — фронт загружает для canAccess
router.get('/', rolesController.getRoles);
router.post('/', requirePageAccess('/admin/roles', 'edit'), rolesController.createRole);
router.put('/:code', requirePageAccess('/admin/roles', 'edit'), rolesController.updateRole);
router.delete('/:code', requirePageAccess('/admin/roles', 'edit'), rolesController.deleteRole);

export default router;
