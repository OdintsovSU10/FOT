import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  getSigurIncidentDetails,
  getSigurMonitorStatus,
  listSigurHealthChecks,
  listSigurIncidents,
} from '../services/sigur-monitor.service.js';

function parseLimit(raw: unknown, fallback = 20, max = 200): number {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, max);
}

function parseOffset(raw: unknown): number {
  const value = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export const sigurMonitorController = {
  async getStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await getSigurMonitorStatus();
      res.json({ success: true, data });
    } catch (error) {
      console.error('sigurMonitor.getStatus error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения статуса мониторинга Sigur' });
    }
  },

  async getIncidents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const limit = parseLimit(req.query.limit, 20, 100);
      const offset = parseOffset(req.query.offset);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const source = typeof req.query.source === 'string' ? req.query.source : undefined;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const { data, count } = await listSigurIncidents({ limit, offset, status, source, startDate, endDate });
      res.json({
        success: true,
        data,
        pagination: {
          limit,
          offset,
          total: count,
        },
      });
    } catch (error) {
      console.error('sigurMonitor.getIncidents error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения инцидентов Sigur' });
    }
  },

  async getIncidentById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const incidentId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(incidentId) || incidentId <= 0) {
        res.status(400).json({ success: false, error: 'Некорректный incident id' });
        return;
      }

      const data = await getSigurIncidentDetails(incidentId);
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка получения инцидента Sigur';
      const isNotFound = message.toLowerCase().includes('not found');
      if (isNotFound) {
        res.status(404).json({ success: false, error: 'Инцидент Sigur не найден' });
        return;
      }

      console.error('sigurMonitor.getIncidentById error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения инцидента Sigur' });
    }
  },

  async getChecks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const limit = parseLimit(req.query.limit, 50, 200);
      const offset = parseOffset(req.query.offset);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const source = typeof req.query.source === 'string' ? req.query.source : undefined;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const { data, count } = await listSigurHealthChecks({ limit, offset, status, source, startDate, endDate });
      res.json({
        success: true,
        data,
        pagination: {
          limit,
          offset,
          total: count,
        },
      });
    } catch (error) {
      console.error('sigurMonitor.getChecks error:', error);
      res.status(500).json({ success: false, error: 'Ошибка получения журнала проверок Sigur' });
    }
  },
};
