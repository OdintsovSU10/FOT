import { type FC, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { travelTimeService } from '../../services/travelTimeService';
import '../../styles/TravelSettings.css';

interface ITravelConfigTabProps {
  canEdit: boolean;
  setError: (error: string) => void;
}

export const TravelConfigTab: FC<ITravelConfigTabProps> = ({ canEdit, setError }) => {
  const [limitMinutes, setLimitMinutes] = useState('');
  const [configuredLimit, setConfiguredLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await travelTimeService.getConfig();
      setConfiguredLimit(data.limit_minutes);
      setLimitMinutes(data.limit_minutes != null ? String(data.limit_minutes) : '');
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка загрузки лимита передвижения');
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    const parsed = Number(limitMinutes);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1440) {
      setError('Укажите лимит передвижения от 1 до 1440 минут');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const next = await travelTimeService.saveConfig({ limit_minutes: parsed });
      setConfiguredLimit(next.limit_minutes);
      setLimitMinutes(next.limit_minutes != null ? String(next.limit_minutes) : '');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ошибка сохранения лимита передвижения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sigur-section">
      <div className="travel-config-toolbar">
        <div>
          <h3 className="sigur-section-title">Единый лимит передвижения</h3>
          <div className="travel-config-hint">
            Укажите время от самого дальнего объекта до самого дальнего. Любое передвижение будет сравниваться с этим лимитом.
          </div>
        </div>
        <button className="sigur-btn" onClick={() => void loadConfig()} disabled={loading || saving}>
          <RefreshCw size={14} className={loading ? 'travel-spin' : ''} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="travel-config-empty">Загрузка лимита...</div>
      ) : (
        <>
          <div className="travel-route-form">
            <input
              type="number"
              min={1}
              max={1440}
              value={limitMinutes}
              onChange={event => setLimitMinutes(event.target.value)}
              disabled={!canEdit || saving}
              placeholder="Лимит, минут"
            />
            <button className="sigur-btn sigur-btn-primary" onClick={handleSave} disabled={!canEdit || saving}>
              <Save size={14} />
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          <div className="travel-config-main">
            <div className="travel-config-sidebar-title">Как это работает</div>
            <div className="travel-config-hint" style={{ marginBottom: '0.75rem' }}>
              Передвижение внутри лимита не влияет на часы табеля. Если фактическое время больше лимита или объект не определён, день подсвечивается в табеле как проблема.
            </div>
            {configuredLimit == null ? (
              <div className="travel-config-empty" style={{ textAlign: 'left', padding: 0 }}>
                Лимит пока не задан. Пока он не сохранён, страница передвижений будет показывать ошибку конфигурации.
              </div>
            ) : (
              <div className="travel-config-hint">
                Текущий лимит: <strong>{configuredLimit} мин</strong>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
