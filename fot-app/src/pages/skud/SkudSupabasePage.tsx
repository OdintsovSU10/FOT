import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import { skudService } from '../../services/skudService';
import type { SkudEvent, SkudDailySummary } from '../../types';
import '../../styles/SkudSupabasePage.css';

type TabId = 'events' | 'summary' | 'access-points';

interface ITab {
  id: TabId;
  label: string;
}

const TABS: ITab[] = [
  { id: 'events', label: 'События' },
  { id: 'summary', label: 'Сводка' },
  { id: 'access-points', label: 'Точки доступа' },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const SkudSupabasePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('events');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Даты
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);

  // Данные
  const [events, setEvents] = useState<SkudEvent[]>([]);
  const [summary, setSummary] = useState<SkudDailySummary[]>([]);
  const [accessPoints, setAccessPoints] = useState<string[]>([]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skudService.getEvents({ startDate, endDate });
      setEvents(data);
      console.log(`[skud-db] События: ${data.length} записей`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skudService.getDailySummary(startDate);
      setSummary(data);
      console.log(`[skud-db] Сводка: ${data.length} записей`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  const loadAccessPoints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await skudService.getAccessPoints();
      setAccessPoints(data);
      console.log(`[skud-db] Точки доступа: ${data.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      setAccessPoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(() => {
    if (activeTab === 'events') loadEvents();
    else if (activeTab === 'summary') loadSummary();
    else loadAccessPoints();
  }, [activeTab, loadEvents, loadSummary, loadAccessPoints]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Данные для таблицы
  const tableData: Record<string, unknown>[] = useMemo(() => {
    if (activeTab === 'events') return events as unknown as Record<string, unknown>[];
    if (activeTab === 'summary') return summary as unknown as Record<string, unknown>[];
    return accessPoints.map((ap, i) => ({ '#': i + 1, access_point: ap }));
  }, [activeTab, events, summary, accessPoints]);

  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    const keys = new Set<string>();
    for (const row of tableData.slice(0, 50)) {
      Object.keys(row).forEach(k => keys.add(k));
    }
    return Array.from(keys);
  }, [tableData]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return tableData;
    const q = searchQuery.toLowerCase();
    return tableData.filter(row =>
      columns.some(col => formatCellValue(row[col]).toLowerCase().includes(q))
    );
  }, [tableData, searchQuery, columns]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setSearchQuery('');
  };

  return (
    <div className="skud-db">
      <div className="skud-db-header">
        <div className="skud-db-title">
          <HardDrive size={22} />
          <h1>Просмотр СКУД (база)</h1>
          {!loading && tableData.length > 0 && (
            <span className="skud-db-count">
              {filteredData.length}{searchQuery ? ` / ${tableData.length}` : ''}
            </span>
          )}
        </div>
        <button
          className="skud-db-refresh"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          Обновить
        </button>
      </div>

      <div className="skud-db-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`skud-db-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
            disabled={loading}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'access-points' && (
        <div className="skud-db-dates">
          <label>
            С:
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label>
            По:
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
          {activeTab === 'events' && (
            <span className="skud-db-limit">макс. 1000 записей</span>
          )}
        </div>
      )}

      <div className="skud-db-search-wrap">
        <Search size={16} className="skud-db-search-icon" />
        <input
          type="text"
          placeholder="Поиск по всем полям..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="skud-db-search-input"
        />
        {searchQuery && (
          <button className="skud-db-search-clear" onClick={() => setSearchQuery('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="skud-db-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="skud-db-loading">
          <div className="spinner"></div>
          <p>Загрузка из базы...</p>
        </div>
      ) : tableData.length === 0 && !error ? (
        <div className="skud-db-empty">Нет данных за выбранный период</div>
      ) : (
        <div className="skud-db-table-wrap">
          <table className="skud-db-table">
            <thead>
              <tr>
                <th className="skud-db-th-num">#</th>
                {columns.map(col => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx}>
                  <td className="skud-db-td-num">{idx + 1}</td>
                  {columns.map(col => (
                    <td key={col} title={formatCellValue(row[col])}>
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && searchQuery && (
            <div className="skud-db-empty">Ничего не найдено</div>
          )}
        </div>
      )}
    </div>
  );
};
