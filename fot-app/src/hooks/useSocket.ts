import { useEffect } from 'react';
import { wsService } from '../services/websocket';

export const useSocket = (token: string | null): typeof wsService | null => {
  useEffect(() => {
    if (!token) {
      wsService.disconnect();
      return;
    }

    wsService.connect(token);
    return () => {
      wsService.disconnect();
    };
  }, [token]);

  return token ? wsService : null;
};
