import { type FC } from 'react';
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

export const EmployeeHistorySection: FC<IEmployeeHistorySectionProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="card-history-empty">
        <p>Нет записей в истории</p>
      </div>
    );
  }

  return (
    <div className="card-history">
      <div className="history-timeline">
        {history.map((event, i) => {
          const data = event.event_data as Record<string, unknown>;
          const isCurrent = i === 0;

          return (
            <div key={event.event_id} className={`timeline-item ${isCurrent ? 'current' : ''}`}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <span className={`timeline-type-badge ${event.event_type}`}>
                  {event.event_type === 'salary' ? 'Зарплата' : 'Назначение'}
                </span>
                <span className="timeline-date">{formatDate(event.event_date)}</span>

                {event.event_type === 'salary' && (
                  <div className="timeline-details">
                    <span className="timeline-salary">
                      {formatSalary(data.salary as number | null)}
                    </span>
                    {data.reason && (
                      <span className="timeline-note">{data.reason as string}</span>
                    )}
                    {data.note && (
                      <span className="timeline-note">{data.note as string}</span>
                    )}
                  </div>
                )}

                {event.event_type === 'assignment' && (
                  <div className="timeline-details">
                    {data.position && (
                      <span className="timeline-detail-item">
                        Должность: <strong>{data.position as string}</strong>
                      </span>
                    )}
                    {data.department && (
                      <span className="timeline-detail-item">
                        Отдел: <strong>{data.department as string}</strong>
                      </span>
                    )}
                    {data.type && (
                      <span className="timeline-detail-item">
                        Тип: {data.type as string}
                      </span>
                    )}
                    {data.reason && (
                      <span className="timeline-note">{data.reason as string}</span>
                    )}
                  </div>
                )}

                {event.event_end_date && (
                  <span className="timeline-end-date">
                    до {formatDate(event.event_end_date)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
