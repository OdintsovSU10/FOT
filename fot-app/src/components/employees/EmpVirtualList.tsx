import type { FC } from 'react';
import { Users } from 'lucide-react';
import type { Employee, IEmployeePresence } from '../../types';

interface IEmpVirtualListProps {
  employees: Employee[];
  loading: boolean;
  selectedEmps: Set<number>;
  presenceMap: Map<number, IEmployeePresence>;
  allVisibleSelected: boolean;
  onEmpClick: (employee: Employee) => void;
  onToggleSelection: (id: number) => void;
  onToggleVisibleSelection: () => void;
}

const renderPresenceDot = (presence?: IEmployeePresence): string => {
  if (!presence) return '';
  return presence.status;
};

export const EmpVirtualList: FC<IEmpVirtualListProps> = ({
  employees,
  loading,
  selectedEmps,
  presenceMap,
  allVisibleSelected,
  onEmpClick,
  onToggleSelection,
  onToggleVisibleSelection,
}) => {
  if (loading) {
    return <div className="ep-emp-list"><div className="ep-loading">Загрузка...</div></div>;
  }

  if (employees.length === 0) {
    return (
      <div className="ep-emp-list">
        <div className="ep-empty">
          <div className="ep-empty-icon"><Users size={28} /></div>
          <h3>Сотрудники не найдены</h3>
          <p>Попробуйте изменить фильтры, отдел или строку поиска.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-emp-list">
      <div className="ep-table-shell">
        <table className="ep-emp-table">
          <thead>
            <tr>
              <th className="ep-col-check">
                <label className={`ep-table-check ${allVisibleSelected ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={onToggleVisibleSelection}
                    aria-label="Выбрать сотрудников на странице"
                  />
                  <span />
                </label>
              </th>
              <th>ФИО</th>
              <th>Отдел</th>
              <th>Должность</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(employee => {
              const isSelected = selectedEmps.has(employee.id);
              const presence = presenceMap.get(employee.id);
              const presenceStatus = renderPresenceDot(presence);

              return (
                <tr
                  key={employee.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onEmpClick(employee)}
                  onMouseDown={event => {
                    if (event.button === 1) {
                      event.preventDefault();
                      window.open(`/employees/${employee.id}`, '_blank');
                    }
                  }}
                >
                  <td className="ep-col-check" onClick={event => event.stopPropagation()}>
                    <label className={`ep-table-check ${isSelected ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          onToggleSelection(employee.id);
                        }}
                        aria-label={`Выбрать ${employee.full_name}`}
                      />
                      <span />
                    </label>
                  </td>
                  <td className="ep-cell-name">
                    <div className="ep-table-name">
                      {presenceStatus && <span className={`ep-table-dot ${presenceStatus}`} />}
                      <span>{employee.full_name}</span>
                    </div>
                  </td>
                  <td className="ep-cell-muted">{employee.department || '—'}</td>
                  <td className="ep-cell-muted">{employee.position_name || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
