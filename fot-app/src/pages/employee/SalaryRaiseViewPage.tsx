import { type FC, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  salaryRaiseService,
  STATUS_COLORS,
  STATUS_LABELS,
  type SalaryRaiseMetricDetailItem,
  type SalaryRaiseMetricSummary,
} from '../../services/salaryRaiseService';
import {
  useSalaryRaiseRequest,
  useSalaryRaiseReviewContext,
} from '../../hooks/useSalaryRaiseData';
import styles from './SalaryRaiseViewPage.module.css';

const formatSalary = (value: number | null | undefined): string => {
  if (value == null) return '—';
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const normalized = value.slice(0, 10);
  const [year, month, day] = normalized.split('-');

  if (year && month && day) {
    return `${Number(day)}.${month}.${year}`;
  }

  return new Date(value).toLocaleDateString('ru-RU');
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
};

const formatSignedSalary = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
};

const EMPTY_DETAILS: SalaryRaiseMetricDetailItem[] = [];
const EMPTY_SUMMARY: SalaryRaiseMetricSummary[] = [];

export const SalaryRaiseViewPage: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user, canEditPage } = useAuth();
  const { id } = useParams<{ id: string }>();

  const requestId = id ? Number(id) : null;
  const isReviewContext = location.pathname.startsWith('/salary-raise-review');
  const backPath = isReviewContext ? '/salary-raise-review' : '/employee/salary-raise';

  const requestQuery = useSalaryRaiseRequest(requestId, !!requestId);
  const reviewContextQuery = useSalaryRaiseReviewContext(requestId, isReviewContext && !!requestId);
  const request = requestQuery.data ?? null;
  const reviewContext = reviewContextQuery.data ?? null;

  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (requestQuery.isError) {
      navigate(backPath);
    }
  }, [backPath, navigate, requestQuery.isError]);

  useEffect(() => {
    const summary = reviewContext?.summary ?? EMPTY_SUMMARY;
    if (summary.length === 0) {
      setSelectedMetric(null);
      return;
    }

    const stillExists = selectedMetric && summary.some((item) => item.key === selectedMetric);
    if (stillExists) return;

    const nextMetric = summary.find((item) => item.count > 0)?.key ?? summary[0]?.key ?? null;
    setSelectedMetric(nextMetric);
  }, [reviewContext, selectedMetric]);

  const selectedSummary = useMemo(
    () => reviewContext?.summary.find((item) => item.key === selectedMetric) ?? null,
    [reviewContext, selectedMetric],
  );

  const selectedDetails = useMemo(
    () => {
      if (!selectedMetric) return EMPTY_DETAILS;
      return reviewContext?.details_by_metric[selectedMetric] ?? EMPTY_DETAILS;
    },
    [reviewContext, selectedMetric],
  );

  if (requestQuery.isLoading || (isReviewContext && reviewContextQuery.isLoading)) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  if (!request) {
    return null;
  }

  const isAuthor = user?.id === request.author_user_id;
  const canEditOwnDraft = !isReviewContext
    && isAuthor
    && request.status === 'draft'
    && canEditPage('/employee/salary-raise');
  const canCancelOwnDraft = canEditOwnDraft;
  const canAdminReview = isReviewContext
    && request.status === 'admin_review'
    && canEditPage('/salary-raise-review');

  const currentSalary = request.current_salary_entered ?? 0;
  const salaryDelta = request.requested_salary - currentSalary;
  const managerName = request.manager_snapshot?.full_name
    || request.employee_snapshot.supervisor_name
    || '—';
  const managerDepartment = request.manager_snapshot?.department_name
    || request.employee_snapshot.department_name
    || '—';

  const handleCancel = async () => {
    setSubmitting(true);

    try {
      await salaryRaiseService.cancel(request.id);
      await queryClient.invalidateQueries({ queryKey: ['salary-raise'] });
      toast.success('Заявка отменена');
      navigate('/employee/salary-raise');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось отменить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminReview = async (action: 'approve' | 'reject') => {
    setSubmitting(true);

    try {
      await salaryRaiseService.adminReview(request.id, {
        action,
        comment: reviewComment.trim() || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['salary-raise'] });
      await requestQuery.refetch();
      toast.success(action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось обновить статус заявки');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <button className={styles.backLink} onClick={() => navigate(backPath)}>
        ← Назад к заявкам
      </button>

      <section className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>
            {isReviewContext ? 'Карточка для администратора' : 'Карточка заявки'}
          </div>
          <h1 className={styles.title}>{request.employee_snapshot.full_name}</h1>
          <p className={styles.subtitle}>
            {request.employee_snapshot.position_name || 'Должность не указана'}
            {' • '}
            {request.employee_snapshot.department_name || 'Подразделение не указано'}
          </p>
        </div>

        <div className={styles.heroAside}>
          <span
            className={styles.statusBadge}
            style={{
              color: STATUS_COLORS[request.status],
              backgroundColor: `${STATUS_COLORS[request.status]}1A`,
            }}
          >
            {STATUS_LABELS[request.status]}
          </span>
          <div className={styles.heroMeta}>Создана {formatDateTime(request.created_at)}</div>
          <div className={styles.heroMeta}>Обновлена {formatDateTime(request.updated_at)}</div>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Сотрудник и инициатор</h2>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>ФИО сотрудника</span>
                <span className={styles.infoValue}>{request.employee_snapshot.full_name}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Руководитель</span>
                <span className={styles.infoValue}>{managerName}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Должность</span>
                <span className={styles.infoValue}>{request.employee_snapshot.position_name || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Подразделение</span>
                <span className={styles.infoValue}>{request.employee_snapshot.department_name || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Подразделение руководителя</span>
                <span className={styles.infoValue}>{managerDepartment}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Текущий объект в профиле</span>
                <span className={styles.infoValue}>{request.employee_snapshot.work_object || '—'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Последнее повышение</span>
                <span className={styles.infoValue}>{formatDate(request.employee_snapshot.last_raise_date)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Дата приёма</span>
                <span className={styles.infoValue}>{formatDate(request.employee_snapshot.hire_date)}</span>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Параметры повышения</h2>
            </div>

            <div className={styles.salaryPanel}>
              <div className={styles.salaryBlock}>
                <span className={styles.infoLabel}>Текущий оклад</span>
                <span className={styles.salaryValue}>{formatSalary(request.current_salary_entered)}</span>
              </div>
              <div className={styles.salaryArrow}>→</div>
              <div className={styles.salaryBlock}>
                <span className={styles.infoLabel}>Желаемый оклад</span>
                <span className={styles.salaryValue}>{formatSalary(request.requested_salary)}</span>
              </div>
              <div className={styles.salaryMeta}>
                <span className={styles.deltaBadge}>{formatSignedSalary(salaryDelta)}</span>
                <span className={styles.percentBadge}>+{request.raise_percentage.toFixed(1)}%</span>
              </div>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Объект по заявке</span>
                <span className={styles.infoValue}>{request.work_object_name || '—'}</span>
              </div>
            </div>

            <div className={styles.textBlock}>
              <span className={styles.infoLabel}>Какая работа выполняется сотрудником</span>
              <p>{request.job_summary || '—'}</p>
            </div>

            <div className={styles.textBlock}>
              <span className={styles.infoLabel}>Почему сотрудник заслуживает повышения</span>
              <p>{request.manager_justification || '—'}</p>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Достижения за полгода</h2>
              <span className={styles.cardHint}>Минимум 3 пункта</span>
            </div>

            <div className={styles.achievementList}>
              {request.achievements.map((item, index) => (
                <div key={`${request.id}-achievement-${index}`} className={styles.achievementItem}>
                  <span className={styles.achievementIndex}>{index + 1}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          {request.admin_review && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Решение администратора</h2>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Решение</span>
                  <span className={styles.infoValue}>
                    {request.admin_review.action === 'approve' ? 'Одобрено' : 'Отклонено'}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Дата решения</span>
                  <span className={styles.infoValue}>{formatDateTime(request.admin_reviewed_at)}</span>
                </div>
              </div>

              {request.admin_review.comment && (
                <div className={styles.textBlock}>
                  <span className={styles.infoLabel}>Комментарий администратора</span>
                  <p>{request.admin_review.comment}</p>
                </div>
              )}
            </section>
          )}

          {canAdminReview && (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Действия администратора</h2>
                <span className={styles.cardHint}>После одобрения оклад применяется сразу</span>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.infoLabel} htmlFor="salary-raise-admin-comment">
                  Комментарий
                </label>
                <textarea
                  id="salary-raise-admin-comment"
                  className={styles.textarea}
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Комментарий к решению (необязательно)"
                />
              </div>

              <div className={styles.actionRow}>
                <button
                  className={styles.approveButton}
                  onClick={() => handleAdminReview('approve')}
                  disabled={submitting}
                >
                  Одобрить
                </button>
                <button
                  className={styles.rejectButton}
                  onClick={() => handleAdminReview('reject')}
                  disabled={submitting}
                >
                  Отклонить
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Статус и действия</h2>
            </div>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Статус</span>
                <span className={styles.infoValue}>{STATUS_LABELS[request.status]}</span>
              </div>
            </div>

            {canEditOwnDraft && (
              <div className={styles.actionColumn}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => navigate(`/employee/salary-raise/${request.id}/edit`)}
                >
                  Редактировать черновик
                </button>
                {canCancelOwnDraft && (
                  <button
                    className={styles.ghostButton}
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Отменить заявку
                  </button>
                )}
              </div>
            )}
          </section>

          {isReviewContext ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Сводка по сотруднику</h2>
                  <div className={styles.cardHint}>
                    Период {formatDate(reviewContext?.period.start_date)} - {formatDate(reviewContext?.period.end_date)}
                  </div>
                </div>
              </div>

              <div className={styles.metricGrid}>
                {(reviewContext?.summary ?? EMPTY_SUMMARY).map((metric) => (
                  <button
                    key={metric.key}
                    className={`${styles.metricCard} ${metric.key === selectedMetric ? styles.metricCardActive : ''}`}
                    onClick={() => setSelectedMetric(metric.key)}
                  >
                    <span className={styles.metricLabel}>{metric.label}</span>
                    <strong className={styles.metricCount}>{metric.count}</strong>
                    <span className={styles.metricHighlight}>{metric.highlight || 'Без доп. данных'}</span>
                  </button>
                ))}
              </div>

              {selectedSummary && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    <h3>{selectedSummary.label}</h3>
                    <span>{selectedSummary.count} записей</span>
                  </div>

                  {selectedDetails.length === 0 ? (
                    <div className={styles.emptyDetails}>За выбранный период деталей не найдено.</div>
                  ) : (
                    <div className={styles.detailList}>
                      {selectedDetails.map((item) => (
                        <div key={item.id} className={styles.detailItem}>
                          <div className={styles.detailDate}>{formatDate(item.date)}</div>
                          <div className={styles.detailBody}>
                            <div className={styles.detailTitle}>{item.title}</div>
                            <div className={styles.detailDescription}>{item.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Статистика сотрудника</h2>
              </div>
              <p className={styles.note}>
                Краткая статистика по табелю за последние 3 месяца доступна на странице админского рассмотрения.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
