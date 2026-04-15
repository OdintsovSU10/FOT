import { supabase } from '../config/database.js';
import {
  TIMESHEET_WORKFLOW_MONITOR_PERMISSION,
  TIMESHEET_WORKFLOW_REVIEW_PERMISSION,
  TIMESHEET_WORKFLOW_SUBMIT_PERMISSION,
  resolveDataScopeFromPermissions,
  type DataScope,
} from '../config/access-control.js';
import { getEffectiveAccess } from './access-control.service.js';

type WorkflowRecipientKind = 'submit' | 'review' | 'monitor';

interface IUserProfileLite {
  id: string;
  position_type: string | null;
  system_role_id?: string | null;
  employee_id: number | null;
}

interface IRoleWorkflowAccess {
  permissions: string[];
  page_access: Record<string, { can_view: boolean; can_edit: boolean }>;
  dataScope: DataScope | null;
}

const WORKFLOW_RULES: Record<WorkflowRecipientKind, {
  permission: string;
  pagePath: string;
  requiresEdit: boolean;
}> = {
  submit: {
    permission: TIMESHEET_WORKFLOW_SUBMIT_PERMISSION,
    pagePath: '/timesheet',
    requiresEdit: true,
  },
  review: {
    permission: TIMESHEET_WORKFLOW_REVIEW_PERMISSION,
    pagePath: '/timesheet-hr',
    requiresEdit: true,
  },
  monitor: {
    permission: TIMESHEET_WORKFLOW_MONITOR_PERMISSION,
    pagePath: '/timesheet-hr',
    requiresEdit: false,
  },
};

function roleMatchesWorkflowKind(access: IRoleWorkflowAccess, kind: WorkflowRecipientKind): boolean {
  const rule = WORKFLOW_RULES[kind];
  if (!access.permissions.includes(rule.permission)) {
    return false;
  }

  const pageAccess = access.page_access[rule.pagePath];
  if (!pageAccess) {
    return false;
  }

  return rule.requiresEdit
    ? pageAccess.can_edit === true
    : pageAccess.can_view === true || pageAccess.can_edit === true;
}

async function loadDepartmentByEmployeeId(employeeIds: number[]): Promise<Map<number, string | null>> {
  if (employeeIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, org_department_id')
    .in('id', employeeIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((employee) => [employee.id as number, (employee.org_department_id as string | null) ?? null]),
  );
}

async function loadRoleWorkflowAccess(roleRefs: string[]): Promise<Map<string, IRoleWorkflowAccess>> {
  const uniqueRoleRefs = [...new Set(roleRefs.filter(Boolean))];
  const entries = await Promise.all(uniqueRoleRefs.map(async (roleRef) => {
    const effectiveAccess = await getEffectiveAccess(roleRef);
    return [
      roleRef,
      {
        permissions: effectiveAccess.permissions,
        page_access: effectiveAccess.page_access,
        dataScope: resolveDataScopeFromPermissions(effectiveAccess.permissions),
      },
    ] as const;
  }));

  return new Map(entries);
}

export async function listTimesheetWorkflowRecipientIds(
  departmentId: string,
  kinds: WorkflowRecipientKind[],
): Promise<string[]> {
  if (!departmentId || kinds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, position_type, system_role_id, employee_id')
    .eq('is_approved', true);

  if (error) {
    throw error;
  }

  const profiles = (data || []) as IUserProfileLite[];
  if (profiles.length === 0) {
    return [];
  }

  const departmentByEmployeeId = await loadDepartmentByEmployeeId(
    profiles
      .map((profile) => profile.employee_id)
      .filter((employeeId): employeeId is number => Number.isInteger(employeeId)),
  );
  const roleAccessByRef = await loadRoleWorkflowAccess(
    profiles
      .map((profile) => profile.system_role_id || profile.position_type)
      .filter((roleRef): roleRef is string => typeof roleRef === 'string' && roleRef.length > 0),
  );

  const recipients = new Set<string>();

  for (const profile of profiles) {
    const roleRef = profile.system_role_id || profile.position_type;
    if (!roleRef) {
      continue;
    }

    const roleAccess = roleAccessByRef.get(roleRef);
    if (!roleAccess) {
      continue;
    }

    if (!kinds.some((kind) => roleMatchesWorkflowKind(roleAccess, kind))) {
      continue;
    }

    if (roleAccess.dataScope === 'all') {
      recipients.add(profile.id);
      continue;
    }

    if (roleAccess.dataScope === 'department' && profile.employee_id != null) {
      const profileDepartmentId = departmentByEmployeeId.get(profile.employee_id) ?? null;
      if (profileDepartmentId === departmentId) {
        recipients.add(profile.id);
      }
    }
  }

  return [...recipients];
}
