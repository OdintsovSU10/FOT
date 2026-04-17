import { supabase } from '../config/database.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { DataScope } from '../config/access-control.js';
import { resolveRoleDataScope } from './access-control.service.js';
import { listManagedDepartmentIdsForUser } from './department-access.service.js';

export async function resolveRequestDataScope(req: AuthenticatedRequest): Promise<DataScope | null> {
  return resolveRoleDataScope(req.user.system_role_id ?? req.user.position_type);
}

export async function canAccessEmployeeInScope(
  req: AuthenticatedRequest,
  employeeId: number | null | undefined,
): Promise<boolean> {
  if (!employeeId) {
    return false;
  }

  const scope = await resolveRequestDataScope(req);
  if (!scope) {
    return false;
  }

  if (scope === 'all') {
    return true;
  }

  if (scope === 'self') {
    return req.user.employee_id === employeeId;
  }

  const managedDepartmentIds = await resolveManagedDepartmentIds(req);
  if (managedDepartmentIds.length === 0) {
    return false;
  }

  const { data, error } = await supabase
    .from('employees')
    .select('org_department_id')
    .eq('id', employeeId)
    .single();

  if (error || !data) {
    return false;
  }

  return managedDepartmentIds.includes((data.org_department_id as string | null) ?? '');
}

export async function resolveScopedDepartmentId(
  req: AuthenticatedRequest,
  requestedDepartmentId?: string | null,
): Promise<string | null> {
  const scope = await resolveRequestDataScope(req);
  if (!scope) {
    return null;
  }

  if (scope === 'all') {
    return requestedDepartmentId ?? null;
  }

  if (scope === 'department') {
    const managedDepartmentIds = await resolveManagedDepartmentIds(req);
    if (managedDepartmentIds.length === 0) {
      return null;
    }

    if (requestedDepartmentId) {
      return managedDepartmentIds.includes(requestedDepartmentId) ? requestedDepartmentId : null;
    }

    if (req.user.department_id && managedDepartmentIds.includes(req.user.department_id)) {
      return req.user.department_id;
    }

    return managedDepartmentIds[0] ?? null;
  }

  return null;
}

export async function resolveManagedDepartmentIds(req: AuthenticatedRequest): Promise<string[]> {
  const scope = await resolveRequestDataScope(req);
  if (scope !== 'department') {
    return [];
  }

  return listManagedDepartmentIdsForUser(req.user.id, req.user.department_id ?? null, req.user.employee_id ?? null);
}

export async function resolveScopedDepartmentIds(
  req: AuthenticatedRequest,
  requestedDepartmentIds?: string[] | null,
): Promise<string[]> {
  const scope = await resolveRequestDataScope(req);
  if (!scope) {
    return [];
  }

  if (scope === 'all') {
    return [...new Set((requestedDepartmentIds || []).filter(Boolean))];
  }

  if (scope === 'department') {
    const managedDepartmentIds = await resolveManagedDepartmentIds(req);
    if (!requestedDepartmentIds?.length) {
      return managedDepartmentIds;
    }

    return requestedDepartmentIds.filter(departmentId => managedDepartmentIds.includes(departmentId));
  }

  return [];
}

export async function canAccessDepartmentInScope(
  req: AuthenticatedRequest,
  departmentId: string | null | undefined,
): Promise<boolean> {
  if (!departmentId) {
    return false;
  }

  const scope = await resolveRequestDataScope(req);
  if (!scope) {
    return false;
  }

  if (scope === 'all') {
    return true;
  }

  if (scope !== 'department') {
    return false;
  }

  const managedDepartmentIds = await resolveManagedDepartmentIds(req);
  return managedDepartmentIds.includes(departmentId);
}
