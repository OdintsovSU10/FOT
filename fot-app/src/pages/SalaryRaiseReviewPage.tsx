import { type FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type ISalaryRaiseRequest,
} from '../services/salaryRaiseService';
import { useSalaryRaiseReviewList } from '../hooks/useSalaryRaiseData';
import './SalaryRaiseReviewPage.css';

const formatSalary = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
};

const formatDate = (value: string): string => new Date(value).toLocaleDateString('ru-RU');

type FilterTab = 'pending' | 'all';
const EMPTY_REQUESTS: ISalaryRaiseRequest[] = [];

export const SalaryRaiseReviewPage: FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canViewAll = hasPermission('data.scope.all');

  const [filter, setFilter] = useState<FilterTab>('pending');
  const { data, isLoading } = useSalaryRaiseReviewList(filter, canViewAll);
  const requests = data ?? EMPTY_REQUESTS;

  return (
    <div className="srr-page">
      <div className="srr-hero">
        <div>
          <div className="srr-eyebrow">Admin review</div>
          <h1 className="srr-title">Заявки на повышение оклада</h1>
          <p className="srr-subtitle">
            Просмотр заявок руководителей и сводки по сотруднику за последние 3 месяца.
          </p>
        </div>

        <div className="srr-filter">
          <button
            className={`srr-filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            На рассмотрении
          </button>
          {canViewAll && (
            <button
              className={`srr-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Все заявки
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="srr-loading">Загрузка...</div>
      ) : requests.length === 0 ? (
        <div className="srr-empty">Заявок для отображения пока нет.</div>
      ) : (
        <div className="srr-list">
          {requests.map((request) => (
            <article
              key={request.id}
              className="srr-card"
              onClick={() => navigate(`/salary-raise-review/${request.id}`)}
            >
              <div className="srr-card-top">
                <div className="srr-person">
                  <div className="srr-card-employee">{request.employee_snapshot.full_name}</div>
                  <div className="srr-card-role">
                    {request.employee_snapshot.position_name || 'Должность не указана'}
                    {' • '}
                    {request.employee_snapshot.department_name || 'Подразделение не указано'}
                  </div>
                </div>

                <span
                  className="srr-status"
                  style={{
                    backgroundColor: `${STATUS_COLORS[request.status]}1A`,
                    color: STATUS_COLORS[request.status],
                  }}
                >
                  {STATUS_LABELS[request.status]}
                </span>
              </div>

              <div className="srr-grid">
                <div className="srr-salary-panel">
                  <span className="srr-meta-label">Оклад</span>
                  <div className="srr-salary-row">
                    <span className="srr-salary-value">{formatSalary(request.current_salary_entered)}</span>
                    <span className="srr-arrow">→</span>
                    <span className="srr-salary-value">{formatSalary(request.requested_salary)}</span>
                    <span className="srr-raise-pct">+{request.raise_percentage.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="srr-meta-row">
                  <div className="srr-inline-item">
                    <span className="srr-inline-label">Руководитель:</span>
                    <span className="srr-inline-value">
                      {request.manager_snapshot?.full_name || request.employee_snapshot.supervisor_name || '—'}
                    </span>
                  </div>

                  <div className="srr-inline-item">
                    <span className="srr-inline-label">Объект:</span>
                    <span className="srr-inline-value">{request.work_object_name || '—'}</span>
                  </div>

                  <div className="srr-inline-item">
                    <span className="srr-inline-label">Достижения:</span>
                    <span className="srr-inline-value">{request.achievements.length}</span>
                  </div>

                  <div className="srr-inline-item">
                    <span className="srr-inline-label">Создана:</span>
                    <span className="srr-inline-value">{formatDate(request.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="srr-summary">
                <div className="srr-summary-title">Что делает сотрудник</div>
                <div className="srr-summary-text">{request.job_summary || 'Описание работы не заполнено'}</div>
              </div>

              {request.admin_review?.comment && (
                <div className="srr-review-note">
                  <span className="srr-meta-label">Комментарий администратора</span>
                  <span className="srr-review-text">{request.admin_review.comment}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
