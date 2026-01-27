import type { FC } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import styles from './ActivityList.module.css';

export const ActivityList: FC = () => {
  return (
    <Card>
      <CardHeader title="Активность СКУД" action="Все записи" />
      <CardContent>
        <div className={styles.list}>
          <div className={styles.empty}>
            <span className={styles.emptyText}>Нет данных</span>
            <span className={styles.emptyHint}>Записи СКУД появятся здесь</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
