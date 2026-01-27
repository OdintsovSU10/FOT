import type { FC } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import styles from './QuickActions.module.css';
import { CalendarIcon, DollarIcon, FileTextIcon, ChevronRightIcon } from '../ui/Icons';

interface IAction {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
}

const actions: IAction[] = [
  { id: 'timesheet', label: 'Сформировать табель', icon: CalendarIcon },
  { id: 'salary', label: 'Расчёт зарплат', icon: DollarIcon },
  { id: 'report', label: 'Выгрузить отчёт', icon: FileTextIcon },
];

export const QuickActions: FC = () => {
  return (
    <Card>
      <CardHeader title="Быстрые действия" />
      <CardContent>
        <div className={styles.actions}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <button key={action.id} className={styles.action}>
                <div className={styles.actionIcon}>
                  <Icon />
                </div>
                <span className={styles.actionText}>{action.label}</span>
                <span className={styles.actionArrow}>
                  <ChevronRightIcon />
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
