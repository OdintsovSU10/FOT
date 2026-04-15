import { useEffect, useMemo, useState, type FC } from 'react';
import { Check, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { sigurService } from '../../services/sigurService';
import type { AccessPointOption, SigurConnectionScope, SigurEmployeeAccessPointBinding } from '../../types';

interface IEmployeeSigurAccessPointsCardProps {
  employeeId: number;
  sigurEmployeeId: number | null;
  canEdit: boolean;
  selectedConnection?: SigurConnectionScope;
}

const getOptionLabel = (option: AccessPointOption): string => (
  option.id == null ? option.name : `${option.name} (${option.id})`
);

export const EmployeeSigurAccessPointsCard: FC<IEmployeeSigurAccessPointsCardProps> = ({
  employeeId,
  sigurEmployeeId,
  canEdit,
  selectedConnection,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState<boolean>(!!sigurEmployeeId);
  const [catalog, setCatalog] = useState<AccessPointOption[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    sigurService.getEmployeeAccessPoints(employeeId, selectedConnection)
      .then(data => {
        if (cancelled) return;
        setLinked(data.linked);
        setCatalog(data.accessPoints);
        const nextSelectedIds = data.bindings.map(binding => binding.accessPointId).sort((a, b) => a - b);
        setInitialSelectedIds(nextSelectedIds);
        setSelectedIds(nextSelectedIds);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить точки доступа сотрудника');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, reloadKey, selectedConnection]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedBindings = useMemo<SigurEmployeeAccessPointBinding[]>(() => (
    catalog
      .filter(option => option.id != null && selectedSet.has(option.id))
      .map(option => ({
        accessPointId: option.id as number,
        accessPointName: option.name,
      }))
      .sort((left, right) => (left.accessPointName || '').localeCompare(right.accessPointName || '', 'ru'))
  ), [catalog, selectedSet]);

  const hasChanges = useMemo(() => {
    const stableSelected = [...selectedIds].sort((a, b) => a - b);
    if (initialSelectedIds.length !== stableSelected.length) return true;
    return stableSelected.some((value, index) => value !== initialSelectedIds[index]);
  }, [initialSelectedIds, selectedIds]);

  const togglePoint = (accessPointId: number) => {
    setSelectedIds(prev => (
      prev.includes(accessPointId)
        ? prev.filter(id => id !== accessPointId)
        : [...prev, accessPointId]
    ));
    setSavedFlash(false);
  };

  const handleReload = () => {
    setReloadKey(prev => prev + 1);
    setSavedFlash(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await sigurService.saveEmployeeAccessPoints(employeeId, [...selectedIds].sort((a, b) => a - b), selectedConnection);
      const nextSelectedIds = result.bindings.map(binding => binding.accessPointId).sort((a, b) => a - b);
      setInitialSelectedIds(nextSelectedIds);
      setSelectedIds(nextSelectedIds);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
      setReloadKey(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить точки доступа сотрудника');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="ec-sigur-card">Загрузка привязок Sigur...</div>;
  }

  if (!linked) {
    return (
      <div className="ec-sigur-card">
        <div className="ec-sigur-card-head">
          <div>
            <div className="ec-sigur-card-title"><ShieldCheck size={16} /> Точки доступа Sigur</div>
            <div className="ec-sigur-card-subtitle">Для этого сотрудника связь с Sigur не настроена.</div>
          </div>
          <button className="sigur-btn" type="button" onClick={handleReload}>
            <RefreshCw size={14} />
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-sigur-card">
      <div className="ec-sigur-card-head">
        <div>
          <div className="ec-sigur-card-title"><ShieldCheck size={16} /> Точки доступа Sigur</div>
          <div className="ec-sigur-card-subtitle">
            Прямые привязки сотрудника к точкам доступа. Изменения сохраняются напрямую в Sigur.
          </div>
        </div>
        <div className="ec-sigur-card-actions">
          <button className="sigur-btn" type="button" onClick={handleReload} disabled={saving}>
            <RefreshCw size={14} />
            Обновить
          </button>
          {canEdit && (
            <button
              className={`sigur-btn sigur-btn-primary ${savedFlash ? 'sigur-btn-saved' : ''}`}
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !hasChanges}
            >
              {savedFlash ? <><Check size={14} /> Сохранено</> : <><Save size={14} /> Сохранить</>}
            </button>
          )}
        </div>
      </div>

      {error && <div className="ec-sigur-inline-error">{error}</div>}

      <div className="ec-sigur-summary">
        Привязано: <strong>{selectedBindings.length}</strong>
        {sigurEmployeeId ? <span>Sigur ID: <strong>{sigurEmployeeId}</strong></span> : null}
      </div>

      {catalog.length === 0 ? (
        <div className="ec-sigur-empty">В Sigur не найдено доступных точек доступа.</div>
      ) : (
        <div className="ec-sigur-points-grid">
          {catalog
            .filter(option => option.id != null)
            .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
            .map(option => {
              const checked = selectedSet.has(option.id as number);
              return (
                <label
                  key={option.id}
                  className={`ec-sigur-point ${checked ? 'selected' : ''} ${!canEdit ? 'readonly' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePoint(option.id as number)}
                    disabled={!canEdit || saving}
                  />
                  <span>{getOptionLabel(option)}</span>
                </label>
              );
            })}
        </div>
      )}
    </div>
  );
};
