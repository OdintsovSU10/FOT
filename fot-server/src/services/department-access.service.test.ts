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

import { listManagedDepartmentIdsForUser, loadManagedDepartmentMap } from './department-access.service.js';

describe('department-access.service', () => {
  beforeEach(() => {
    mockedState.userDepartmentAccess = [];
    mockedState.employeeDepartmentAccess = [];
  });

  it('unions primary, user, and employee departments without duplicates', async () => {
    mockedState.userDepartmentAccess = [
      { user_id: 'user-1', department_id: 'dept-b', is_active: true },
      { user_id: 'user-1', department_id: 'dept-a', is_active: true },
    ];
    mockedState.employeeDepartmentAccess = [
      { employee_id: 10, department_id: 'dept-c', is_active: true },
    ];

    const result = await listManagedDepartmentIdsForUser('user-1', 'dept-a', 10);

    expect(result).toEqual(['dept-a', 'dept-b', 'dept-c']);
  });

  it('ignores inactive explicit rows from both sources', async () => {
    mockedState.userDepartmentAccess = [
      { user_id: 'user-1', department_id: 'dept-b', is_active: false },
    ];
    mockedState.employeeDepartmentAccess = [
      { employee_id: 10, department_id: 'dept-c', is_active: false },
      { employee_id: 10, department_id: 'dept-d', is_active: true },
    ];

    const result = await listManagedDepartmentIdsForUser('user-1', 'dept-a', 10);

    expect(result).toEqual(['dept-a', 'dept-d']);
  });

  it('builds managed department maps for multiple users with employee-based access', async () => {
    mockedState.userDepartmentAccess = [
      { user_id: 'user-1', department_id: 'dept-b', is_active: true },
    ];
    mockedState.employeeDepartmentAccess = [
      { employee_id: 22, department_id: 'dept-c', is_active: true },
    ];

    const result = await loadManagedDepartmentMap([
      { user_id: 'user-1', primary_department_id: 'dept-a', employee_id: 11 },
      { user_id: 'user-2', primary_department_id: 'dept-c', employee_id: 22 },
    ]);

    expect(result.get('user-1')).toEqual({
      primary_department_id: 'dept-a',
      managed_department_ids: ['dept-a', 'dept-b'],
    });
    expect(result.get('user-2')).toEqual({
      primary_department_id: 'dept-c',
      managed_department_ids: ['dept-c'],
    });
  });
});
