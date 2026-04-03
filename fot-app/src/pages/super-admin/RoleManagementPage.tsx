import { useState, useEffect, useCallback, useRef } from 'react';
import type { FC } from 'react';
import { rolesService } from '../../services/rolesService';
import type { RolePageAccessEntry, AvailablePage } from '../../services/rolesService';
import { useToast } from '../../contexts/ToastContext';
import type { SystemRole } from '../../types';
import styles from './RoleManagementPage.module.css';

type Tab = 'roles' | 'access';

interface INewRoleForm {
  code: string;
  name: string;
  level: string;
}

interface IEditState {
  code: string;
  name: string;
  level: string;
}

// Map: role_code → page_path → can_view
type AccessMatrix = Record<string, Record<string, boolean>>;

export const RoleManagementPage: FC = () => {
  const { error: toastError, success: toastSuccess } = useToast();
  const toastErrorRef = useRef(toastError);
  const toastSuccessRef = useRef(toastSuccess);
  toastErrorRef.current = toastError;
  toastSuccessRef.current = toastSuccess;
  const [tab, setTab] = useState<Tab>('roles');

  // Roles tab state
  const [roles, setRoles] = useState<SystemRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<INewRoleForm>({ code: '', name: '', level: '' });
  const [editState, setEditState] = useState<IEditState | null>(null);
  const [saving, setSaving] = useState(false);

  // Access tab state
  const [pages, setPages] = useState<AvailablePage[]>([]);
  const [matrix, setMatrix] = useState<AccessMatrix>({});
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const data = await rolesService.getAll();
      setRoles(data);
    } catch {
      toastErrorRef.current('Ошибка загрузки ролей');
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const [accessData, pagesData] = await Promise.all([
        rolesService.getPageAccess(),
        rolesService.getAvailablePages(),
      ]);
      setPages(pagesData);
      const m: AccessMatrix = {};
      for (const entry of accessData) {
        if (!m[entry.role_code]) m[entry.role_code] = {};
        m[entry.role_code][entry.page_path] = entry.can_view;
      }
      setMatrix(m);
    } catch {
      toastErrorRef.current('Ошибка загрузки матрицы доступа');
    } finally {
      setLoadingAccess(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (tab === 'access') {
      loadAccess();
    }
  }, [tab, loadAccess]);

  // --- Roles CRUD ---

  const handleCreateRole = async () => {
    const level = parseInt(newForm.level, 10);
    if (!newForm.code || !newForm.name || isNaN(level)) {
      toastErrorRef.current('Заполните все поля');
      return;
    }
    setSaving(true);
    try {
      await rolesService.create({ code: newForm.code, name: newForm.name, level });
      toastSuccessRef.current('Роль создана');
      setNewForm({ code: '', name: '', level: '' });
      setShowNewForm(false);
      await loadRoles();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка создания роли';
      toastErrorRef.current(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (code: string) => {
    if (!editState) return;
    const level = parseInt(editState.level, 10);
    if (!editState.name || isNaN(level)) {
      toastErrorRef.current('Заполните все поля');
      return;
    }
    setSaving(true);
    try {
      await rolesService.update(code, { name: editState.name, level });
      toastSuccessRef.current('Роль обновлена');
      setEditState(null);
      await loadRoles();
    } catch {
      toastErrorRef.current('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (role: SystemRole) => {
    try {
      await rolesService.update(role.code, {
        name: role.name,
        level: role.level,
        is_active: !role.is_active,
      });
      toastSuccessRef.current(role.is_active ? 'Роль деактивирована' : 'Роль активирована');
      await loadRoles();
    } catch {
      toastErrorRef.current('Ошибка изменения статуса');
    }
  };

  const handleDeleteRole = async (code: string) => {
    if (!confirm(`Удалить роль "${code}"? Это действие необратимо.`)) return;
    try {
      await rolesService.deleteRole(code);
      toastSuccessRef.current('Роль удалена');
      await loadRoles();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка удаления';
      toastErrorRef.current(msg);
    }
  };

  // --- Access matrix ---

  const handleMatrixToggle = (roleCode: string, pagePath: string) => {
    setMatrix(prev => ({
      ...prev,
      [roleCode]: {
        ...(prev[roleCode] ?? {}),
        [pagePath]: !(prev[roleCode]?.[pagePath] ?? false),
      },
    }));
  };

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      const items: RolePageAccessEntry[] = [];
      for (const role of roles) {
        for (const page of pages) {
          items.push({
            role_code: role.code,
            page_path: page.path,
            can_view: matrix[role.code]?.[page.path] ?? false,
            can_edit: false,
          });
        }
      }
      await rolesService.updatePageAccess(items);
      toastSuccessRef.current('Матрица доступа сохранена');
    } catch {
      toastErrorRef.current('Ошибка сохранения');
    } finally {
      setSavingAccess(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'roles' ? styles.tabActive : ''}`}
          onClick={() => setTab('roles')}
        >
          Роли
        </button>
        <button
          className={`${styles.tab} ${tab === 'access' ? styles.tabActive : ''}`}
          onClick={() => setTab('access')}
        >
          Доступ к страницам
        </button>
      </div>

      {tab === 'roles' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Системные роли</h2>
            <button className={styles.addBtn} onClick={() => setShowNewForm(v => !v)}>
              + Добавить роль
            </button>
          </div>

          {showNewForm && (
            <div className={styles.newRoleForm}>
              <input
                className={styles.input}
                placeholder="Код (напр. finance)"
                value={newForm.code}
                onChange={e => setNewForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
              />
              <input
                className={styles.input}
                placeholder="Название (напр. Финансы)"
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className={styles.input}
                placeholder="Уровень иерархии (1–99)"
                type="number"
                min={1}
                max={99}
                value={newForm.level}
                onChange={e => setNewForm(f => ({ ...f, level: e.target.value }))}
              />
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={handleCreateRole} disabled={saving}>
                  Создать
                </button>
                <button className={styles.cancelBtn} onClick={() => setShowNewForm(false)}>
                  Отмена
                </button>
              </div>
            </div>
          )}

          {loadingRoles ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Название</th>
                    <th>Уровень</th>
                    <th>Тип</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => (
                    <tr key={role.code} className={!role.is_active ? styles.rowInactive : ''}>
                      <td data-label="Код">
                        <code className={styles.code}>{role.code}</code>
                      </td>
                      <td data-label="Название">
                        {editState?.code === role.code ? (
                          <input
                            className={styles.inputInline}
                            value={editState.name}
                            onChange={e => setEditState(s => s ? { ...s, name: e.target.value } : s)}
                            autoFocus
                          />
                        ) : (
                          role.name
                        )}
                      </td>
                      <td data-label="Уровень">
                        {editState?.code === role.code ? (
                          <input
                            className={styles.inputInlineSmall}
                            type="number"
                            min={1}
                            max={99}
                            value={editState.level}
                            onChange={e => setEditState(s => s ? { ...s, level: e.target.value } : s)}
                          />
                        ) : (
                          role.level
                        )}
                      </td>
                      <td data-label="Тип">
                        {role.is_system ? (
                          <span className={styles.badgeSystem}>🔒 Системная</span>
                        ) : (
                          <span className={styles.badgeCustom}>Пользовательская</span>
                        )}
                      </td>
                      <td data-label="Статус">
                        <button
                          className={role.is_active ? styles.toggleActive : styles.toggleInactive}
                          onClick={() => handleToggleActive(role)}
                          title={role.is_active ? 'Деактивировать' : 'Активировать'}
                        >
                          {role.is_active ? 'Активна' : 'Неактивна'}
                        </button>
                      </td>
                      <td className={styles.actions}>
                        {editState?.code === role.code ? (
                          <>
                            <button className={styles.saveBtn} onClick={() => handleSaveEdit(role.code)} disabled={saving}>
                              Сохранить
                            </button>
                            <button className={styles.cancelBtn} onClick={() => setEditState(null)}>
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className={styles.editBtn}
                              onClick={() => setEditState({ code: role.code, name: role.name, level: String(role.level) })}
                            >
                              Изменить
                            </button>
                            {!role.is_system && (
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteRole(role.code)}
                              >
                                Удалить
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'access' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Матрица доступа к страницам</h2>
            <button
              className={styles.saveBtn}
              onClick={handleSaveAccess}
              disabled={savingAccess || loadingAccess}
            >
              {savingAccess ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>

          {loadingAccess ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : (
            <div className={styles.matrixWrapper}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th className={styles.matrixPageCol}>Страница</th>
                    {roles.map(role => (
                      <th key={role.code} className={styles.matrixRoleCol} title={role.code}>
                        <span className={styles.matrixRoleName}>{role.name}</span>
                        {!role.is_active && <span className={styles.inactiveTag}> (неакт.)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pages.map(page => (
                    <tr key={page.path}>
                      <td className={styles.matrixPageLabel}>
                        <span className={styles.pageLabel}>{page.label}</span>
                        <code className={styles.pagePath}>{page.path}</code>
                      </td>
                      {roles.map(role => (
                        <td key={role.code} className={styles.matrixCell}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={matrix[role.code]?.[page.path] ?? false}
                            onChange={() => handleMatrixToggle(role.code, page.path)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
