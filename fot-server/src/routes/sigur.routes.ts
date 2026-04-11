import { Router } from 'express';
import { sigurController } from '../controllers/sigur.controller.js';
import { sigurMonitorController } from '../controllers/sigur-monitor.controller.js';
import { sigurSyncController } from '../controllers/sigur-sync.controller.js';
import { sigurAdminController } from '../controllers/sigur-admin.controller.js';
import { sigurFilterController } from '../controllers/sigur-filter.controller.js';
import { authenticate, requirePageAccess } from '../middleware/auth.js';

const router = Router();

// Все роуты требуют аутентификации и page access на настройки СКУД
router.use(authenticate);

// === Read-only эндпоинты ===

// === Monitor эндпоинты (admin+) ===

router.get('/monitor/status', requirePageAccess('/skud-monitor', 'view'), sigurMonitorController.getStatus);
router.get('/monitor/incidents', requirePageAccess('/skud-monitor', 'view'), sigurMonitorController.getIncidents);
router.get('/monitor/incidents/:id', requirePageAccess('/skud-monitor', 'view'), sigurMonitorController.getIncidentById);
router.get('/monitor/checks', requirePageAccess('/skud-monitor', 'view'), sigurMonitorController.getChecks);

// GET /api/sigur/stream?type=employees — SSE-стриминг с прогрессом
router.get('/stream', requirePageAccess('/skud-settings', 'view'), sigurController.stream);

// GET /api/sigur/test — проверка подключения
router.get('/test', requirePageAccess('/skud-settings', 'view'), sigurController.testConnection);

// GET /api/sigur/employees — сотрудники Sigur
router.get('/employees', requirePageAccess('/skud-settings', 'view'), sigurController.getEmployees);

// GET /api/sigur/departments — отделы Sigur
router.get('/departments', requirePageAccess('/skud-settings', 'view'), sigurController.getDepartments);

// GET /api/sigur/access-points — точки доступа
router.get('/access-points', requirePageAccess('/skud-settings', 'view'), sigurController.getAccessPoints);

// GET /api/sigur/events — события (query: startTime, endTime)
router.get('/events', requirePageAccess('/skud-settings', 'view'), sigurController.getEvents);

// GET /api/sigur/events/types — типы событий
router.get('/events/types', requirePageAccess('/skud-settings', 'view'), sigurController.getEventTypes);

// GET /api/sigur/cards — карты доступа
router.get('/cards', requirePageAccess('/skud-settings', 'view'), sigurController.getCards);

// GET /api/sigur/zones — зоны доступа
router.get('/zones', requirePageAccess('/skud-settings', 'view'), sigurController.getZones);

// GET /api/sigur/access-rules — режимы доступа
router.get('/access-rules', requirePageAccess('/skud-settings', 'view'), sigurController.getAccessRules);

// GET /api/sigur/discover — диагностика полей Sigur API
router.get('/discover', requirePageAccess('/skud-settings', 'view'), sigurController.discover);

// GET /api/sigur/preview — предпросмотр сырых данных Sigur
router.get('/preview', requirePageAccess('/skud-settings', 'view'), sigurController.preview);

// === Sync эндпоинты ===

// POST /api/sigur/sync-all — полная синхронизация структуры (SSE)
router.post('/sync-all', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.syncAll);

// POST /api/sigur/sync — синхронизация событий из Sigur в БД
router.post('/sync', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.sync);

// POST /api/sigur/clear-events — удаление событий за период
router.post('/clear-events', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.clearEvents);

// POST /api/sigur/sync-employees — импорт сотрудников из Sigur в БД
router.post('/sync-employees', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.syncEmployees);

// POST /api/sigur/sync-departments — импорт отделов с иерархией
router.post('/sync-departments', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.syncDepartments);

// POST /api/sigur/sync-positions — импорт должностей из Sigur
router.post('/sync-positions', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.syncPositions);

// POST /api/sigur/match-employees — ручное сопоставление сотрудников
router.post('/match-employees', requirePageAccess('/skud-settings', 'edit'), sigurSyncController.matchEmployees);

// === Фильтр синхронизации ===

// GET /api/sigur/sync-filter — текущий whitelist отделов для синхронизации
router.get('/sync-filter', requirePageAccess('/skud-settings', 'view'), sigurFilterController.getFilter);

// PUT /api/sigur/sync-filter — замена whitelist отделов
router.put('/sync-filter', requirePageAccess('/skud-settings', 'edit'), sigurFilterController.updateFilter);

// === Admin эндпоинты ===

// POST /api/sigur/seed-positions — предзаполнение справочника должностей
router.post('/seed-positions', requirePageAccess('/skud-settings', 'edit'), sigurAdminController.seedPositions);

export default router;
