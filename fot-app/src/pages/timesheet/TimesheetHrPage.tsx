import { type FC, useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { TimesheetReviewPage } from './TimesheetReviewPage';
import { MassTimesheetExportPage } from './MassTimesheetExportPage';

const TABS = ['Проверка', 'Экспорт'];

export const TimesheetHrPage: FC = () => {
  const [active, setActive] = useState(0);

  return (
    <div>
      <Tabs tabs={TABS} activeTab={active} onTabChange={setActive} />
      {active === 0 ? <TimesheetReviewPage /> : <MassTimesheetExportPage />}
    </div>
  );
};
