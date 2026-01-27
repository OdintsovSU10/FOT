import type { FC, ReactNode } from 'react';
import styles from './Layout.module.css';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ILayoutProps {
  children: ReactNode;
  title: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Layout: FC<ILayoutProps> = ({ children, title, theme, onToggleTheme }) => {
  return (
    <div className={styles.app}>
      <Sidebar theme={theme} />
      <main className={styles.main}>
        <Header title={title} theme={theme} onToggleTheme={onToggleTheme} />
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
};
