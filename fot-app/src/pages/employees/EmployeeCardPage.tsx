import { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Archive, RotateCcw, Trash2,
  Briefcase, FolderOpen, CalendarDays, CheckCircle,
  Clock, DollarSign, BarChart3, LogIn, LogOut,
} from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { skudService } from '../../services/skudService';
import { structureApi } from '../../api/structure';
import { useAuth } from '../../contexts/AuthContext';
import { EmployeeInfoSection } from '../../components/employees/EmployeeInfoSection';
import { EmployeeHistorySection } from '../../components/employees/EmployeeHistorySection';
import { EmployeeSkudSection } from '../../components/employees/EmployeeSkudSection';
import { AttendanceCalendar } from '../../components/employees/AttendanceCalendar';
import { EmployeeCardSidebar } from '../../components/employees/EmployeeCardSidebar';
import {
  calculateAttendance, isEmployeeOnSite, computePeriodData,
} from '../../utils/attendanceCalc';
import type { Employee, EmployeeInput, EmployeeHistoryEvent, OrgDepartmentNode, SkudEvent } from '../../types';
import '../../styles/EmployeeCardPage.css';
import '../../styles/EmployeeCardV2.css';

type Tab = 'attendance' | 'info' | 'history' | 'skud';
type StatsPeriod = 'today' | 'week' | 'month';
const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
};
const STATS_TREND_LABELS: Record<StatsPeriod, string> = {
  today: 'за сегодня',
  week: 'за неделю',
  month: 'за текущий месяц',
};
const TABS: { key: Tab; label: string }[] = [
  { key: 'attendance', label: 'Посещаемость' },
  { key: 'info', label: 'Информация' },
  { key: 'history', label: 'История' },
  { key: 'skud', label: 'СКУД' },
];

const getInitials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
};

