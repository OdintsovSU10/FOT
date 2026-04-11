/**
 * Сервис авто-генерации расчётных листков из данных табеля.
 */
import { supabase } from '../config/database.js';
import { resolveSchedulesBulk, countWorkingDaysForSchedule } from './schedule.service.js';

const WORKED_STATUSES = new Set(['work', 'manual', 'remote', 'business_trip']);
const NDFL_RATE = 0.13;

interface IGeneratedPayslip {
  employee_id: number;
  full_name: string;
  salary: number;
  norm_days: number;
  worked_days: number;
  gross_amount: number;
  deductions: number;
  net_amount: number;
}

export const generatePayslipsForMonth = async (
  year: number,
  month: number,
  createdBy: string,
  departmentId?: string,
): Promise<{ generated: number; payslips: IGeneratedPayslip[] }> => {
  const period = `${year}-${String(month).padStart(2, '0')}`;
  const startDate = `${period}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
  const midMonth = `${period}-15`;

  // 1. Получаем активных сотрудников с окладом
  let query = supabase
    .from('employees')
    .select('id, full_name, salary_calculated, current_salary, org_department_id, work_category')
    .eq('employment_status', 'active');

  if (departmentId) {
    query = query.eq('org_department_id', departmentId);
  }

  const { data: employees, error: empErr } = await query;

  if (empErr) throw empErr;
  if (!employees || employees.length === 0) return { generated: 0, payslips: [] };

  // 2. Resolve расписания
  const scheduleMap = await resolveSchedulesBulk(
    employees.map(e => ({
      id: e.id as number,
      work_category: (e.work_category as string | null) || null,
    })),
    midMonth,
  );

  // 3. Проверяем production_calendar
  const { data: calEntry } = await supabase
    .from('production_calendar')
    .select('norm_days')
    .eq('year', year)
    .eq('month', month)
    .single();

  // 4. Получаем записи табеля (tender_timesheet + timesheet)
  const employeeIds = employees.map(e => e.id as number);
  const BATCH = 500;

  let allEntries: Array<{ employee_id: number; status: string }> = [];

  for (let i = 0; i < employeeIds.length; i += BATCH) {
    const batch = employeeIds.slice(i, i + BATCH);

    const [tenderRes, tsRes] = await Promise.all([
      supabase
        .from('tender_timesheet')
        .select('employee_id, status')
        .in('employee_id', batch)
        .gte('work_date', startDate)
        .lte('work_date', endDate),
      supabase
        .from('timesheet')
        .select('employee_id, status')
        .in('employee_id', batch)
        .gte('work_date', startDate)
        .lte('work_date', endDate),
    ]);

    if (tenderRes.data) allEntries.push(...(tenderRes.data as Array<{ employee_id: number; status: string }>));
    if (tsRes.data) allEntries.push(...(tsRes.data as Array<{ employee_id: number; status: string }>));
  }

  // Группируем рабочие дни по сотруднику
  const workedMap = new Map<number, number>();
  for (const e of allEntries) {
    if (WORKED_STATUSES.has(e.status)) {
      workedMap.set(e.employee_id, (workedMap.get(e.employee_id) || 0) + 1);
    }
  }

  // 5. Генерируем расчётные листки
  const payslips: IGeneratedPayslip[] = [];
  const upsertRecords: Array<Record<string, unknown>> = [];

  for (const emp of employees) {
    const empId = emp.id as number;
    const salary = (emp.salary_calculated as number) ?? (emp.current_salary as number) ?? 0;
    if (salary <= 0) continue;

    const sched = scheduleMap.get(empId);
    const normDays = calEntry?.norm_days ?? (sched ? countWorkingDaysForSchedule(year, month, sched) : 22);
    const workedDays = workedMap.get(empId) || 0;

    if (workedDays === 0) continue;

    const gross = normDays > 0 ? (salary / normDays) * workedDays : 0;
    const deductions = Math.round(gross * NDFL_RATE * 100) / 100;
    const net = Math.round((gross - deductions) * 100) / 100;
    const grossRounded = Math.round(gross * 100) / 100;

    payslips.push({
      employee_id: empId,
      full_name: emp.full_name as string,
      salary,
      norm_days: normDays,
      worked_days: workedDays,
      gross_amount: grossRounded,
      deductions,
      net_amount: net,
    });

    upsertRecords.push({
      employee_id: empId,
      period,
      gross_amount: grossRounded,
      net_amount: net,
      deductions,
      details: { salary, norm_days: normDays, worked_days: workedDays, ndfl_rate: NDFL_RATE },
      created_by: createdBy,
    });
  }

  // 6. Upsert в payslips
  if (upsertRecords.length > 0) {
    for (let i = 0; i < upsertRecords.length; i += BATCH) {
      const batch = upsertRecords.slice(i, i + BATCH);
      const { error } = await supabase
        .from('payslips')
        .upsert(batch, { onConflict: 'employee_id,period' });
      if (error) throw error;
    }
  }

  return { generated: upsertRecords.length, payslips };
};
