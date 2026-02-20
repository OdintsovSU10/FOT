import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Upload, Search, Archive, X, AlertTriangle, FileSpreadsheet, List, GitBranch, ChevronDown } from 'lucide-react';
import { employeeService } from '../../services/employeeService';
import { apiClient } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { EmployeeTreeView } from '../../components/employees/EmployeeTreeView';
import type { Employee, EmployeeInput } from '../../types';
import '../../styles/TenderPage.css';

interface IDbDepartment {
  id: string;
  name: string;
  parent_id: string | null;
  children: IDbDepartment[];
}

interface IDeptFlatOption {
  id: string;
  name: string;
  level: number;
  allIds: string[];
}

const collectAllIds = (node: IDbDepartment): string[] => {
  const ids = [node.id];
  for (const child of node.children) {
    ids.push(...collectAllIds(child));
  }
  return ids;
};

const flattenDbTree = (nodes: IDbDepartment[], level = 0): IDeptFlatOption[] => {
  const result: IDeptFlatOption[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      level,
      allIds: collectAllIds(node),
    });
    result.push(...flattenDbTree(node.children, level + 1));
  }
  return result;
};

export const TenderPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasPosition, canAccess } = useAuth();
  const isSuperAdmin = hasPosition('super_admin');
  const canEdit = canAccess('header');
  const [deleting, setDeleting] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');

  const [deptOptions, setDeptOptions] = useState<IDeptFlatOption[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState('');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<EmployeeInput>({
    full_name: '',
    hire_date: new Date().toISOString().split('T')[0],
    current_salary: null,
  });

  useEffect(() => {
    apiClient.get<{ success: boolean; data: { departments: IDbDepartment[] } }>('/structure')
      .then(res => {
        const departments = res.data?.departments || [];
        setDeptOptions(flattenDbTree(departments));
      })
      .catch(() => {});
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await employeeService.getAll({ archived: showArchived });
      setEmployees(data);
    } catch {
      setError('Ошибка загрузки сотрудников');
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const positions = useMemo(() => {
    const posSet = new Set<string>();
    employees.forEach(emp => { if (emp.position_name) posSet.add(emp.position_name); });
    return Array.from(posSet).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [employees]);

  const selectedDept = useMemo(
    () => selectedDeptId !== null ? deptOptions.find(d => d.id === selectedDeptId) : null,
    [selectedDeptId, deptOptions],
  );

  const filteredDeptOptions = useMemo(() => {
    if (!deptSearchQuery) return deptOptions;
    const q = deptSearchQuery.toLowerCase();
    return deptOptions.filter(d => d.name.toLowerCase().includes(q));
  }, [deptOptions, deptSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = searchQuery === '' ||
        emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.position_name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPosition = positionFilter === '' || emp.position_name === positionFilter;
      const matchesDept = !selectedDept ||
        selectedDept.allIds.includes(emp.org_department_id || '');
      return matchesSearch && matchesPosition && matchesDept;
    });
  }, [employees, searchQuery, positionFilter, selectedDept]);

  const handleAddEmployee = async () => {
    if (!formData.full_name || !formData.hire_date) return;
    try {
      await employeeService.create(formData);
      setShowAddModal(false);
      setFormData({ full_name: '', hire_date: new Date().toISOString().split('T')[0], current_salary: null });
      loadEmployees();
    } catch {
      setError('Ошибка добавления сотрудника');
    }
  };

  const handleRowClick = (emp: Employee) => {
    navigate(`/tender/${emp.id}`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await employeeService.import(file);
      alert(`Импортировано: ${result.imported} сотрудников`);
      loadEmployees();
    } catch {
      setError('Ошибка импорта');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('ВНИМАНИЕ! Удалить ВСЕХ сотрудников? Это действие необратимо!')) return;
    if (!confirm('Вы уверены? Это удалит ВСЕ данные сотрудников!')) return;
    setDeleting(true);
    try {
      const result = await employeeService.deleteAll();
      alert(`Удалено ${result.deleted} сотрудников`);
      loadEmployees();
    } catch {
      setError('Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ru-RU');

  const calculateTenure = (hireDate: string) => {
    const hire = new Date(hireDate);
    const now = new Date();
    const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return years > 0 ? `${years} г. ${rem} мес.` : `${rem} мес.`;
  };

  const clearFilters = () => {
    setPositionFilter('');
    setSelectedDeptId(null);
    setSearchQuery('');
  };

  const hasActiveFilters = positionFilter !== '' || selectedDeptId !== null || searchQuery !== '';

  return (
    <div className="tender-page">
      <div className="tender-header">
        <div className="tender-title">
          <Users size={24} />
          <h1>Сотрудники</h1>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: '12px' }}>×</button>
        </div>
      )}

      <div className="tender-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {deptOptions.length > 0 && (
          <div className="dept-dropdown" ref={deptDropdownRef}>
            <button
              className={`dept-dropdown-trigger ${selectedDeptId ? 'has-value' : ''}`}
              onClick={() => {
                setDeptDropdownOpen(!deptDropdownOpen);
                setDeptSearchQuery('');
              }}
            >
              <span className="dept-dropdown-label">
                {selectedDept ? selectedDept.name : 'Все отделы'}
              </span>
              <ChevronDown size={14} className={`dept-dropdown-chevron ${deptDropdownOpen ? 'open' : ''}`} />
            </button>
            {deptDropdownOpen && (
              <div className="dept-dropdown-menu">
                <div className="dept-dropdown-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Поиск отдела..."
                    value={deptSearchQuery}
                    onChange={e => setDeptSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="dept-dropdown-list">
                  <div
                    className={`dept-dropdown-item ${!selectedDeptId ? 'selected' : ''}`}
                    onClick={() => { setSelectedDeptId(null); setDeptDropdownOpen(false); }}
                  >
                    Все отделы
                  </div>
                  {filteredDeptOptions.map(dept => (
                    <div
                      key={dept.id}
                      className={`dept-dropdown-item ${selectedDeptId === dept.id ? 'selected' : ''}`}
                      style={{ paddingLeft: 12 + dept.level * 16 }}
                      onClick={() => { setSelectedDeptId(dept.id); setDeptDropdownOpen(false); }}
                    >
                      {dept.name}
                    </div>
                  ))}
                  {filteredDeptOptions.length === 0 && (
                    <div className="dept-dropdown-empty">Не найдено</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <select
          className="filter-select"
          value={positionFilter}
          onChange={e => setPositionFilter(e.target.value)}
        >
          <option value="">Все должности</option>
          {positions.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button className="btn-clear-filters" onClick={clearFilters} title="Сбросить фильтры">
            <X size={16} />
          </button>
        )}

        <button
          className={`btn-archive-toggle ${showArchived ? 'active' : ''}`}
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive size={16} />
          <span>Архив</span>
        </button>

        <div className="view-mode-toggle">
          <button
            className={`btn-view-mode ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Список"
          >
            <List size={16} />
          </button>
          <button
            className={`btn-view-mode ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
            title="По отделам"
          >
            <GitBranch size={16} />
          </button>
        </div>

        {canEdit && (
          <div className="tender-actions">
            <button className="btn-import" onClick={() => setShowImportModal(true)}>
              <Upload size={18} />
              <span>Импорт</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleImport}
              hidden
            />
            <button className="btn-add" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              <span>Сотрудник</span>
            </button>
            {isSuperAdmin && (
              <button
                className="btn-clear-all"
                onClick={handleDeleteAll}
                disabled={deleting}
                title="Удалить всех сотрудников (для разработки)"
              >
                <AlertTriangle size={16} />
                <span>{deleting ? 'Удаление...' : 'Очистить'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : viewMode === 'tree' ? (
        <EmployeeTreeView
          employees={filteredEmployees}
          searchQuery={searchQuery}
          onEmployeeClick={handleRowClick}
        />
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state">
          <Users size={48} />
          <p>Сотрудники не найдены</p>
        </div>
      ) : (
        <div className="employees-table">
          <div className="table-header">
            <span style={{ width: '40px', textAlign: 'center' }}>№</span>
            <span>ФИО</span>
            <span>Должность</span>
            <span>Стаж</span>
            <span>Группа</span>
          </div>
          {filteredEmployees.map((emp, index) => (
            <div
              key={emp.id}
              className={`table-row ${emp.is_archived ? 'archived' : ''}`}
              onClick={() => handleRowClick(emp)}
            >
              <span className="col-number" style={{ width: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {index + 1}
              </span>
              <span className="col-name">{emp.full_name}</span>
              <span className="col-position">{emp.position_name || '—'}</span>
              <span className="col-tenure">{calculateTenure(emp.hire_date)}</span>
              <span className="col-group">{emp.department || '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Добавить сотрудника</h3>
            <div className="form-group">
              <label>ФИО</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Иванов Иван Иванович"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Дата найма</label>
                <input
                  type="date"
                  value={formData.hire_date}
                  onChange={e => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Зарплата</label>
                <input
                  type="number"
                  value={formData.current_salary || ''}
                  onChange={e => setFormData({ ...formData, current_salary: e.target.value ? Number(e.target.value) : null })}
                  placeholder="50000"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={handleAddEmployee}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="import-modal" onClick={e => e.stopPropagation()}>
            <div className="import-modal-header">
              <div className="import-modal-icon">
                <FileSpreadsheet size={24} />
              </div>
              <div className="import-modal-title">
                <h3>Импорт сотрудников</h3>
                <p>Загрузите Excel файл (.xlsx, .xls)</p>
              </div>
              <button className="import-modal-close" onClick={() => setShowImportModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="import-modal-body">
              <table className="import-columns-table">
                <thead>
                  <tr>
                    <th className="import-col-num">№</th>
                    <th className="import-col-name">Столбец</th>
                    <th className="import-col-required">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { n: 1, name: 'ФИО полное' },
                    { n: 2, name: 'Должность' },
                    { n: 3, name: 'Отдел' },
                    { n: 4, name: 'Подразделение' },
                    { n: 5, name: 'Дата приёма' },
                    { n: 6, name: 'Дата рождения' },
                    { n: 7, name: 'Зарплата' },
                    { n: 8, name: 'Страна' },
                    { n: 9, name: 'СНИЛС' },
                    { n: 10, name: 'Дата выдачи патента' },
                    { n: 11, name: 'Дата окончания патента' },
                    { n: 12, name: 'Компания' },
                    { n: 13, name: 'Email' },
                  ].map(col => (
                    <tr key={col.n}>
                      <td className="import-col-num">{col.n}</td>
                      <td className="import-col-name">{col.name}</td>
                      <td className="import-col-required"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="import-hints">
                <div className="import-hint">
                  <span className="import-hint-icon">📅</span>
                  <span>Форматы дат: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД</span>
                </div>
                <div className="import-hint accent">
                  <span className="import-hint-icon">✨</span>
                  <span>Компании, отделы и подразделения автоматически добавляются в структуру</span>
                </div>
              </div>
            </div>
            <div className="import-modal-footer">
              <button className="import-btn-cancel" onClick={() => setShowImportModal(false)}>Отмена</button>
              <button
                className="import-btn-submit"
                onClick={() => {
                  setShowImportModal(false);
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={18} />
                Выбрать файл
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
