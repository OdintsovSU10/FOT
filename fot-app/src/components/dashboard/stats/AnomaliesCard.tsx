import type { FC } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './DashboardStats.module.css';

interface IAnomaliesCardProps {
  refusals: number;
}

export const AnomaliesCard: FC<IAnomaliesCardProps> = ({ refusals }) => (
  <div className={styles.card}>
    <div className={styles.title}>
      <div className={`${styles.titleIcon} ${styles.red}`}>
        <AlertTriangle />
      </div>
      Аномалии СКУД
    </div>
    <div className={styles.anomalyRow}>
      <span className={styles.anomalyLabel}>Отказы доступа:</span>
      <span className={`${styles.anomalyValue} ${styles.red}`}>{refusals}</span>
    </div>
    <div className={styles.sub}>
      Неопознанные события за сегодня
    </div>
  </div>
);
