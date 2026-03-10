import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/database.js';
import { auditService } from '../services/audit.service.js';
import { getOrgId } from '../utils/org.utils.js';
import type { AuthenticatedRequest, TimeStatus } from '../types/index.js';

const validStatuses: TimeStatus[] = ['work', 'vacation', 'dayoff', 'remote', 'unpaid', 'absent', 'sick', 'business_trip', 'manual'];

const createEntrySchema = z.object({
  employee_id: z.number().int().positive(),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(validStatuses as [string, ...string[]]),
  hours_worked: z.number().min(0).max(24).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const updateEntrySchema = z.object({
  status: z.enum(validStatuses as [string, ...string[]]).optional(),
  hours_worked: z.number().min(0).max(24).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export const timesheetController = {
  /** GET /api/timesheet?month=YYYY-MM&department_id=... */
  async getAll(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = getOrgId(req);
      const { month, department_id } = req.query;

      if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ success: false, error: 'Параметр month обязателен (формат YYYY-MM)' });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const mon = parseInt(monthStr);
      const startDate = `${month}-01`;
      const endDate = `${month}-${new Date(year, mon, 0).getDate()}`;

      if (!organizationId) {
        return res.status(400).json({ success: false, error: 'Организация не определена' });
      }

      // Fetch employees
      let empQuery = supabase
        .from('employees')
        .select('id, full_name, position_id, org_department_id, employment_status')
        .eq('organization_id', organizationId)
        .eq('employment_status', 'active')
        .eq('is_archived', false)
        .order('full_name');

      if (department_id && typeof department_id === 'string') {
        empQuery = empQuery.eq('org_department_id', department_id);
      }

      const { data: employees, error: empError } = await empQuery;
      if (empError) throw empError;

      const employeeIds = (employees || []).map(e => e.id);

      // Fetch position names
      const positionIds = [...new Set((employees || []).map(e => e.position_id).filter(Boolean))];
      let posMap = new Map<string, string>();
      if (positionIds.length > 0) {
        const { data: positions } = await supabase
          .from('positions')
          .select('id, name')
          .in('id', positionIds);
        (positions || []).forEach((p: { id: string; name: string }) => posMap.set(p.id, p.name));
      }

      // Fetch timesheet entries
      let entries: Array<Record<string, unknown>> = [];
      if (employeeIds.length > 0) {
        const { data, error } = await supabase
          .from('tender_timesheet')
          .select('*')
          .in('employee_id', employeeIds)
          .gte('work_date', startDate)
          .lte('work_date', endDate);
        if (error) throw error;
        entries = data || [];
      }

      // Compute stats
      const workingDays = getWorkingDaysInMonth(year, mon);
      const normHours = workingDays * 8;
      let actualHours = 0;
      let deviations = { late: 0, absent: 0, sick: 0 };

      for (const entry of entries) {
        if (entry.hours_worked && typeof entry.hours_worked === 'number') {
          actualHours += entry.hours_worked;
        }
        if (entry.status === 'absent') deviations.absent++;
        if (entry.status === 'sick') deviations.sick++;
        if (entry.status === 'work' && typeof entry.hours_worked === 'number' && entry.hours_worked < 8) {
          deviations.late++;
        }
      }

      const employeesWithNames = (employees || []).map(e => ({
        ...e,
        position_name: e.position_id ? posMap.get(e.position_id) || null : null,
      }));

      res.json({
        success: true,
        data: {
          employees: employeesWithNames,
          entries,
          stats: {
            employeeCount: employeeIds.length,
            workingDays,
            normHours,
            actualHours,
            deviations,
          },
        },
      });
    } catch (err) {
      console.error('timesheet.getAll error:', err);
      res.status(500).json({ success: false, error: 'Ошибка загрузки табеля' });
    }
  },

  /** POST /api/timesheet */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = getOrgId(req);
      if (!organizationId) {
        return res.status(400).json({ success: false, error: 'Организация не определена' });
      }
      const parsed = createEntrySchema.parse(req.body);

      // Verify employee belongs to org
      const { data: emp } = await supabase
        .from('employees')
        .select('id')
        .eq('id', parsed.employee_id)
        .eq('organization_id', organizationId)
        .single();

      if (!emp) {
        return res.status(404).json({ success: false, error: 'Сотрудник не найден' });
      }

      const { data, error } = await supabase
        .from('tender_timesheet')
        .upsert({
          employee_id: parsed.employee_id,
          work_date: parsed.work_date,
          status: parsed.status,
          hours_worked: parsed.hours_worked ?? null,
          is_correction: false,
        }, { onConflict: 'employee_id,work_date' })
        .select()
        .single();

      if (error) throw error;

      await auditService.logFromRequest(req, 'timesheet.create', 'timesheet', String(data.id), {
        employee_id: parsed.employee_id,
        work_date: parsed.work_date,
        status: parsed.status,
      });

      res.json({ success: true, data });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Ошибка валидации', details: err.errors });
      }
      console.error('timesheet.create error:', err);
      res.status(500).json({ success: false, error: 'Ошибка создания записи' });
    }
  },

  /** PUT /api/timesheet/:id */
  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ success: false, error: 'Некорректный ID' });

      const parsed = updateEntrySchema.parse(req.body);

      const { data, error } = await supabase
        .from('tender_timesheet')
        .update({
          ...parsed,
          is_correction: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Запись не найдена' });

      await auditService.logFromRequest(req, 'timesheet.update', 'timesheet', String(id), parsed);

      res.json({ success: true, data });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Ошибка валидации', details: err.errors });
      }
      console.error('timesheet.update error:', err);
      res.status(500).json({ success: false, error: 'Ошибка обновления записи' });
    }
  },

  /** GET /api/timesheet/export?month=YYYY-MM&department_id=... */
  async export(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = getOrgId(req);
      if (!organizationId) {
        return res.status(400).json({ success: false, error: 'Организация не определена' });
      }
      const { month, department_id } = req.query;

      if (!month || typeof month !== 'string') {
        return res.status(400).json({ success: false, error: 'Параметр month обязателен' });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const mon = parseInt(monthStr);
      const startDate = `${month}-01`;
      const endDate = `${month}-${new Date(year, mon, 0).getDate()}`;

      let empQuery = supabase
        .from('employees')
        .select('id, full_name, position_id')
        .eq('organization_id', organizationId)
        .eq('employment_status', 'active')
        .eq('is_archived', false)
        .order('full_name');

      if (department_id && typeof department_id === 'string') {
        empQuery = empQuery.eq('org_department_id', department_id);
      }

      const { data: employees } = await empQuery;
      const employeeIds = (employees || []).map(e => e.id);

      let entries: Array<Record<string, unknown>> = [];
      if (employeeIds.length > 0) {
        const { data } = await supabase
          .from('tender_timesheet')
          .select('*')
          .in('employee_id', employeeIds)
          .gte('work_date', startDate)
          .lte('work_date', endDate);
        entries = data || [];
      }

      // Build a simple CSV
      const header = ['Сотрудник', 'Дата', 'Статус', 'Часы'];
      const empMap = new Map((employees || []).map(e => [e.id, e.full_name]));
      const rows = entries.map(e => [
        empMap.get(e.employee_id as number) || '',
        e.work_date,
        e.status,
        e.hours_worked ?? '',
      ]);

      const csv = [header, ...rows].map(r => r.join(';')).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="timesheet-${month}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      console.error('timesheet.export error:', err);
      res.status(500).json({ success: false, error: 'Ошибка экспорта' });
    }
  },
};
