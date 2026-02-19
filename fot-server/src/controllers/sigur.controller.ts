import { Response } from 'express';
import { sigurService } from '../services/sigur.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const sigurController = {
  /**
   * GET /api/sigur/test
   * Проверка соединения с Sigur
   */
  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: 'Sigur не настроен. Укажите SIGUR_EXTERNAL_* или SIGUR_INTERNAL_* в .env',
          connections: sigurService.getAvailableConnections(),
        });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const result = await sigurService.testConnection(connection);

      res.json({
        success: result.success,
        message: result.message,
        connection: result.connection,
        connections: sigurService.getAvailableConnections(),
      });
    } catch (error) {
      console.error('Sigur test connection error:', error);
      res.status(500).json({ success: false, error: 'Ошибка проверки подключения к Sigur' });
    }
  },

  /**
   * GET /api/sigur/employees
   * Получить список сотрудников из Sigur
   */
  async getEmployees(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getEmployees(undefined, connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get employees error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения сотрудников из Sigur' });
    }
  },

  /**
   * GET /api/sigur/departments
   * Получить список отделов из Sigur
   */
  async getDepartments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getDepartments(connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get departments error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения отделов из Sigur' });
    }
  },

  /**
   * GET /api/sigur/access-points
   * Получить список точек доступа из Sigur
   */
  async getAccessPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getAccessPoints(connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get access points error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения точек доступа из Sigur' });
    }
  },

  /**
   * GET /api/sigur/events
   * Получить события из Sigur (query: startTime, endTime)
   */
  async getEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const { startTime, endTime, connection: conn } = req.query;
      const connection = (conn as 'external' | 'internal') || undefined;

      const data = await sigurService.getEvents(
        startTime as string | undefined,
        endTime as string | undefined,
        connection,
      );

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get events error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения событий из Sigur' });
    }
  },

  /**
   * GET /api/sigur/events/codes
   * Получить коды событий из Sigur
   */
  async getEventCodes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getEventCodes(connection);

      res.json({ success: true, data });
    } catch (error) {
      console.error('Sigur get event codes error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения кодов событий из Sigur' });
    }
  },

  /**
   * GET /api/sigur/cards
   * Получить карты доступа из Sigur
   */
  async getCards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getCards(undefined, connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get cards error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения карт из Sigur' });
    }
  },

  /**
   * GET /api/sigur/zones
   * Получить зоны доступа из Sigur
   */
  async getZones(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getZones(connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get zones error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения зон из Sigur' });
    }
  },

  /**
   * GET /api/sigur/access-rules
   * Получить режимы доступа из Sigur
   */
  async getAccessRules(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!sigurService.isConfigured()) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const connection = (req.query.connection as 'external' | 'internal') || undefined;
      const data = await sigurService.getAccessRules(connection);

      res.json({ success: true, data, count: data.length });
    } catch (error) {
      console.error('Sigur get access rules error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения режимов доступа из Sigur' });
    }
  },
};
