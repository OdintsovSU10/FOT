import { Response } from 'express';
import {
  seedPositionsLogic,
} from '../services/sigur-sync.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const sigurAdminController = {
  /**
   * POST /api/sigur/seed-positions
   * Предзаполнение справочника должностей строительной организации
   */
  async seedPositions(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await seedPositionsLogic();
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Sigur seedPositions error:', error);
      res.status(500).json({ success: false, error: 'Ошибка создания справочника должностей' });
    }
  },
};
