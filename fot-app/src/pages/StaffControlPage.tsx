import { useState, useEffect, useCallback, useMemo, useRef, memo, type FC } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pencil, ArrowRightLeft, History, TrendingUp, Upload, UserPlus } from 'lucide-react';
import { SearchInput } from '../components/ui/SearchInput';
import { employeeService } from '../services/employeeService';
import { workCategoryService } from '../services/workCategoryService';
import type { IWorkCategory } from '../types/schedule';
import { useIsMobile } from '../hooks/useIsMobile';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useStaffData } from '../hooks/useStaffData';
import { DeptSelect } from '../components/staff/DeptSelect';
import { HistoryPanel } from '../components/staff/HistoryPanel';
import { ImportModal } from '../components/employees/ImportModal';
import { EnrichPreviewModal } from '../components/employees/EnrichPreviewModal';
import type { Employee, EmployeeHistoryEvent, EmployeeInput, EnrichPreview } from '../types';
import type { OrgDepartmentNode } from '../types/organization';
import '../styles/StaffControlPage.css';

/* ───────── helpers ───────── */

const flattenDepts = (nodes: OrgDepartmentNode[]): OrgDepartmentNode[] =>
  nodes.flatMap(n => [n, ...flattenDepts(n.children)]);

const sortDepts = (depts: OrgDepartmentNode[]): OrgDepartmentNode[] =>
  [...depts].sort((a, b) => {
    const aHas = /\(/.test(a.name) ? 0 : 1;
    const bHas = /\(/.test(b.name) ? 0 : 1;
    return aHas - bHas || a.name.localeCompare(b.name, 'ru');
  });

const fmt = (n: number | null | undefined) =>
  n ? n.toLocaleString('ru-RU') + ' ₽' : '—';

type ModalType = 'salary' | 'salary_actual' | 'position' | 'department' | 'category';

/* ───────── Memoized table row ───────── */

interface IStaffRowProps {
  emp: Employee;
  index: number;
  categoryLabels: Map<string, string>;
  onNavigate: (emp: Employee) => void;
  onOpenModal: (emp: Employee, type: ModalType) => void;
  onOpenHistory: (emp: Employee) => void;
}

const StaffRow: FC<IStaffRowProps> = memo(({ emp, index, categoryLabels, onNavigate, onOpenModal, onOpenHistory }) => (
  <tr className="sc-row" onClick={() => onNavigate(emp)}>
    <td className="sc-td-num">{index + 1}</td>
    <td className="sc-td-name">{emp.full_name}</td>
    <td>
      <span className="sc-cell-with-btn">
        {emp.department || '—'}
        <button className="sc-inline-btn" title="Сменить отдел" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'department'); }}>
          <ArrowRightLeft size={12} />
        </button>
      </span>
    </td>
    <td>
      <span className="sc-cell-with-btn">
        <button className="sc-inline-btn" title="Сменить должность" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'position'); }}>
          <Pencil size={12} />
        </button>
        {emp.position_name || '—'}
      </span>
    </td>
    <td>
      <span className="sc-cell-with-btn">
        <button className="sc-inline-btn" title="Изменить категорию труда" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'category'); }}>
          <Pencil size={12} />
        </button>
        {emp.work_category ? categoryLabels.get(emp.work_category) || emp.work_category : '—'}
      </span>
    </td>
    <td className="sc-td-salary">
      <span className="sc-cell-with-btn">
        <button className="sc-inline-btn" title="Изменить оклад (договор)" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'salary_actual'); }}>
          <Pencil size={12} />
        </button>
        {fmt(emp.salary_actual)}
      </span>
    </td>
    <td className="sc-td-salary">
      <span className="sc-cell-with-btn">
        <button className="sc-inline-btn" title="Изменить реальный оклад" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'salary'); }}>
          <Pencil size={12} />
        </button>
        {fmt(emp.salary_calculated)}
      </span>
    </td>
    <td className="sc-td-hist" onClick={e => e.stopPropagation()}>
      <button className="sc-btn-icon" title="История" onClick={() => onOpenHistory(emp)}>
        <History size={14} />
      </button>
    </td>
  </tr>
));

