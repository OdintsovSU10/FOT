import { apiClient } from '../api/client';

interface ApiResponse<T> {
  data: T;
}

interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ISigurMonitorSettings {
  enabled: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
  silenceWindowMinutes: number;
  baselineLookbackDays: number;
  baselineMinEvents: number;
  alertCooldownMinutes: number;
  timezone: string;
}

export interface ISigurHealthCheck {
  id: number;
  checked_at: string;
  source: 'presence_polling' | 'monitor_probe' | 'silence_detector';
  status: 'success' | 'failure' | 'silence';
  connection_type: 'internal' | 'external' | null;
  response_ms: number | null;
  events_last_window: number | null;
  baseline_events: number | null;
  consecutive_failures: number;
  error_message: string | null;
  meta: Record<string, unknown>;
}

export interface ISigurIncident {
  id: number;
  status: 'open' | 'resolved';
  severity: 'warning' | 'critical';
  detected_by: 'presence_polling' | 'monitor_probe' | 'silence_detector';
  started_at: string;
  resolved_at: string | null;
  last_success_at: string | null;
  affected_from: string | null;
  affected_to: string | null;
  connection_type: 'internal' | 'external' | null;
  error_message: string | null;
  meta: Record<string, unknown>;
  opened_notification_sent_at: string | null;
  resolved_notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISigurMonitorStatus {
  enabled: boolean;
  latestCheck: ISigurHealthCheck | null;
  activeIncident: ISigurIncident | null;
  lastSignalAt: string | null;
  lastSuccessfulSignalAt: string | null;
  lastEventFlowAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  consecutiveEventFlowSuccesses: number;
  currentStatus: 'disabled' | 'ok' | 'incident_open';
  settings: ISigurMonitorSettings;
}

export interface ISigurIncidentDetails {
  incident: ISigurIncident;
  checks: ISigurHealthCheck[];
}

export const sigurMonitorService = {
  async getStatus(): Promise<ISigurMonitorStatus> {
    const response = await apiClient.get<ApiResponse<ISigurMonitorStatus>>('/sigur/monitor/status');
    return response.data;
  },

  async getIncidents(params?: {
    limit?: number;
    offset?: number;
    status?: 'all' | 'open' | 'resolved';
  }): Promise<IPaginatedResponse<ISigurIncident>> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.status) query.append('status', params.status);
    return apiClient.get<IPaginatedResponse<ISigurIncident>>(`/sigur/monitor/incidents?${query.toString()}`);
  },

  async getIncident(id: number): Promise<ISigurIncidentDetails> {
    const response = await apiClient.get<ApiResponse<ISigurIncidentDetails>>(`/sigur/monitor/incidents/${id}`);
    return response.data;
  },

  async getChecks(params?: {
    limit?: number;
    offset?: number;
    status?: 'all' | 'success' | 'failure' | 'silence';
  }): Promise<IPaginatedResponse<ISigurHealthCheck>> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.status) query.append('status', params.status);
    return apiClient.get<IPaginatedResponse<ISigurHealthCheck>>(`/sigur/monitor/checks?${query.toString()}`);
  },
};
