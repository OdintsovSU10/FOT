import type { FC, ReactNode } from 'react';
import styles from './Card.module.css';

interface ICardProps {
  children: ReactNode;
  className?: string;
}

interface ICardHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export const Card: FC<ICardProps> = ({ children, className }) => (
  <div className={`${styles.card} ${className || ''}`}>
    {children}
  </div>
);

export const CardHeader: FC<ICardHeaderProps> = ({ title, action, onAction }) => (
  <div className={styles.header}>
    <h2 className={styles.title}>{title}</h2>
    {action && (
      <span className={styles.action} onClick={onAction}>
        {action} →
      </span>
    )}
  </div>
);

export const CardContent: FC<ICardProps> = ({ children, className }) => (
  <div className={`${styles.content} ${className || ''}`}>
    {children}
  </div>
);
