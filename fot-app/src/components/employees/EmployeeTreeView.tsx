import { useState, useEffect, useMemo, type FC } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Building2, Users, Edit3, Archive, Trash2, X, Check } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { Employee, EmployeeInput } from '../../types';
import '../../styles/EmployeeTreeView.css';

interface ISigurDepartment {
  id: number;
  name: string;
  parentId: number | null;
}

interface IDeptTreeNode {
  id: number;
  name: string;
  parentId: number | null;
  children: IDeptTreeNode[];
}

interface IEmployeeTreeViewProps {
  employees: Employee[];
  searchQuery: string;
  expandedId: number | null;
  isEditing: boolean;
  canEdit: boolean;
  showArchived: boolean;
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

const SYSTEM_DEPTS = ['api_keys', 'автопарк', 'гостевые qr-коды'];

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

const buildTree = (departments: ISigurDepartment[]): IDeptTreeNode[] => {
  const map = new Map<number, IDeptTreeNode>();
  const roots: IDeptTreeNode[] = [];

  for (const d of departments) {
    map.set(d.id, { id: d.id, name: d.name, parentId: d.parentId, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
};

export const EmployeeTreeView: FC<IEmployeeTreeViewProps> = ({
  employees,
  searchQuery,
  expandedId,
  isEditing,
  canEdit,
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
  const [tree, setTree] = useState<IDeptTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{ success: boolean; data: ISigurDepartment[] }>('/sigur/departments');
        if (cancelled) return;
        const filtered = (res.data || []).filter(
          d => !SYSTEM_DEPTS.includes(d.name.toLowerCase().trim())
        );
        const built = buildTree(filtered);
        setTree(built);
        // Раскрываем первый уровень
        const initial = new Set<number>();
        built.forEach(n => initial.add(n.id));
        setExpandedNodes(initial);
      } catch {
        if (!cancelled) setTree([]);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Группировка сотрудников по имени отдела (department из Supabase)
  const employeesByDeptName = useMemo(() => {
    const map = new Map<string, Employee[]>();
    employees.forEach(emp => {
      const key = (emp.department || '').trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(emp);
    });
    return map;
  }, [employees]);

  // Плоский Map id → node для поиска предков
  const flatMap = useMemo(() => {
    const map = new Map<number, IDeptTreeNode>();
    const flatten = (nodes: IDeptTreeNode[]) => {
      nodes.forEach(n => { map.set(n.id, n); flatten(n.children); });
    };
    flatten(tree);
    return map;
  }, [tree]);

  // Получить сотрудников для узла дерева
  const getEmpsForNode = (node: IDeptTreeNode): Employee[] => {
    const key = node.name.trim().toLowerCase();
    return employeesByDeptName.get(key) || [];
  };

  // Рекурсивный подсчёт сотрудников в ветке
  const countBranch = useMemo(() => {
    const cache = new Map<number, number>();
    const count = (node: IDeptTreeNode): number => {
      if (cache.has(node.id)) return cache.get(node.id)!;
      let total = getEmpsForNode(node).length;
      node.children.forEach(child => { total += count(child); });
      cache.set(node.id, total);
      return total;
    };
    tree.forEach(n => count(n));
    return cache;
  }, [tree, employeesByDeptName]);

  // При поиске: определяем видимые узлы (содержащие сотрудников + предки)
  const visibleNodeIds = useMemo(() => {
    if (!searchQuery && employees.length === 0) return null;
    const ids = new Set<number>();
    const addAncestors = (nodeId: number) => {
      let current = flatMap.get(nodeId);
      while (current) {
        if (ids.has(current.id)) break;
        ids.add(current.id);
        current = current.parentId ? flatMap.get(current.parentId) : undefined;
      }
    };
    // Для каждого отдела с сотрудниками — добавляем его и предков
    const flatten = (nodes: IDeptTreeNode[]) => {
      nodes.forEach(n => {
        if (getEmpsForNode(n).length > 0) addAncestors(n.id);
        flatten(n.children);
      });
    };
    flatten(tree);
    return ids;
  }, [searchQuery, employees, tree, flatMap, employeesByDeptName]);

  const toggleNode = (id: number) => {
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

  const renderDeptNode = (node: IDeptTreeNode, level: number) => {
    const count = countBranch.get(node.id) || 0;
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const nodeEmployees = getEmpsForNode(node);

    if (visibleNodeIds && !visibleNodeIds.has(node.id) && count === 0) return null;

    return (
      <div key={node.id} className="dept-node">
        <div
          className="dept-header"
          style={{ paddingLeft: 12 + level * 24 }}
          onClick={() => toggleNode(node.id)}
        >
          <span className="dept-expand">
            {(hasChildren || nodeEmployees.length > 0)
              ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)
              : <span className="dept-expand-placeholder" />
            }
          </span>
          <Building2 size={16} className="dept-icon" />
          <span className="dept-name">{node.name}</span>
          {count > 0 && <span className="dept-count">{count}</span>}
        </div>

        {isExpanded && (
          <div className="dept-children">
            {hasChildren && node.children.map(child => renderDeptNode(child, level + 1))}
            {nodeEmployees.length > 0 && (
              <div className="dept-employees" style={{ paddingLeft: 12 + (level + 1) * 24 }}>
                {nodeEmployees.map(renderEmployeeRow)}
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

  // Сотрудники без совпадения с отделами Sigur
  const assignedDeptNames = new Set<string>();
  const collectNames = (nodes: IDeptTreeNode[]) => {
    nodes.forEach(n => {
      assignedDeptNames.add(n.name.trim().toLowerCase());
      collectNames(n.children);
    });
  };
  collectNames(tree);

  const unassigned = employees.filter(emp => {
    const deptName = (emp.department || '').trim().toLowerCase();
    return !deptName || !assignedDeptNames.has(deptName);
  });

  const hasTree = tree.length > 0;

  return (
    <div className="employee-tree">
      {hasTree && tree.map(node => renderDeptNode(node, 0))}

      {unassigned.length > 0 && (
        <div className="dept-node unassigned-section">
          <div
            className="dept-header unassigned-header"
            onClick={() => toggleNode(-1)}
          >
            <span className="dept-expand">
              {expandedNodes.has(-1) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
            <Users size={16} className="dept-icon" />
            <span className="dept-name">Без отдела</span>
            <span className="dept-count">{unassigned.length}</span>
          </div>
          {expandedNodes.has(-1) && (
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
