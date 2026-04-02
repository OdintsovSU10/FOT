import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { skudService } from '../services/skudService';
import type { IAccessPointSetting } from '../types';

type PresenceStatus = 'online' | 'offline' | 'unknown';

const REFRESH_INTERVAL = 60_000;

const toLocalISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const useMyPresence = (): { status: PresenceStatus; loading: boolean } => {
  const { profile } = useAuth();
  const [status, setStatus] = useState<PresenceStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const check = useCallback(async () => {
    const empId = profile?.employee_id;
    if (!empId) { setStatus('unknown'); setLoading(false); return; }

    try {
      const today = toLocalISO(new Date());
      const [events, apSettings] = await Promise.all([
        skudService.getEmployeeEvents(empId, today, today),
        skudService.getAccessPointSettings().catch(() => [] as IAccessPointSetting[]),
      ]);

      const internalPoints = new Set(apSettings.filter(s => s.is_internal).map(s => s.access_point_name));
      const extEvents = events
        .filter(e => !e.access_point || !internalPoints.has(e.access_point))
        .sort((a, b) => b.event_time.localeCompare(a.event_time));

      const lastExt = extEvents[0];
      if (!lastExt) {
        setStatus('unknown');
      } else {
        setStatus(lastExt.direction === 'entry' ? 'online' : 'offline');
      }
    } catch {
      setStatus('unknown');
    } finally {
      setLoading(false);
    }
  }, [profile?.employee_id]);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (!profile?.employee_id) return;
    intervalRef.current = window.setInterval(check, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [check, profile?.employee_id]);

  return { status, loading };
};
