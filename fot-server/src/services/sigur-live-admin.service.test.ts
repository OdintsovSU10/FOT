import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./sigur.service.js', () => ({
  sigurService: {},
}));

vi.mock('./sigur-linked-employees.service.js', () => ({
  getEmployeeAccessPointBindings: vi.fn(),
  invalidateEmployeeAccessPointBindingsCache: vi.fn(),
  replaceEmployeeAccessPointBindings: vi.fn(),
}));

import {
  buildSigurDepartmentTree,
  collectSigurDepartmentDescendantIds,
  normalizeSigurEmployeeSummary,
} from './sigur-live-admin.service.js';

describe('sigur-live-admin helpers', () => {
  it('collects selected department with all descendants', () => {
    const ids = collectSigurDepartmentDescendantIds(10, [
      { id: 10, parentId: null },
      { id: 11, parentId: 10 },
      { id: 12, parentId: 11 },
      { id: 13, parentId: 10 },
      { id: 99, parentId: null },
    ]);

    expect([...ids]).toEqual([10, 13, 11, 12]);
  });

  it('normalizes employee summary and falls back to department map', () => {
    const employee = normalizeSigurEmployeeSummary(
      {
        id: 77,
        name: 'Иван Петров',
        departmentId: 11,
        positionId: 3,
        positionName: 'Инженер',
        tabNumber: 'A-15',
        blocked: 1,
      },
      new Map([[11, 'Монтажный отдел']]),
    );

    expect(employee).toEqual({
      id: 77,
      name: 'Иван Петров',
      departmentId: 11,
      departmentName: 'Монтажный отдел',
      positionId: 3,
      positionName: 'Инженер',
      tabId: 'A-15',
      blocked: true,
    });
  });

  it('builds sorted department tree and aggregates employee counts from children', () => {
    const tree = buildSigurDepartmentTree(
      [
        { id: 1, parentId: null, name: 'База' },
        { id: 2, parentId: 1, name: 'Склад' },
        { id: 3, parentId: 1, name: 'Администрация' },
        { id: 4, parentId: 3, name: 'Бухгалтерия' },
      ],
      [
        {
          id: 101,
          name: 'А',
          departmentId: 3,
          departmentName: 'Администрация',
          positionId: null,
          positionName: null,
          tabId: null,
          blocked: false,
        },
        {
          id: 102,
          name: 'Б',
          departmentId: 4,
          departmentName: 'Бухгалтерия',
          positionId: null,
          positionName: null,
          tabId: null,
          blocked: false,
        },
        {
          id: 103,
          name: 'В',
          departmentId: 2,
          departmentName: 'Склад',
          positionId: null,
          positionName: null,
          tabId: null,
          blocked: false,
        },
      ],
    );

    expect(tree).toEqual([
      {
        id: 1,
        parentId: null,
        name: 'База',
        hasChildren: true,
        employeeCount: 3,
        children: [
          {
            id: 3,
            parentId: 1,
            name: 'Администрация',
            hasChildren: true,
            employeeCount: 2,
            children: [
              {
                id: 4,
                parentId: 3,
                name: 'Бухгалтерия',
                hasChildren: false,
                employeeCount: 1,
                children: [],
              },
            ],
          },
          {
            id: 2,
            parentId: 1,
            name: 'Склад',
            hasChildren: false,
            employeeCount: 1,
            children: [],
          },
        ],
      },
    ]);
  });
});