const formatHireDate = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const MONTH_LABELS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const EmployeeCardPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backLabel = (location.state as { label?: string })?.label || 'Сотрудники';
  const { canAccess } = useAuth();
  const canEdit = canAccess('admin');

  // Deep-link: ?tab=skud&date=2026-03-18
  const urlTab = searchParams.get('tab') as Tab | null;
  const urlDate = searchParams.get('date');

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<EmployeeHistoryEvent[]>([]);
  const [, setDepartments] = useState<OrgDepartmentNode[]>([]);
  const [skudEvents, setSkudEvents] = useState<SkudEvent[]>([]);
  const [internalPoints, setInternalPoints] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(urlTab && ['attendance', 'info', 'history', 'skud'].includes(urlTab) ? urlTab : 'attendance');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<EmployeeInput>>({});
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('month');
  const [skudFocusDate, setSkudFocusDate] = useState<string | null>(urlDate || null);
  const [skudFocusKey] = useState(urlDate ? 1 : 0);

  // Calendar month — если есть urlDate, начинаем с его месяца
  const now = new Date();
  // Парсим urlDate напрямую (YYYY-MM-DD) без new Date() чтобы избежать сдвига часового пояса
  const urlYMD = urlDate ? urlDate.split('-').map(Number) : null;
  const [calMonth, setCalMonth] = useState(urlYMD ? urlYMD[1] - 1 : now.getMonth());
  const [calYear, setCalYear] = useState(urlYMD ? urlYMD[0] : now.getFullYear());

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  // Load employee + structure
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [emp, hist, struct] = await Promise.all([
        employeeService.getById(Number(id)),
        employeeService.getHistory(Number(id)).catch(() => [] as EmployeeHistoryEvent[]),
        structureApi.getTree().catch(() => null),
      ]);
      setEmployee(emp);
      setHistory(hist);
      if (struct?.data?.departments) setDepartments(struct.data.departments);
    } catch {
      setError('Ошибка загрузки данных сотрудника');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load internal access points
  useEffect(() => {
    skudService.getAccessPointSettings().then(settings => {
      setInternalPoints(new Set(settings.filter(s => s.is_internal).map(s => s.access_point_name.trim())));
    }).catch(() => {});
  }, []);

  // Load SKUD events for selected month
  const [skudRefresh, setSkudRefresh] = useState(0);
  const reloadSkudEvents = useCallback(() => setSkudRefresh(n => n + 1), []);

  useEffect(() => {
    if (!id) return;
    const startDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(new Date(calYear, calMonth + 1, 0).getDate()).padStart(2, '0')}`;
    skudService.getEmployeeEvents(Number(id), startDate, endDate)
      .then(setSkudEvents)
      .catch(() => setSkudEvents([]));
  }, [id, calMonth, calYear, skudRefresh]);

  // Отдельная загрузка событий сегодняшнего дня для статуса (не зависит от выбранного месяца)
  const [todayEvents, setTodayEvents] = useState<SkudEvent[]>([]);
  useEffect(() => {
    if (!id) return;
    const today = new Date().toISOString().slice(0, 10);
    skudService.getEmployeeEvents(Number(id), today, today)
      .then(setTodayEvents)
      .catch(() => setTodayEvents([]));
  }, [id, skudRefresh]);

  // Calculated attendance data
  const attendance = useMemo(
    () => calculateAttendance(skudEvents, internalPoints, calYear, calMonth),
    [skudEvents, internalPoints, calYear, calMonth],
  );
  const onSite = useMemo(() => isEmployeeOnSite(todayEvents, internalPoints), [todayEvents, internalPoints]);

  // Period-filtered stats + weekly pattern
  const periodData = useMemo(() => {
    const { stats: mStats, weeklyPattern: mPattern } = attendance;
    if (statsPeriod === 'month') return { stats: mStats, weeklyPattern: mPattern };
    const n = new Date();
    if (n.getFullYear() !== calYear || n.getMonth() !== calMonth)
      return { stats: mStats, weeklyPattern: mPattern };
    const todayDate = n.getDate();
    const filteredDays = statsPeriod === 'today'
      ? attendance.days.filter(d => d.day === todayDate)
      : attendance.days.filter(d => d.day >= Math.max(1, todayDate - 6) && d.day <= todayDate);
    return computePeriodData(filteredDays, calYear, calMonth);
  }, [statsPeriod, attendance, calYear, calMonth]);

  // Calendar day click → SKUD tab
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);

  const handleDayClick = useCallback((day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedCalDay(dateStr);
  }, [calYear, calMonth]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedCalDay) return [];
    return skudEvents
      .filter(e => e.event_date === selectedCalDay)
      .sort((a, b) => a.event_time.localeCompare(b.event_time));
  }, [skudEvents, selectedCalDay]);

  // Actions
  const startEditing = () => {
    if (!employee) return;
    setEditData({
      full_name: employee.full_name,
      hire_date: employee.hire_date,
      birth_date: employee.birth_date || undefined,
      current_salary: employee.current_salary,
      org_department_id: employee.org_department_id || undefined,
    });
    setIsEditing(true);
    setActiveTab('info');
  };

  const saveEditing = async () => {
    if (!employee) return;
    try { await employeeService.update(employee.id, editData); setIsEditing(false); loadData(); }
    catch { setError('Ошибка сохранения'); }
  };

  const handleArchive = async () => {
    if (!employee || !confirm('Перевести сотрудника в архив?')) return;
    try { await employeeService.archive(employee.id); loadData(); }
    catch { setError('Ошибка архивации'); }
  };

  const handleRestore = async () => {
    if (!employee) return;
    try { await employeeService.restore(employee.id); loadData(); }
    catch { setError('Ошибка восстановления'); }
  };

  const handleDelete = async () => {
    if (!employee || !confirm('Удалить сотрудника? Это действие необратимо.')) return;
    try { await employeeService.delete(employee.id); navigate(-1); }
    catch { setError('Ошибка удаления'); }
  };

  // Loading / Error states
  if (loading) return <div className="ec-content"><div className="ec-loading">Загрузка...</div></div>;
  if (error && !employee) {
    return (
      <div className="ec-content">
        <div className="ec-error">
          <p>{error}</p>
          <button className="btn-back-link" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Назад к списку
          </button>
        </div>
      </div>
    );
  }
  if (!employee) return null;

  const { stats: pStats } = periodData;
  const todayLabel = `${now.getDate()} ${MONTH_LABELS_GEN[now.getMonth()]}`;

  return (
    <div className="ec-content">
      {error && (
        <div className="ec-error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* ===== Profile Card ===== */}
      <div className="ec-profile-card">
        <button className="ec-back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          {backLabel}
        </button>
        <div className="ec-profile">
          <div className="ec-avatar">
            {getInitials(employee.full_name)}
            <div className={`ec-avatar-status ${onSite ? 'online' : 'offline'}`} />
          </div>
          <div className="ec-profile-info">
            <h1 className="ec-profile-name">
              {employee.full_name}
              {employee.is_archived && <span className="ec-badge-archived">Архив</span>}
              {employee.employment_status === 'fired' && <span className="ec-badge-fired">Уволен</span>}
            </h1>
            <div className="ec-profile-badges">
              {employee.position_name && (
                <span className="ec-badge"><Briefcase size={14} />{employee.position_name}</span>
              )}
              {employee.department && (
                <span className="ec-badge accent"><FolderOpen size={14} />{employee.department}</span>
              )}
              {employee.employment_status === 'active' && !employee.is_archived && (
                <span className="ec-badge accent"><CheckCircle size={14} />Активен</span>
              )}
            </div>
            <div className="ec-profile-meta">
              <div className="ec-meta-item">
                <CalendarDays size={16} />
                В компании с {formatHireDate(employee.hire_date)}
              </div>
              {employee.email && (
                <div className="ec-meta-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  {employee.email}
                </div>
              )}
              <span className="ec-profile-id">ID: {employee.id}</span>
            </div>
          </div>
          {canEdit && (
            <div className="ec-profile-actions">
              <button className="ec-action-btn" onClick={startEditing}>
                <Edit3 size={16} /> Редактировать
              </button>
              {employee.is_archived ? (
                <button className="ec-action-btn" onClick={handleRestore}>
                  <RotateCcw size={16} /> Восстановить
                </button>
              ) : (
                <button className="ec-action-btn" onClick={handleArchive}>
                  <Archive size={16} /> В архив
                </button>
              )}
              <button className="ec-action-btn danger" onClick={handleDelete}>
                <Trash2 size={16} /> Удалить
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="ec-stats-period-selector">
          {(['today', 'week', 'month'] as StatsPeriod[]).map(p => (
            <button
              key={p}
              className={`ec-stats-period-btn ${statsPeriod === p ? 'active' : ''}`}
              onClick={() => setStatsPeriod(p)}
            >
              {STATS_PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="ec-stats-row">
          <div className="ec-stat-card">
            <div className="ec-stat-header">
              <span className="ec-stat-label">Посещаемость</span>
              <div className="ec-stat-icon green"><CheckCircle size={18} /></div>
            </div>
            <div className="ec-stat-value">{pStats.attendancePercent}%</div>
            <div className="ec-stat-trend neutral">{STATS_TREND_LABELS[statsPeriod]}</div>
          </div>
          <div className="ec-stat-card">
            <div className="ec-stat-header">
              <span className="ec-stat-label">Опозданий</span>
              <div className="ec-stat-icon orange"><Clock size={18} /></div>
            </div>
            <div className="ec-stat-value">{pStats.lateCount}</div>
            <div className={`ec-stat-trend ${pStats.lateCount > 2 ? 'down' : 'neutral'}`}>
              {pStats.lateCount > 2 ? 'превышен лимит' : 'в пределах нормы'}
            </div>
          </div>
          <div className="ec-stat-card">
            <div className="ec-stat-header">
              <span className="ec-stat-label">Отработано часов</span>
              <div className="ec-stat-icon blue"><DollarSign size={18} /></div>
            </div>
            <div className="ec-stat-value">{pStats.hoursWorked}ч</div>
            <div className="ec-stat-trend neutral">из {pStats.hoursPlanned}ч по плану</div>
          </div>
          <div className="ec-stat-card">
            <div className="ec-stat-header">
              <span className="ec-stat-label">Ср. время прихода</span>
              <div className="ec-stat-icon purple"><BarChart3 size={18} /></div>
            </div>
            <div className="ec-stat-value">{pStats.avgArrivalTime || '—'}</div>
            <div className={`ec-stat-trend ${pStats.avgArrivalDiffMinutes > 0 ? 'down' : 'up'}`}>
              {pStats.avgArrivalDiffMinutes > 0
                ? `+${pStats.avgArrivalDiffMinutes} мин к норме`
                : pStats.avgArrivalDiffMinutes < 0
                  ? `${pStats.avgArrivalDiffMinutes} мин к норме`
                  : 'точно в норме'}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <div className="ec-tabs-container">
        <div className="ec-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`ec-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.key); setSkudFocusDate(null); }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Tab Content ===== */}
      {activeTab === 'attendance' && (() => {
        // Показываемые события: выбранный день или сегодня
        const showDate = selectedCalDay || new Date().toISOString().slice(0, 10);
        const showEvents = selectedCalDay ? selectedDayEvents : todayEvents.filter(e => !e.access_point || !internalPoints.has(e.access_point)).sort((a, b) => a.event_time.localeCompare(b.event_time));
        const dayLabel = selectedCalDay
          ? new Date(selectedCalDay + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })
          : `Сегодня, ${todayLabel}`;

        // Расчёт часов для показываемого дня
        const workCalc = (() => {
          if (showEvents.length === 0) return null;
          let total = 0;
          let entry: number | null = null;
          for (const ev of showEvents) {
            const [h, m, s = 0] = ev.event_time.split(':').map(Number);
            const sec = h * 3600 + m * 60 + s;
            if (ev.direction === 'entry') { if (entry === null) entry = sec; }
            else if (ev.direction === 'exit' && entry !== null) { total += sec - entry; entry = null; }
          }
          const todayStr = new Date().toISOString().slice(0, 10);
          if (entry !== null && showDate === todayStr) {
            const now = new Date();
            const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            if (nowSec > entry) total += nowSec - entry;
          }
          const h = Math.floor(total / 3600);
          const m = Math.floor((total % 3600) / 60);
          return `${h}ч ${m}м`;
        })();

        const firstEntry = showEvents.find(e => e.direction === 'entry')?.event_time?.slice(0, 5) || null;
        const lastExit = [...showEvents].reverse().find(e => e.direction === 'exit')?.event_time?.slice(0, 5) || null;

        return (
          <div className="ec-grid">
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
              <div style={{ flex: '0 0 50%', minWidth: 0 }}>
                <AttendanceCalendar
                  days={attendance.days}
                  month={calMonth}
                  year={calYear}
                  onPrevMonth={prevMonth}
                  onNextMonth={nextMonth}
                  onDayClick={handleDayClick}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="ec-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="ec-card-header">
                    <div className="ec-card-title">
                      <Clock size={18} />
                      {dayLabel}
                    </div>
                  </div>
                  {/* Статистика дня */}
                  {workCalc && (
                    <div style={{ display: 'flex', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                      {firstEntry && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                          <LogIn size={14} style={{ color: 'var(--color-success, #22c55e)' }} />
                          <span style={{ color: 'var(--color-success, #22c55e)', fontWeight: 600 }}>{firstEntry}</span>
                        </div>
                      )}
                      {lastExit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                          <LogOut size={14} style={{ color: 'var(--color-danger, #ef4444)' }} />
                          <span style={{ color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>{lastExit}</span>
                        </div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-success, #22c55e)', marginLeft: 'auto' }}>
                        {workCalc}
                      </div>
                    </div>
                  )}
                  {showEvents.length > 0 ? (
                    <div className="ec-timeline" style={{ flex: 1, overflowY: 'auto' }}>
                      {showEvents.map((ev, i) => (
                        <div key={i} className="ec-tl-item">
                          <div className={`ec-tl-icon ${ev.direction === 'entry' ? 'in' : 'out'}`}>
                            {ev.direction === 'entry' ? <LogIn size={16} /> : <LogOut size={16} />}
                          </div>
                          <div className="ec-tl-content">
                            <div className="ec-tl-title">{ev.direction === 'entry' ? 'Вход' : 'Выход'}</div>
                            <div className="ec-tl-meta">{ev.access_point || ''}</div>
                          </div>
                          <div className="ec-tl-time">{ev.event_time.slice(0, 5)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ec-tl-empty" style={{ flex: 1 }}>Нет событий</div>
                  )}
                </div>
              </div>
            </div>
            <EmployeeCardSidebar
              weeklyPattern={periodData.weeklyPattern}
              alerts={attendance.alerts}
              employee={employee}
            />
          </div>
        );
      })()}

      {activeTab === 'info' && (
        <div className="ec-tab-content-full">
          <EmployeeInfoSection
            employee={employee}
            isEditing={isEditing}
            editData={editData}
            onEditDataChange={setEditData}
            onSave={saveEditing}
            onCancel={() => { setIsEditing(false); setEditData({}); }}
          />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="ec-tab-content-full">
          <EmployeeHistorySection history={history} />
        </div>
      )}

      {activeTab === 'skud' && (
        <EmployeeSkudSection
          employeeId={employee.id}
          departmentId={employee.org_department_id || undefined}
          onSync={reloadSkudEvents}
          focusDate={skudFocusDate}
          focusKey={skudFocusKey}
        />
      )}
    </div>
  );
};
