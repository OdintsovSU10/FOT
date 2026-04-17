import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Archive,
  ChevronRight,
  Folder,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import type { OrgDepartmentNode } from '../../types';

interface IDepartmentPanelProps {
  departments: OrgDepartmentNode[];
  selectedDeptId: string | null;
  expandedDepts: Set<string>;
  deptCounts: Map<string, number>;
  totalActive: number;
  archiveDepartmentId?: string | null;
  highlightedDeptIds?: Set<string>;
  deptSearch: string;
  visibleDeptIds?: Set<string>;
  canManage?: boolean;
  selectedManageDeptIds?: Set<string>;
  onSelectDept: (id: string | null) => void;
  onToggleDept: (id: string) => void;
  onRefresh: () => void;
  onToggleManageSelection?: (id: string) => void;
  onSetManageSelection?: (ids: string[]) => void;
  onCreateRootDepartment?: () => void;
  onCreateDepartment?: (parentId: string | null) => void;
  onRenameDepartment?: (id: string) => void;
  onMoveDepartments?: (departmentIds: string[]) => void;
  onDeleteDepartments?: (departmentIds: string[]) => void;
  onDeleteDepartmentRecursive?: (id: string) => void;
  onClearManageSelection?: () => void;
  onDropEmployees?: (departmentId: string, employeeIds: number[]) => void;
}

interface IDragPayload {
  employeeIds: number[];
}

interface IContextMenuState {
  x: number;
  y: number;
  selection: string[];
}

const EMPLOYEE_DRAG_TYPE = 'application/x-fot-employees';

