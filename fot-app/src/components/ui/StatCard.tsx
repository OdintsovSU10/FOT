import type { FC, ReactNode } from 'react';
import styles from './StatCard.module.css';
import { TrendUpIcon, TrendDownIcon } from './Icons';

interface IStatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: ReactNode;
  iconType: 'blue' | 'green' | 'orange' | 'red';
}

export const StatCard: FC<IStatCardProps> = ({
  label,
  value,
  change,
  changeType = 'positive',
  icon,
  iconType
}) => (
  <div className={styles.card}>
    <div className={styles.header}>
      <span className={styles.label}>{label}</span>
      <div className={`${styles.icon} ${styles[iconType]}`}>
        {icon}
      </div>
    </div>
    <div className={styles.value}>{value}</div>
    {change && (
      <div className={`${styles.change} ${styles[changeType]}`}>
        {changeType === 'positive' ? <TrendUpIcon /> : changeType === 'negative' ? <TrendDownIcon /> : null}
        {change}
      </div>
    )}
  </div>
);
