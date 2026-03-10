import { type FC } from 'react';
import { DollarSign, Briefcase } from 'lucide-react';
import type { EmployeeHistoryEvent } from '../../types';

interface IEmployeeHistorySectionProps {
  history: EmployeeHistoryEvent[];
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU');

const formatSalary = (salary: number | null | undefined) => {
  if (!salary) return '—';
  return salary.toLocaleString('ru-RU') + ' ₽';
};

const getEventTitle = (event: EmployeeHistoryEvent): string => {
  if (event.event_type === 'salary') return 'Изменение оклада';
  const data = event.event_data as Record<string, unknown>;
  if (data.type === 'hire' || data.type === 'Прием') return 'Принят на работу';
  if (data.type === 'transfer' || data.type === 'Перевод') return 'Перевод';
  if (data.type === 'dismiss' || data.type === 'Увольнение') return 'Увольнение';
  return 'Назначение';
};

const getEventDesc = (event: EmployeeHistoryEvent): string => {
  const data = event.event_data as Record<string, unknown>;
  const parts: string[] = [];

  if (event.event_type === 'salary') {
    parts.push(`Оклад: ${formatSalary(data.salary as number | null)}`);
    if (data.reason) parts.push(String(data.reason));
    if (data.note) parts.push(String(data.note));
  } else {
    if (data.position) parts.push(`Должность: ${data.position}`);
    if (data.department) parts.push(`Отдел: ${data.department}`);
    if (data.reason) parts.push(String(data.reason));
  }

  return parts.join(' · ');
};

export const EmployeeHistorySection: FC<IEmployeeHistorySectionProps> = ({ history }) => {
  if (history.length === 0) {
    return <div className="ec-history-empty">Нет записей в истории</div>;
  }

  return (
    <div className="ec-history-timeline">
      {history.map(event => {
        const iconColor = event.event_type === 'salary' ? 'green' : 'blue';
        const Icon = event.event_type === 'salary' ? DollarSign : Briefcase;

        return (
          <div key={event.event_id} className="ec-history-item">
            <div className={`ec-history-icon ${iconColor}`}>
              <Icon size={18} />
            </div>
            <div className="ec-history-content">
              <div className="ec-history-title">{getEventTitle(event)}</div>
              <div className="ec-history-desc">{getEventDesc(event)}</div>
            </div>
            <div className="ec-history-date">
              {formatDate(event.event_date)}
              {event.event_end_date && (
                <> — {formatDate(event.event_end_date)}</>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
