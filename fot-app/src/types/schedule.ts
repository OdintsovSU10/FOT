export type ScheduleType = 'office' | 'remote' | 'hybrid' | 'shift';

export interface IWorkSchedule {
  id: string;
  organization_id: string;
  name: string;
  schedule_type: ScheduleType;
  work_start: string;
  work_end: string;
  work_hours: number;
  work_days: number[];
  office_days: number[] | null;
  late_threshold_minutes: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface IDepartmentSchedule {
  id: string;
  department_id: string;
  schedule_id: string;
  schedule?: IWorkSchedule;
  effective_from: string;
  effective_to: string | null;
  created_by: number | null;
  created_at: string;
}

export interface IEmployeeSchedule {
  id: string;
  employee_id: number;
  schedule_id: string;
  schedule?: IWorkSchedule;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
  created_by: number | null;
  created_at: string;
}

export interface IResolvedSchedule {
  schedule_id: string;
  schedule_type: ScheduleType;
  work_start: string;
  work_end: string;
  work_hours: number;
  work_days: number[];
  office_days: number[] | null;
  late_threshold_minutes: number;
  source: 'employee' | 'department' | 'default';
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  office: 'Офис',
  remote: 'Удалёнка',
  hybrid: 'Гибрид',
  shift: 'Сменный',
};

export const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
