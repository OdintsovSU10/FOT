import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../api/client';
import { employeeService } from '../../services/employeeService';
import { skudService } from '../../services/skudService';
import type { Employee, SkudEvent, IAccessPointSetting } from '../../types';
import styles from './EmployeeDashboard.module.css';

type RequestType = 'vacation' | 'sick' | 'remote' | 'docs';
type ViewPeriod = 'day' | 'week' | 'month';

const formatTime = (t: string) => t.slice(0, 5);

const formatDateRu = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const formatHM = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
};

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const calcYears = (from: string): string => {
  const diff = Date.now() - new Date(from).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  if (years === 0) return 'менее года';
  const lastDigit = years % 10;
  const lastTwo = years % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${years} лет`;
  if (lastDigit === 1) return `${years} год`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${years} года`;
  return `${years} лет`;
};

interface DayAttendance {
  date: string;
  dayName: string;
  firstEntry: string | null;
  lastExit: string | null;
  totalMinutes: number;
  isToday: boolean;
  isWeekend: boolean;
}

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const buildWeekAttendance = (events: SkudEvent[], startDate: string): DayAttendance[] => {
  const start = new Date(startDate + 'T00:00:00');
  const todayStr = new Date().toISOString().slice(0, 10);
  const result: DayAttendance[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayEvents = events
      .filter((e) => e.event_date === dateStr)
      .sort((a, b) => a.event_time.localeCompare(b.event_time));

    const firstEntry = dayEvents.length > 0 ? dayEvents[0].event_time : null;
    const lastExit = dayEvents.length > 1 ? dayEvents[dayEvents.length - 1].event_time : null;
    const totalMinutes = firstEntry && lastExit
      ? Math.max(0, timeToMinutes(lastExit) - timeToMinutes(firstEntry))
      : 0;

    result.push({
      date: dateStr,
      dayName: DAY_NAMES[i],
      firstEntry,
      lastExit,
      totalMinutes,
      isToday: dateStr === todayStr,
      isWeekend: i >= 5,
    });
  }
  return result;
};

