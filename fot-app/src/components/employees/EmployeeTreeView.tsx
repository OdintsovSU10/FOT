import { useState, useEffect, useMemo, type FC } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Building2, Users, Edit3, Archive, Trash2, X, Check } from 'lucide-react';
import { structureApi } from '../../api/structure';
import type { Employee, EmployeeInput, OrgDepartmentNode } from '../../types';
import '../../styles/EmployeeTreeView.css';

interface IEmployeeTreeViewProps {
  employees: Employee[];
  searchQuery: string;
  expandedId: number | null;
  isEditing: boolean;
  canEdit: boolean;
  showArchived: boolean;
  effectiveOrgId?: string;
  onRowClick: (emp: Employee) => void;
  onStartEditing: (emp: Employee) => void;
  onCancelEditing: () => void;
  onSaveEditing: (id: number) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  editFormData: Partial<EmployeeInput>;
  onEditFormChange: (data: Partial<EmployeeInput>) => void;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('ru-RU');

const formatSalary = (salary: number | null) =>
  salary ? salary.toLocaleString('ru-RU') + ' \u20BD' : '\u2014';

const calculateTenure = (hireDate: string) => {
  const hire = new Date(hireDate);
  const now = new Date();
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return years > 0 ? `${years} \u0433. ${rem} \u043C\u0435\u0441.` : `${rem} \u043C\u0435\u0441.`;
};

export const EmployeeTreeView: FC<IEmployeeTreeViewProps> = ({
  employees,
  searchQuery,
  expandedId,
  isEditing,
  canEdit,
  showArchived,
  effectiveOrgId,
  onRowClick,
  onStartEditing,
  onCancelEditing,
  onSaveEditing,
  onArchive,
  onRestore,
  onDelete,
  editFormData,
  onEditFormChange,
}) => {
  const [departments, setDepartments] = useState<OrgDepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const res = await structureApi.getTree(effectiveOrgId);
      if (!cancelled && res.success && res.data) {
        setDepartments(res.data.departments);
        const all = new Set<string>();
        const expand = (nodes: OrgDepartmentNode[]) => {
          nodes.forEach(d => { all.add(d.id); if (d.children) expand(d.children); });
        };
        expand(res.data.departments);
        setExpandedNodes(all);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [effectiveOrgId]);

  const employeesByDept = useMemo(() => {
    const map = new Map<string | null, Employee[]>();
    employees.forEach(emp => {
      const key = emp.org_department_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(emp);
    });
    return map;
  }, [employees]);

  const flatDeptMap = useMemo(() => {
    const map = new Map<string, OrgDepartmentNode>();
    const flatten = (nodes: OrgDepartmentNode[]) => {
      nodes.forEach(n => { map.set(n.id, n); if (n.children) flatten(n.children); });
    };
    flatten(departments);
    return map;
  }, [departments]);

  const visibleDeptIds = useMemo(() => {
    if (!searchQuery && employees.length === 0) return null;
    const ids = new Set<string>();
    const addAncestors = (deptId: string) => {
      let current = flatDeptMap.get(deptId);
      while (current) {
        if (ids.has(current.id)) break;
        ids.add(current.id);
        current = current.parent_id ? flatDeptMap.get(current.parent_id) : undefined;
      }
    };
    employeesByDept.forEach((_emps, key) => {
      if (key) addAncestors(key);
    });
    return ids;
  }, [searchQuery, employees, employeesByDept, flatDeptMap]);

  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const count = (dept: OrgDepartmentNode): number => {
      let total = (employeesByDept.get(dept.id) || []).length;
      dept.children.forEach(child => { total += count(child); });
      counts.set(dept.id, total);
      return total;
    };
    departments.forEach(d => count(d));
    return counts;
  }, [departments, employeesByDept]);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderEmployeeRow = (emp: Employee) => (
    <div key={emp.id}>
      <div
        className={`tree-emp-row ${expandedId === emp.id ? 'tree-emp-expanded' : ''} ${emp.is_archived ? 'tree-emp-archived' : ''}`}
        onClick={() => onRowClick(emp)}
      >
        <span className="tree-emp-name">{emp.full_name}</span>
        <span className="tree-emp-position">{emp.position_name || '\u2014'}</span>
        <span className="tree-emp-salary">{formatSalary(emp.current_salary)}</span>
        <span className="tree-emp-chevron">
          {expandedId === emp.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {expandedId === emp.id && (
        <div className="tree-emp-details">
          {isEditing ? (
            <div className="expanded-edit-form">
              <div className="edit-grid">
                <div className="form-group">
                  <label>ФИО</label>
                  <input type="text" value={editFormData.full_name || ''} onChange={e => onEditFormChange({ ...editFormData, full_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Дата найма</label>
                  <input type="date" value={editFormData.hire_date || ''} onChange={e => onEditFormChange({ ...editFormData, hire_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Дата рождения</label>
                  <input type="date" value={editFormData.birth_date || ''} onChange={e => onEditFormChange({ ...editFormData, birth_date: e.target.value || undefined })} />
                </div>
                <div className="form-group">
                  <label>Зарплата</label>
                  <input type="number" value={editFormData.current_salary || ''} onChange={e => onEditFormChange({ ...editFormData, current_salary: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="expanded-actions">
                <button className="btn-cancel" onClick={onCancelEditing}><X size={16} /> Отмена</button>
                <button className="btn-save" onClick={() => onSaveEditing(emp.id)}><Check size={16} /> Сохранить</button>
              </div>
            </div>
          ) : (
            <div className="expanded-view">
              <div className="expanded-info">
                <div className="info-item">
                  <span className="info-label">Должность</span>
                  <span className="info-value">{emp.position_name || '\u2014'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Дата найма</span>
                  <span className="info-value">{formatDate(emp.hire_date)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Стаж</span>
                  <span className="info-value">{calculateTenure(emp.hire_date)}</span>
                </div>
                {emp.birth_date && (
                  <div className="info-item">
                    <span className="info-label">Дата рождения</span>
                    <span className="info-value">{formatDate(emp.birth_date)}</span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Отдел</span>
                  <span className="info-value">{emp.department || '\u2014'}</span>
                </div>
                <div className="info-item highlight">
                  <span className="info-label">Зарплата</span>
                  <span className="info-value">{formatSalary(emp.current_salary)}</span>
                </div>
              </div>
              {canEdit && (
                <div className="expanded-actions">
                  <button className="btn-edit" onClick={e => { e.stopPropagation(); onStartEditing(emp); }}><Edit3 size={16} /> Редактировать</button>
                  {emp.is_archived ? (
                    <button className="btn-restore" onClick={e => { e.stopPropagation(); onRestore(emp.id); }}>Восстановить</button>
                  ) : (
                    <button className="btn-archive" onClick={e => { e.stopPropagation(); onArchive(emp.id); }}><Archive size={16} /> В архив</button>
                  )}
                  <button className="btn-delete" onClick={e => { e.stopPropagation(); onDelete(emp.id); }}><Trash2 size={16} /> Удалить</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderDeptNode = (dept: OrgDepartmentNode, level: number) => {
    const count = deptCounts.get(dept.id) || 0;
    const isExpanded = expandedNodes.has(dept.id);
    const hasChildren = dept.children && dept.children.length > 0;
    const deptEmployees = employeesByDept.get(dept.id) || [];

    if (visibleDeptIds && !visibleDeptIds.has(dept.id) && count === 0) return null;

    return (
      <div key={dept.id} className="dept-node">
        <div
          className="dept-header"
          style={{ paddingLeft: 12 + level * 24 }}
          onClick={() => toggleNode(dept.id)}
        >
          <span className="dept-expand">
            {(hasChildren || deptEmployees.length > 0)
              ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)
              : <span className="dept-expand-placeholder" />
            }
          </span>
          <Building2 size={16} className="dept-icon" />
          <span className="dept-name">{dept.name}</span>
          {count > 0 && <span className="dept-count">{count}</span>}
        </div>

        {isExpanded && (
          <div className="dept-children">
            {hasChildren && dept.children.map(child => renderDeptNode(child, level + 1))}
            {deptEmployees.length > 0 && (
              <div className="dept-employees" style={{ paddingLeft: 12 + (level + 1) * 24 }}>
                {deptEmployees.map(renderEmployeeRow)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Загрузка структуры...</div>;
  }

  const unassigned = employeesByDept.get(null) || [];
  const hasTree = departments.length > 0;

  return (
    <div className="employee-tree">
      {hasTree && departments.map(dept => renderDeptNode(dept, 0))}

      {unassigned.length > 0 && (
        <div className="dept-node unassigned-section">
          <div
            className="dept-header unassigned-header"
            onClick={() => toggleNode('__unassigned')}
          >
            <span className="dept-expand">
              {expandedNodes.has('__unassigned') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <Users size={16} className="dept-icon" />
            <span className="dept-name">Без отдела</span>
            <span className="dept-count">{unassigned.length}</span>
          </div>
          {expandedNodes.has('__unassigned') && (
            <div className="dept-children">
              <div className="dept-employees" style={{ paddingLeft: 36 }}>
                {unassigned.map(renderEmployeeRow)}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasTree && unassigned.length === 0 && (
        <div className="empty-state">
          <Users size={48} />
          <p>Сотрудники не найдены</p>
        </div>
      )}
    </div>
  );
};
