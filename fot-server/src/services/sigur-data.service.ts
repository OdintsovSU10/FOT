import { SigurServiceBase, ConnectionType } from './sigur-base.service.js';

export class SigurDataService extends SigurServiceBase {
  private employeeCache: { data: Record<string, unknown>[]; fetchedAt: number } | null = null;
  private employeeFetchPromise: Promise<Record<string, unknown>[]> | null = null;
  private departmentCache: { map: Map<number, string>; fetchedAt: number } | null = null;
  private accessPointCache: { map: Map<number, string>; fetchedAt: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly EVENT_CHUNK_MS = 2 * 60 * 60 * 1000;
  private readonly EVENT_CHUNK_OVERLAP_MS = 60 * 1000;
  private static readonly SIGUR_TIMEZONE_OFFSET_MS = 3 * 60 * 60 * 1000;

  async testConnection(
    connection?: ConnectionType,
  ): Promise<{ success: boolean; message: string; connection: ConnectionType }> {
    const connType = await this.resolveConnectionType(connection);

    try {
      await this.authenticate(connType);
      await this.request('/api/v1/departments', { limit: 1 }, connType);
      return {
        success: true,
        message: 'Подключение к Sigur успешно',
        connection: connType,
      };
    } catch (error) {
      const { AxiosError } = await import('axios');
      const message = error instanceof AxiosError
        ? `Ошибка подключения: ${error.message}${error.response?.data ? ' - ' + JSON.stringify(error.response.data) : ''}`
        : `Ошибка: ${(error as Error).message}`;

      return { success: false, message, connection: connType };
    }
  }

  async getEmployees(filters?: Record<string, any>, connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/employees', filters, connection, 1000);
  }

  async getEmployeesByDepartments(
    departmentIds: number[],
    connection?: ConnectionType,
    onProgress?: (loaded: number, deptIndex: number, totalDepts: number) => void,
  ): Promise<Record<string, unknown>[]> {
    const allEmployees: Record<string, unknown>[] = [];
    const seen = new Set<number>();
    const total = departmentIds.length;

    if (total === 0) return allEmployees;

    const concurrency = Math.min(8, total);
    let nextIndex = 0;
    let completed = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= total) return;

        const deptId = departmentIds[currentIndex];
        const items = await this.fetchAllPaginated<Record<string, unknown>>(
          '/api/v1/employees',
          { departmentId: deptId },
          connection,
          1000,
        );

        for (const employee of items) {
          const id = employee.id as number;
          if (id && !seen.has(id)) {
            seen.add(id);
            allEmployees.push(employee);
          }
        }

        completed++;
        if (onProgress) onProgress(allEmployees.length, completed, total);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    console.log(`[sigur] fetched ${allEmployees.length} employees from ${total} departments`);
    return allEmployees;
  }

  async getEmployeesLimited(maxItems = 3000, connection?: ConnectionType) {
    const response = await this.request<any>('/api/v1/employees', { limit: maxItems }, connection);
    const items = response?.data || response || [];
    return Array.isArray(items) ? items : [];
  }

  async getEmployeesCached(connection?: ConnectionType): Promise<Record<string, unknown>[]> {
    if (this.employeeCache && (Date.now() - this.employeeCache.fetchedAt) < this.CACHE_TTL) {
      return this.employeeCache.data;
    }

    if (this.employeeFetchPromise) {
      console.log('[sigur] waiting for ongoing employee fetch...');
      return this.employeeFetchPromise;
    }

    console.log('[sigur] fetching employees (no cache)...');
    this.employeeFetchPromise = this.getEmployees(undefined, connection)
      .then(data => {
        const employees = data as Record<string, unknown>[];
        this.employeeCache = { data: employees, fetchedAt: Date.now() };
        console.log('[sigur] cached', employees.length, 'employees');
        return employees;
      })
      .finally(() => {
        this.employeeFetchPromise = null;
      });

    return this.employeeFetchPromise;
  }

  async getDepartmentMapCached(connection?: ConnectionType): Promise<Map<number, string>> {
    if (this.departmentCache && (Date.now() - this.departmentCache.fetchedAt) < this.CACHE_TTL) {
      return this.departmentCache.map;
    }

    console.log('[sigur] fetching departments for cache...');
    const response = await this.request<any>('/api/v1/departments', { limit: 500 }, connection);
    const items = response?.data || response || [];
    const map = new Map<number, string>();

    if (Array.isArray(items)) {
      for (const department of items) {
        if (typeof department.id === 'number' && typeof department.name === 'string') {
          map.set(department.id, department.name);
        }
      }
    }

    this.departmentCache = { map, fetchedAt: Date.now() };
    console.log('[sigur] cached', map.size, 'departments');
    return map;
  }

