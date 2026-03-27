import { useState, type FC } from 'react';
import { Building, FolderTree } from 'lucide-react';
import { ManagePage } from './ManagePage';
import { OrganizationsPage } from './OrganizationsPage';
import styles from './AdminManagePage.module.css';

type AdminManageTab = 'structure' | 'organizations';

export const AdminManagePage: FC = () => {
  const [activeTab, setActiveTab] = useState<AdminManageTab>('structure');

  return (
    <div>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'structure' ? styles.active : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          <FolderTree size={14} />
          Структура
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'organizations' ? styles.active : ''}`}
          onClick={() => setActiveTab('organizations')}
        >
          <Building size={14} />
          Организации
        </button>
      </div>

      {activeTab === 'structure' && <ManagePage />}
      {activeTab === 'organizations' && <OrganizationsPage />}
    </div>
  );
};

export default AdminManagePage;
