import type { IResolvedSchedule } from '../types/schedule';

const getISODow = (date: Date): number => {
  const d = date.getDay();
  return d === 0 ? 7 : d;
};

/** Возвращает норму часов для конкретного дня с учётом day_overrides */
export const getWorkHoursForDay = (
  sched: IResolvedSchedule | undefined,
  year: number,
  month: number,
  day: number,
): number => {
  if (!sched) return 8;
  if (sched.day_overrides) {
    const dow = String(getISODow(new Date(year, month - 1, day)));
    const override = sched.day_overrides[dow];
    if (override) return override.work_hours;
  }
  return sched.work_hours;
};
