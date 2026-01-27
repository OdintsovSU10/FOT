import type { FC } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import styles from './PresenceProgress.module.css';

export const PresenceProgress: FC = () => {
  return (
    <Card>
      <CardHeader title="Присутствие по объектам" />
      <CardContent>
        <div className={styles.list}>
          <div className={styles.empty}>
            <span className={styles.emptyText}>Нет объектов</span>
            <span className={styles.emptyHint}>Добавьте объекты для отслеживания</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
