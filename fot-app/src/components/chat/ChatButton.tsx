import type { FC } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useChatContext } from '../../contexts/ChatContext';
import styles from './ChatButton.module.css';

export const ChatButton: FC = () => {
  const { isAuthenticated, isApproved } = useAuth();
  const { toggleChat, unreadTotal, isOpen } = useChatContext();

  if (!isAuthenticated || !isApproved || isOpen) return null;

  return (
    <button className={styles.button} onClick={toggleChat} title="Открыть чат">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      {unreadTotal > 0 && (
        <span className={styles.badge}>{unreadTotal > 99 ? '99+' : unreadTotal}</span>
      )}
    </button>
  );
};
