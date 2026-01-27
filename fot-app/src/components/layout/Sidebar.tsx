import type { FC } from 'react';
import styles from './Sidebar.module.css';
import {
  GridIcon,
  UsersIcon,
  CalendarIcon,
  ShieldIcon,
  ClockIcon,
  DollarIcon,
  TrendUpIcon,
  ChartIcon,
  SettingsIcon
} from '../ui/Icons';

interface INavItem {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
  badge?: number;
}

interface INavGroup {
  label: string;
  items: INavItem[];
}

const navGroups: INavGroup[] = [
  {
    label: 'Основное',
    items: [
      { id: 'overview', label: 'Обзор', icon: GridIcon },
      { id: 'employees', label: 'Сотрудники', icon: UsersIcon, badge: 0 },
      { id: 'timesheet', label: 'Табель', icon: CalendarIcon },
    ]
  },
  {
    label: 'Контроль',
    items: [
      { id: 'access', label: 'СКУД', icon: ShieldIcon },
      { id: 'time', label: 'Время', icon: ClockIcon },
    ]
  },
  {
    label: 'Финансы',
    items: [
      { id: 'salary', label: 'Зарплаты', icon: DollarIcon },
      { id: 'raises', label: 'Повышения', icon: TrendUpIcon },
    ]
  },
  {
    label: 'Система',
    items: [
      { id: 'reports', label: 'Отчёты', icon: ChartIcon },
      { id: 'settings', label: 'Настройки', icon: SettingsIcon },
    ]
  }
];

interface ISidebarProps {
  activeItem?: string;
  onItemClick?: (id: string) => void;
  theme?: 'light' | 'dark';
}

export const Sidebar: FC<ISidebarProps> = ({ activeItem = 'overview', onItemClick, theme = 'dark' }) => {
  const logoSrc = theme === 'dark' ? '/fot-logo-dark.svg' : '/fot-logo-light.svg';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src={logoSrc} alt="FOT" className={styles.logoImage} />
      </div>

      <nav className={styles.nav}>
        {navGroups.map(group => (
          <div key={group.label} className={styles.navGroup}>
            <div className={styles.navLabel}>{group.label}</div>
            {group.items.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`${styles.navItem} ${activeItem === item.id ? styles.active : ''}`}
                  onClick={() => onItemClick?.(item.id)}
                >
                  <Icon className={styles.navIcon} />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={styles.navBadge}>{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>--</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>Не авторизован</div>
            <div className={styles.userRole}>Гость</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
