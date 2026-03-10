import type { FC } from 'react';
import { Target } from 'lucide-react';
import styles from './DashboardStats.module.css';

interface IAttendanceGoalCardProps {
  target: number;
  current: number;
  trend?: number[];
}

const SPARKLINE_W = 120;
const SPARKLINE_H = 30;

const buildSparkline = (data: number[]): string => {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = SPARKLINE_W / (data.length - 1);
  return data
    .map((v, i) => `${i * step},${SPARKLINE_H - ((v - min) / range) * (SPARKLINE_H - 4) - 2}`)
    .join(' ');
};

export const AttendanceGoalCard: FC<IAttendanceGoalCardProps> = ({ target, current, trend = [] }) => {
  const colorClass = current >= target ? styles.good : current >= target - 15 ? styles.warn : styles.bad;

  return (
    <div className={styles.card}>
      <div className={styles.goalHeader}>
        <div className={styles.title} style={{ marginBottom: 0 }}>
          <div className={`${styles.titleIcon} ${styles.blue}`}>
            <Target />
          </div>
          Цель по присутствию
        </div>
        <span className={styles.goalTarget}>Цель: {target}%</span>
      </div>
      <div className={`${styles.goalValue} ${colorClass}`}>
        {current}%
      </div>
      {trend.length >= 2 && (
        <>
          <div className={styles.trendLabel}>Тренд</div>
          <svg className={styles.sparkline} viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`} preserveAspectRatio="none">
            <polyline points={buildSparkline(trend)} />
          </svg>
        </>
      )}
    </div>
  );
};
