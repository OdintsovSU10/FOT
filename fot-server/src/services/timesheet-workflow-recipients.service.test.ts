import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryRecord = {
  table: string;
  operations: Array<{ method: string; args: unknown[] }>;
};

type QueryResponse = {
  data?: unknown;
  error?: { message?: string } | null;
};

const mockedState = vi.hoisted(() => ({
  userProfiles: [] as Array<{
    id: string;
    position_type: string | null;
    system_role_id?: string | null;
    employee_id: number | null;
    is_approved: boolean;
  }>,
  employees: [] as Array<{
    id: number;
    org_department_id: string | null;
  }>,
  userDepartmentAccess: [] as Array<{
    user_id: string;
    department_id: string;
    is_active: boolean;
  }>,
  employeeDepartmentAccess: [] as Array<{
    employee_id: number;
    department_id: string;
    is_active: boolean;
  }>,
  effectiveAccessByRoleRef: new Map<string, {
    permissions: string[];
    page_access: Record<string, { can_view: boolean; can_edit: boolean }>;
  }>(),
  rolesByCode: new Map<string, { id?: string; code: string }>(),
  rolesById: new Map<string, { id: string; code: string }>(),
}));

function matchesQueryRecord<T extends Record<string, unknown>>(row: T, query: QueryRecord): boolean {
  return query.operations.every((operation) => {
    if (operation.method === 'eq') {
      const [field, value] = operation.args;
      return row[String(field)] === value;
    }

    if (operation.method === 'in') {
      const [field, values] = operation.args;
      return Array.isArray(values) && values.includes(row[String(field)]);
    }

    return true;
  });
}

function resolveQuery(query: QueryRecord): QueryResponse {
  if (query.table === 'user_profiles') {
    return {
      data: mockedState.userProfiles.filter(profile => matchesQueryRecord(profile, query)),
      error: null,
    };
  }

  if (query.table === 'employees') {
    return {
      data: mockedState.employees.filter(employee => matchesQueryRecord(employee, query)),
      error: null,
    };
  }

  if (query.table === 'user_department_access') {
    return {
      data: mockedState.userDepartmentAccess.filter(row => matchesQueryRecord(row, query)),
      error: null,
    };
  }

  if (query.table === 'employee_department_access') {
    return {
      data: mockedState.employeeDepartmentAccess.filter(row => matchesQueryRecord(row, query)),
      error: null,
    };
  }

  throw new Error(`Unexpected query for table ${query.table}`);
}

