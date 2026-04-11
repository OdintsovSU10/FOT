import { supabase } from '../config/database.js';
import { getInternalAccessPoints } from './skud-shared.service.js';

const DEFAULT_CREDIT_MULTIPLIER = 1.5;
const BATCH_SIZE = 500;

export type TravelSegmentStatus = 'auto_approved' | 'delayed' | 'needs_object' | 'needs_route';

interface ITravelObjectRow {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ITravelObjectMappingRow {
  object_id: string;
  access_point_name: string;
}

interface ITravelRouteRow {
  id: string;
  from_object_id: string;
  to_object_id: string;
  travel_minutes: number;
  credit_multiplier: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ITravelSegmentRow {
  id: string;
  employee_id: number;
  work_date: string;
  from_object_id: string | null;
  to_object_id: string | null;
  from_access_point_name: string | null;
  to_access_point_name: string | null;
  exit_time: string;
  entry_time: string;
  actual_minutes: number;
  norm_minutes: number | null;
  max_credit_minutes: number | null;
  credited_minutes: number;
  delay_minutes: number;
  status: TravelSegmentStatus;
  created_at: string;
  updated_at: string;
}

interface ITravelEmployeeRow {
  id: number;
  full_name: string;
  org_department_id: string | null;
  position_id: string | null;
}

interface ITravelDepartmentRow {
  id: string;
  name: string;
}

interface ITravelEventRow {
  employee_id: number;
  event_date: string;
  event_time: string;
  access_point: string | null;
  direction: string | null;
}

export interface ITravelObject {
  id: string;
  name: string;
  is_active: boolean;
  access_points: string[];
  created_at: string;
  updated_at: string;
}

export interface ITravelRoute {
  id: string;
  from_object_id: string;
  from_object_name: string | null;
  to_object_id: string;
  to_object_name: string | null;
  travel_minutes: number;
  credit_multiplier: number;
  max_credit_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ITravelSegmentListItem {
  id: string;
  employee_id: number;
  employee_name: string;
  department_id: string | null;
  department_name: string | null;
  work_date: string;
  from_object_id: string | null;
  from_object_name: string | null;
  to_object_id: string | null;
  to_object_name: string | null;
  from_access_point_name: string | null;
  to_access_point_name: string | null;
  exit_time: string;
  entry_time: string;
  actual_minutes: number;
  norm_minutes: number | null;
  max_credit_minutes: number | null;
  credited_minutes: number;
  delay_minutes: number;
  status: TravelSegmentStatus;
  created_at: string;
  updated_at: string;
}

export interface ITravelDaySummary {
  creditedMinutes: number;
  delayMinutes: number;
  segmentsCount: number;
  problematicSegmentsCount: number;
}

interface ICalculatedTravelSegment {
  employee_id: number;
  work_date: string;
  from_object_id: string | null;
  to_object_id: string | null;
  from_access_point_name: string | null;
  to_access_point_name: string | null;
  exit_time: string;
  entry_time: string;
  actual_minutes: number;
  norm_minutes: number | null;
  max_credit_minutes: number | null;
  credited_minutes: number;
  delay_minutes: number;
  status: TravelSegmentStatus;
}

interface ITravelScopeParams {
  month: string;
  departmentId?: string | null;
  employeeId?: number | null;
}

interface IRebuildTravelParams {
  employeeIds: number[];
  startDate: string;
  endDate: string;
}

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string; details?: string };
  return candidate.code === '42P01'
    || candidate.message?.includes('does not exist')
    || candidate.details?.includes('does not exist')
    || false;
};

const formatTravelFeatureError = (error: unknown): Error => {
  if (isMissingTableError(error)) {
    return new Error('Таблицы передвижений не созданы. Примените миграцию 013_skud_travel_segments.sql');
  }
  if (error instanceof Error) return error;
  return new Error('Ошибка работы с передвижениями');
};

const toMonthRange = (month: string): { startDate: string; endDate: string } => {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const days = new Date(year, mon, 0).getDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(days).padStart(2, '0')}`,
  };
};

const normalizeAccessPoint = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized || null;
};

const routeKey = (fromObjectId: string, toObjectId: string): string => `${fromObjectId}__${toObjectId}`;
const dayKey = (employeeId: number, workDate: string): string => `${employeeId}_${workDate}`;

const timeToMinutes = (value: string): number => {
  const [hours = 0, minutes = 0, seconds = 0] = value.split(':').map(Number);
  return hours * 60 + minutes + Math.floor(seconds / 60);
};

const roundHours = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;

const dedupeAccessPoints = (accessPoints: string[]): string[] => {
  const unique = new Set<string>();
  for (const point of accessPoints) {
    const normalized = normalizeAccessPoint(point);
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, 'ru'));
};

const fetchTravelObjectsRaw = async (): Promise<ITravelObjectRow[]> => {
  const { data, error } = await supabase
    .from('skud_objects')
    .select('id, name, is_active, created_at, updated_at')
    .order('name');

  if (error) throw formatTravelFeatureError(error);
  return (data || []) as ITravelObjectRow[];
};

const fetchTravelMappingsRaw = async (): Promise<ITravelObjectMappingRow[]> => {
  const { data, error } = await supabase
    .from('skud_object_access_points')
    .select('object_id, access_point_name');

  if (error) throw formatTravelFeatureError(error);
  return (data || []) as ITravelObjectMappingRow[];
};

const fetchTravelRoutesRaw = async (): Promise<ITravelRouteRow[]> => {
  const { data, error } = await supabase
    .from('skud_object_routes')
    .select('id, from_object_id, to_object_id, travel_minutes, credit_multiplier, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('from_object_id')
    .order('to_object_id');

  if (error) throw formatTravelFeatureError(error);
  return (data || []) as ITravelRouteRow[];
};

const fetchEmployeeScope = async ({
  departmentId,
  employeeId,
}: {
  departmentId?: string | null;
  employeeId?: number | null;
}): Promise<ITravelEmployeeRow[]> => {
  let query = supabase
    .from('employees')
    .select('id, full_name, org_department_id, position_id')
    .eq('employment_status', 'active')
    .eq('is_archived', false)
    .order('full_name');

  if (departmentId) query = query.eq('org_department_id', departmentId);
  if (employeeId) query = query.eq('id', employeeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ITravelEmployeeRow[];
};

const fetchDepartmentsMap = async (departmentIds: string[]): Promise<Map<string, string>> => {
  const uniqueIds = [...new Set(departmentIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('org_departments')
    .select('id, name')
    .in('id', uniqueIds);

  if (error) throw error;

  const result = new Map<string, string>();
  for (const row of (data || []) as ITravelDepartmentRow[]) {
    result.set(row.id, row.name);
  }
  return result;
};

const fetchEventsForEmployees = async ({
  employeeIds,
  startDate,
  endDate,
}: IRebuildTravelParams): Promise<ITravelEventRow[]> => {
  if (employeeIds.length === 0) return [];

  const events: ITravelEventRow[] = [];
  for (let index = 0; index < employeeIds.length; index += BATCH_SIZE) {
    const batch = employeeIds.slice(index, index + BATCH_SIZE);
    const { data, error } = await supabase
      .from('skud_events')
      .select('employee_id, event_date, event_time, access_point, direction')
      .in('employee_id', batch)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('employee_id', { ascending: true })
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    if (error) throw error;
    events.push(...((data || []) as ITravelEventRow[]));
  }

  return events;
};

const buildTravelSegments = ({
  events,
  internalPoints,
  accessPointToObjectId,
  routeMap,
}: {
  events: ITravelEventRow[];
  internalPoints: Set<string>;
  accessPointToObjectId: Map<string, string>;
  routeMap: Map<string, ITravelRouteRow>;
}): ICalculatedTravelSegment[] => {
  const grouped = new Map<string, ITravelEventRow[]>();

  for (const event of events) {
    const key = dayKey(event.employee_id, event.event_date);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(event);
  }

  const segments: ICalculatedTravelSegment[] = [];

  for (const dayEvents of grouped.values()) {
    dayEvents.sort((left, right) => left.event_time.localeCompare(right.event_time));

    for (let index = 0; index < dayEvents.length - 1; index += 1) {
      const fromEvent = dayEvents[index];
      const toEvent = dayEvents[index + 1];

      if (fromEvent.direction !== 'exit' || toEvent.direction !== 'entry') continue;

      const fromAccessPoint = normalizeAccessPoint(fromEvent.access_point);
      const toAccessPoint = normalizeAccessPoint(toEvent.access_point);

      if (!fromAccessPoint || !toAccessPoint) continue;
      if (internalPoints.has(fromAccessPoint) || internalPoints.has(toAccessPoint)) continue;

      const fromObjectId = accessPointToObjectId.get(fromAccessPoint) || null;
      const toObjectId = accessPointToObjectId.get(toAccessPoint) || null;

      if (fromObjectId && toObjectId && fromObjectId === toObjectId) continue;

      const actualMinutes = timeToMinutes(toEvent.event_time) - timeToMinutes(fromEvent.event_time);
      if (actualMinutes <= 0) continue;

      let status: TravelSegmentStatus;
      let normMinutes: number | null = null;
      let maxCreditMinutes: number | null = null;
      let creditedMinutes = 0;
      let delayMinutes = 0;

      if (!fromObjectId || !toObjectId) {
        status = 'needs_object';
      } else {
        const route = routeMap.get(routeKey(fromObjectId, toObjectId));
        if (!route) {
          status = 'needs_route';
        } else {
          normMinutes = route.travel_minutes;
          const multiplier = route.credit_multiplier ?? DEFAULT_CREDIT_MULTIPLIER;
          maxCreditMinutes = Math.ceil(route.travel_minutes * multiplier);
          creditedMinutes = Math.min(actualMinutes, maxCreditMinutes);
          delayMinutes = Math.max(actualMinutes - maxCreditMinutes, 0);
          status = delayMinutes > 0 ? 'delayed' : 'auto_approved';
        }
      }

      segments.push({
        employee_id: fromEvent.employee_id,
        work_date: fromEvent.event_date,
        from_object_id: fromObjectId,
        to_object_id: toObjectId,
        from_access_point_name: fromAccessPoint,
        to_access_point_name: toAccessPoint,
        exit_time: fromEvent.event_time,
        entry_time: toEvent.event_time,
        actual_minutes: actualMinutes,
        norm_minutes: normMinutes,
        max_credit_minutes: maxCreditMinutes,
        credited_minutes: creditedMinutes,
        delay_minutes: delayMinutes,
        status,
      });
    }
  }

  return segments;
};

const syncSegmentsToDatabase = async ({
  employeeIds,
  startDate,
  endDate,
  segments,
}: IRebuildTravelParams & { segments: ICalculatedTravelSegment[] }): Promise<void> => {
  for (let index = 0; index < employeeIds.length; index += BATCH_SIZE) {
    const batch = employeeIds.slice(index, index + BATCH_SIZE);
    const { error } = await supabase
      .from('skud_travel_segments')
      .delete()
      .in('employee_id', batch)
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    if (error) throw formatTravelFeatureError(error);
  }

  if (segments.length === 0) return;

  const nowIso = new Date().toISOString();
  for (let index = 0; index < segments.length; index += BATCH_SIZE) {
    const batch = segments.slice(index, index + BATCH_SIZE).map(segment => ({
      ...segment,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const { error } = await supabase
      .from('skud_travel_segments')
      .insert(batch);

    if (error) throw formatTravelFeatureError(error);
  }
};

const summarizeSegmentsByDay = (segments: ICalculatedTravelSegment[]): Map<string, ITravelDaySummary> => {
  const summary = new Map<string, ITravelDaySummary>();

  for (const segment of segments) {
    const key = dayKey(segment.employee_id, segment.work_date);
    const current = summary.get(key) || {
      creditedMinutes: 0,
      delayMinutes: 0,
      segmentsCount: 0,
      problematicSegmentsCount: 0,
    };

    current.creditedMinutes += segment.credited_minutes;
    current.delayMinutes += segment.delay_minutes;
    current.segmentsCount += 1;
    if (segment.status !== 'auto_approved') current.problematicSegmentsCount += 1;
    summary.set(key, current);
  }

  return summary;
};

export const calculateAndSyncTravelSegments = async ({
  employeeIds,
  startDate,
  endDate,
}: IRebuildTravelParams): Promise<{
  segments: ICalculatedTravelSegment[];
  summaryByDay: Map<string, ITravelDaySummary>;
}> => {
  if (employeeIds.length === 0) {
    return { segments: [], summaryByDay: new Map() };
  }

  const [internalPoints, mappings, routes, events] = await Promise.all([
    getInternalAccessPoints(),
    fetchTravelMappingsRaw(),
    fetchTravelRoutesRaw(),
    fetchEventsForEmployees({ employeeIds, startDate, endDate }),
  ]);

  const accessPointToObjectId = new Map<string, string>();
  for (const row of mappings) {
    const normalized = normalizeAccessPoint(row.access_point_name);
    if (normalized) accessPointToObjectId.set(normalized, row.object_id);
  }

  const routeMap = new Map<string, ITravelRouteRow>();
  for (const route of routes) {
    routeMap.set(routeKey(route.from_object_id, route.to_object_id), route);
  }

  const segments = buildTravelSegments({
    events,
    internalPoints,
    accessPointToObjectId,
    routeMap,
  });

  await syncSegmentsToDatabase({ employeeIds, startDate, endDate, segments });

  return {
    segments,
    summaryByDay: summarizeSegmentsByDay(segments),
  };
};

export const listTravelObjects = async (): Promise<ITravelObject[]> => {
  const [objects, mappings] = await Promise.all([
    fetchTravelObjectsRaw(),
    fetchTravelMappingsRaw(),
  ]);

  const byObjectId = new Map<string, string[]>();
  for (const mapping of mappings) {
    const normalized = normalizeAccessPoint(mapping.access_point_name);
    if (!normalized) continue;
    if (!byObjectId.has(mapping.object_id)) byObjectId.set(mapping.object_id, []);
    byObjectId.get(mapping.object_id)!.push(normalized);
  }

  return objects.map(object => ({
    ...object,
    access_points: (byObjectId.get(object.id) || []).sort((left, right) => left.localeCompare(right, 'ru')),
  }));
};

export const createTravelObject = async (name: string): Promise<ITravelObject> => {
  const normalizedName = name.trim();
  const { data, error } = await supabase
    .from('skud_objects')
    .insert({
      name: normalizedName,
      is_active: true,
    })
    .select('id, name, is_active, created_at, updated_at')
    .single();

  if (error) throw formatTravelFeatureError(error);

  const object = data as ITravelObjectRow;
  return {
    ...object,
    access_points: [],
  };
};

export const updateTravelObject = async ({
  objectId,
  name,
  accessPoints,
}: {
  objectId: string;
  name: string;
  accessPoints: string[];
}): Promise<ITravelObject> => {
  const normalizedName = name.trim();
  const normalizedAccessPoints = dedupeAccessPoints(accessPoints);
  const updatedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('skud_objects')
    .update({
      name: normalizedName,
      updated_at: updatedAt,
    })
    .eq('id', objectId);

  if (updateError) throw formatTravelFeatureError(updateError);

  if (normalizedAccessPoints.length > 0) {
    const { error: clearCrossBindingsError } = await supabase
      .from('skud_object_access_points')
      .delete()
      .in('access_point_name', normalizedAccessPoints)
      .neq('object_id', objectId);

    if (clearCrossBindingsError) throw formatTravelFeatureError(clearCrossBindingsError);
  }

  const { error: deleteOwnMappingsError } = await supabase
    .from('skud_object_access_points')
    .delete()
    .eq('object_id', objectId);

  if (deleteOwnMappingsError) throw formatTravelFeatureError(deleteOwnMappingsError);

  if (normalizedAccessPoints.length > 0) {
    const { error: insertMappingsError } = await supabase
      .from('skud_object_access_points')
      .insert(normalizedAccessPoints.map(accessPointName => ({
        object_id: objectId,
        access_point_name: accessPointName,
      })));

    if (insertMappingsError) throw formatTravelFeatureError(insertMappingsError);
  }

  const objects = await listTravelObjects();
  const updated = objects.find(object => object.id === objectId);
  if (!updated) throw new Error('Объект не найден после сохранения');
  return updated;
};

export const deleteTravelObject = async (objectId: string): Promise<void> => {
  const { error } = await supabase
    .from('skud_objects')
    .delete()
    .eq('id', objectId);

  if (error) throw formatTravelFeatureError(error);
};

export const listTravelRoutes = async (): Promise<ITravelRoute[]> => {
  const [objects, routes] = await Promise.all([
    fetchTravelObjectsRaw(),
    fetchTravelRoutesRaw(),
  ]);

  const objectNameById = new Map<string, string>();
  for (const object of objects) {
    objectNameById.set(object.id, object.name);
  }

  return routes.map(route => {
    const multiplier = route.credit_multiplier ?? DEFAULT_CREDIT_MULTIPLIER;
    return {
      ...route,
      from_object_name: objectNameById.get(route.from_object_id) || null,
      to_object_name: objectNameById.get(route.to_object_id) || null,
      credit_multiplier: multiplier,
      max_credit_minutes: Math.ceil(route.travel_minutes * multiplier),
    };
  });
};

export const createTravelRoute = async ({
  fromObjectId,
  toObjectId,
  travelMinutes,
}: {
  fromObjectId: string;
  toObjectId: string;
  travelMinutes: number;
}): Promise<ITravelRoute> => {
  const { data, error } = await supabase
    .from('skud_object_routes')
    .insert({
      from_object_id: fromObjectId,
      to_object_id: toObjectId,
      travel_minutes: travelMinutes,
      credit_multiplier: DEFAULT_CREDIT_MULTIPLIER,
      is_active: true,
    })
    .select('id, from_object_id, to_object_id, travel_minutes, credit_multiplier, is_active, created_at, updated_at')
    .single();

  if (error) throw formatTravelFeatureError(error);

  const route = data as ITravelRouteRow;
  const [objects] = await Promise.all([fetchTravelObjectsRaw()]);
  const objectNameById = new Map<string, string>(objects.map(object => [object.id, object.name]));
  const multiplier = route.credit_multiplier ?? DEFAULT_CREDIT_MULTIPLIER;

  return {
    ...route,
    from_object_name: objectNameById.get(route.from_object_id) || null,
    to_object_name: objectNameById.get(route.to_object_id) || null,
    credit_multiplier: multiplier,
    max_credit_minutes: Math.ceil(route.travel_minutes * multiplier),
  };
};

export const updateTravelRoute = async ({
  routeId,
  fromObjectId,
  toObjectId,
  travelMinutes,
}: {
  routeId: string;
  fromObjectId: string;
  toObjectId: string;
  travelMinutes: number;
}): Promise<ITravelRoute> => {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('skud_object_routes')
    .update({
      from_object_id: fromObjectId,
      to_object_id: toObjectId,
      travel_minutes: travelMinutes,
      updated_at: updatedAt,
    })
    .eq('id', routeId);

  if (error) throw formatTravelFeatureError(error);

  const routes = await listTravelRoutes();
  const updated = routes.find(route => route.id === routeId);
  if (!updated) throw new Error('Маршрут не найден после сохранения');
  return updated;
};

export const deleteTravelRoute = async (routeId: string): Promise<void> => {
  const { error } = await supabase
    .from('skud_object_routes')
    .delete()
    .eq('id', routeId);

  if (error) throw formatTravelFeatureError(error);
};

const getScopedEmployees = async ({
  month,
  departmentId,
  employeeId,
}: ITravelScopeParams): Promise<ITravelEmployeeRow[]> => {
  void month;
  return fetchEmployeeScope({ departmentId, employeeId });
};

export const rebuildTravelSegmentsForScope = async ({
  month,
  departmentId,
  employeeId,
}: ITravelScopeParams): Promise<{ segmentCount: number; employeeCount: number }> => {
  const employees = await getScopedEmployees({ month, departmentId, employeeId });
  const employeeIds = employees.map(employee => employee.id);
  const { startDate, endDate } = toMonthRange(month);

  const { segments } = await calculateAndSyncTravelSegments({
    employeeIds,
    startDate,
    endDate,
  });

  return {
    segmentCount: segments.length,
    employeeCount: employeeIds.length,
  };
};

export const listTravelSegments = async ({
  month,
  departmentId,
  employeeId,
  status,
}: ITravelScopeParams & { status?: TravelSegmentStatus | 'problem' }): Promise<ITravelSegmentListItem[]> => {
  const employees = await getScopedEmployees({ month, departmentId, employeeId });
  const employeeIds = employees.map(employee => employee.id);
  const employeeMap = new Map<number, ITravelEmployeeRow>(employees.map(employee => [employee.id, employee]));
  const departmentMap = await fetchDepartmentsMap(
    employees.map(employee => employee.org_department_id).filter((value): value is string => !!value),
  );
  const { startDate, endDate } = toMonthRange(month);

  await calculateAndSyncTravelSegments({
    employeeIds,
    startDate,
    endDate,
  });

  if (employeeIds.length === 0) return [];

  let query = supabase
    .from('skud_travel_segments')
    .select('id, employee_id, work_date, from_object_id, to_object_id, from_access_point_name, to_access_point_name, exit_time, entry_time, actual_minutes, norm_minutes, max_credit_minutes, credited_minutes, delay_minutes, status, created_at, updated_at')
    .in('employee_id', employeeIds)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: false })
    .order('exit_time', { ascending: true });

  if (status && status !== 'problem') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw formatTravelFeatureError(error);

  const rows = (data || []) as ITravelSegmentRow[];
  const filteredRows = status === 'problem'
    ? rows.filter(row => row.status !== 'auto_approved')
    : rows;

  const objectIds = [...new Set(
    filteredRows.flatMap(row => [row.from_object_id, row.to_object_id]).filter((value): value is string => !!value),
  )];
  const objects = objectIds.length > 0
    ? await fetchTravelObjectsRaw()
    : [];
  const objectNameById = new Map<string, string>(objects.map(object => [object.id, object.name]));

  return filteredRows.map(row => {
    const employee = employeeMap.get(row.employee_id);
    const departmentIdValue = employee?.org_department_id || null;
    return {
      id: row.id,
      employee_id: row.employee_id,
      employee_name: employee?.full_name || `#${row.employee_id}`,
      department_id: departmentIdValue,
      department_name: departmentIdValue ? departmentMap.get(departmentIdValue) || null : null,
      work_date: row.work_date,
      from_object_id: row.from_object_id,
      from_object_name: row.from_object_id ? objectNameById.get(row.from_object_id) || null : null,
      to_object_id: row.to_object_id,
      to_object_name: row.to_object_id ? objectNameById.get(row.to_object_id) || null : null,
      from_access_point_name: row.from_access_point_name,
      to_access_point_name: row.to_access_point_name,
      exit_time: row.exit_time,
      entry_time: row.entry_time,
      actual_minutes: row.actual_minutes,
      norm_minutes: row.norm_minutes,
      max_credit_minutes: row.max_credit_minutes,
      credited_minutes: row.credited_minutes,
      delay_minutes: row.delay_minutes,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });
};

export const getTravelHoursSummaryForRange = async ({
  employeeIds,
  startDate,
  endDate,
}: IRebuildTravelParams): Promise<Map<string, ITravelDaySummary>> => {
  try {
    const { summaryByDay } = await calculateAndSyncTravelSegments({ employeeIds, startDate, endDate });
    return summaryByDay;
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn('[travel] feature tables are missing, returning empty summary');
      return new Map();
    }
    throw error;
  }
};

export const travelMinutesToHours = (minutes: number): number => roundHours(minutes);
