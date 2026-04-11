import { type FC, useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { TimesheetEntry, TimesheetEmployee } from '../../types';
import type { IResolvedSchedule } from '../../types/schedule';
import { getEffectiveLateThresholdForDay, getScheduleForTimesheetDay } from '../../utils/scheduleUtils';

interface ILateRatingModalProps {
  open: boolean;
  onClose: () => void;
  employees: TimesheetEmployee[];
  entries: TimesheetEntry[];
  schedules?: Record<number, IResolvedSchedule>;
  dailySchedules?: Record<number, Record<string, IResolvedSchedule>>;
}

interface ILateDay {
  date: string;
  firstEntry: string | null;
  hours: number | null;
}

interface ILateEmployee {
  employee: TimesheetEmployee;
  days: ILateDay[];
}

const DEFAULT_LATE_THRESHOLD = '09:00:00';

const formatTime = (val: string | null): string => {
  if (!val) return '—';
  // Could be "HH:MM:SS" or "HH:MM" or full ISO
  const timeMatch = val.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  return '—';
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export const LateRatingModal: FC<ILateRatingModalProps> = ({ open, onClose, employees, entries, schedules, dailySchedules }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const rating = useMemo<ILateEmployee[]>(() => {
    const map = new Map<number, ILateDay[]>();

    for (const e of entries) {
      if (e.status !== 'work' || !e.first_entry) continue;

      const [year, month, day] = e.work_date.split('-').map(Number);
      const sched = getScheduleForTimesheetDay(schedules, dailySchedules, e.employee_id, year, month, day);
      const lateThreshold = sched ? getEffectiveLateThresholdForDay(sched, year, month, day) : DEFAULT_LATE_THRESHOLD;

      // Нормализуем first_entry до формата HH:MM:SS для корректного сравнения
      const firstEntry = e.first_entry.length === 5 ? e.first_entry + ':00' : e.first_entry;

      if (firstEntry > lateThreshold) {
        if (!map.has(e.employee_id)) map.set(e.employee_id, []);
        map.get(e.employee_id)!.push({
          date: e.work_date,
          firstEntry: e.first_entry,
          hours: e.hours_worked,
        });
      }
    }

    const result: ILateEmployee[] = [];
    for (const [empId, days] of map) {
      const emp = employees.find(e => e.id === empId);
      if (emp) {
        days.sort((a, b) => b.date.localeCompare(a.date));
        result.push({ employee: emp, days });
      }
    }
    result.sort((a, b) => b.days.length - a.days.length);
    return result;
  }, [entries, employees, schedules, dailySchedules]);

  const toggle = (id: number) => setExpandedId(prev => (prev === id ? null : id));

  if (!open) return null;

  return (
    <div className="ts-modal-overlay ts-modal-overlay--open" onClick={onClose}>
      <div className="ts-modal ts-late-modal" onClick={e => e.stopPropagation()}>
        <div className="ts-modal-header">
          <div className="ts-modal-title">Опоздания</div>
          <button className="ts-panel-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="ts-modal-body">
          {rating.length === 0 ? (
            <div className="ts-modal-events-empty">Опозданий нет</div>
          ) : (
            <div className="ts-late-list">
              {rating.map((item, idx) => {
                const isExpanded = expandedId === item.employee.id;
                return (
                  <div key={item.employee.id} className="ts-late-item">
                    <div
                      className="ts-late-row"
                      onClick={() => toggle(item.employee.id)}
                    >
                      <div className="ts-late-rank">{idx + 1}</div>
                      <div className="ts-late-info">
                        <div className="ts-late-name">{item.employee.full_name}</div>
                        {item.employee.position_name && (
                          <div className="ts-late-position">{item.employee.position_name}</div>
                        )}
                      </div>
                      <div className="ts-late-count">{item.days.length}</div>
                      <div className="ts-late-chevron">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ts-late-details">
                        {item.days.map(d => (
                          <div key={d.date} className="ts-late-detail-row">
                            <div className="ts-late-detail-date">{formatDate(d.date)}</div>
                            <div className="ts-late-detail-time">
                              <Clock size={12} />
                              {formatTime(d.firstEntry)}
                            </div>
                            {d.hours !== null && (
                              <div className="ts-late-detail-hours">{d.hours.toFixed(1)}ч</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
