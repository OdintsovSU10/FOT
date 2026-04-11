import { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  createTravelObject,
  createTravelRoute,
  deleteTravelObject,
  deleteTravelRoute,
  listTravelObjects,
  listTravelRoutes,
  listTravelSegments,
  rebuildTravelSegmentsForScope,
  updateTravelObject,
  updateTravelRoute,
} from '../services/skud-travel.service.js';

const monthRegex = /^\d{4}-\d{2}$/;

const createObjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
});

const updateObjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  access_points: z.array(z.string().trim().min(1).max(255)).max(500).default([]),
});

const saveRouteSchema = z.object({
  from_object_id: z.string().uuid(),
  to_object_id: z.string().uuid(),
  travel_minutes: z.number().int().positive().max(1440),
});

const segmentQuerySchema = z.object({
  month: z.string().regex(monthRegex),
  department_id: z.string().uuid().optional(),
  employee_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['auto_approved', 'delayed', 'needs_object', 'needs_route', 'problem']).optional(),
});

export const skudTravelController = {
  async getTravelObjects(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await listTravelObjects();
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки объектов';
      console.error('getTravelObjects error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async createTravelObject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const parsed = createObjectSchema.parse(req.body);
      const data = await createTravelObject(parsed.name);
      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные данные объекта', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка создания объекта';
      console.error('createTravelObject error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async updateTravelObject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const objectId = z.string().uuid().parse(req.params.id);
      const parsed = updateObjectSchema.parse(req.body);
      const data = await updateTravelObject({
        objectId,
        name: parsed.name,
        accessPoints: parsed.access_points,
      });
      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные данные объекта', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка сохранения объекта';
      console.error('updateTravelObject error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async deleteTravelObject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const objectId = z.string().uuid().parse(req.params.id);
      await deleteTravelObject(objectId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректный id объекта', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка удаления объекта';
      console.error('deleteTravelObject error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async getTravelRoutes(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await listTravelRoutes();
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка загрузки маршрутов';
      console.error('getTravelRoutes error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async createTravelRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const parsed = saveRouteSchema.parse(req.body);
      const data = await createTravelRoute({
        fromObjectId: parsed.from_object_id,
        toObjectId: parsed.to_object_id,
        travelMinutes: parsed.travel_minutes,
      });
      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные данные маршрута', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка создания маршрута';
      console.error('createTravelRoute error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async updateTravelRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const routeId = z.string().uuid().parse(req.params.id);
      const parsed = saveRouteSchema.parse(req.body);
      const data = await updateTravelRoute({
        routeId,
        fromObjectId: parsed.from_object_id,
        toObjectId: parsed.to_object_id,
        travelMinutes: parsed.travel_minutes,
      });
      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные данные маршрута', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка сохранения маршрута';
      console.error('updateTravelRoute error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async deleteTravelRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const routeId = z.string().uuid().parse(req.params.id);
      await deleteTravelRoute(routeId);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректный id маршрута', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка удаления маршрута';
      console.error('deleteTravelRoute error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async getTravelSegments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const raw = segmentQuerySchema.parse({
        month: req.query.month,
        department_id: req.user.position_type === 'header' && req.user.department_id
          ? req.user.department_id
          : req.query.department_id,
        employee_id: req.query.employee_id,
        status: req.query.status,
      });

      const data = await listTravelSegments({
        month: raw.month,
        departmentId: raw.department_id || null,
        employeeId: raw.employee_id || null,
        status: raw.status,
      });

      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные параметры выборки', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка загрузки передвижений';
      console.error('getTravelSegments error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },

  async rebuildTravelSegments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const raw = segmentQuerySchema.parse({
        month: req.body?.month,
        department_id: req.user.position_type === 'header' && req.user.department_id
          ? req.user.department_id
          : req.body?.department_id,
        employee_id: req.body?.employee_id,
      });

      const data = await rebuildTravelSegmentsForScope({
        month: raw.month,
        departmentId: raw.department_id || null,
        employeeId: raw.employee_id || null,
      });

      res.json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: 'Некорректные параметры пересчёта', details: error.errors });
        return;
      }
      const message = error instanceof Error ? error.message : 'Ошибка пересчёта передвижений';
      console.error('rebuildTravelSegments error:', error);
      res.status(500).json({ success: false, error: message });
    }
  },
};
