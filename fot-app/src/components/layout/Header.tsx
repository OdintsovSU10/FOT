import { useState } from 'react';
import type { FC } from 'react';
import styles from './Header.module.css';
import { IconButton } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { MoonIcon, SunIcon, BellIcon } from '../ui/Icons';
import { NotificationDropdown } from '../ui/NotificationDropdown';
import { useNotifications } from '../../hooks/useNotifications';
import dropdownStyles from '../ui/NotificationDropdown.module.css';

interface IHeaderProps {
  title: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onMenuOpen?: () => void;
  showPeriodTabs?: boolean;
}

const periodTabs = ['Сегодня', 'Неделя', 'Месяц'];

export const Header: FC<IHeaderProps> = ({ title, theme, onToggleTheme, onMenuOpen, showPeriodTabs = false }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const { notifications, unreadCount, loading, loadNotifications, markRead, markAllRead } = useNotifications();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {onMenuOpen && (
          <button className={styles.menuBtn} onClick={onMenuOpen}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}
        <h1 className={styles.title}>{title}</h1>
        {showPeriodTabs && <Tabs tabs={periodTabs} activeTab={activeTab} onTabChange={setActiveTab} />}
      </div>

      <div className={styles.right}>
        <IconButton onClick={onToggleTheme} title="Переключить тему">
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </IconButton>

        <div className={dropdownStyles.wrapper}>
          <IconButton onClick={() => setBellOpen(!bellOpen)} title="Уведомления">
            <BellIcon />
            {unreadCount > 0 && (
              <span className={dropdownStyles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </IconButton>
          {bellOpen && (
            <NotificationDropdown
              notifications={notifications}
              loading={loading}
              onLoad={loadNotifications}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
              onClose={() => setBellOpen(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
};
