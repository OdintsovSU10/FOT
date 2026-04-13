import { Suspense, lazy, type FC, useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { TimesheetReviewPage } from './TimesheetReviewPage';
import styles from './TimesheetHrPage.module.css';

const MassTimesheetExportPage = lazy(() => import('./MassTimesheetExportPage').then(module => ({
  default: module.MassTimesheetExportPage,
})));

const TABS = ['Проверка', 'Экспорт'];

export const TimesheetHrPage: FC = () => {
  const [active, setActive] = useState(0);

  return (
    <div className={styles.page}>
      <section className={styles.workspace}>
        <div className={styles.workspaceTabs}>
          <Tabs tabs={TABS} activeTab={active} onTabChange={setActive} />
        </div>

        <div className={styles.workspaceBody}>
          {active === 0 ? (
            <TimesheetReviewPage />
          ) : (
            <Suspense fallback={<div className={styles.loadingState}>Загрузка экспорта...</div>}>
              <MassTimesheetExportPage />
            </Suspense>
          )}
        </div>
      </section>
    </div>
  );
};
