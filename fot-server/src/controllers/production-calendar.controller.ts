import type { Response } from 'express';
import { supabase } from '../config/database.js';
import type { AuthenticatedRequest } from '../types/index.js';

/** GET /api/production-calendar?year=YYYY */
const getByYear = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string);
    if (isNaN(year)) {
      res.status(400).json({ success: false, error: 'Параметр year обязателен' });
      return;
    }

    const { data, error } = await supabase
      .from('production_calendar')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('production-calendar.getByYear error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения календаря' });
  }
};

/** PUT /api/production-calendar/:year/:month */
const update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: 'Некорректные параметры year/month' });
      return;
    }

    const { norm_days, norm_hours } = req.body;
    if (norm_days == null || norm_hours == null) {
      res.status(400).json({ success: false, error: 'norm_days и norm_hours обязательны' });
      return;
    }

    const { data, error } = await supabase
      .from('production_calendar')
      .upsert({
        year,
        month,
        norm_days,
        norm_hours,
        is_custom: true,
        updated_by: req.user.employee_id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'year,month' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('production-calendar.update error:', err);
    res.status(500).json({ success: false, error: 'Ошибка обновления календаря' });
  }
};

export const productionCalendarController = { getByYear, update };
