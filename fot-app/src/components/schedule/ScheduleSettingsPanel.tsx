import { type FC, useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Building2, User, Calendar } from 'lucide-react';
import { scheduleService } from '../../services/scheduleService';
import type { IWorkSchedule, IDepartmentSchedule, IEmployeeSchedule, ScheduleType } from '../../types/schedule';
import { SCHEDULE_TYPE_LABELS, WEEKDAY_LABELS } from '../../types/schedule';
import './ScheduleSettingsPanel.css';

interface IProps {
  open: boolean;
  onClose: () => void;
  departmentId: string | null;
  departmentName?: string;
  employees?: { id: number; full_name: string }[];
}

type PanelTab = 'department' | 'employees' | 'templates';

const SCHEDULE_TYPES: ScheduleType[] = ['office', 'remote', 'hybrid', 'shift'];
const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export const ScheduleSettingsPanel: FC<IProps> = ({ open, onClose, departmentId, departmentName, employees = [] }) => {
  const [tab, setTab] = useState<PanelTab>('department');
  const [templates, setTemplates] = useState<IWorkSchedule[]>([]);
  const [deptSchedules, setDeptSchedules] = useState<IDepartmentSchedule[]>([]);
  const [empSchedules, setEmpSchedules] = useState<Map<number, IEmployeeSchedule[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Форма назначения
  const [assignTarget, setAssignTarget] = useState<'department' | number>('department');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  // Форма создания шаблона
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ScheduleType>('office');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('18:00');
  const [newHours, setNewHours] = useState(8);
  const [newWorkDays, setNewWorkDays] = useState<number[]>(DEFAULT_WORK_DAYS);
  const [newOfficeDays, setNewOfficeDays] = useState<number[]>([1, 3, 5]);
  const [newLateThreshold, setNewLateThreshold] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tpls, deptSch] = await Promise.all([
        scheduleService.list(),
        departmentId ? scheduleService.getDepartmentSchedule(departmentId) : Promise.resolve([]),
      ]);
      setTemplates(tpls);
      setDeptSchedules(deptSch);

      // Загрузить графики для всех сотрудников
      const empSchMap = new Map<number, IEmployeeSchedule[]>();
      for (const emp of employees) {
        try {
          const scheds = await scheduleService.getEmployeeSchedule(emp.id);
          if (scheds.length > 0) empSchMap.set(emp.id, scheds);
        } catch { /* ignore */ }
      }
      setEmpSchedules(empSchMap);
    } catch (err) {
      setError('Ошибка загрузки данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [departmentId, employees]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleAssign = async () => {
    if (!selectedScheduleId) return;
    setError('');
    try {
      if (assignTarget === 'department' && departmentId) {
        await scheduleService.assignDepartment(departmentId, {
          schedule_id: selectedScheduleId,
          effective_from: effectiveFrom,
        });
      } else if (typeof assignTarget === 'number') {
        await scheduleService.assignEmployee(assignTarget, {
          schedule_id: selectedScheduleId,
          effective_from: effectiveFrom,
          reason: reason || undefined,
        });
      }
      await loadData();
      setSelectedScheduleId('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения');
    }
  };

  const handleCreateTemplate = async () => {
    if (!newName.trim()) return;
    setError('');
    try {
      await scheduleService.create({
        name: newName,
        schedule_type: newType,
        work_start: newStart + ':00',
        work_end: newEnd + ':00',
        work_hours: newHours,
        work_days: newWorkDays,
        office_days: newType === 'hybrid' ? newOfficeDays : null,
        late_threshold_minutes: newLateThreshold,
      });
      setShowCreateForm(false);
      setNewName('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await scheduleService.remove(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const handleRemoveEmpOverride = async (empId: number, schedId: string) => {
    try {
      await scheduleService.removeEmployeeOverride(empId, schedId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const toggleDay = (days: number[], setDays: (d: number[]) => void, day: number) => {
    setDays(days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort());
  };

  const getScheduleName = (id: string) => templates.find(t => t.id === id)?.name || '—';
  const getScheduleType = (id: string) => {
    const t = templates.find(t => t.id === id);
    return t ? SCHEDULE_TYPE_LABELS[t.schedule_type] : '';
  };

  if (!open) return null;

  return (
    <div className="sched-overlay" onClick={onClose}>
      <div className="sched-panel" onClick={e => e.stopPropagation()}>
        <div className="sched-header">
          <h3>Графики работы {departmentName ? `— ${departmentName}` : ''}</h3>
          <button className="sched-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sched-tabs">
          <button className={`sched-tab ${tab === 'department' ? 'active' : ''}`} onClick={() => setTab('department')}>
            <Building2 size={14} /> Отдел
          </button>
          <button className={`sched-tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>
            <User size={14} /> Сотрудники
          </button>
          <button className={`sched-tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
            <Calendar size={14} /> Шаблоны
          </button>
        </div>

        {error && <div className="sched-error">{error}</div>}
        {loading && <div className="sched-loading">Загрузка...</div>}

        <div className="sched-body">
          {/* ---- ВКЛАДКА: ОТДЕЛ ---- */}
          {tab === 'department' && (
            <div className="sched-section">
              <h4>Текущий график отдела</h4>
              {deptSchedules.length === 0 ? (
                <p className="sched-muted">Не назначен (по умолчанию: офис 9:00–18:00)</p>
              ) : (
                <div className="sched-list">
                  {deptSchedules.map(ds => (
                    <div key={ds.id} className="sched-item">
                      <div className="sched-item-main">
                        <span className="sched-badge">{getScheduleType(ds.schedule_id)}</span>
                        <span>{getScheduleName(ds.schedule_id)}</span>
                      </div>
                      <span className="sched-dates">с {ds.effective_from}{ds.effective_to ? ` по ${ds.effective_to}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}

              <h4>Назначить график</h4>
              <div className="sched-form">
                <select value={selectedScheduleId} onChange={e => setSelectedScheduleId(e.target.value)}>
                  <option value="">Выберите график</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({SCHEDULE_TYPE_LABELS[t.schedule_type]})</option>
                  ))}
                </select>
                <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
                <button className="sched-btn primary" onClick={() => { setAssignTarget('department'); handleAssign(); }} disabled={!selectedScheduleId}>
                  Назначить отделу
                </button>
              </div>
            </div>
          )}

          {/* ---- ВКЛАДКА: СОТРУДНИКИ ---- */}
          {tab === 'employees' && (
            <div className="sched-section">
              <h4>Переопределения сотрудников</h4>
              {employees.length === 0 ? (
                <p className="sched-muted">Нет сотрудников</p>
              ) : (
                <div className="sched-emp-list">
                  {employees.map(emp => {
                    const empSch = empSchedules.get(emp.id);
                    return (
                      <div key={emp.id} className="sched-emp-item">
                        <div className="sched-emp-name">{emp.full_name}</div>
                        {empSch && empSch.length > 0 ? (
                          <div className="sched-emp-schedules">
                            {empSch.map(es => (
                              <div key={es.id} className="sched-emp-sched">
                                <span className="sched-badge">{getScheduleType(es.schedule_id)}</span>
                                <span>{getScheduleName(es.schedule_id)}</span>
                                <span className="sched-dates">с {es.effective_from}</span>
                                {es.reason && <span className="sched-reason">{es.reason}</span>}
                                <button className="sched-btn-icon" onClick={() => handleRemoveEmpOverride(emp.id, es.id)} title="Удалить">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="sched-muted">по графику отдела</span>
                        )}
                        <div className="sched-emp-assign">
                          <select
                            value=""
                            onChange={async e => {
                              const schedId = e.target.value;
                              if (!schedId) return;
                              setAssignTarget(emp.id);
                              setSelectedScheduleId(schedId);
                            }}
                          >
                            <option value="">Назначить...</option>
                            {templates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          {selectedScheduleId && assignTarget === emp.id && (
                            <div className="sched-emp-assign-form">
                              <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} />
                              <input placeholder="Причина" value={reason} onChange={e => setReason(e.target.value)} />
                              <button className="sched-btn primary sm" onClick={handleAssign}>OK</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---- ВКЛАДКА: ШАБЛОНЫ ---- */}
          {tab === 'templates' && (
            <div className="sched-section">
              <div className="sched-section-header">
                <h4>Шаблоны графиков</h4>
                <button className="sched-btn primary sm" onClick={() => setShowCreateForm(!showCreateForm)}>
                  <Plus size={14} /> Создать
                </button>
              </div>

              {showCreateForm && (
                <div className="sched-create-form">
                  <input placeholder="Название графика" value={newName} onChange={e => setNewName(e.target.value)} />

                  <div className="sched-form-row">
                    <label>Тип:</label>
                    <select value={newType} onChange={e => setNewType(e.target.value as ScheduleType)}>
                      {SCHEDULE_TYPES.map(t => <option key={t} value={t}>{SCHEDULE_TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>

                  <div className="sched-form-row">
                    <label>Начало:</label>
                    <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
                    <label>Конец:</label>
                    <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                  </div>

                  <div className="sched-form-row">
                    <label>Норма (ч):</label>
                    <input type="number" min={0.5} max={24} step={0.5} value={newHours} onChange={e => setNewHours(Number(e.target.value))} />
                    <label>Допуск (мин):</label>
                    <input type="number" min={0} max={120} value={newLateThreshold} onChange={e => setNewLateThreshold(Number(e.target.value))} />
                  </div>

                  <div className="sched-form-row">
                    <label>Рабочие дни:</label>
                    <div className="sched-weekdays">
                      {WEEKDAY_LABELS.map((label, i) => (
                        <button
                          key={i}
                          className={`sched-weekday ${newWorkDays.includes(i + 1) ? 'active' : ''}`}
                          onClick={() => toggleDay(newWorkDays, setNewWorkDays, i + 1)}
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {newType === 'hybrid' && (
                    <div className="sched-form-row">
                      <label>Дни в офисе:</label>
                      <div className="sched-weekdays">
                        {WEEKDAY_LABELS.map((label, i) => (
                          <button
                            key={i}
                            className={`sched-weekday ${newOfficeDays.includes(i + 1) ? 'active office' : ''}`}
                            onClick={() => toggleDay(newOfficeDays, setNewOfficeDays, i + 1)}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="sched-form-actions">
                    <button className="sched-btn" onClick={() => setShowCreateForm(false)}>Отмена</button>
                    <button className="sched-btn primary" onClick={handleCreateTemplate} disabled={!newName.trim()}>Создать</button>
                  </div>
                </div>
              )}

              <div className="sched-list">
                {templates.map(t => (
                  <div key={t.id} className="sched-item template">
                    <div className="sched-item-main">
                      <span className="sched-badge">{SCHEDULE_TYPE_LABELS[t.schedule_type]}</span>
                      <span className="sched-tpl-name">{t.name}</span>
                      {t.is_default && <span className="sched-default-badge">по умолчанию</span>}
                    </div>
                    <div className="sched-item-details">
                      {t.work_start.slice(0, 5)}–{t.work_end.slice(0, 5)}, {t.work_hours}ч/день,
                      дни: {t.work_days.map(d => WEEKDAY_LABELS[d - 1]).join(', ')}
                      {t.office_days && ` (офис: ${t.office_days.map(d => WEEKDAY_LABELS[d - 1]).join(', ')})`}
                      {t.late_threshold_minutes > 0 && `, допуск ${t.late_threshold_minutes} мин`}
                    </div>
                    {!t.is_default && (
                      <button className="sched-btn-icon danger" onClick={() => handleDeleteTemplate(t.id)} title="Удалить">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