function createBuilder(table: string) {
  const query: QueryRecord = { table, operations: [] };

  const builder = {
    select: (...args: unknown[]) => {
      query.operations.push({ method: 'select', args });
      return builder;
    },
    eq: (...args: unknown[]) => {
      query.operations.push({ method: 'eq', args });
      return builder;
    },
    in: (...args: unknown[]) => {
      query.operations.push({ method: 'in', args });
      return builder;
    },
    then: (onFulfilled: (value: QueryResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolveQuery(query)).then(onFulfilled, onRejected),
  };

  return builder;
}

vi.mock('../config/database.js', () => ({
  supabase: {
    from: vi.fn((table: string) => createBuilder(table)),
  },
}));

vi.mock('./access-control.service.js', () => ({
  getEffectiveAccess: vi.fn(async (roleRef: string) => mockedState.effectiveAccessByRoleRef.get(roleRef) || {
    permissions: [],
    page_access: {},
  }),
}));

vi.mock('./roles-cache.service.js', () => ({
  getRoleByCode: vi.fn(async (code: string) => mockedState.rolesByCode.get(code) || null),
  getRoleById: vi.fn(async (id: string) => mockedState.rolesById.get(id) || null),
}));

import { listTimesheetWorkflowRecipientIds } from './timesheet-workflow-recipients.service.js';

describe('timesheet-workflow-recipients.service', () => {
  beforeEach(() => {
    mockedState.userProfiles = [];
    mockedState.employees = [];
    mockedState.userDepartmentAccess = [];
    mockedState.employeeDepartmentAccess = [];
    mockedState.effectiveAccessByRoleRef.clear();
    mockedState.rolesByCode.clear();
    mockedState.rolesById.clear();
  });

  it('keeps admin-like workflow recipients when no exclusion is requested', async () => {
    mockedState.userProfiles = [
      { id: 'header-1', position_type: 'header', employee_id: 101, is_approved: true },
      { id: 'admin-1', position_type: 'admin', employee_id: 201, is_approved: true },
    ];
    mockedState.employees = [
      { id: 101, org_department_id: 'dept-a' },
      { id: 201, org_department_id: 'dept-b' },
    ];
    mockedState.rolesByCode.set('header', { code: 'header' });
    mockedState.rolesByCode.set('admin', { code: 'admin' });
    mockedState.effectiveAccessByRoleRef.set('header', {
      permissions: ['data.scope.department', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });
    mockedState.effectiveAccessByRoleRef.set('admin', {
      permissions: ['data.scope.all', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });

    const recipients = await listTimesheetWorkflowRecipientIds('dept-a', ['submit']);

    expect(recipients).toEqual(['header-1', 'admin-1']);
  });

  it('filters admin-like recipients by resolved role code, including system_role_id roles', async () => {
    mockedState.userProfiles = [
      { id: 'header-1', position_type: 'header', employee_id: 101, is_approved: true },
      { id: 'admin-1', position_type: 'manager', system_role_id: 'role-admin', employee_id: 201, is_approved: true },
      { id: 'super-admin-1', position_type: 'super_admin', employee_id: 202, is_approved: true },
    ];
    mockedState.employees = [
      { id: 101, org_department_id: 'dept-a' },
      { id: 201, org_department_id: 'dept-b' },
      { id: 202, org_department_id: 'dept-c' },
    ];
    mockedState.rolesByCode.set('header', { code: 'header' });
    mockedState.rolesByCode.set('super_admin', { code: 'super_admin' });
    mockedState.rolesById.set('role-admin', { id: 'role-admin', code: 'admin' });
    mockedState.effectiveAccessByRoleRef.set('header', {
      permissions: ['data.scope.department', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });
    mockedState.effectiveAccessByRoleRef.set('role-admin', {
      permissions: ['data.scope.all', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });
    mockedState.effectiveAccessByRoleRef.set('super_admin', {
      permissions: ['data.scope.all', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });

    const recipients = await listTimesheetWorkflowRecipientIds(
      'dept-a',
      ['submit'],
      { excludeRoleCodes: ['admin', 'super_admin'] },
    );

    expect(recipients).toEqual(['header-1']);
  });

  it('can limit recipients to department-scoped submitters only', async () => {
    mockedState.userProfiles = [
      { id: 'header-1', position_type: 'header', employee_id: 101, is_approved: true },
      { id: 'ops-1', position_type: 'ops_manager', employee_id: 201, is_approved: true },
    ];
    mockedState.employees = [
      { id: 101, org_department_id: 'dept-a' },
      { id: 201, org_department_id: 'dept-b' },
    ];
    mockedState.rolesByCode.set('header', { code: 'header' });
    mockedState.rolesByCode.set('ops_manager', { code: 'ops_manager' });
    mockedState.effectiveAccessByRoleRef.set('header', {
      permissions: ['data.scope.department', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });
    mockedState.effectiveAccessByRoleRef.set('ops_manager', {
      permissions: ['data.scope.all', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });

    const recipients = await listTimesheetWorkflowRecipientIds(
      'dept-a',
      ['submit'],
      { includeDataScopes: ['department'] },
    );

    expect(recipients).toEqual(['header-1']);
  });

  it('includes department-scoped recipients with explicit additional brigade access', async () => {
    mockedState.userProfiles = [
      { id: 'header-1', position_type: 'header', employee_id: 101, is_approved: true },
    ];
    mockedState.employees = [
      { id: 101, org_department_id: 'dept-a' },
    ];
    mockedState.userDepartmentAccess = [
      { user_id: 'header-1', department_id: 'dept-b', is_active: true },
    ];
    mockedState.rolesByCode.set('header', { code: 'header' });
    mockedState.effectiveAccessByRoleRef.set('header', {
      permissions: ['data.scope.department', 'timesheet.workflow.submit'],
      page_access: { '/timesheet': { can_view: true, can_edit: true } },
    });

    const recipients = await listTimesheetWorkflowRecipientIds('dept-b', ['submit']);

    expect(recipients).toEqual(['header-1']);
  });
});
