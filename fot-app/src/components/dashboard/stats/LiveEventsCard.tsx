import type { FC } from 'react';
import { Radio } from 'lucide-react';
import type { IRecentEvent } from '../../../types';
import styles from './DashboardStats.module.css';

interface ILiveEventsCardProps {
  events: IRecentEvent[];
  totalCount: number;
}

export const LiveEventsCard: FC<ILiveEventsCardProps> = ({ events, totalCount }) => (
  <div className={`${styles.card} ${styles.cardWide}`}>
    <div className={styles.title}>
      <div className={`${styles.titleIcon} ${styles.purple}`}>
        <Radio />
      </div>
      События в эфире
    </div>
    <div className={styles.eventsHeader}>
      Недавних событий: {totalCount}
    </div>
    <div className={styles.eventsList}>
      {events.map((ev, i) => {
        const dirClass = ev.direction === 'entry' ? styles.eventEntry : ev.direction === 'exit' ? styles.eventExit : '';
        return (
          <div key={i} className={`${styles.eventItem} ${dirClass}`}>
            <span className={styles.eventTime}>{ev.time}</span>
            <span className={ev.direction === null && !ev.name ? styles.eventRefusal : styles.eventName}>
              {ev.name}
            </span>
            <span className={styles.eventArrow}>{ev.direction === 'entry' ? '→' : ev.direction === 'exit' ? '←' : '→'}</span>
            <span className={ev.direction === null ? styles.eventRefusal : styles.eventPoint}>
              {ev.accessPoint || '—'}
              {ev.direction === null ? ' (Отказ)' : ''}
            </span>
          </div>
        );
      })}
      {events.length === 0 && (
        <div className={styles.sub}>Нет событий</div>
      )}
    </div>
  </div>
);
