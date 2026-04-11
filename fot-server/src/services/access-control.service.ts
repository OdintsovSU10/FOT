import { supabase } from '../config/database.js';
import {
  normalizePermissions,
  resolveDataScopeFromPermissions,
  resolveEmployeeVariantFromPermissions,
  type DataScope,
  type EmployeePortalVariant,
} from '../config/access-control.js';
import { getRoleByCode, invalidateRolesCache } from './roles-cache.service.js';

interface PageAccessPermission {
  can_view: boolean;
  can_edit: boolean;
}

type RolePageAccessMap = Map<string, Map<string, PageAccessPermission>>;

const PAGE_ACCESS_CACHE_TTL_MS = 300_000;

let pageAccessCache: RolePageAccessMap | null = null;
let pageAccessCacheExpiresAt = 0;

async function loadPageAccessCache(): Promise<RolePageAccessMap> {
  const now = Date.now();
  if (pageAccessCache && pageAccessCacheExpiresAt > now) {
    return pageAccessCache;
  }

  const { data, error } = await supabase
    .from('role_page_access')
    .select('role_code, page_path, can_view, can_edit');

  if (error) {
    throw new Error(`Failed to load role page access cache: ${error.message}`);
  }

  const cache: RolePageAccessMap = new Map();
  for (const entry of data || []) {
    if (!cache.has(entry.role_code)) {
      cache.set(entry.role_code, new Map());
    }
    cache.get(entry.role_code)!.set(entry.page_path, {
      can_view: !!entry.can_view || !!entry.can_edit,
      can_edit: !!entry.can_edit,
    });
  }

  pageAccessCache = cache;
  pageAccessCacheExpiresAt = now + PAGE_ACCESS_CACHE_TTL_MS;
  return cache;
}

export async function getRolePermissions(roleCode: string): Promise<string[]> {
  const role = await getRoleByCode(roleCode);
  return normalizePermissions(role?.permissions);
}

export async function getRolePageAccess(roleCode: string): Promise<Record<string, PageAccessPermission>> {
  const cache = await loadPageAccessCache();
  const entries = cache.get(roleCode) ?? new Map<string, PageAccessPermission>();

  return Object.fromEntries(entries.entries());
}

export async function hasPermission(roleCode: string, permission: string): Promise<boolean> {
  const permissions = await getRolePermissions(roleCode);
  return permissions.includes(permission);
}

export async function hasAnyPermission(roleCode: string, permissions: string[]): Promise<boolean> {
  const rolePermissions = await getRolePermissions(roleCode);
  return permissions.some(permission => rolePermissions.includes(permission));
}

export async function hasPageView(roleCode: string, pagePath: string): Promise<boolean> {
  const access = await getRolePageAccess(roleCode);
  return access[pagePath]?.can_view === true;
}

export async function hasPageEdit(roleCode: string, pagePath: string): Promise<boolean> {
  const access = await getRolePageAccess(roleCode);
  return access[pagePath]?.can_edit === true;
}

export async function getEffectiveAccess(roleCode: string): Promise<{
  permissions: string[];
  page_access: Record<string, PageAccessPermission>;
}> {
  const [permissions, page_access] = await Promise.all([
    getRolePermissions(roleCode),
    getRolePageAccess(roleCode),
  ]);

  return { permissions, page_access };
}

export async function resolveRoleEmployeeVariant(roleCode: string): Promise<EmployeePortalVariant | null> {
  return resolveEmployeeVariantFromPermissions(await getRolePermissions(roleCode));
}

export async function resolveRoleDataScope(roleCode: string): Promise<DataScope | null> {
  return resolveDataScopeFromPermissions(await getRolePermissions(roleCode));
}

export function invalidateAccessControlCache(): void {
  pageAccessCache = null;
  pageAccessCacheExpiresAt = 0;
  invalidateRolesCache();
}
