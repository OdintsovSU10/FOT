import { type FC } from 'react';
import { X, Check } from 'lucide-react';
import type { Employee, EmployeeInput } from '../../types';

interface IEmployeeInfoSectionProps {
  employee: Employee;
  isEditing: boolean;
  editData: Partial<EmployeeInput>;
  onEditDataChange: (data: Partial<EmployeeInput>) => void;
  onSave: () => void;
  onCancel: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
};

const calculateTenure = (hireDate: string) => {
  const hire = new Date(hireDate);
  const now = new Date();
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return years > 0 ? `${years} г. ${rem} мес.` : `${rem} мес.`;
};

const formatSalary = (salary: number | null) => {
  if (!salary) return '—';
  return salary.toLocaleString('ru-RU') + ' ₽';
};

export const EmployeeInfoSection: FC<IEmployeeInfoSectionProps> = ({
  employee,
  isEditing,
  editData,
  onEditDataChange,
  onSave,
  onCancel,
}) => {
  if (isEditing) {
    return (
      <div className="card-edit-form">
        <div className="edit-grid">
          <div className="form-group">
            <label>ФИО</label>
            <input
              type="text"
              value={editData.full_name || ''}
              onChange={e => onEditDataChange({ ...editData, full_name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Должность</label>
            <span className="form-readonly">{employee.position_name || '—'}</span>
          </div>
          <div className="form-group">
            <label>Дата найма</label>
            <input
              type="date"
              value={editData.hire_date || ''}
              onChange={e => onEditDataChange({ ...editData, hire_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Дата рождения</label>
            <input
              type="date"
              value={editData.birth_date || ''}
              onChange={e => onEditDataChange({ ...editData, birth_date: e.target.value || undefined })}
            />
          </div>
          <div className="form-group">
            <label>Зарплата</label>
            <input
              type="number"
              value={editData.current_salary || ''}
              onChange={e => onEditDataChange({ ...editData, current_salary: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        </div>
        <div className="card-edit-actions">
          <button className="btn-cancel" onClick={onCancel}>
            <X size={16} /> Отмена
          </button>
          <button className="btn-save" onClick={onSave}>
            <Check size={16} /> Сохранить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-info-grid">
      <div className="info-item">
        <span className="info-label">ФИО</span>
        <span className="info-value">{employee.full_name}</span>
      </div>
      <div className="info-item">
        <span className="info-label">Должность</span>
        <span className="info-value">{employee.position_name || '—'}</span>
      </div>
      <div className="info-item">
        <span className="info-label">Отдел</span>
        <span className="info-value">{employee.department || '—'}</span>
      </div>
      <div className="info-item">
        <span className="info-label">Дата найма</span>
        <span className="info-value">{formatDate(employee.hire_date)}</span>
      </div>
      <div className="info-item">
        <span className="info-label">Стаж</span>
        <span className="info-value">{calculateTenure(employee.hire_date)}</span>
      </div>
      {employee.birth_date && (
        <div className="info-item">
          <span className="info-label">Дата рождения</span>
          <span className="info-value">{formatDate(employee.birth_date)}</span>
        </div>
      )}
      <div className="info-item highlight">
        <span className="info-label">Зарплата</span>
        <span className="info-value">{formatSalary(employee.current_salary)}</span>
      </div>
      {employee.country && (
        <div className="info-item">
          <span className="info-label">Страна</span>
          <span className="info-value">{employee.country}</span>
        </div>
      )}
      {employee.pension_number && (
        <div className="info-item">
          <span className="info-label">СНИЛС</span>
          <span className="info-value">{employee.pension_number}</span>
        </div>
      )}
      {employee.patent_issue_date && (
        <div className="info-item">
          <span className="info-label">Патент выдан</span>
          <span className="info-value">{formatDate(employee.patent_issue_date)}</span>
        </div>
      )}
      {employee.patent_expiry_date && (
        <div className="info-item">
          <span className="info-label">Патент до</span>
          <span className="info-value">{formatDate(employee.patent_expiry_date)}</span>
        </div>
      )}
      {employee.email && (
        <div className="info-item">
          <span className="info-label">Email</span>
          <span className="info-value">{employee.email}</span>
        </div>
      )}
    </div>
  );
};
