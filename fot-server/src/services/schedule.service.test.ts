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
    in: (...args: unknown[]) => {
      query.operations.push({ method: 'in', args });
      return builder;
    },
    lte: (...args: unknown[]) => {
      query.operations.push({ method: 'lte', args });
      return builder;
    },
    or: (...args: unknown[]) => {
      query.operations.push({ method: 'or', args });
      return builder;
    },
    order: (...args: unknown[]) => {
      query.operations.push({ method: 'order', args });
      return builder;
    },
    limit: (...args: unknown[]) => {
      query.operations.push({ method: 'limit', args });
      return builder;
    },
    maybeSingle: async () => mockedState.resolver(query),
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

import { resolveObjectSchedule, resolveObjectSchedulesForPeriod } from './schedule.service.js';

describe('schedule.service object assignments', () => {
  beforeEach(() => {
    mockedState.queryLog.length = 0;
    mockedState.resolver = () => ({ data: [], error: null });
  });

  it('resolves an object schedule for a single date', async () => {
    mockedState.resolver = (query) => {
      if (query.table === 'object_schedule_assignments') {
        return {
          data: {
            schedule_id: 'sched-object',
            work_schedules: {
              id: 'sched-object',
              schedule_type: 'shift',
              work_start: '08:00:00',
              work_end: '17:00:00',
              work_hours: 9,
              work_days: [1, 2, 3, 4, 5],
              office_days: null,
              late_threshold_minutes: 15,
              day_overrides: null,
              lunch_minutes: 60,
              respects_holidays: true,
              pattern_type: 'custom',
              expected_saturdays_per_month: 0,
              full_day_threshold_minutes: null,
              weekend_full_day_threshold_minutes: null,
            },
          },
          error: null,
        };
      }

      throw new Error(`Unexpected query for table ${query.table}`);
    };

    const result = await resolveObjectSchedule('obj-a', '2026-04-10');

    expect(result).toMatchObject({
      schedule_id: 'sched-object',
      work_hours: 9,
      source: 'object',
    });
  });

  it('returns null when object has no assigned schedule on date', async () => {
    const result = await resolveObjectSchedule('obj-missing', '2026-04-10');
    expect(result).toBeNull();
  });

  it('builds daily object schedules only for dates covered by object assignment periods', async () => {
    mockedState.resolver = (query) => {
      if (query.table === 'object_schedule_assignments') {
        return {
          data: [
            {
              object_id: 'obj-a',
              effective_from: '2026-04-01',
              effective_to: '2026-04-02',
              work_schedules: {
                id: 'sched-a',
                schedule_type: 'office',
                work_start: '09:00:00',
                work_end: '12:00:00',
                work_hours: 3,
                work_days: [1, 2, 3, 4, 5],
                office_days: null,
                late_threshold_minutes: 0,
                day_overrides: null,
                lunch_minutes: 0,
                respects_holidays: true,
                pattern_type: 'custom',
                expected_saturdays_per_month: 0,
                full_day_threshold_minutes: null,
                weekend_full_day_threshold_minutes: null,
              },
            },
            {
              object_id: 'obj-b',
              effective_from: '2026-04-02',
              effective_to: null,
              work_schedules: {
                id: 'sched-b',
                schedule_type: 'office',
                work_start: '10:00:00',
                work_end: '14:00:00',
                work_hours: 4,
                work_days: [1, 2, 3, 4, 5],
                office_days: null,
                late_threshold_minutes: 0,
                day_overrides: null,
                lunch_minutes: 0,
                respects_holidays: true,
                pattern_type: 'custom',
                expected_saturdays_per_month: 0,
                full_day_threshold_minutes: null,
                weekend_full_day_threshold_minutes: null,
              },
            },
          ],
          error: null,
        };
      }

      throw new Error(`Unexpected query for table ${query.table}`);
    };

    const result = await resolveObjectSchedulesForPeriod(
      ['obj-a', 'obj-b', 'obj-c'],
      '2026-04-01',
      '2026-04-03',
    );

    expect(result.get('obj-a')).toEqual(new Map([
      ['2026-04-01', expect.objectContaining({ schedule_id: 'sched-a', source: 'object' })],
      ['2026-04-02', expect.objectContaining({ schedule_id: 'sched-a', source: 'object' })],
    ]));
    expect(result.get('obj-b')).toEqual(new Map([
      ['2026-04-02', expect.objectContaining({ schedule_id: 'sched-b', source: 'object' })],
      ['2026-04-03', expect.objectContaining({ schedule_id: 'sched-b', source: 'object' })],
    ]));
    expect(result.has('obj-c')).toBe(false);
  });
});
