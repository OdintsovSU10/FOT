import { type FC, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Save, RotateCcw } from 'lucide-react';
import { productionCalendarService, type IProductionCalendarEntry } from '../../services/productionCalendarService';
import styles from './ProductionCalendarPage.module.css';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

interface IEditingRow {
  month: number;
  norm_days: number;
  norm_hours: number;
  holidays: string;
  mandatory_holidays: string;
}

const datesToString = (arr: string[] | undefined): string =>
  (arr || []).join(', ');

const stringToDates = (str: string): string[] =>
  str
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));

export const ProductionCalendarPage: FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<IProductionCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [editing, setEditing] = useState<IEditingRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productionCalendarService.getByYear(year);
      console.log('ProductionCalendar loaded:', data?.length, 'entries');
      setEntries(data);
    } catch (err) {
      console.error('ProductionCalendar load error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const entryMap = useMemo(() => new Map(entries.map(e => [e.month, e])), [entries]);

  const handleEdit = (month: number) => {
    const entry = entryMap.get(month);
    setEditing({
      month,
      norm_days: entry?.norm_days ?? 22,
      norm_hours: entry?.norm_hours ?? 176,
      holidays: datesToString(entry?.holidays),
      mandatory_holidays: datesToString(entry?.mandatory_holidays),
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(editing.month);
    try {
      await productionCalendarService.update(year, editing.month, {
        norm_days: editing.norm_days,
        norm_hours: editing.norm_hours,
        holidays: stringToDates(editing.holidays),
        mandatory_holidays: stringToDates(editing.mandatory_holidays),
      });
      setEditing(null);
      await load();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => setEditing(null);

  const totalDays = entries.reduce((s, e) => s + e.norm_days, 0);
  const totalHours = entries.reduce((s, e) => s + Number(e.norm_hours), 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Производственный календарь</h2>
        <div className={styles.yearNav}>
          <button className={styles.yearBtn} onClick={() => setYear(y => y - 1)}>
            <ChevronLeft size={18} />
          </button>
          <span className={styles.yearLabel}>{year}</span>
          <button className={styles.yearBtn} onClick={() => setYear(y => y + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Месяц</th>
                <th>Рабочих дней</th>
                <th>Рабочих часов</th>
                <th>Праздники</th>
                <th>Всегда-выходные</th>
                <th>Изменено</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {MONTH_NAMES.map((name, i) => {
                const month = i + 1;
                const entry = entryMap.get(month);
                const isEditing = editing?.month === month;

                return (
                  <tr key={month} className={entry?.is_custom ? styles.customRow : ''}>
                    <td className={styles.monthCell}>{name}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          className={styles.input}
                          value={editing.norm_days}
                          onChange={e => setEditing({ ...editing, norm_days: parseInt(e.target.value) || 0 })}
                          min={0}
                          max={31}
                        />
                      ) : (
                        entry?.norm_days ?? '—'
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          className={styles.input}
                          value={editing.norm_hours}
                          onChange={e => setEditing({ ...editing, norm_hours: parseFloat(e.target.value) || 0 })}
                          min={0}
                          max={248}
                          step={0.5}
                        />
                      ) : (
                        entry?.norm_hours ?? '—'
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className={styles.input}
                          value={editing.holidays}
                          onChange={e => setEditing({ ...editing, holidays: e.target.value })}
                          placeholder="2026-05-01, 2026-05-09"
                        />
                      ) : (
                        <span style={{ fontSize: 11 }}>{(entry?.holidays || []).length} дат</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className={styles.input}
                          value={editing.mandatory_holidays}
                          onChange={e => setEditing({ ...editing, mandatory_holidays: e.target.value })}
                          placeholder="2026-01-01, 2026-01-07"
                        />
                      ) : (
                        <span style={{ fontSize: 11 }}>{(entry?.mandatory_holidays || []).length} дат</span>
                      )}
                    </td>
                    <td className={styles.customCell}>
                      {entry?.is_custom && (
                        <span className={styles.customBadge}>Изменено</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className={styles.actions}>
                          <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving === month}
                          >
                            <Save size={14} />
                            {saving === month ? 'Сохранение...' : 'Сохранить'}
                          </button>
                          <button className={styles.cancelBtn} onClick={handleCancel}>
                            <RotateCcw size={14} />
                          </button>
                        </div>
                      ) : (
                        <button className={styles.editBtn} onClick={() => handleEdit(month)}>
                          Изменить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className={styles.totalRow}>
                <td>Итого</td>
                <td>{totalDays}</td>
                <td>{totalHours}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
            Даты в формате YYYY-MM-DD через запятую. «Праздники» учитываются только графиками с
            флагом «учитывать праздники РФ». «Всегда-выходные» (1 января, 7 января, 9 мая) — для
            всех графиков.
          </div>
        </div>
      )}
    </div>
  );
};
