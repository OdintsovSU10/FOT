import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryRecord = {
  table: string;
  operations: Array<{ method: string; args: unknown[] }>;
};

type QueryResponse = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

const mockedState = vi.hoisted(() => ({
  resolver: (() => ({ data: [], error: null })) as (query: QueryRecord) => QueryResponse | Promise<QueryResponse>,
}));

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
    order: (...args: unknown[]) => {
      query.operations.push({ method: 'order', args });
      return builder;
    },
    then: (onFulfilled: (value: QueryResponse) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(mockedState.resolver(query)).then(onFulfilled, onRejected),
  };

  return builder;
}

vi.mock('../config/database.js', () => ({
  supabase: {
    from: vi.fn((table: string) => createBuilder(table)),
  },
}));

import { invalidateAccessCatalogCache, loadCapabilityCatalog } from './access-catalog.service.js';

describe('access-catalog.service', () => {
  beforeEach(() => {
    invalidateAccessCatalogCache();
    mockedState.resolver = (query) => {
      if (query.table === 'access_pages') {
        return { data: [], error: null };
      }

      if (query.table === 'access_capability_catalog') {
        return {
          data: [
            {
              group_code: 'data.scope',
              option_code: 'data.scope.self',
              group_label: 'Область данных',
              group_description: 'Определяет охват данных.',
              option_label: 'Только свои данные',
              option_description: 'Только свои записи.',
              exclusive: true,
              group_sort_order: 20,
              option_sort_order: 10,
              is_active: true,
            },
          ],
          error: null,
        };
      }

      throw new Error(`Unexpected query for table ${query.table}`);
    };
  });

  it('merges missing default capability groups when the database catalog is partial', async () => {
    const groups = await loadCapabilityCatalog();

    expect(groups.find((group) => group.code === 'data.scope')?.options.map((option) => option.code)).toEqual([
      'data.scope.self',
      'data.scope.department',
      'data.scope.all',
    ]);

    expect(groups.find((group) => group.code === 'timesheet.workflow')?.options.map((option) => option.code)).toEqual([
      'timesheet.workflow.submit',
      'timesheet.workflow.review',
      'timesheet.workflow.monitor',
    ]);
  });
});