  async getDepartments(connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/departments', undefined, connection);
  }

  async getCards(filters?: Record<string, any>, connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/cards', filters, connection);
  }

  async getCardBindings(connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/bindings/employees-cards', undefined, connection);
  }

  async getAccessPoints(connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/accesspoints', undefined, connection);
  }

  async getAccessPointMapCached(connection?: ConnectionType): Promise<Map<number, string>> {
    if (this.accessPointCache && (Date.now() - this.accessPointCache.fetchedAt) < this.CACHE_TTL) {
      return this.accessPointCache.map;
    }

    console.log('[sigur] fetching access points for cache...');
    const accessPoints = await this.getAccessPoints(connection) as Record<string, unknown>[];
    const map = new Map<number, string>();

    for (const point of accessPoints) {
      if (typeof point.id === 'number' && typeof point.name === 'string') {
        map.set(point.id, point.name);
      }
    }

    this.accessPointCache = { map, fetchedAt: Date.now() };
    console.log('[sigur] cached', map.size, 'access points');
    return map;
  }

  async getAccessRules(connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/accessrules', undefined, connection);
  }

  async getZones(connection?: ConnectionType) {
    return this.fetchAllPaginated('/api/v1/zones', undefined, connection);
  }

  private isRawPassEvent(raw: Record<string, unknown>): boolean {
    const direction = raw.direction;
    const accessObjectId = raw.accessObjectId;
    const timestamp = raw.timestamp;

    return (
      (direction === 'IN' || direction === 'OUT') &&
      typeof accessObjectId === 'number' &&
      typeof timestamp === 'string'
    );
  }

  private async enrichRawEvents(
    rawEvents: Record<string, unknown>[],
    connection?: ConnectionType,
  ): Promise<Record<string, unknown>[]> {
    if (rawEvents.length === 0) return [];

    const [employees, accessPointMap] = await Promise.all([
      this.getEmployeesCached(connection),
      this.getAccessPointMapCached(connection),
    ]);

    const employeeById = new Map<number, Record<string, unknown>>();
    for (const employee of employees) {
      if (typeof employee.id === 'number') {
        employeeById.set(employee.id, employee);
      }
    }

    const beforeFilter = rawEvents.length;
    const passEvents = rawEvents.filter(raw => this.isRawPassEvent(raw));
    const dropped = beforeFilter - passEvents.length;

    if (dropped > 0) {
      const reasons = { noDir: 0, badDir: 0, noAOId: 0, badAOIdType: 0, noTs: 0 };
      const samples: string[] = [];

      for (const raw of rawEvents) {
        if (this.isRawPassEvent(raw)) continue;

        if (!raw.direction) reasons.noDir++;
        else if (raw.direction !== 'IN' && raw.direction !== 'OUT') reasons.badDir++;

        if (raw.accessObjectId === undefined) reasons.noAOId++;
        else if (typeof raw.accessObjectId !== 'number') reasons.badAOIdType++;

        if (typeof raw.timestamp !== 'string') reasons.noTs++;

        if (samples.length < 3) {
          samples.push(
            `id=${raw.id} dir=${raw.direction} aoId=${raw.accessObjectId}(${typeof raw.accessObjectId}) ts=${typeof raw.timestamp}`,
          );
        }
      }

      console.log(
        `[enrichRawEvents] dropped ${dropped}/${beforeFilter} by isRawPassEvent: ${JSON.stringify(reasons)} samples: ${samples.join(' | ')}`,
      );
    }

    let unmatchedEmployeeIds = 0;
    const unmatchedIdSamples: number[] = [];

    const result = passEvents.map(raw => {
      const employeeId = raw.accessObjectId as number;
      const employee = employeeById.get(employeeId);
      const accessPointId = typeof raw.accessPointId === 'number' ? raw.accessPointId : null;
      const employeeName = typeof employee?.name === 'string' ? employee.name : '';

      if (!employee) {
        unmatchedEmployeeIds++;
        if (unmatchedIdSamples.length < 10) unmatchedIdSamples.push(employeeId);
      }

      return {
        id: raw.id,
        eventType: 'PASS_DETECTED',
        timestamp: raw.timestamp,
        data: {
          direction: raw.direction,
          employeeId,
          accessPointId,
          cardKey: null,
        },
        additionalData: {
          accessObject: {
            type: 'EMPLOYEE',
            data: {
              id: employeeId,
              name: employeeName,
              position: typeof employee?.position === 'string' ? employee.position : undefined,
            },
          },
          accessPoint: accessPointId != null
            ? {
                id: accessPointId,
                name: accessPointMap.get(accessPointId) || null,
              }
            : undefined,
        },
      };
    });

    if (unmatchedEmployeeIds > 0) {
      console.log(
        `[enrichRawEvents] ${unmatchedEmployeeIds}/${passEvents.length} events have no employee match. Unmatched accessObjectIds: [${unmatchedIdSamples.join(', ')}]`,
      );
    }

    console.log(
      `[enrichRawEvents] pipeline: raw=${rawEvents.length} -> passFilter=${passEvents.length} -> enriched=${result.length} (employeeCache=${employeeById.size})`,
    );

    return result;
  }