/* ───────── Modals (isolated from table renders) ───────── */

interface IStaffModalsProps {
  modalType: ModalType | null;
  modalEmp: Employee | null;
  allDepts: OrgDepartmentNode[];
  categories: IWorkCategory[];
  onClose: () => void;
  onSaveSalary: (empId: number, val: number, type: ModalType, reason?: string, date?: string) => Promise<void>;
  onSavePosition: (empId: number, val: string, reason?: string, date?: string) => Promise<void>;
  onSaveDepartment: (empId: number, deptId: string) => Promise<void>;
  onSaveCategory: (empId: number, category: string | null) => Promise<void>;
}

const StaffModals: FC<IStaffModalsProps> = memo(({ modalType, modalEmp, allDepts, categories, onClose, onSaveSalary, onSavePosition, onSaveDepartment, onSaveCategory }) => {
  const [salaryVal, setSalaryVal] = useState('');
  const [salaryDate, setSalaryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salaryReason, setSalaryReason] = useState('');
  const [positionVal, setPositionVal] = useState('');
  const [positionDate, setPositionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [positionReason, setPositionReason] = useState('');
  const [deptVal, setDeptVal] = useState('');
  const [categoryVal, setCategoryVal] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (modalEmp) {
      setSalaryVal('');
      setSalaryDate(new Date().toISOString().slice(0, 10));
      setSalaryReason('');
      setPositionVal('');
      setPositionDate(new Date().toISOString().slice(0, 10));
      setPositionReason('');
      setDeptVal(modalEmp.org_department_id || '');
      setCategoryVal(modalEmp.work_category || '');
    }
  }, [modalEmp]);

  if (!modalType || !modalEmp) return null;

  const handleSalary = async () => {
    if (!salaryVal) return;
    setSaving(true);
    await onSaveSalary(modalEmp.id, Number(salaryVal), modalType, salaryReason || undefined, salaryDate || undefined);
    setSaving(false);
  };

  const handlePosition = async () => {
    if (!positionVal) return;
    setSaving(true);
    await onSavePosition(modalEmp.id, positionVal, positionReason || undefined, positionDate || undefined);
    setSaving(false);
  };

  const handleDepartment = async () => {
    if (!deptVal) return;
    setSaving(true);
    await onSaveDepartment(modalEmp.id, deptVal);
    setSaving(false);
  };

  const handleCategory = async () => {
    setSaving(true);
    const value = categoryVal === '' ? null : categoryVal;
    await onSaveCategory(modalEmp.id, value);
    setSaving(false);
  };

  if (modalType === 'salary' || modalType === 'salary_actual') {
    const title = modalType === 'salary' ? 'Изменить реальный оклад' : 'Изменить оклад (договор)';
    const placeholder = modalType === 'salary' ? 'Повышение, пересмотр...' : 'Изменение договора...';
    return (
      <div className="sc-overlay" onClick={onClose}>
        <div className="sc-modal" onClick={e => e.stopPropagation()}>
          <div className="sc-modal-header">
            <h3>{title} — {modalEmp.full_name}</h3>
            <button className="sc-modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="sc-modal-body">
            <div className="sc-field">
              <label>Новый оклад (₽)</label>
              <input type="number" value={salaryVal} onChange={e => setSalaryVal(e.target.value)} placeholder="150 000" autoFocus />
            </div>
            <div className="sc-field">
              <label>Дата вступления в силу</label>
              <input type="date" value={salaryDate} onChange={e => setSalaryDate(e.target.value)} />
            </div>
            <div className="sc-field">
              <label>Причина</label>
              <input value={salaryReason} onChange={e => setSalaryReason(e.target.value)} placeholder={placeholder} />
            </div>
          </div>
          <div className="sc-modal-footer">
            <button className="sc-btn cancel" onClick={onClose}>Отмена</button>
            <button className="sc-btn apply" onClick={handleSalary} disabled={!salaryVal || saving}>
              {saving ? 'Сохранение...' : 'Применить'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modalType === 'position') {
    return (
      <div className="sc-overlay" onClick={onClose}>
        <div className="sc-modal" onClick={e => e.stopPropagation()}>
          <div className="sc-modal-header">
            <h3>Сменить должность — {modalEmp.full_name}</h3>
            <button className="sc-modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="sc-modal-body">
            <div className="sc-field">
              <label>Должность</label>
              <input value={positionVal} onChange={e => setPositionVal(e.target.value)} placeholder="Название должности" autoFocus />
            </div>
            <div className="sc-field">
              <label>Дата вступления в силу</label>
              <input type="date" value={positionDate} onChange={e => setPositionDate(e.target.value)} />
            </div>
            <div className="sc-field">
              <label>Причина</label>
              <input value={positionReason} onChange={e => setPositionReason(e.target.value)} placeholder="Повышение, перевод..." />
            </div>
          </div>
          <div className="sc-modal-footer">
            <button className="sc-btn cancel" onClick={onClose}>Отмена</button>
            <button className="sc-btn apply" onClick={handlePosition} disabled={!positionVal || saving}>
              {saving ? 'Сохранение...' : 'Применить'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (modalType === 'category') {
    return (
      <div className="sc-overlay" onClick={onClose}>
        <div className="sc-modal" onClick={e => e.stopPropagation()}>
          <div className="sc-modal-header">
            <h3>Категория труда — {modalEmp.full_name}</h3>
            <button className="sc-modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="sc-modal-body">
            <div className="sc-field">
              <label>Категория</label>
              <select value={categoryVal} onChange={e => setCategoryVal(e.target.value)} autoFocus>
                <option value="">— не назначена —</option>
                {categories.filter(c => c.is_active).map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              График работы подтянется автоматически по привязке категории. Индивидуальный график
              сотрудника, если задан, имеет приоритет.
            </div>
          </div>
          <div className="sc-modal-footer">
            <button className="sc-btn cancel" onClick={onClose}>Отмена</button>
            <button
              className="sc-btn apply"
              onClick={handleCategory}
              disabled={saving || (categoryVal || '') === (modalEmp.work_category || '')}
            >
              {saving ? 'Сохранение...' : 'Применить'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-header">
          <h3>Сменить отдел — {modalEmp.full_name}</h3>
          <button className="sc-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="sc-modal-body">
          <div className="sc-field">
            <label>Отдел</label>
            <select value={deptVal} onChange={e => setDeptVal(e.target.value)} autoFocus>
              <option value="">Выберите отдел</option>
              {allDepts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="sc-modal-footer">
          <button className="sc-btn cancel" onClick={onClose}>Отмена</button>
          <button className="sc-btn apply" onClick={handleDepartment} disabled={!deptVal || deptVal === modalEmp.org_department_id || saving}>
            {saving ? 'Сохранение...' : 'Применить'}
          </button>
        </div>
      </div>
    </div>
  );
});

/* ───────── Virtualized Table ───────── */

interface IVirtualTableProps {
  filtered: Employee[];
  categoryLabels: Map<string, string>;
  onNavigate: (emp: Employee) => void;
  onOpenModal: (emp: Employee, type: ModalType) => void;
  onOpenHistory: (emp: Employee) => void;
}

const ROW_HEIGHT = 36;

const VirtualTable: FC<IVirtualTableProps> = memo(({ filtered, categoryLabels, onNavigate, onOpenModal, onOpenHistory }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  return (
    <div className="sc-table-wrap" ref={scrollRef}>
      <table className="sc-table">
        <thead>
          <tr>
            <th className="sc-th-num">№</th>
            <th>ФИО</th>
            <th>Отдел</th>
            <th>Должность</th>
            <th>Категория</th>
            <th>Оклад (договор)</th>
            <th>Реальный оклад</th>
            <th className="sc-th-hist"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={8} className="sc-empty">Нет сотрудников</td></tr>
          ) : (
            <>
              {/* spacer top */}
              {virtualizer.getVirtualItems()[0]?.start > 0 && (
                <tr><td colSpan={8} style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0, border: 'none' }} /></tr>
              )}
              {virtualizer.getVirtualItems().map(vRow => {
                const emp = filtered[vRow.index];
                return (
                  <StaffRow
                    key={emp.id}
                    emp={emp}
                    index={vRow.index}
                    categoryLabels={categoryLabels}
                    onNavigate={onNavigate}
                    onOpenModal={onOpenModal}
                    onOpenHistory={onOpenHistory}
                  />
                );
              })}
              {/* spacer bottom */}
              {(() => {
                const items = virtualizer.getVirtualItems();
                const lastItem = items[items.length - 1];
                const remaining = lastItem ? virtualizer.getTotalSize() - lastItem.end : 0;
                return remaining > 0 ? <tr><td colSpan={8} style={{ height: remaining, padding: 0, border: 'none' }} /></tr> : null;
              })()}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
});

/* ───────── Virtualized Mobile Cards ───────── */

interface IVirtualCardsProps {
  filtered: Employee[];
  categoryLabels: Map<string, string>;
  onNavigate: (emp: Employee) => void;
  onOpenModal: (emp: Employee, type: ModalType) => void;
  onOpenHistory: (emp: Employee) => void;
}

const CARD_HEIGHT = 200;

const MobileCard: FC<{ emp: Employee; categoryLabels: Map<string, string>; onNavigate: (emp: Employee) => void; onOpenModal: (emp: Employee, type: ModalType) => void; onOpenHistory: (emp: Employee) => void }> = memo(({ emp, categoryLabels, onNavigate, onOpenModal, onOpenHistory }) => (
  <div className="sc-card" onClick={() => onNavigate(emp)}>
    <div className="sc-card-name">{emp.full_name}</div>
    <div className="sc-card-row">
      <span className="sc-card-label">Отдел</span>
      <span>{emp.department || '—'}</span>
    </div>
    <div className="sc-card-row">
      <span className="sc-card-label">Должность</span>
      <span>{emp.position_name || '—'}</span>
    </div>
    <div className="sc-card-row">
      <span className="sc-card-label">Категория</span>
      <span>{emp.work_category ? categoryLabels.get(emp.work_category) || emp.work_category : '—'}</span>
    </div>
    <div className="sc-card-row">
      <span className="sc-card-label">Оклад (дог.)</span>
      <span>{fmt(emp.salary_actual)}</span>
    </div>
    <div className="sc-card-row">
      <span className="sc-card-label">Оклад (прог.)</span>
      <span>{fmt(emp.salary_calculated)}</span>
    </div>
    <div className="sc-card-actions">
      <button className="sc-btn-icon" title="История" onClick={e => { e.stopPropagation(); onOpenHistory(emp); }}>
        <History size={14} />
      </button>
      <button className="sc-btn-icon" title="Сменить должность" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'position'); }}>
        <Pencil size={14} />
      </button>
      <button className="sc-btn-icon" title="Категория труда" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'category'); }}>
        <Pencil size={14} />
      </button>
      <button className="sc-btn-icon" title="Изменить оклад" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'salary'); }}>
        <TrendingUp size={14} />
      </button>
      <button className="sc-btn-icon" title="Сменить отдел" onClick={e => { e.stopPropagation(); onOpenModal(emp, 'department'); }}>
        <ArrowRightLeft size={14} />
      </button>
    </div>
  </div>
));

