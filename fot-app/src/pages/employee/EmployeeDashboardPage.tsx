import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { apiClient } from '../../api/client';
import { employeeService } from '../../services/employeeService';
import { skudService } from '../../services/skudService';
import type { Employee, SkudEvent } from '../../types';
import styles from './EmployeeDashboard.module.css';

type RequestType = 'vacation' | 'sick' | 'remote' | 'docs';

const formatTime = (t: string) => t.slice(0, 5);

const formatDateRu = (d: string) =>
  new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

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
  hours: number;
  isToday: boolean;
  isWeekend: boolean;
}

const buildWeekAttendance = (events: SkudEvent[]): DayAttendance[] => {
  const today = new Date();
  const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDay);
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const result: DayAttendance[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayEvents = events
      .filter((e) => e.event_date === dateStr)
      .sort((a, b) => a.event_time.localeCompare(b.event_time));

    const firstEntry = dayEvents.length > 0 ? dayEvents[0].event_time : null;
    const lastExit = dayEvents.length > 1 ? dayEvents[dayEvents.length - 1].event_time : null;

    let hours = 0;
    if (firstEntry && lastExit) {
      const [h1, m1] = firstEntry.split(':').map(Number);
      const [h2, m2] = lastExit.split(':').map(Number);
      hours = Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
    }

    result.push({
      date: dateStr,
      dayName: dayNames[i],
      firstEntry,
      lastExit,
      hours: Math.round(hours * 10) / 10,
      isToday: dateStr === today.toISOString().slice(0, 10),
      isWeekend: i >= 5,
    });
  }
  return result;
};

