import type { FC } from 'react';
import { Clock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import styles from './DashboardStats.module.css';

interface ILatenessCardProps {
  lateCount: number;
  earlyLeaveCount: number;
  entries: number;
  exits: number;
}

export const LatenessCard: FC<ILatenessCardProps> = ({ lateCount, earlyLeaveCount, entries, exits }) => (
  <div className={styles.card}>
    <div className={styles.title}>
      <div className={`${styles.titleIcon} ${styles.orange}`}>
        <Clock />
      </div>
      Опоздания и Уходы
    </div>
    <div className={styles.lateValue}>
      Опоздали: {lateCount}
    </div>
    <div className={styles.lateSub}>
      Ушли рано: {earlyLeaveCount}
    </div>
    <div className={styles.miniStats}>
      <div className={styles.miniStat}>
        <ArrowDownRight />
        Входы: <span className={styles.miniStatValue}>{entries}</span>
      </div>
      <div className={styles.miniStat}>
        <ArrowUpRight />
        Выходы: <span className={styles.miniStatValue}>{exits}</span>
      </div>
    </div>
  </div>
);
