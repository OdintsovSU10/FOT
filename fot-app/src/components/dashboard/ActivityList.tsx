import { type FC, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { formatElapsed } from '../../utils/formatElapsed';
import { useFavorites } from '../../hooks/useFavorites';
import type { IEmployeePresence } from '../../types';
import styles from './ActivityList.module.css';

type TabFilter = 'favorites' | 'all' | 'online' | 'offline' | 'absent';

interface IActivityListProps {
  employees: IEmployeePresence[];
  loading: boolean;
}

const getInitials = (name: string): string => {
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

/** Простая оценка прогресса рабочего дня (0-100%) по since-времени */
const getTimelinePercent = (employee: IEmployeePresence): number => {
  if (employee.status !== 'online' && employee.status !== 'offline') return 0;
  if (!employee.since) return employee.status === 'online' ? 50 : 0;
  const now = new Date();
  const [h, m] = employee.since.split(':').map(Number);
  const sinceDate = new Date();
  sinceDate.setHours(h, m, 0, 0);
  if (employee.status === 'online') {
    const hoursWorked = (now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60);
    return Math.min(100, Math.round((hoursWorked / 8) * 100));
  }
  return 0;
};

const EmployeeRow: FC<{
  employee: IEmployeePresence;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
}> = ({ employee, isFavorite, onToggleFavorite }) => {
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(() => formatElapsed(employee.since));

  useEffect(() => {
    setElapsed(formatElapsed(employee.since));
    const timer = setInterval(() => setElapsed(formatElapsed(employee.since)), 60_000);
    return () => clearInterval(timer);
  }, [employee.since]);

  const isOnline = employee.status === 'online';
  const isOffline = employee.status === 'offline';
  const timelineWidth = getTimelinePercent(employee);

  return (
    <div className={styles.item} onClick={() => navigate(`/tender/${employee.employee_id}`, { state: { from: '/dashboard', label: 'Обзор' } })}>
      <button
        className={`${styles.starBtn} ${isFavorite ? styles.starActive : ''}`}
        onClick={e => { e.stopPropagation(); onToggleFavorite(employee.employee_id); }}
        title={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      >
        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
      <div className={styles.avatar}>{getInitials(employee.full_name)}</div>
      <div className={styles.content}>
        <div className={styles.name}>{employee.full_name}</div>
        <div className={styles.meta}>
          {employee.position_name || employee.department_name || ''}
        </div>
      </div>
      {timelineWidth > 0 && (
        <div className={styles.timeline}>
          <div
            className={`${styles.timelineFill} ${isOnline ? styles.full : styles.partial}`}
            style={{ width: `${timelineWidth}%` }}
          />
        </div>
      )}
      <span className={`${styles.status} ${isOnline ? styles.in : isOffline ? styles.out : styles.out}`}>
        {isOnline ? 'Онлайн' : isOffline ? 'Оффлайн' : '—'}
      </span>
      {elapsed && <span className={styles.time}>{elapsed}</span>}
    </div>
  );
};

export const ActivityList: FC<IActivityListProps> = ({ employees, loading }) => {
  const [tab, setTab] = useState<TabFilter>('all');
  const { favorites, toggle, isFavorite } = useFavorites();

  const onlineCount = useMemo(() => employees.filter(e => e.status === 'online').length, [employees]);
  const offlineCount = useMemo(() => employees.filter(e => e.status === 'offline').length, [employees]);
  const absentCount = useMemo(() => employees.filter(e => e.status === 'unknown').length, [employees]);
  const favCount = useMemo(() => employees.filter(e => favorites.has(e.employee_id)).length, [employees, favorites]);

  const filtered = useMemo(() => {
    if (tab === 'favorites') return employees.filter(e => favorites.has(e.employee_id));
    if (tab === 'online') return employees.filter(e => e.status === 'online');
    if (tab === 'offline') return employees.filter(e => e.status === 'offline');
    if (tab === 'absent') return employees.filter(e => e.status === 'unknown');
    return employees;
  }, [employees, tab, favorites]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Присутствие сотрудников" />
        <CardContent>
          <div className={styles.empty}>
            <span className={styles.emptyText}>Загрузка...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Присутствие сотрудников" />
      <CardContent>
        <div className={styles.tabs}>
          {favCount > 0 && (
            <button
              className={`${styles.tab} ${tab === 'favorites' ? styles.tabActive : ''}`}
              onClick={() => setTab('favorites')}
            >
              <Star size={13} fill={tab === 'favorites' ? 'currentColor' : 'none'} />
              Избранные <span className={styles.tabCount}>{favCount}</span>
            </button>
          )}
          <button
            className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
            onClick={() => setTab('all')}
          >
            Все <span className={styles.tabCount}>{employees.length}</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'online' ? styles.tabActive : ''}`}
            onClick={() => setTab('online')}
          >
            На работе <span className={styles.tabCount}>{onlineCount}</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'offline' ? styles.tabActive : ''}`}
            onClick={() => setTab('offline')}
          >
            Ушли <span className={styles.tabCount}>{offlineCount}</span>
          </button>
          <button
            className={`${styles.tab} ${tab === 'absent' ? styles.tabActive : ''}`}
            onClick={() => setTab('absent')}
          >
            Отсутствуют <span className={styles.tabCount}>{absentCount}</span>
          </button>
        </div>
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>
                {tab === 'favorites' ? 'Нет избранных сотрудников' : employees.length === 0 ? 'Нет данных' : 'Нет сотрудников'}
              </span>
              {employees.length === 0 && (
                <span className={styles.emptyHint}>Выберите отдел для просмотра</span>
              )}
            </div>
          ) : (
            filtered.map(emp => (
              <EmployeeRow
                key={emp.employee_id}
                employee={emp}
                isFavorite={isFavorite(emp.employee_id)}
                onToggleFavorite={toggle}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