export const DepartmentPanel: FC<IDepartmentPanelProps> = ({
  departments,
  selectedDeptId,
  expandedDepts,
  deptCounts,
  totalActive,
  archiveDepartmentId = null,
  highlightedDeptIds,
  deptSearch,
  visibleDeptIds,
  canManage = false,
  selectedManageDeptIds = new Set(),
  onSelectDept,
  onToggleDept,
  onRefresh,
  onToggleManageSelection,
  onSetManageSelection,
  onCreateRootDepartment,
  onCreateDepartment,
  onRenameDepartment,
  onMoveDepartments,
  onDeleteDepartments,
  onDeleteDepartmentRecursive,
  onClearManageSelection,
  onDropEmployees,
}) => {
  const [contextMenu, setContextMenu] = useState<IContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredDepts = useMemo(() => {
    if (visibleDeptIds) {
      const filterById = (nodes: OrgDepartmentNode[]): OrgDepartmentNode[] =>
        nodes.reduce<OrgDepartmentNode[]>((acc, node) => {
          const children = filterById(node.children);
          if (visibleDeptIds.has(node.id) || children.length > 0) {
            acc.push({ ...node, children });
          }
          return acc;
        }, []);
      return filterById(departments);
    }

    if (!deptSearch) return departments;

    const query = deptSearch.toLowerCase();
    const filterTree = (nodes: OrgDepartmentNode[]): OrgDepartmentNode[] =>
      nodes.reduce<OrgDepartmentNode[]>((acc, node) => {
        const children = filterTree(node.children);
        if (node.name.toLowerCase().includes(query) || children.length > 0) {
          acc.push({ ...node, children });
        }
        return acc;
      }, []);
    return filterTree(departments);
  }, [departments, deptSearch, visibleDeptIds]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, OrgDepartmentNode>();
    const visit = (nodes: OrgDepartmentNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        visit(node.children);
      }
    };
    visit(departments);
    return map;
  }, [departments]);

  const selectedCount = selectedManageDeptIds.size;
  const contextSelection = contextMenu?.selection || [];
  const contextSelectionNodes = contextSelection
    .map(id => departmentMap.get(id))
    .filter((node): node is OrgDepartmentNode => !!node);
  const canCreateChild = contextSelection.length === 1 && contextSelection[0] !== archiveDepartmentId;
  const canRenameSelection = contextSelection.length === 1 && contextSelection[0] !== archiveDepartmentId;
  const canDeleteSelection = contextSelection.length > 0 && contextSelectionNodes.every(node => (
    node.id !== archiveDepartmentId
    && node.children.length === 0
    && (deptCounts.get(node.id) || 0) === 0
  ));
  const canDeleteRecursiveSelection = contextSelection.length === 1 && contextSelection[0] !== archiveDepartmentId;

  useEffect(() => {
    if (!contextMenu) return;

    const handleClose = (event?: Event) => {
      if (event && contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('mousedown', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const handleDrop = (event: React.DragEvent, departmentId: string) => {
    if (!onDropEmployees || departmentId === archiveDepartmentId) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData(EMPLOYEE_DRAG_TYPE);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as IDragPayload;
      const employeeIds = Array.from(new Set((payload.employeeIds || []).map(Number).filter(Number.isFinite)));
      if (employeeIds.length > 0) {
        onDropEmployees(departmentId, employeeIds);
      }
    } catch {
      // ignore malformed drag payload
    }
  };

  const handleNodeContextMenu = (event: React.MouseEvent, node: OrgDepartmentNode) => {
    if (!canManage) return;
    event.preventDefault();
    event.stopPropagation();

    const selection = selectedManageDeptIds.has(node.id) && selectedManageDeptIds.size > 0
      ? [...selectedManageDeptIds]
      : [node.id];

    onSetManageSelection?.(selection);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      selection,
    });
  };

  const renderDeptNode = (node: OrgDepartmentNode, level = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = deptSearch ? true : expandedDepts.has(node.id);
    const isSelected = selectedDeptId === node.id;
    const isHighlighted = !isSelected && (highlightedDeptIds?.has(node.id) ?? false);
    const isManageSelected = selectedManageDeptIds.has(node.id);
    const isArchive = archiveDepartmentId === node.id;
    const count = deptCounts.get(node.id) || 0;

    return (
      <div key={node.id} className="ep-dept-item">
        <div
          className={[
            'ep-dept-header',
            isSelected ? 'active' : '',
            isHighlighted ? 'highlighted' : '',
            isManageSelected ? 'manage-selected' : '',
            isArchive ? 'archive' : '',
            onDropEmployees && node.id !== archiveDepartmentId ? 'droppable' : '',
          ].filter(Boolean).join(' ')}
          style={{ paddingLeft: `${12 + level * 20}px` }}
          onClick={() => onSelectDept(isSelected ? null : node.id)}
          onContextMenu={event => handleNodeContextMenu(event, node)}
          onDragOver={(event) => {
            if (!onDropEmployees || node.id === archiveDepartmentId) return;
            event.preventDefault();
          }}
          onDrop={(event) => handleDrop(event, node.id)}
        >
          {canManage && onToggleManageSelection && (
            <button
              className={`ep-manage-check ${isManageSelected ? 'checked' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleManageSelection(node.id);
              }}
              title={isManageSelected ? 'Убрать из выбора' : 'Выбрать отдел'}
            />
          )}
          <button
            className={`ep-dept-toggle ${hasChildren ? (isExpanded ? 'expanded' : '') : 'empty'}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleDept(node.id);
            }}
          >
            <ChevronRight size={14} />
          </button>
          {isArchive ? <Archive size={16} className="ep-dept-icon" /> : <Folder size={16} className="ep-dept-icon" />}
          <span className="ep-dept-name">{node.name}</span>
          {count > 0 && <span className="ep-dept-count">{count}</span>}
        </div>
        {hasChildren && isExpanded && (
          <div className="ep-dept-children">
            {node.children.map(child => renderDeptNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ep-dept-panel">
      <div className="ep-dept-panel-header">
        <div className="ep-panel-title">
          <Folder size={16} />
          <span>Отделы</span>
          {selectedCount > 0 && <span className="ep-dept-selection-pill">{selectedCount}</span>}
        </div>
        <div className="ep-panel-actions">
          {selectedCount > 0 && onClearManageSelection && (
            <button className="ep-panel-btn" onClick={onClearManageSelection} title="Очистить выбор">
              <X size={14} />
            </button>
          )}
          {canManage && onCreateRootDepartment && (
            <button className="ep-panel-btn" onClick={onCreateRootDepartment} title="Новая папка">
              <Plus size={15} />
            </button>
          )}
          <button className="ep-panel-btn" onClick={onRefresh} title="Обновить">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="ep-dept-tree">
        <div
          className={`ep-dept-header ep-dept-all ${!selectedDeptId ? 'active' : ''}`}
          onClick={() => onSelectDept(null)}
        >
          <Users size={16} className="ep-dept-icon" />
          <span className="ep-dept-name">Все сотрудники</span>
          <span className="ep-dept-count">{totalActive}</span>
        </div>
        {filteredDepts.map(dept => renderDeptNode(dept))}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="ep-tree-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          <button
            className="ep-tree-context-item"
            type="button"
            onClick={() => {
              if (canCreateChild && contextSelection[0]) onCreateDepartment?.(contextSelection[0]);
              setContextMenu(null);
            }}
            disabled={!canCreateChild}
          >
            Добавить подпапку
          </button>
          <button
            className="ep-tree-context-item"
            type="button"
            onClick={() => {
              if (canRenameSelection && contextSelection[0]) onRenameDepartment?.(contextSelection[0]);
              setContextMenu(null);
            }}
            disabled={!canRenameSelection}
          >
            Переименовать
          </button>
          <button
            className="ep-tree-context-item"
            type="button"
            onClick={() => {
              if (contextSelection.length > 0) onMoveDepartments?.(contextSelection);
              setContextMenu(null);
            }}
          >
            {contextSelection.length > 1 ? `Переместить папки (${contextSelection.length})` : 'Переместить папку'}
          </button>
          <button
            className="ep-tree-context-item danger"
            type="button"
            onClick={() => {
              if (contextSelection.length > 0) onDeleteDepartments?.(contextSelection);
              setContextMenu(null);
            }}
            disabled={!canDeleteSelection}
          >
            {contextSelection.length > 1 ? 'Удалить пустые папки' : 'Удалить папку'}
          </button>
          <button
            className="ep-tree-context-item danger"
            type="button"
            onClick={() => {
              if (canDeleteRecursiveSelection && contextSelection[0]) onDeleteDepartmentRecursive?.(contextSelection[0]);
              setContextMenu(null);
            }}
            disabled={!canDeleteRecursiveSelection}
          >
            Удалить с содержимым
          </button>
        </div>
      )}
    </div>
  );
};
