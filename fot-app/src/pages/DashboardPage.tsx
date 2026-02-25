import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Search, Building2 } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { ActivityList } from '../components/dashboard/ActivityList';
import { usePresence } from '../hooks/usePresence';
import { apiClient } from '../api/client';
import {
  UsersIcon,
  MapPinIcon,
  CheckCircleIcon,
  ChartIcon,
} from '../components/ui/Icons';
import '../styles/DashboardPage.css';

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
}

const flattenDbTree = (nodes: IDbDepartment[], level = 0): IDeptFlatOption[] => {
  const result: IDeptFlatOption[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, name: node.name, level });
    result.push(...flattenDbTree(node.children, level + 1));
  }
  return result;
};

export const DashboardPage: React.FC = () => {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Department selector
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDeptId = searchParams.get('dept');
  const [deptOptions, setDeptOptions] = useState<IDeptFlatOption[]>([]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiClient.get<{ success: boolean; data: { departments: IDbDepartment[] } }>('/structure')
      .then(res => {
        const departments = res.data?.departments || [];
        setDeptOptions(flattenDbTree(departments));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedDept = useMemo(
    () => selectedDeptId ? deptOptions.find(d => d.id === selectedDeptId) : null,
    [selectedDeptId, deptOptions],
  );

  const filteredDeptOptions = useMemo(() => {
    if (!deptSearchQuery) return deptOptions;
    const q = deptSearchQuery.toLowerCase();
    return deptOptions.filter(d => d.name.toLowerCase().includes(q));
  }, [deptOptions, deptSearchQuery]);

  // Presence data
  const { employees, loading } = usePresence(selectedDeptId);

  const onlineCount = useMemo(
    () => employees.filter(e => e.status === 'online').length,
    [employees],
  );

  const offlineCount = useMemo(
    () => employees.filter(e => e.status === 'offline').length,
    [employees],
  );

  const presencePercent = useMemo(
    () => employees.length > 0 ? Math.round((onlineCount / employees.length) * 100) : 0,
    [employees, onlineCount],
  );

  const deptSelector = (
    <div className="dash-dept-dropdown" ref={deptDropdownRef}>
      <button
        className={`dash-dept-trigger ${selectedDeptId ? 'has-value' : ''} ${!selectedDeptId ? 'dash-dept-trigger--large' : ''}`}
        onClick={() => { setDeptDropdownOpen(!deptDropdownOpen); setDeptSearchQuery(''); }}
      >
        <span className="dash-dept-label">
          {selectedDept ? selectedDept.name : 'Выберите отдел'}
        </span>
        <ChevronDown size={selectedDeptId ? 14 : 18} className={`dash-dept-chevron ${deptDropdownOpen ? 'open' : ''}`} />
      </button>
      {deptDropdownOpen && (
        <div className={`dash-dept-menu ${!selectedDeptId ? 'dash-dept-menu--center' : ''}`}>
          <div className="dash-dept-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Поиск отдела..."
              value={deptSearchQuery}
              onChange={e => setDeptSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="dash-dept-list">
            {filteredDeptOptions.map(dept => (
              <div
                key={dept.id}
                className={`dash-dept-item ${selectedDeptId === dept.id ? 'selected' : ''}`}
                style={{ paddingLeft: 12 + dept.level * 16 }}
                onClick={() => { setSearchParams({ dept: dept.id }, { replace: true }); setDeptDropdownOpen(false); }}
              >
                {dept.name}
              </div>
            ))}
            {filteredDeptOptions.length === 0 && (
              <div className="dash-dept-empty">Не найдено</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {!selectedDeptId ? (
        <div className="dash-placeholder">
          <Building2 size={48} strokeWidth={1.2} />
          <h3>Выберите отдел</h3>
          <p>Чтобы увидеть статистику присутствия</p>
          {deptSelector}
        </div>
      ) : (
        <>
          <div className="content-header">
            <div className="date-display">{today}</div>
            {deptSelector}
          </div>
          <div className="stats-grid">
            <StatCard
              label="Всего сотрудников"
              value={employees.length > 0 ? String(employees.length) : '—'}
              icon={<UsersIcon />}
              iconType="blue"
            />
            <StatCard
              label="На работе"
              value={onlineCount > 0 ? String(onlineCount) : '—'}
              icon={<MapPinIcon />}
              iconType="green"
            />
            <StatCard
              label="Ушли"
              value={offlineCount > 0 ? String(offlineCount) : '—'}
              icon={<CheckCircleIcon />}
              iconType="orange"
            />
            <StatCard
              label="Присутствие"
              value={employees.length > 0 ? `${presencePercent}%` : '—'}
              icon={<ChartIcon />}
              iconType="blue"
            />
          </div>

          <ActivityList employees={employees} loading={loading} />
        </>
      )}
    </>
  );
};
