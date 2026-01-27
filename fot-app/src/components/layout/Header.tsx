import { useState } from 'react';
import type { FC } from 'react';
import styles from './Header.module.css';
import { SearchInput } from '../ui/SearchInput';
import { IconButton } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { MoonIcon, SunIcon, BellIcon } from '../ui/Icons';

interface IHeaderProps {
  title: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const periodTabs = ['Сегодня', 'Неделя', 'Месяц'];

export const Header: FC<IHeaderProps> = ({ title, theme, onToggleTheme }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
        <Tabs tabs={periodTabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className={styles.right}>
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Поиск сотрудника..."
        />

        <IconButton onClick={onToggleTheme} title="Переключить тему">
          {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
        </IconButton>

        <IconButton hasNotification>
          <BellIcon />
        </IconButton>
      </div>
    </header>
  );
};
