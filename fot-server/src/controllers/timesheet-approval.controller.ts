import type { Response } from 'express';
import { supabase } from '../config/database.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { resolveRequestDataScope, resolveScopedDepartmentId } from '../services/data-scope.service.js';

/** Header подтверждает табель отдела за месяц */
const submit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { department_id, period } = req.body;
    const deptId = await resolveScopedDepartmentId(req, department_id || null);

    if (!deptId || !period) {
      res.status(400).json({ success: false, error: 'department_id и period обязательны' });
      return;
    }

    const { data, error } = await supabase
      .from('timesheet_approvals')
      .upsert({
        department_id: deptId,
        period,
        status: 'submitted',
        submitted_by: req.user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'department_id,period' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('timesheet-approval.submit error:', err);
    res.status(500).json({ success: false, error: 'Ошибка подтверждения табеля' });
  }
};

/** Статус согласования по отделу и периоду */
const getStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const department_id = await resolveScopedDepartmentId(
      req,
      typeof req.query.department_id === 'string' ? req.query.department_id : null,
    );
    const period = req.query.period as string;

    if (!department_id || !period) {
      res.json({ success: true, data: null });
      return;
    }

    const { data, error } = await supabase
      .from('timesheet_approvals')
      .select('*')
      .eq('department_id', department_id)
      .eq('period', period)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('timesheet-approval.getStatus error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения статуса' });
  }
};

/** HR утверждает табель */
const approve = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: approval } = await supabase
      .from('timesheet_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (!approval) {
      res.status(404).json({ success: false, error: 'Запись не найдена' });
      return;
    }

    if (approval.status !== 'submitted') {
      res.status(400).json({ success: false, error: 'Табель не находится на проверке' });
      return;
    }
    const scopedDepartmentId = await resolveScopedDepartmentId(req, approval.department_id);
    if (!scopedDepartmentId || scopedDepartmentId !== approval.department_id) {
      res.status(403).json({ success: false, error: 'Нет доступа к табелю этого отдела' });
      return;
    }

    const { data, error } = await supabase
      .from('timesheet_approvals')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: req.body.comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('timesheet-approval.approve error:', err);
    res.status(500).json({ success: false, error: 'Ошибка утверждения' });
  }
};

/** HR отклоняет табель */
const reject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const { data: approval } = await supabase
      .from('timesheet_approvals')
      .select('*')
      .eq('id', id)
      .single();

    if (!approval) {
      res.status(404).json({ success: false, error: 'Запись не найдена' });
      return;
    }

    if (approval.status !== 'submitted') {
      res.status(400).json({ success: false, error: 'Табель не находится на проверке' });
      return;
    }
    const scopedDepartmentId = await resolveScopedDepartmentId(req, approval.department_id);
    if (!scopedDepartmentId || scopedDepartmentId !== approval.department_id) {
      res.status(403).json({ success: false, error: 'Нет доступа к табелю этого отдела' });
      return;
    }

    const { data, error } = await supabase
      .from('timesheet_approvals')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        review_comment: comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('timesheet-approval.reject error:', err);
    res.status(500).json({ success: false, error: 'Ошибка отклонения' });
  }
};

/** HR: все неутверждённые табели */
const getPending = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const scope = await resolveRequestDataScope(_req);
    let query = supabase
      .from('timesheet_approvals')
      .select('*')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });

    if (scope === 'department' && _req.user.department_id) {
      query = query.eq('department_id', _req.user.department_id);
    } else if (scope === 'self') {
      res.json({ success: true, data: [] });
      return;
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('timesheet-approval.getPending error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения списка' });
  }
};

/** HR: список табелей по статусу */
const getByStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const scope = await resolveRequestDataScope(req);
    let query = supabase
      .from('timesheet_approvals')
      .select('*');

    if (status) {
      query = query.eq('status', status);
    }

    if (scope === 'department' && req.user.department_id) {
      query = query.eq('department_id', req.user.department_id);
    } else if (scope === 'self') {
      res.json({ success: true, data: [] });
      return;
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('timesheet-approval.getByStatus error:', err);
    res.status(500).json({ success: false, error: 'Ошибка получения списка' });
  }
};

export const timesheetApprovalController = { submit, getStatus, approve, reject, getPending, getByStatus };