const getPeriodRange = (period: ViewPeriod, offset: number): { startDate: string; endDate: string; label: string } => {
  const today = new Date();

  if (period === 'day') {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = offset === 0;
    const label = isToday
      ? 'Сегодня'
      : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return { startDate: dateStr, endDate: dateStr, label };
  }

  if (period === 'week') {
    const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - currentDay + offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const label = `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      label,
    };
  }

  // month
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return {
    startDate: d.toISOString().slice(0, 10),
    endDate: last.toISOString().slice(0, 10),
    label,
  };
};

export const EmployeeDashboardPage: React.FC = () => {
  const { user, profile, refreshProfile, isTwoFactorEnabled } = useAuth();
  const { showToast } = useToast();
  const [activeModal, setActiveModal] = useState<RequestType | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [skudEvents, setSkudEvents] = useState<SkudEvent[]>([]);
  const [internalPoints, setInternalPoints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Period navigation
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('day');
  const [periodOffset, setPeriodOffset] = useState(0);

  // 2FA state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFAData, setTwoFAData] = useState<{ secret: string; qrCode: string; recoveryCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);

  const periodRange = useMemo(() => getPeriodRange(viewPeriod, periodOffset), [viewPeriod, periodOffset]);

  // Initial load: employee + access point settings
  useEffect(() => {
    const load = async () => {
      if (!profile?.employee_id) { setLoading(false); return; }
      try {
        const [emp, apSettings] = await Promise.all([
          employeeService.getById(profile.employee_id),
          skudService.getAccessPointSettings().catch(() => [] as IAccessPointSetting[]),
        ]);
        setEmployee(emp);
        setInternalPoints(new Set(apSettings.filter(s => s.is_internal).map(s => s.access_point_name)));
      } catch (e) {
        console.error('Failed to load employee data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.employee_id]);

  // Load SKUD events when period changes
  const loadEvents = useCallback(async (empId: number, start: string, end: string) => {
    setEventsLoading(true);
    try {
      const events = await skudService.getEmployeeEvents(empId, start, end);
      setSkudEvents(events);
    } catch (e) {
      console.error('Failed to load events:', e);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.employee_id) return;
    loadEvents(profile.employee_id, periodRange.startDate, periodRange.endDate);
  }, [profile?.employee_id, periodRange.startDate, periodRange.endDate, loadEvents]);

  // Build display data
  const weekStartDate = useMemo(() => {
    if (viewPeriod === 'week') return periodRange.startDate;
    const today = new Date();
    const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - currentDay);
    return start.toISOString().slice(0, 10);
  }, [viewPeriod, periodRange.startDate]);

  const weekData = useMemo(
    () => buildWeekAttendance(skudEvents, viewPeriod === 'week' ? periodRange.startDate : weekStartDate),
    [skudEvents, viewPeriod, periodRange.startDate, weekStartDate]
  );

  const dayEvents = useMemo(() => {
    const dateStr = viewPeriod === 'day' ? periodRange.startDate : new Date().toISOString().slice(0, 10);
    return skudEvents
      .filter((e) => e.event_date === dateStr)
      .sort((a, b) => a.event_time.localeCompare(b.event_time));
  }, [skudEvents, viewPeriod, periodRange.startDate]);

  const dayData = useMemo(() => {
    const first = dayEvents.length > 0 ? dayEvents[0].event_time : null;
    const last = dayEvents.length > 1 ? dayEvents[dayEvents.length - 1].event_time : null;
    const totalMinutes = first && last ? Math.max(0, timeToMinutes(last) - timeToMinutes(first)) : 0;
    return { firstEntry: first, lastExit: last, totalMinutes };
  }, [dayEvents]);

  // Month data: list of days
  const monthDays = useMemo(() => {
    if (viewPeriod !== 'month') return [];
    const start = new Date(periodRange.startDate + 'T00:00:00');
    const end = new Date(periodRange.endDate + 'T00:00:00');
    const todayStr = new Date().toISOString().slice(0, 10);
    const days: DayAttendance[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dayEvts = skudEvents
        .filter(e => e.event_date === dateStr)
        .sort((a, b) => a.event_time.localeCompare(b.event_time));
      const firstEntry = dayEvts.length > 0 ? dayEvts[0].event_time : null;
      const lastExit = dayEvts.length > 1 ? dayEvts[dayEvts.length - 1].event_time : null;
      const totalMinutes = firstEntry && lastExit
        ? Math.max(0, timeToMinutes(lastExit) - timeToMinutes(firstEntry)) : 0;
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
      days.push({ date: dateStr, dayName: DAY_NAMES[dow], firstEntry, lastExit, totalMinutes, isToday: dateStr === todayStr, isWeekend: dow >= 5 });
    }
    return days;
  }, [viewPeriod, periodRange, skudEvents]);

  const isCurrentPeriod = periodOffset === 0;

  const getEventColor = (event: SkudEvent) => {
    const isInternal = event.access_point ? internalPoints.has(event.access_point) : false;
    if (isInternal) return { dot: styles.skudInternal, badge: styles.statusGray, label: 'Внутр.' };
    const dir = event.direction?.toLowerCase() || '';
    const isEntry = dir.includes('вход') || dir.includes('in') || event.direction === '1' || dir === 'entry';
    const isExit = dir.includes('выход') || dir.includes('out') || event.direction === '0' || dir === 'exit';
    if (isEntry) return { dot: styles.skudEntry, badge: styles.approved, label: 'Вход' };
    if (isExit) return { dot: styles.skudExit, badge: styles.statusRed, label: 'Выход' };
    return { dot: styles.skudInternal, badge: styles.statusGray, label: 'Событие' };
  };

  const handleSetup2FA = async () => {
    try {
      const data = await apiClient.post<{ secret: string; qrCode: string; recoveryCodes: string[] }>('/auth/2fa/setup');
      setTwoFAData(data);
      setShow2FASetup(true);
    } catch {
      showToast('error', 'Ошибка при настройке 2FA');
    }
  };

  const handleEnable2FA = async () => {
    if (!verifyCode.trim()) { showToast('error', 'Введите код'); return; }
    setIsEnabling2FA(true);
    try {
      await apiClient.post('/auth/2fa/enable', { code: verifyCode });
      await refreshProfile();
      setShow2FASetup(false); setTwoFAData(null); setVerifyCode('');
      showToast('success', '2FA включена');
    } catch {
      showToast('error', 'Неверный код');
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm('Отключить двухфакторную аутентификацию?')) return;
    try {
      await apiClient.post('/auth/2fa/disable');
      await refreshProfile();
      showToast('success', '2FA отключена');
    } catch {
      showToast('error', 'Ошибка при отключении 2FA');
    }
  };

  return (
    <div className={styles.content}>
      {/* Quick Actions */}
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Подать заявление</h2>
      </div>
      <div className={styles.quickActionsGrid}>
        {(['vacation','sick','remote','docs'] as RequestType[]).map((type) => (
          <div key={type} className={styles.quickActionCard} onClick={() => setActiveModal(type)}>
            <div className={`${styles.quickActionIcon} ${styles[type]}`}>
              {type === 'vacation' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
              {type === 'sick' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
              {type === 'remote' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
              {type === 'docs' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>}
            </div>
            <div className={styles.quickActionTitle}>{type === 'vacation' ? 'Отпуск' : type === 'sick' ? 'Больничный' : type === 'remote' ? 'Удалёнка' : 'Справка'}</div>
            <div className={styles.quickActionDesc}>{type === 'vacation' ? 'Ежегодный оплачиваемый' : type === 'sick' ? 'Листок нетрудоспособности' : type === 'remote' ? 'Работа из дома' : 'Запросить документ'}</div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className={styles.contentGrid}>
        {/* Attendance block */}
        <div className={styles.card}>
          {/* Period controls */}
          <div className={styles.attendanceHeader}>
            <div className={styles.periodTabs}>
              {(['day','week','month'] as ViewPeriod[]).map(p => (
                <button
                  key={p}
                  className={`${styles.periodTab} ${viewPeriod === p ? styles.periodTabActive : ''}`}
                  onClick={() => { setViewPeriod(p); setPeriodOffset(0); }}
                >
                  {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
            <div className={styles.periodNav}>
              <button className={styles.periodNavBtn} onClick={() => setPeriodOffset(o => o - 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className={styles.periodLabel}>{periodRange.label}</span>
              <button
                className={styles.periodNavBtn}
                onClick={() => setPeriodOffset(o => o + 1)}
                disabled={isCurrentPeriod}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div className={styles.requestsList}>
            {(loading || eventsLoading) ? (
              <div className={styles.emptyState}>Загрузка...</div>
            ) : viewPeriod === 'day' ? (
              <>
                {dayEvents.length === 0 ? (
                  <div className={styles.emptyState}>Нет событий СКУД</div>
                ) : (
                  dayEvents.map((event, i) => {
                    const { dot, badge, label } = getEventColor(event);
                    const firstEntry = dayEvents[0]?.event_time;
                    const duration = firstEntry && i > 0
                      ? Math.max(0, timeToMinutes(event.event_time) - timeToMinutes(firstEntry))
                      : 0;
                    return (
                      <div key={event.id || i} className={styles.requestItem}>
                        <div className={`${styles.skudDot} ${dot}`} />
                        <div className={styles.requestContent}>
                          <div className={styles.requestTitle}>{label}</div>
                          <div className={styles.requestMeta}>
                            {event.access_point || '—'}
                            {duration > 0 && <span className={styles.durationBadge}>{formatHM(duration)}</span>}
                          </div>
                        </div>
                        <div className={`${styles.requestStatus} ${badge}`}>
                          {formatTime(event.event_time)}
                        </div>
                      </div>
                    );
                  })
                )}
                {dayData.totalMinutes > 0 && (
                  <div className={styles.todaySummary}>
                    <span>Итого отработано:</span>
                    <strong>{formatHM(dayData.totalMinutes)}</strong>
                  </div>
                )}
              </>
            ) : viewPeriod === 'week' ? (
              <>
                <div className={styles.scheduleWeekFull}>
                  {weekData.map((day) => (
                    <div
                      key={day.date}
                      className={`${styles.scheduleRow} ${day.isToday ? styles.today : ''} ${day.isWeekend ? styles.weekend : ''}`}
                    >
                      <div className={styles.scheduleRowDay}>
                        <span className={styles.scheduleDayName}>{day.dayName}</span>
                        <span className={styles.scheduleDayDate}>{formatDateRu(day.date)}</span>
                      </div>
                      <div className={styles.scheduleRowTimes}>
                        {day.firstEntry ? (
                          <>
                            <span className={styles.scheduleEntry}>{formatTime(day.firstEntry)}</span>
                            <span className={styles.scheduleSep}>–</span>
                            <span className={styles.scheduleExit}>{day.lastExit ? formatTime(day.lastExit) : 'на месте'}</span>
                          </>
                        ) : (
                          <span className={styles.scheduleAbsent}>—</span>
                        )}
                      </div>
                      {day.totalMinutes > 0 && (
                        <div className={styles.scheduleRowHours}>{formatHM(day.totalMinutes)}</div>
                      )}
                    </div>
                  ))}
                </div>
                {weekData.reduce((s, d) => s + d.totalMinutes, 0) > 0 && (
                  <div className={styles.todaySummary}>
                    <span>Итого за неделю:</span>
                    <strong>{formatHM(weekData.reduce((s, d) => s + d.totalMinutes, 0))}</strong>
                  </div>
                )}
              </>
            ) : (
              // Month view
              <>
                <div className={styles.scheduleWeekFull}>
                  {monthDays.filter(d => !d.isWeekend || d.firstEntry).map((day) => (
                    <div
                      key={day.date}
                      className={`${styles.scheduleRow} ${day.isToday ? styles.today : ''} ${day.isWeekend ? styles.weekend : ''}`}
                    >
                      <div className={styles.scheduleRowDay}>
                        <span className={styles.scheduleDayName}>{day.dayName}</span>
                        <span className={styles.scheduleDayDate}>{formatDateRu(day.date)}</span>
                      </div>
                      <div className={styles.scheduleRowTimes}>
                        {day.firstEntry ? (
                          <>
                            <span className={styles.scheduleEntry}>{formatTime(day.firstEntry)}</span>
                            <span className={styles.scheduleSep}>–</span>
                            <span className={styles.scheduleExit}>{day.lastExit ? formatTime(day.lastExit) : 'на месте'}</span>
                          </>
                        ) : (
                          <span className={styles.scheduleAbsent}>—</span>
                        )}
                      </div>
                      {day.totalMinutes > 0 && (
                        <div className={styles.scheduleRowHours}>{formatHM(day.totalMinutes)}</div>
                      )}
                    </div>
                  ))}
                </div>
                {monthDays.reduce((s, d) => s + d.totalMinutes, 0) > 0 && (
                  <div className={styles.todaySummary}>
                    <span>Итого за месяц:</span>
                    <strong>{formatHM(monthDays.reduce((s, d) => s + d.totalMinutes, 0))}</strong>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className={styles.infoCards}>
          {/* Employee Info */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <div className={`${styles.infoCardIcon} ${styles.vacation}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className={styles.infoCardTitle}>Информация</div>
            </div>
            {loading ? (
              <div className={styles.emptyState}>Загрузка...</div>
            ) : employee ? (
              <div className={styles.vacationDetails}>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Отдел</span>
                  <span className={styles.vacationDetailValue}>{employee.department || '—'}</span>
                </div>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Должность</span>
                  <span className={styles.vacationDetailValue}>{employee.position_name || profile?.imported_position || '—'}</span>
                </div>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Дата приёма</span>
                  <span className={styles.vacationDetailValue}>{employee.hire_date ? formatDateRu(employee.hire_date) : '—'}</span>
                </div>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Стаж</span>
                  <span className={styles.vacationDetailValue}>{employee.hire_date ? calcYears(employee.hire_date) : '—'}</span>
                </div>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Таб. номер</span>
                  <span className={styles.vacationDetailValue}>{employee.tab_number || '—'}</span>
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>Данные не найдены</div>
            )}
          </div>

          {/* Profile & Security */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <div className={`${styles.infoCardIcon} ${styles.schedule}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div className={styles.infoCardTitle}>Безопасность</div>
            </div>
            <div className={styles.vacationDetails}>
              <div className={styles.vacationDetail}>
                <span className={styles.vacationDetailLabel}>Email</span>
                <span className={styles.vacationDetailValue}>{user?.email || '—'}</span>
              </div>
              <div className={styles.vacationDetail}>
                <span className={styles.vacationDetailLabel}>2FA</span>
                <span className={styles.vacationDetailValue}>
                  {isTwoFactorEnabled ? (
                    <><span className={styles.statusOn}>Включена</span><button className={styles.link2FA} onClick={handleDisable2FA}>Отключить</button></>
                  ) : (
                    <><span className={styles.statusOff}>Отключена</span><button className={styles.link2FA} onClick={handleSetup2FA}>Включить</button></>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FASetup && twoFAData && (
        <div className={styles.modalOverlay} onClick={() => setShow2FASetup(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Настройка 2FA</h2>
              <button className={styles.modalClose} onClick={() => setShow2FASetup(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: 12, fontSize: 13 }}>Отсканируйте QR-код в приложении аутентификации:</p>
              <img src={twoFAData.qrCode} alt="QR" style={{ display: 'block', margin: '0 auto 16px', maxWidth: 200 }} />
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Или введите вручную:</p>
              <code style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, marginBottom: 16, wordBreak: 'break-all' }}>{twoFAData.secret}</code>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Код из приложения</label>
                <input type="text" className={styles.formInput} value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="000000" maxLength={6} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShow2FASetup(false)}>Отмена</button>
              <button className={styles.btnPrimary} onClick={handleEnable2FA} disabled={isEnabling2FA}>
                {isEnabling2FA ? 'Проверка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Modals */}
      {activeModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {activeModal === 'vacation' && 'Заявление на отпуск'}
                {activeModal === 'sick' && 'Больничный лист'}
                {activeModal === 'remote' && 'Удалённая работа'}
                {activeModal === 'docs' && 'Запрос справки'}
              </h2>
              <button className={styles.modalClose} onClick={() => setActiveModal(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {activeModal === 'vacation' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Тип отпуска <span className={styles.required}>*</span></label>
                    <select className={styles.formSelect}><option>Ежегодный оплачиваемый</option><option>За свой счёт</option><option>Учебный</option></select>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}><label className={styles.formLabel}>Дата начала <span className={styles.required}>*</span></label><input type="date" className={styles.formInput} /></div>
                    <div className={styles.formGroup}><label className={styles.formLabel}>Дата окончания <span className={styles.required}>*</span></label><input type="date" className={styles.formInput} /></div>
                  </div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Комментарий</label><textarea className={styles.formTextarea} placeholder="Дополнительная информация..." /></div>
                </>
              )}
              {activeModal === 'sick' && (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}><label className={styles.formLabel}>Дата начала <span className={styles.required}>*</span></label><input type="date" className={styles.formInput} /></div>
                    <div className={styles.formGroup}><label className={styles.formLabel}>Дата окончания</label><input type="date" className={styles.formInput} /></div>
                  </div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Номер больничного листа</label><input type="text" className={styles.formInput} placeholder="Номер ЭЛН" /></div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Комментарий</label><textarea className={styles.formTextarea} placeholder="Дополнительная информация..." /></div>
                </>
              )}
              {activeModal === 'remote' && (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}><label className={styles.formLabel}>Дата <span className={styles.required}>*</span></label><input type="date" className={styles.formInput} /></div>
                    <div className={styles.formGroup}><label className={styles.formLabel}>До даты</label><input type="date" className={styles.formInput} /></div>
                  </div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Причина <span className={styles.required}>*</span></label><textarea className={styles.formTextarea} placeholder="Укажите причину работы из дома..." /></div>
                </>
              )}
              {activeModal === 'docs' && (
                <>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Тип справки <span className={styles.required}>*</span></label><select className={styles.formSelect}><option>2-НДФЛ</option><option>Справка с места работы</option><option>Копия трудовой книжки</option><option>Справка о доходах</option></select></div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Период (для 2-НДФЛ)</label><select className={styles.formSelect}><option>2025 год</option><option>2024 год</option><option>2023 год</option></select></div>
                  <div className={styles.formGroup}><label className={styles.formLabel}>Комментарий</label><textarea className={styles.formTextarea} placeholder="Для чего нужна справка..." /></div>
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setActiveModal(null)}>Отмена</button>
              <button className={styles.btnPrimary}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
