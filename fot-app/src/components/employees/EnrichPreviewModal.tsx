import { useState, type FC } from 'react';
import { X, CheckCircle, AlertCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import type { EnrichPreview } from '../../types';

interface IEnrichPreviewModalProps {
  preview: EnrichPreview;
  loading: boolean;
  onApply: () => void;
  onClose: () => void;
}

export const EnrichPreviewModal: FC<IEnrichPreviewModalProps> = ({
  preview,
  loading,
  onApply,
  onClose,
}) => {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showAmbiguous, setShowAmbiguous] = useState(false);

  const { matched, unmatched, ambiguous, stats } = preview;

  return (
    <div className="ep-modal-overlay" onClick={onClose}>
      <div className="ep-modal enrich-modal" onClick={e => e.stopPropagation()}>
        <div className="ep-modal-header">
          <span className="ep-modal-title">Импорт сотрудников — Превью</span>
          <button className="ep-modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="ep-modal-body enrich-body">
          {/* Статистика */}
          <div className="enrich-stats">
            <div className="enrich-stat">
              <Users size={16} />
              <span>Всего в файле: <strong>{stats.total}</strong></span>
            </div>
            <div className="enrich-stat success">
              <CheckCircle size={16} />
              <span>Совпало: <strong>{stats.matched}</strong></span>
            </div>
            <div className="enrich-stat warning">
              <AlertCircle size={16} />
              <span>Не найдено: <strong>{stats.unmatched}</strong></span>
            </div>
            {stats.ambiguous > 0 && (
              <div className="enrich-stat warning">
                <AlertCircle size={16} />
                <span>Дубликаты: <strong>{stats.ambiguous}</strong></span>
              </div>
            )}
          </div>

          {/* Таблица совпавших */}
          {matched.length > 0 && (
            <div className="enrich-section">
              <h4>Будут обновлены ({matched.length})</h4>
              <div className="enrich-table-wrap">
                <table className="enrich-table">
                  <thead>
                    <tr>
                      <th>ФИО</th>
                      <th>Обновляемые поля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matched.map(item => (
                      <tr key={item.id}>
                        <td className="enrich-name">{item.fullName}</td>
                        <td>
                          <div className="enrich-updates">
                            {Object.entries(item.updates).map(([field, val]) => (
                              <span key={field} className="enrich-update-tag">
                                {field}: {val.new}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Несовпавшие */}
          {unmatched.length > 0 && (
            <div className="enrich-section">
              <button
                className="enrich-toggle"
                onClick={() => setShowUnmatched(!showUnmatched)}
              >
                {showUnmatched ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Не найдены в системе ({unmatched.length})
              </button>
              {showUnmatched && (
                <div className="enrich-list">
                  {unmatched.map((item, i) => (
                    <div key={i} className="enrich-list-item">
                      <span>{item.fullName}</span>
                      {item.department && <span className="enrich-dept">{item.department}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Дубликаты */}
          {ambiguous.length > 0 && (
            <div className="enrich-section">
              <button
                className="enrich-toggle"
                onClick={() => setShowAmbiguous(!showAmbiguous)}
              >
                {showAmbiguous ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Неоднозначные совпадения ({ambiguous.length})
              </button>
              {showAmbiguous && (
                <div className="enrich-list">
                  {ambiguous.map((item, i) => (
                    <div key={i} className="enrich-list-item">
                      <span>{item.fullName}</span>
                      <span className="enrich-dept">{item.count} записей в БД</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ep-modal-footer">
          <button className="ep-modal-btn secondary" onClick={onClose} disabled={loading}>
            Отмена
          </button>
          <button
            className="ep-modal-btn primary"
            onClick={onApply}
            disabled={loading || matched.length === 0}
          >
            {loading ? 'Применяется...' : `Применить (${matched.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
