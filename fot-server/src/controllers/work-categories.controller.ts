/**
 * Контроллер категорий труда (work_categories).
 * CRUD для динамического списка категорий, к которым привязываются графики работы.
 */
import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/database.js';
import type { AuthenticatedRequest } from '../types/index.js';

const codeSchema = z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, 'Только a-z, 0-9, _');
const nameSchema = z.string().min(1).max(100);

const createSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  description: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

const updateSchema = z.object({
  code: codeSchema.optional(),
  name: nameSchema.optional(),
  description: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
});

export const workCategoriesController = {
  /** GET /api/work-categories */
  async list(_req: AuthenticatedRequest, res: Response) {
    try {
      const { data, error } = await supabase
        .from('work_categories')
        .select('code, name, description, sort_order, is_active, created_at, updated_at')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.json({ success: true, data: data || [] });
    } catch (err) {
      console.error('[work-categories] list error:', err);
      res.status(500).json({ success: false, error: 'Ошибка загрузки категорий' });
    }
  },

  /** POST /api/work-categories */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues });
        return;
      }
      const { data, error } = await supabase
        .from('work_categories')
        .insert(parsed.data)
        .select()
        .single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (err) {
      console.error('[work-categories] create error:', err);
      res.status(500).json({ success: false, error: 'Ошибка создания категории' });
    }
  },

  /** PUT /api/work-categories/:code */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { code } = req.params;
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.issues });
        return;
      }
      const { data, error } = await supabase
        .from('work_categories')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('code', code)
        .select()
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (err) {
      console.error('[work-categories] update error:', err);
      res.status(500).json({ success: false, error: 'Ошибка обновления категории' });
    }
  },

  /** DELETE /api/work-categories/:code — удалит, если не используется */
  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const { code } = req.params;

      const [{ count: empCount }, { count: catSchedCount }] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('work_category', code),
        supabase.from('category_schedules').select('id', { count: 'exact', head: true }).eq('category', code),
      ]);

      if ((empCount || 0) > 0 || (catSchedCount || 0) > 0) {
        res.status(409).json({
          success: false,
          error: `Категория используется: сотрудников ${empCount || 0}, привязок графиков ${catSchedCount || 0}`,
        });
        return;
      }

      const { error } = await supabase.from('work_categories').delete().eq('code', code);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('[work-categories] remove error:', err);
      res.status(500).json({ success: false, error: 'Ошибка удаления категории' });
    }
  },
};
