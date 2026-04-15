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
  queryLog: [] as QueryRecord[],
  resolver: (() => ({ data: [], error: null })) as (query: QueryRecord) => QueryResponse | Promise<QueryResponse>,
}));

function createBuilder(table: string) {
  const query: QueryRecord = { table, operations: [] };
  mockedState.queryLog.push(query);

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

vi.mock('./skud-shared.service.js', () => ({
  getInternalAccessPoints: vi.fn(async () => new Set()),
}));

vi.mock('./settings.service.js', () => ({
  settingsService: {
    getSkudTravelConfig: vi.fn(async () => ({ limitMinutes: 60 })),
    setSkudTravelConfig: vi.fn(),
  },
}));

vi.mock('./supabase-storage.service.js', () => ({
  SKUD_OBJECT_MAPS_BUCKET: 'skud-object-maps',
  supabaseStorageService: {
    buildObjectMapPath: vi.fn(),
    createSignedUploadUrl: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
    ensureObjectExists: vi.fn(),
    removeObject: vi.fn(),
  },
}));

import { listTravelObjects } from './skud-travel.service.js';

describe('skud-travel.service schema diagnostics', () => {
  beforeEach(() => {
    mockedState.queryLog.length = 0;
    mockedState.resolver = () => ({ data: [], error: null });
  });

  it('points to migration 026 when map columns are missing', async () => {
    mockedState.resolver = (query) => {
      if (query.table === 'skud_objects') {
        return {
          data: null,
          error: {
            code: '42703',
            message: 'column skud_objects.map_storage_path does not exist',
          },
        };
      }

      if (query.table === 'skud_object_access_points' || query.table === 'skud_object_map_points') {
        return { data: [], error: null };
      }

      throw new Error(`Unexpected query for table ${query.table}`);
    };

    await expect(listTravelObjects()).rejects.toThrow(
      'Карты объектов СКУД не видны через Supabase API. Примените миграцию 026_skud_object_maps.sql в текущую базу.',
    );
  });
});
