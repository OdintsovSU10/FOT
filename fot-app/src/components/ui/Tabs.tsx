import type { FC } from 'react';
import styles from './Tabs.module.css';

interface ITabsProps {
  tabs: string[];
  activeTab: number;
  onTabChange: (index: number) => void;
}

export const Tabs: FC<ITabsProps> = ({ tabs, activeTab, onTabChange }) => (
  <div className={styles.tabs}>
    {tabs.map((tab, index) => (
      <button
        key={tab}
        className={`${styles.tab} ${activeTab === index ? styles.active : ''}`}
        onClick={() => onTabChange(index)}
      >
        {tab}
      </button>
    ))}
  </div>
);
