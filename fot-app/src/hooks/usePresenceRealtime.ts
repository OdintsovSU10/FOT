import { useEffect, useId, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { wsService } from '../services/websocket';

interface IUsePresenceRealtimeOptions {
  owner: string;
  enabled?: boolean;
  debounceMs?: number;
  onPresenceUpdate?: () => void | Promise<void>;
  onVisible?: () => void | Promise<void>;
}

export const usePresenceRealtime = ({
  owner,
  enabled = true,
  debounceMs = 250,
  onPresenceUpdate,
  onVisible,
}: IUsePresenceRealtimeOptions): void => {
  const { token, isAuthenticated, isApproved } = useAuth();
  const instanceId = useId();
  const ownerId = `${owner}:${instanceId}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRef = useRef(onPresenceUpdate);
  const visibleRef = useRef(onVisible ?? onPresenceUpdate);

  useEffect(() => {
    updateRef.current = onPresenceUpdate;
  }, [onPresenceUpdate]);

  useEffect(() => {
    visibleRef.current = onVisible ?? onPresenceUpdate;
  }, [onVisible, onPresenceUpdate]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !isApproved || !token) {
      wsService.disconnect(ownerId);
      return undefined;
    }

    wsService.connect(token, ownerId);
    return () => {
      wsService.disconnect(ownerId);
    };
  }, [enabled, isApproved, isAuthenticated, ownerId, token]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribe = wsService.on('presence_updated', () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void updateRef.current?.();
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [debounceMs, enabled]);

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') {
      return undefined;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      void visibleRef.current?.();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
};
