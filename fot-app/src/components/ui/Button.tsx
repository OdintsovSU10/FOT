import type { FC, ReactNode, ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'icon';
  icon?: ReactNode;
}

export const Button: FC<IButtonProps> = ({
  children,
  variant = 'primary',
  icon,
  className,
  ...props
}) => (
  <button className={`${styles.button} ${styles[variant]} ${className || ''}`} {...props}>
    {icon && <span className={styles.icon}>{icon}</span>}
    {children}
  </button>
);

interface IIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  hasNotification?: boolean;
}

export const IconButton: FC<IIconButtonProps> = ({
  children,
  hasNotification,
  className,
  ...props
}) => (
  <button className={`${styles.iconButton} ${className || ''}`} {...props}>
    {children}
    {hasNotification && <span className={styles.notification} />}
  </button>
);