export const EmployeeDashboardPage: React.FC = () => {
  const { user, profile, refreshProfile, isTwoFactorEnabled } = useAuth();
  const { showToast } = useToast();
  const [activeModal, setActiveModal] = useState<RequestType | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [skudEvents, setSkudEvents] = useState<SkudEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // 2FA state
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFAData, setTwoFAData] = useState<{ secret: string; qrCode: string; recoveryCodes: string[] } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile?.employee_id) {
        setLoading(false);
        return;
      }
      try {
        const today = new Date();
        const currentDay = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDay);

        const [emp, events] = await Promise.all([
          employeeService.getById(profile.employee_id),
          skudService.getEmployeeEvents(
            profile.employee_id,
            startOfWeek.toISOString().slice(0, 10),
            today.toISOString().slice(0, 10)
          ),
        ]);
        setEmployee(emp);
        setSkudEvents(events);
      } catch (e) {
        console.error('Failed to load employee data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.employee_id]);

  const weekData = useMemo(() => buildWeekAttendance(skudEvents), [skudEvents]);
  const todayData = weekData.find((d) => d.isToday);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEvents = skudEvents
    .filter((e) => e.event_date === todayStr)
    .sort((a, b) => a.event_time.localeCompare(b.event_time));

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
      setShow2FASetup(false);
      setTwoFAData(null);
      setVerifyCode('');
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
        <div className={styles.quickActionCard} onClick={() => setActiveModal('vacation')}>
          <div className={`${styles.quickActionIcon} ${styles.vacation}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className={styles.quickActionTitle}>Отпуск</div>
          <div className={styles.quickActionDesc}>Ежегодный оплачиваемый</div>
        </div>
        <div className={styles.quickActionCard} onClick={() => setActiveModal('sick')}>
          <div className={`${styles.quickActionIcon} ${styles.sick}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className={styles.quickActionTitle}>Больничный</div>
          <div className={styles.quickActionDesc}>Листок нетрудоспособности</div>
        </div>
        <div className={styles.quickActionCard} onClick={() => setActiveModal('remote')}>
          <div className={`${styles.quickActionIcon} ${styles.remote}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div className={styles.quickActionTitle}>Удалёнка</div>
          <div className={styles.quickActionDesc}>Работа из дома</div>
        </div>
        <div className={styles.quickActionCard} onClick={() => setActiveModal('docs')}>
          <div className={`${styles.quickActionIcon} ${styles.docs}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div className={styles.quickActionTitle}>Справка</div>
          <div className={styles.quickActionDesc}>Запросить документ</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className={styles.contentGrid}>
        {/* Today's attendance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Посещаемость сегодня</h2>
            <span className={styles.sectionAction}>
              {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className={styles.requestsList}>
            {loading ? (
              <div className={styles.emptyState}>Загрузка...</div>
            ) : todayEvents.length === 0 ? (
              <div className={styles.emptyState}>Нет событий СКУД за сегодня</div>
            ) : (
              todayEvents.map((event, i) => (
                <div key={event.id || i} className={styles.requestItem}>
                  <div className={`${styles.requestIcon} ${i === 0 ? styles.vacation : styles.overtime}`}>
                    {i === 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    )}
                  </div>
                  <div className={styles.requestContent}>
                    <div className={styles.requestTitle}>
                      {i === 0 ? 'Вход' : i === todayEvents.length - 1 ? 'Последнее событие' : 'Событие'}
                    </div>
                    <div className={styles.requestMeta}>
                      {event.access_point || '—'}
                    </div>
                  </div>
                  <div className={`${styles.requestStatus} ${styles.approved}`}>
                    {formatTime(event.event_time)}
                  </div>
                </div>
              ))
            )}
            {todayData && todayData.hours > 0 && (
              <div className={styles.todaySummary}>
                <span>Отработано:</span>
                <strong>{todayData.hours} ч</strong>
              </div>
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
                  <span className={styles.vacationDetailValue}>
                    {employee.hire_date ? formatDateRu(employee.hire_date) : '—'}
                  </span>
                </div>
                <div className={styles.vacationDetail}>
                  <span className={styles.vacationDetailLabel}>Стаж</span>
                  <span className={styles.vacationDetailValue}>
                    {employee.hire_date ? calcYears(employee.hire_date) : '—'}
                  </span>
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

          {/* Weekly Schedule from SKUD */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <div className={`${styles.infoCardIcon} ${styles.schedule}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className={styles.infoCardTitle}>Посещаемость за неделю</div>
            </div>
            {todayData && (
              <div className={styles.scheduleToday}>
                <span className={styles.scheduleTodayLabel}>Сегодня</span>
                <span className={styles.scheduleTodayValue}>
                  {todayData.firstEntry ? formatTime(todayData.firstEntry) : '—'}
                  {' – '}
                  {todayData.lastExit ? formatTime(todayData.lastExit) : 'на месте'}
                </span>
              </div>
            )}
            <div className={styles.scheduleWeek}>
              {weekData.map((day) => (
                <div
                  key={day.date}
                  className={`${styles.scheduleDay} ${day.isToday ? styles.today : ''} ${day.isWeekend ? styles.weekend : ''}`}
                >
                  <div className={styles.scheduleDayName}>{day.dayName}</div>
                  <div className={styles.scheduleDayNum}>
                    {day.firstEntry ? formatTime(day.firstEntry) : '—'}
                  </div>
                  {day.hours > 0 && (
                    <div className={styles.scheduleDayHours}>{day.hours}ч</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile & Security */}
      <div className={styles.profileSection}>
        <div className={styles.profileRow}>
          <div className={styles.profileItem}>
            <span className={styles.profileLabel}>Email</span>
            <span className={styles.profileValue}>{user?.email || '—'}</span>
          </div>
          <div className={styles.profileItem}>
            <span className={styles.profileLabel}>2FA</span>
            <span className={styles.profileValue}>
              {isTwoFactorEnabled ? (
                <>
                  <span className={styles.statusOn}>Включена</span>
                  <button className={styles.link2FA} onClick={handleDisable2FA}>Отключить</button>
                </>
              ) : (
                <>
                  <span className={styles.statusOff}>Отключена</span>
                  <button className={styles.link2FA} onClick={handleSetup2FA}>Включить</button>
                </>
              )}
            </span>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: 12, fontSize: 13 }}>Отсканируйте QR-код в приложении аутентификации:</p>
              <img src={twoFAData.qrCode} alt="QR" style={{ display: 'block', margin: '0 auto 16px', maxWidth: 200 }} />
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>Или введите вручную:</p>
              <code style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, marginBottom: 16, wordBreak: 'break-all' }}>{twoFAData.secret}</code>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Код из приложения</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                />
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

      {/* Modal */}
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {activeModal === 'vacation' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Тип отпуска <span className={styles.required}>*</span>
                    </label>
                    <select className={styles.formSelect}>
                      <option>Ежегодный оплачиваемый</option>
                      <option>За свой счёт</option>
                      <option>Учебный</option>
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Дата начала <span className={styles.required}>*</span>
                      </label>
                      <input type="date" className={styles.formInput} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Дата окончания <span className={styles.required}>*</span>
                      </label>
                      <input type="date" className={styles.formInput} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Комментарий</label>
                    <textarea className={styles.formTextarea} placeholder="Дополнительная информация..." />
                  </div>
                </>
              )}
              {activeModal === 'sick' && (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Дата начала <span className={styles.required}>*</span>
                      </label>
                      <input type="date" className={styles.formInput} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Дата окончания</label>
                      <input type="date" className={styles.formInput} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Номер больничного листа</label>
                    <input type="text" className={styles.formInput} placeholder="Номер ЭЛН" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Комментарий</label>
                    <textarea className={styles.formTextarea} placeholder="Дополнительная информация..." />
                  </div>
                </>
              )}
              {activeModal === 'remote' && (
                <>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Дата <span className={styles.required}>*</span>
                      </label>
                      <input type="date" className={styles.formInput} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        До даты
                      </label>
                      <input type="date" className={styles.formInput} />
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Причина <span className={styles.required}>*</span>
                    </label>
                    <textarea className={styles.formTextarea} placeholder="Укажите причину работы из дома..." />
                  </div>
                </>
              )}
              {activeModal === 'docs' && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Тип справки <span className={styles.required}>*</span>
                    </label>
                    <select className={styles.formSelect}>
                      <option>2-НДФЛ</option>
                      <option>Справка с места работы</option>
                      <option>Копия трудовой книжки</option>
                      <option>Справка о доходах</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Период (для 2-НДФЛ)</label>
                    <select className={styles.formSelect}>
                      <option>2025 год</option>
                      <option>2024 год</option>
                      <option>2023 год</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Комментарий</label>
                    <textarea className={styles.formTextarea} placeholder="Для чего нужна справка..." />
                  </div>
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setActiveModal(null)}>
                Отмена
              </button>
              <button className={styles.btnPrimary}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
