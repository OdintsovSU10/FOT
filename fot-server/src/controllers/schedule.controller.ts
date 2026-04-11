/**
 * Контроллер графиков работы: CRUD шаблонов, назначение отделам/сотрудникам.
 */
import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/database.js';
import { resolveSchedule, resolveSchedulesBulk } from '../services/schedule.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const scheduleTypeEnum = z.enum(['office', 'remote', 'hybrid', 'shift']);
const patternTypeEnum = z.enum(['5+0', '5+2', '6+0', 'custom']);
const workCategoryCodeSchema = z.string().min(1).max(50).regex(/^[a-z0-9_]+$/);
const weekDayArray = z.array(z.number().int().min(1).max(7)).min(1).max(7);

const dayOverrideSchema = z.object({
  work_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  work_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  work_hours: z.number().min(0.5).max(24),
});

const baseScheduleSchema = z.object({
  name: z.string().min(1).max(100),
  schedule_type: scheduleTypeEnum,
  work_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  work_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  work_hours: z.number().min(0.5).max(24),
  work_days: weekDayArray,
  office_days: weekDayArray.nullable().optional(),
  late_threshold_minutes: z.number().int().min(0).max(120).optional(),
  day_overrides: z.record(z.string().regex(/^[1-7]$/), dayOverrideSchema).nullable().optional(),
  lunch_minutes: z.number().int().min(0).max(240).optional(),
  respects_holidays: z.boolean().optional(),
  pattern_type: patternTypeEnum.optional(),
  expected_saturdays_per_month: z.number().int().min(0).max(5).optional(),
});

const createScheduleSchema = baseScheduleSchema.refine((data) => {
  if (!data.day_overrides) return true;
  return Object.keys(data.day_overrides).every(k => data.work_days.includes(Number(k)));
}, { message: 'day_overrides keys must be in work_days' });

