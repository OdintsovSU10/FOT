import type { FC, ReactNode } from 'react';
import { EmployeeSidebar } from './EmployeeSidebar';
import styles from './EmployeeLayout.module.css';
import { useMobileMenu } from '../../hooks/useMobileMenu';

interface IEmployeeLayoutProps {
  children: ReactNode;
  title: string;
}

export const EmployeeLayout: FC<IEmployeeLayoutProps> = ({ children, title }) => {
  const { isOpen, open, close } = useMobileMenu();

  return (
    <div className={styles.app}>
      {isOpen && <div className={styles.overlay} onClick={close} />}
      <EmployeeSidebar isOpen={isOpen} onClose={close} />
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.menuBtn} onClick={open}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.headerBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className={styles.notificationIndicator}></span>
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
};