  private parseEventBoundary(time?: string): Date | null {
    if (!time) return null;

    const parsed = new Date(this.ensureTimezone(time));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatSigurDateTime(date: Date): string {
    const shifted = new Date(date.getTime() + SigurDataService.SIGUR_TIMEZONE_OFFSET_MS);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    const hours = String(shifted.getUTCHours()).padStart(2, '0');
    const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
    const seconds = String(shifted.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private dedupeEventsById<T extends Record<string, unknown>>(events: T[]): T[] {
    const deduped: T[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      const key = typeof event.id === 'number' || typeof event.id === 'string'
        ? String(event.id)
        : JSON.stringify([
            event.timestamp,
            event.accessObjectId,
            event.direction,
            event.accessPointId,
          ]);

      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(event);
    }

    return deduped;
  }

  private async fetchEventsByChunks<T extends Record<string, unknown>>(
    startTime: string | undefined,
    endTime: string | undefined,
    params: Record<string, any>,
    connection?: ConnectionType,
    pageSize = 3000,
  ): Promise<T[]> {
    const startDate = this.parseEventBoundary(startTime);
    const endDate = this.parseEventBoundary(endTime);

    if (!startDate || !endDate || endDate.getTime() <= startDate.getTime()) {
      return this.fetchAllByLastId<T>('/api/v1/events', params, connection, pageSize);
    }

    const baseParams = { ...params };
    delete baseParams.startTime;
    delete baseParams.endTime;

    const allEvents: T[] = [];
    const rangeStart = startDate.getTime();
    const rangeEnd = endDate.getTime();
    let chunkStart = rangeStart;
    let chunkIndex = 0;

    while (chunkStart <= rangeEnd) {
      chunkIndex++;

      const chunkEnd = Math.min(chunkStart + this.EVENT_CHUNK_MS - 1, rangeEnd);
      const chunkParams = {
        ...baseParams,
        startTime: this.ensureTimezone(this.formatSigurDateTime(new Date(chunkStart))),
        endTime: this.ensureTimezone(this.formatSigurDateTime(new Date(chunkEnd))),
      };

      console.log(
        `[sigur chunk] window ${chunkIndex}: ${chunkParams.startTime} -> ${chunkParams.endTime}`,
      );

      const chunkEvents = await this.fetchAllByLastId<T>(
        '/api/v1/events',
        chunkParams,
        connection,
        pageSize,
      );

      console.log(`[sigur chunk] window ${chunkIndex} got ${chunkEvents.length} events`);
      allEvents.push(...chunkEvents);

      if (chunkEnd >= rangeEnd) break;

      chunkStart = Math.max(
        chunkEnd + 1 - this.EVENT_CHUNK_OVERLAP_MS,
        rangeStart,
      );
    }

    const dedupedEvents = this.dedupeEventsById(allEvents);
    console.log(
      `[sigur chunk] combined ${allEvents.length} events into ${dedupedEvents.length} unique events`,
    );

    return dedupedEvents;
  }

  async getRawEvents(
    startTime?: string,
    endTime?: string,
    connection?: ConnectionType,
    extraParams?: Record<string, any>,
  ) {
    const pageSize = extraParams?.pageSize || 1000;
    const params: Record<string, any> = {};

    if (startTime) params.startTime = this.ensureTimezone(startTime);
    if (endTime) params.endTime = this.ensureTimezone(endTime);

    if (extraParams) {
      const { pageSize: _pageSize, ...rest } = extraParams;
      if (Object.keys(rest).length > 0) Object.assign(params, rest);
    }

    return this.fetchEventsByChunks(startTime, endTime, params, connection, pageSize);
  }

  private static readonly EVENT_TYPE_ID_MAP: Record<string, number> = {
    PASS_DETECTED: 6,
    PASS_DENY: 12,
  };

  async getEvents(
    startTime?: string,
    endTime?: string,
    connection?: ConnectionType,
    eventType?: string,
    extraParams?: Record<string, any>,
  ) {
    const pageSize = extraParams?.pageSize || 3000;
    const params: Record<string, any> = {};

    if (startTime) params.startTime = this.ensureTimezone(startTime);
    if (endTime) params.endTime = this.ensureTimezone(endTime);

    if (eventType) {
      const typeId = SigurDataService.EVENT_TYPE_ID_MAP[eventType];
      if (typeId) params.eventTypeId = typeId;
    }

    if (extraParams) {
      const { pageSize: _pageSize, ...rest } = extraParams;
      if (Object.keys(rest).length > 0) Object.assign(params, rest);
    }

    const rawEvents = await this.fetchEventsByChunks<Record<string, unknown>>(
      startTime,
      endTime,
      params,
      connection,
      pageSize,
    );

    console.log(`[sigur] getEvents raw: ${rawEvents.length} events`);
    return this.enrichRawEvents(rawEvents, connection);
  }

  async getEventsLimited(
    startTime?: string,
    endTime?: string,
    maxItems = 200,
    connection?: ConnectionType,
  ) {
    const params: Record<string, any> = { limit: maxItems };

    if (startTime) params.startTime = this.ensureTimezone(startTime);
    if (endTime) params.endTime = this.ensureTimezone(endTime);

    const response = await this.request<any>('/api/v1/events/parsed', params, connection);
    const items = response?.data || response || [];
    return Array.isArray(items) ? items.slice(0, maxItems) : [];
  }

  async getEventTypes(connection?: ConnectionType) {
    return this.request('/api/v1/events/types', undefined, connection);
  }

  async getPositions(connection?: ConnectionType): Promise<Record<string, unknown>[] | null> {
    try {
      return await this.fetchAllPaginated('/api/v1/positions', undefined, connection) as Record<string, unknown>[];
    } catch {
      console.warn('[sigur] /api/v1/positions not available');
      return null;
    }
  }

  async getDepartmentById(id: number, connection?: ConnectionType) {
    return this.request<Record<string, unknown>>(`/api/v1/departments/${id}`, undefined, connection);
  }

  async getEmployeeById(id: number, connection?: ConnectionType) {
    return this.request<Record<string, unknown>>(`/api/v1/employees/${id}`, undefined, connection);
  }

  async updateEmployee(
    id: number,
    body: Record<string, unknown>,
    connection?: ConnectionType,
  ): Promise<Record<string, unknown>> {
    return this.mutate<Record<string, unknown>>('put', `/api/v1/employees/${id}`, body, undefined, connection);
  }

  async blockEmployee(id: number, connection?: ConnectionType): Promise<void> {
    await this.mutate<void>('put', `/api/v1/employees/${id}/block`, undefined, undefined, connection);
  }

  async unblockEmployee(id: number, connection?: ConnectionType): Promise<void> {
    await this.mutate<void>('put', `/api/v1/employees/${id}/unblock`, undefined, undefined, connection);
  }

  async createDepartment(
    body: Record<string, unknown>,
    connection?: ConnectionType,
  ): Promise<Record<string, unknown>> {
    return this.mutate<Record<string, unknown>>('post', '/api/v1/departments', body, undefined, connection);
  }

  async createPosition(
    body: Record<string, unknown>,
    connection?: ConnectionType,
  ): Promise<Record<string, unknown>> {
    return this.mutate<Record<string, unknown>>('post', '/api/v1/positions', body, undefined, connection);
  }

  async getEmployeeAccessPointBindings(connection?: ConnectionType): Promise<Record<string, unknown>[]> {
    try {
      return await this.fetchAllPaginated<Record<string, unknown>>(
        '/api/v1/bindings/employees-accesspoints',
        undefined,
        connection,
      );
    } catch {
      return [];
    }
  }

  async createEmployeeAccessPointBindings(
    employeeIds: number[],
    accessPointIds: number[],
    connection?: ConnectionType,
  ): Promise<void> {
    await this.mutate<void>(
      'post',
      '/api/v1/bindings/employees-accesspoints',
      { employeeIds, accessPointIds },
      undefined,
      connection,
    );
  }

  async deleteEmployeeAccessPointBindings(
    employeeIds: number[],
    accessPointIds: number[],
    connection?: ConnectionType,
  ): Promise<void> {
    await this.mutate<void>(
      'post',
      '/api/v1/bindings/employees-accesspoints/delete',
      { employeeIds, accessPointIds },
      undefined,
      connection,
    );
  }
}
