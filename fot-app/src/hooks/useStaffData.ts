import { useState, useCallback, useEffect } from 'react';
import { employeeService } from '../services/employeeService';
import { structureApi } from '../api/structure';
import type { Employee } from '../types';
import type { OrgDepartmentNode } from '../types/organization';
import type { PaginatedMeta } from '../services/employeeService';

/* ─── module-level dept cache ─── */
let cachedDepartments: OrgDepartmentNode[] | null = null;
let deptCacheTs = 0;
const DEPT_CACHE_TTL = 120_000;

interface IUseStaffDataParams {
  page: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
}

export const useStaffData = (params: IUseStaffDataParams) => {
  const { page, pageSize = 100, search, departmentId } = params;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<OrgDepartmentNode[]>(cachedDepartments ?? []);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<PaginatedMeta>({ page: 1, pageSize, total: 0, totalPages: 0 });
  const [totalActive, setTotalActive] = useState(0);

  const loadDepts = useCallback(async () => {
    if (cachedDepartments && Date.now() - deptCacheTs < DEPT_CACHE_TTL) {
      setDepartments(cachedDepartments);
      return;
    }
    const tree = await structureApi.getTree();
    const deps = tree.data?.departments ?? [];
    cachedDepartments = deps;
    deptCacheTs = Date.now();
    setDepartments(deps);
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    const [result, counts] = await Promise.all([
      employeeService.getPaginated({
        page,
        pageSize,
        search: search || undefined,
        departmentId: departmentId || undefined,
        status: 'active',
        view: 'staff',
      }),
      employeeService.getCounts(false).catch(() => ({ byDepartment: {}, byStatus: { active: 0, fired: 0 } })),
    ]);
    setEmployees(result.data);
    setMeta(result.meta);
    setTotalActive(counts.byStatus.active);
    setLoading(false);
  }, [page, pageSize, search, departmentId]);

  useEffect(() => { loadDepts(); }, [loadDepts]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const patchEmployee = useCallback((id: number, patch: Partial<Employee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const refresh = useCallback(() => loadEmployees(), [loadEmployees]);

  return { employees, departments, loading, meta, totalActive, refresh, patchEmployee };
};