const VirtualCards: FC<IVirtualCardsProps> = memo(({ filtered, categoryLabels, onNavigate, onOpenModal, onOpenHistory }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5,
  });

  return (
    <div className="sc-cards" ref={scrollRef}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const emp = filtered[vRow.index];
          return (
            <div key={emp.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}>
              <MobileCard emp={emp} categoryLabels={categoryLabels} onNavigate={onNavigate} onOpenModal={onOpenModal} onOpenHistory={onOpenHistory} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ───────── Main Page ───────── */

export const StaffControlPage: FC = () => {
  const navigate = useNavigate();
  const [urlParams, setUrlParams] = useSearchParams();
  const isMobile = useIsMobile(768);

  const [search, setSearch] = useState(() => urlParams.get('q') || '');
  const [deptId, setDeptId] = useState(() => urlParams.get('dept') || '');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, deptId]);

  const { employees, departments, loading, meta, totalActive, refresh, patchEmployee } = useStaffData({
    page,
    pageSize: 100,
    search: debouncedSearch || undefined,
    departmentId: deptId || undefined,
  });

  const [workCategories, setWorkCategories] = useState<IWorkCategory[]>([]);
  useEffect(() => {
    workCategoryService.list().then(setWorkCategories).catch(() => setWorkCategories([]));
  }, []);

  const categoryLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of workCategories) m.set(c.code, c.name);
    return m;
  }, [workCategories]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (deptId) p.set('dept', deptId);
    if (debouncedSearch) p.set('q', debouncedSearch);
    setUrlParams(p, { replace: true });
  }, [deptId, debouncedSearch, setUrlParams]);

  // history panel
  const [panelEmp, setPanelEmp] = useState<Employee | null>(null);
  const [panelHistory, setPanelHistory] = useState<EmployeeHistoryEvent[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // modals
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalEmp, setModalEmp] = useState<Employee | null>(null);

  // import / add
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<EmployeeInput>({ full_name: '', hire_date: new Date().toISOString().slice(0, 10) });
  const [enrichPreview, setEnrichPreview] = useState<EnrichPreview | null>(null);
  const [enrichFile, setEnrichFile] = useState<File | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [salaryEnrichPreview, setSalaryEnrichPreview] = useState<EnrichPreview | null>(null);
  const [salaryEnrichFile, setSalaryEnrichFile] = useState<File | null>(null);
  const [salaryEnrichLoading, setSalaryEnrichLoading] = useState(false);
  const [salaryHistoryPreview, setSalaryHistoryPreview] = useState<EnrichPreview | null>(null);
  const [salaryHistoryFile, setSalaryHistoryFile] = useState<File | null>(null);
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false);

  /* ─── memoized computations ─── */

  const allDepts = useMemo(() => sortDepts(flattenDepts(departments)), [departments]);

  /* ─── stable callbacks for child components ─── */

  const handleNavigate = useCallback((emp: Employee) => {
    navigate(`/tender/${emp.id}`, { state: { label: 'Управление кадрами', from: `/staff-control?${urlParams.toString()}` } });
  }, [navigate, urlParams]);

  const openHistory = useCallback(async (emp: Employee) => {
    setPanelEmp(emp);
    setPanelLoading(true);
    const history = await employeeService.getHistory(emp.id);
    setPanelHistory(history);
    setPanelLoading(false);
  }, []);

  const closeHistory = useCallback(() => {
    setPanelEmp(null);
    setPanelHistory([]);
  }, []);

  const openModal = useCallback((emp: Employee, type: ModalType) => {
    setModalEmp(emp);
    setModalType(type);
  }, []);

  const closeModal = useCallback(() => {
    setModalType(null);
    setModalEmp(null);
  }, []);

  /* ─── modal save handlers ─── */

  const handleSaveSalary = useCallback(async (empId: number, val: number, type: ModalType, reason?: string, date?: string) => {
    await employeeService.changeSalary(empId, val, reason, date);
    closeModal();
    if (type === 'salary_actual') {
      patchEmployee(empId, { salary_actual: val });
    } else {
      patchEmployee(empId, { salary_calculated: val });
    }
  }, [closeModal, patchEmployee]);

  const handleSavePosition = useCallback(async (empId: number, val: string, reason?: string, date?: string) => {
    await employeeService.changePosition(empId, val, reason, date);
    closeModal();
    patchEmployee(empId, { position_name: val });
  }, [closeModal, patchEmployee]);

  const handleSaveDepartment = useCallback(async (empId: number, newDeptId: string) => {
    await employeeService.moveDepartment(empId, newDeptId);
    closeModal();
    const deptName = allDepts.find(d => d.id === newDeptId)?.name;
    patchEmployee(empId, { org_department_id: newDeptId, department: deptName });
  }, [closeModal, patchEmployee, allDepts]);

  const handleSaveCategory = useCallback(async (empId: number, category: string | null) => {
    await employeeService.changeCategory(empId, category);
    closeModal();
    patchEmployee(empId, { work_category: category });
  }, [closeModal, patchEmployee]);

  /* ─── history panel data changed ─── */

  const handleHistoryDataChanged = useCallback(() => {
    if (panelEmp) openHistory(panelEmp);
  }, [panelEmp, openHistory]);

  /* ─── import handlers ─── */

  const handleEnrichFile = async (file: File) => {
    setShowImportModal(false);
    setEnrichLoading(true);
    try {
      const preview = await employeeService.enrichPreview(file);
      setEnrichPreview(preview);
      setEnrichFile(file);
    } catch { /* ignore */ }
    setEnrichLoading(false);
  };

  const handleEnrichApply = async (manualMatches: Array<{ fullName: string; employeeId: number }> = []) => {
    if (!enrichFile) return;
    setEnrichLoading(true);
    try {
      const r = await employeeService.enrichApply(enrichFile, manualMatches);
      alert(`Обновлено: ${r.updated} сотрудников`);
      refresh();
    } catch { /* ignore */ }
    setEnrichLoading(false);
    setEnrichPreview(null);
    setEnrichFile(null);
  };

  const handleSalaryFile = async (file: File) => {
    setShowImportModal(false);
    setSalaryEnrichLoading(true);
    try {
      const preview = await employeeService.salaryEnrichPreview(file);
      setSalaryEnrichPreview(preview);
      setSalaryEnrichFile(file);
    } catch { /* ignore */ }
    setSalaryEnrichLoading(false);
  };

  const handleSalaryApply = async (manualMatches: Array<{ fullName: string; employeeId: number }> = []) => {
    if (!salaryEnrichFile) return;
    setSalaryEnrichLoading(true);
    try {
      const r = await employeeService.salaryEnrichApply(salaryEnrichFile, manualMatches);
      alert(`Обновлено: ${r.updated} сотрудников`);
      refresh();
    } catch { /* ignore */ }
    setSalaryEnrichLoading(false);
    setSalaryEnrichPreview(null);
    setSalaryEnrichFile(null);
  };

  const handleSalaryHistoryFile = async (file: File) => {
    setShowImportModal(false);
    setSalaryHistoryLoading(true);
    try {
      const preview = await employeeService.salaryHistoryEnrichPreview(file);
      setSalaryHistoryPreview(preview);
      setSalaryHistoryFile(file);
    } catch { /* ignore */ }
    setSalaryHistoryLoading(false);
  };

  const handleSalaryHistoryApply = async (manualMatches: Array<{ fullName: string; employeeId: number }> = []) => {
    if (!salaryHistoryFile) return;
    setSalaryHistoryLoading(true);
    try {
      const r = await employeeService.salaryHistoryEnrichApply(salaryHistoryFile, manualMatches);
      alert(`Обновлено: ${r.updated} сотрудников`);
      refresh();
    } catch { /* ignore */ }
    setSalaryHistoryLoading(false);
    setSalaryHistoryPreview(null);
    setSalaryHistoryFile(null);
  };

  const handleAddEmployee = async () => {
    if (!addForm.full_name || !addForm.hire_date) return;
    await employeeService.create(addForm);
    setShowAddModal(false);
    setAddForm({ full_name: '', hire_date: new Date().toISOString().slice(0, 10) });
    refresh();
  };

  /* ─── render ─── */

  return (
    <div className="sc-page">
      {/* Filters */}
      <div className="sc-filters">
        <DeptSelect
          departments={allDepts}
          value={deptId}
          onChange={setDeptId}
        />
        <div className="sc-filter-search">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Поиск по ФИО..." />
        </div>
        <div className="sc-filter-count">
          {meta.total} из {totalActive}
        </div>
        <div className="sc-filter-actions">
          <button className="sc-btn secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={14} /> Импорт
          </button>
          <button className="sc-btn apply" onClick={() => setShowAddModal(true)}>
            <UserPlus size={14} /> Добавить
          </button>
        </div>
      </div>

      {loading ? (
        <div className="sc-loading">Загрузка...</div>
      ) : isMobile ? (
        <VirtualCards filtered={employees} categoryLabels={categoryLabels} onNavigate={handleNavigate} onOpenModal={openModal} onOpenHistory={openHistory} />
      ) : (
        <VirtualTable filtered={employees} categoryLabels={categoryLabels} onNavigate={handleNavigate} onOpenModal={openModal} onOpenHistory={openHistory} />
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="sc-pagination">
          <button className="sc-btn cancel" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
          <span className="sc-pagination-info">{page} / {meta.totalPages}</span>
          <button className="sc-btn cancel" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Вперёд →</button>
        </div>
      )}

      {/* History Side Panel */}
      {panelEmp && (
        <HistoryPanel
          employee={panelEmp}
          history={panelHistory}
          loading={panelLoading}
          onClose={closeHistory}
          onRefresh={() => openHistory(panelEmp)}
          onDataChanged={handleHistoryDataChanged}
        />
      )}

      {/* Modals — isolated from table */}
      <StaffModals
        modalType={modalType}
        modalEmp={modalEmp}
        allDepts={allDepts}
        categories={workCategories}
        onClose={closeModal}
        onSaveSalary={handleSaveSalary}
        onSavePosition={handleSavePosition}
        onSaveDepartment={handleSaveDepartment}
        onSaveCategory={handleSaveCategory}
      />

      {/* ─── Import Modal ─── */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onEnrichFile={handleEnrichFile}
          onSalaryFile={handleSalaryFile}
          onSalaryHistoryFile={handleSalaryHistoryFile}
        />
      )}

      {enrichPreview && (
        <EnrichPreviewModal preview={enrichPreview} loading={enrichLoading} onApply={handleEnrichApply} onClose={() => { setEnrichPreview(null); setEnrichFile(null); }} title="Импорт документов — Превью" />
      )}
      {salaryEnrichPreview && (
        <EnrichPreviewModal preview={salaryEnrichPreview} loading={salaryEnrichLoading} onApply={handleSalaryApply} onClose={() => { setSalaryEnrichPreview(null); setSalaryEnrichFile(null); }} title="Импорт окладов — Превью" />
      )}
      {salaryHistoryPreview && (
        <EnrichPreviewModal preview={salaryHistoryPreview} loading={salaryHistoryLoading} onApply={handleSalaryHistoryApply} onClose={() => { setSalaryHistoryPreview(null); setSalaryHistoryFile(null); }} title="Импорт истории окладов — Превью" />
      )}

      {/* ─── Add Employee Modal ─── */}
      {showAddModal && (
        <div className="sc-overlay" onClick={() => setShowAddModal(false)}>
          <div className="sc-modal" onClick={e => e.stopPropagation()}>
            <div className="sc-modal-header">
              <h3>Добавить сотрудника</h3>
              <button className="sc-modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className="sc-modal-body">
              <div className="sc-field">
                <label>ФИО</label>
                <input value={addForm.full_name} onChange={e => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="Иванов Иван Иванович" autoFocus />
              </div>
              <div className="sc-field">
                <label>Дата найма</label>
                <input type="date" value={addForm.hire_date} onChange={e => setAddForm({ ...addForm, hire_date: e.target.value })} />
              </div>
            </div>
            <div className="sc-modal-footer">
              <button className="sc-btn cancel" onClick={() => setShowAddModal(false)}>Отмена</button>
              <button className="sc-btn apply" onClick={handleAddEmployee} disabled={!addForm.full_name}>Добавить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
