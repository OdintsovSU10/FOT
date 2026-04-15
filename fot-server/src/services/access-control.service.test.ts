import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedState = vi.hoisted(() => ({
  rolePageAccessRows: [] as Array<{
    system_role_id: string | null;
    role_code: string | null;
    page_path: string;
    can_view: boolean;
    can_edit: boolean;
  }>,
  rolesByCode: new Map<string, {
    id: string;
    code: string;
    permissions: string[];
  }>(),
  rolesById: new Map<string, {
    id: string;
    code: string;
    permissions: string[];
  }>(),
  pageCatalog: [
    {
      key: '/timesheet-hr',
      label: 'Табели HR',
      group_code: 'operations',
      group_label: 'Управление',
      surface: 'page' as const,
      supports_edit: true,
      requires_data_scope: true,
      requires_employee_variant: false,
      sort_order: 10,
      is_active: true,
      is_system: true,
    },
    {
      key: '/discipline',
      label: 'Дисциплина',
      group_code: 'operations',
      group_label: 'Управление',
      surface: 'page' as const,
      supports_edit: false,
      requires_data_scope: true,
      requires_employee_variant: false,
      sort_order: 20,
      is_active: true,
      is_system: true,
    },
  ],
  capabilityCatalog: [
    {
      code: 'portal.employee.variant',
      label: 'Вариант кабинета /employee',
      description: '',
      exclusive: true,
      sort_order: 10,
      options: [
        { code: 'portal.employee.variant.office', label: 'Обычный кабинет', description: '', sort_order: 10 },
        { code: 'portal.employee.variant.object', label: 'Кабинет рабочего', description: '', sort_order: 20 },
      ],
    },
    {
      code: 'data.scope',
      label: 'Область данных',
      description: '',
      exclusive: true,
      sort_order: 20,
      options: [
        { code: 'data.scope.self', label: 'Только свои данные', description: '', sort_order: 10 },
        { code: 'data.scope.all', label: 'Все данные', description: '', sort_order: 20 },
      ],
    },
    {
      code: 'timesheet.workflow',
      label: 'Табели',
      description: '',
      exclusive: false,
      sort_order: 30,
      options: [
        { code: 'timesheet.workflow.submit', label: 'Подача', description: '', sort_order: 10 },
        { code: 'timesheet.workflow.review', label: 'Проверка', description: '', sort_order: 20 },
        { code: 'timesheet.workflow.monitor', label: 'Мониторинг', description: '', sort_order: 30 },
      ],
    },
  ],
}));

vi.mock('../config/database.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(async () => ({
        data: mockedState.rolePageAccessRows,
        error: null,
      })),
    })),
  },
}));

vi.mock('./roles-cache.service.js', () => ({
  getRoleByCode: vi.fn(async (code: string) => mockedState.rolesByCode.get(code) ?? null),
  getRoleById: vi.fn(async (id: string | null | undefined) => {
    if (!id) return null;
    return mockedState.rolesById.get(id) ?? null;
  }),
  invalidateRolesCache: vi.fn(),
}));

vi.mock('./access-catalog.service.js', () => ({
  loadAccessPageCatalog: vi.fn(async () => mockedState.pageCatalog),
  loadCapabilityCatalog: vi.fn(async () => mockedState.capabilityCatalog),
  invalidateAccessCatalogCache: vi.fn(),
}));

import {
  getRolePageAccess,
  getRolePermissions,
  hasPageEdit,
  hasPageView,
  hasPermission,
  invalidateAccessControlCache,
} from './access-control.service.js';

describe('access-control.service explicit permissions model', () => {
  beforeEach(() => {
    mockedState.rolePageAccessRows = [];
    mockedState.rolesByCode.clear();
    mockedState.rolesById.clear();
    invalidateAccessControlCache();
  });

  it('grants super_admin full page access and workflow capabilities from the catalog', async () => {
    const superAdminRole = {
      id: 'role-super-admin',
      code: 'super_admin',
      permissions: [],
    };
    mockedState.rolesByCode.set(superAdminRole.code, superAdminRole);
    mockedState.rolesById.set(superAdminRole.id, superAdminRole);

    const permissions = await getRolePermissions(superAdminRole.id);
    const pageAccess = await getRolePageAccess(superAdminRole.id);

    expect(permissions).toEqual([
      'data.scope.all',
      'portal.employee.variant.office',
      'timesheet.workflow.monitor',
      'timesheet.workflow.review',
      'timesheet.workflow.submit',
    ]);
    expect(pageAccess).toEqual({
      '/timesheet-hr': { can_view: true, can_edit: true },
      '/discipline': { can_view: true, can_edit: false },
    });

    await expect(hasPermission(superAdminRole.id, 'timesheet.workflow.review')).resolves.toBe(true);
    await expect(hasPageView(superAdminRole.id, '/discipline')).resolves.toBe(true);
    await expect(hasPageEdit(superAdminRole.id, '/timesheet-hr')).resolves.toBe(true);
    await expect(hasPageEdit(superAdminRole.id, '/discipline')).resolves.toBe(false);
  });

  it('keeps non-super-admin roles constrained to the stored access profile', async () => {
    const headerRole = {
      id: 'role-header',
      code: 'header',
      permissions: ['data.scope.department'],
    };
    mockedState.rolesByCode.set(headerRole.code, headerRole);
    mockedState.rolesById.set(headerRole.id, headerRole);
    mockedState.rolePageAccessRows = [
      {
        system_role_id: headerRole.id,
        role_code: headerRole.code,
        page_path: '/discipline',
        can_view: true,
        can_edit: false,
      },
    ];

    await expect(getRolePermissions(headerRole.id)).resolves.toEqual(['data.scope.department']);
    await expect(getRolePageAccess(headerRole.id)).resolves.toEqual({
      '/discipline': { can_view: true, can_edit: false },
    });
    await expect(hasPermission(headerRole.id, 'timesheet.workflow.review')).resolves.toBe(false);
    await expect(hasPageView(headerRole.id, '/timesheet-hr')).resolves.toBe(false);
  });

  it('does not infer workflow permissions from page access for regular roles', async () => {
    const hrRole = {
      id: 'role-hr-review',
      code: 'hr',
      permissions: ['data.scope.all', 'portal.employee.variant.office'],
    };
    mockedState.rolesByCode.set(hrRole.code, hrRole);
    mockedState.rolesById.set(hrRole.id, hrRole);
    mockedState.rolePageAccessRows = [
      {
        system_role_id: hrRole.id,
        role_code: hrRole.code,
        page_path: '/timesheet-hr',
        can_view: true,
        can_edit: true,
      },
    ];

    await expect(getRolePermissions(hrRole.id)).resolves.toEqual([
      'data.scope.all',
      'portal.employee.variant.office',
    ]);
    await expect(getRolePageAccess(hrRole.id)).resolves.toEqual({
      '/timesheet-hr': { can_view: true, can_edit: true },
    });
    await expect(hasPermission(hrRole.id, 'timesheet.workflow.monitor')).resolves.toBe(false);
    await expect(hasPermission(hrRole.id, 'timesheet.workflow.review')).resolves.toBe(false);
  });
});
