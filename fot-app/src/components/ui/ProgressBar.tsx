import type { FC } from 'react';
import styles from './ProgressBar.module.css';

interface IProgressBarProps {
  label: string;
  current: number;
  total: number;
}

export const ProgressBar: FC<IProgressBarProps> = ({ label, current, total }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const variant = percentage >= 90 ? 'high' : percentage >= 70 ? 'medium' : 'low';

  return (
    <div className={styles.item}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{current} / {total}</span>
      </div>
      <div className={styles.bar}>
        <div
          className={`${styles.fill} ${styles[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