const assignCategorySchema = z.object({
  schedule_id: z.string().uuid(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Нормализация HH:MM → HH:MM:SS */
const normalizeTime = (t: string): string => (t.length === 5 ? t + ':00' : t);

/** Нормализация day_overrides: time → HH:MM:SS */
const normalizeDayOverrides = (
  overrides: Record<string, { work_start: string; work_end: string; work_hours: number }> | null | undefined,
): Record<string, { work_start: string; work_end: string; work_hours: number }> | null => {
  if (!overrides) return null;
  const result: Record<string, { work_start: string; work_end: string; work_hours: number }> = {};
  for (const [key, val] of Object.entries(overrides)) {
    result[key] = {
      work_start: normalizeTime(val.work_start),
      work_end: normalizeTime(val.work_end),
      work_hours: val.work_hours,
    };
  }
  return result;
};

export const scheduleController = {
  /** GET /api/schedules — шаблоны */
  async list(_req: AuthenticatedRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('[schedules] list error:', err);
      res.status(500).json({ success: false, error: 'Ошибка загрузки графиков' });
    }
  },

  /** POST /api/schedules — создать шаблон */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createScheduleSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues });

      const body = {
        ...parsed.data,
        work_start: normalizeTime(parsed.data.work_start),
        work_end: normalizeTime(parsed.data.work_end),
        day_overrides: normalizeDayOverrides(parsed.data.day_overrides),
      };

      const { data, error } = await supabase
        .from('work_schedules')
        .insert(body)
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('[schedules] create error:', err);
      res.status(500).json({ success: false, error: 'Ошибка создания графика' });
    }
  },

  /** PUT /api/schedules/:id — обновить шаблон */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const parsed = baseScheduleSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues });

      const body: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
      if (parsed.data.work_start) body.work_start = normalizeTime(parsed.data.work_start);
      if (parsed.data.work_end) body.work_end = normalizeTime(parsed.data.work_end);
      if (parsed.data.day_overrides !== undefined) body.day_overrides = normalizeDayOverrides(parsed.data.day_overrides);

      const { data, error } = await supabase
        .from('work_schedules')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('[schedules] update error:', err);
      res.status(500).json({ success: false, error: 'Ошибка обновления графика' });
    }
  },

  /** DELETE /api/schedules/:id — удалить шаблон (если не привязан к категории) */
  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const { count: catCount } = await supabase
        .from('category_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('schedule_id', id);

      if ((catCount || 0) > 0) {
        return res.status(409).json({ success: false, error: 'График привязан к категории труда, удалить нельзя' });
      }

      const { error } = await supabase
        .from('work_schedules')
        .delete()
        .eq('id', id)
        .eq('is_default', false);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('[schedules] remove error:', err);
      res.status(500).json({ success: false, error: 'Ошибка удаления графика' });
    }
  },

  /** GET /api/schedules/resolve/:empId?date=YYYY-MM-DD — resolve для сотрудника */
  async resolve(req: AuthenticatedRequest, res: Response) {
    try {
      const empId = parseInt(req.params.empId);
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const { data: emp } = await supabase
        .from('employees')
        .select('work_category')
        .eq('id', empId)
        .maybeSingle();

      const schedule = await resolveSchedule(
        empId,
        null,
        date,
        (emp?.work_category as string | null) || null,
      );
      res.json({ success: true, data: schedule });
    } catch (err) {
      console.error('[schedules] resolve error:', err);
      res.status(500).json({ success: false, error: 'Ошибка определения графика' });
    }
  },

  /** GET /api/schedules/resolve-bulk?employee_ids=1,2,3&date=YYYY-MM-DD */
  async resolveBulk(req: AuthenticatedRequest, res: Response) {
    try {
      const idsParam = req.query.employee_ids as string;
      if (!idsParam) return res.status(400).json({ success: false, error: 'employee_ids обязателен' });

      const employeeIds = idsParam.split(',').map(Number).filter(n => !isNaN(n));
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const { data: emps } = await supabase
        .from('employees')
        .select('id, work_category')
        .in('id', employeeIds);

      const employees = (emps || []).map(e => ({
        id: e.id as number,
        work_category: (e.work_category as string | null) || null,
      }));
      const schedules = await resolveSchedulesBulk(employees, date);

      const result: Record<number, unknown> = {};
      for (const [id, sched] of schedules) {
        result[id] = sched;
      }

      res.json({ success: true, data: result });
    } catch (err) {
      console.error('[schedules] resolveBulk error:', err);
      res.status(500).json({ success: false, error: 'Ошибка массового определения графиков' });
    }
  },

  /** GET /api/schedules/categories — список привязок category → schedule */
  async listCategories(_req: AuthenticatedRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('category_schedules')
        .select('*, work_schedules(*)')
        .order('category')
        .order('effective_from', { ascending: false });

      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err) {
      console.error('[schedules] listCategories error:', err);
      res.status(500).json({ success: false, error: 'Ошибка загрузки привязок категорий' });
    }
  },

  /** PUT /api/schedules/category/:category — назначить график категории */
  async assignCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const parsedCat = workCategoryCodeSchema.safeParse(req.params.category);
      if (!parsedCat.success) return res.status(400).json({ success: false, error: 'Неверная категория' });

      const parsed = assignCategorySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues });

      await supabase
        .from('category_schedules')
        .update({ effective_to: parsed.data.effective_from })
        .eq('category', parsedCat.data)
        .is('effective_to', null);

      const { data, error } = await supabase
        .from('category_schedules')
        .insert({
          category: parsedCat.data,
          schedule_id: parsed.data.schedule_id,
          effective_from: parsed.data.effective_from,
          effective_to: parsed.data.effective_to || null,
          created_by: req.user.employee_id,
        })
        .select('*, work_schedules(*)')
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('[schedules] assignCategory error:', err);
      res.status(500).json({ success: false, error: 'Ошибка назначения графика категории' });
    }
  },

  /** DELETE /api/schedules/category/:category — закрыть все активные привязки */
  async removeCategoryAssignment(req: AuthenticatedRequest, res: Response) {
    try {
      const parsedCat = workCategoryCodeSchema.safeParse(req.params.category);
      if (!parsedCat.success) return res.status(400).json({ success: false, error: 'Неверная категория' });

      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from('category_schedules')
        .update({ effective_to: today })
        .eq('category', parsedCat.data)
        .is('effective_to', null);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('[schedules] removeCategoryAssignment error:', err);
      res.status(500).json({ success: false, error: 'Ошибка снятия привязки категории' });
    }
  },
};
