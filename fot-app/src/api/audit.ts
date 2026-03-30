import { apiClient } from './client';

export interface AuditIssue {
  employee_id: number;
  full_name: string;
  issue_type: string;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface AuditCheckResult {
  check_name: string;
  check_description: string;
  issues_count: number;
  issues: AuditIssue[];
}

export interface AuditSummary {
  total_employees: number;
  total_issues: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  checks: AuditCheckResult[];
  run_at: string;
}

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export const auditApi = {
  async runFullAudit(): Promise<ApiResponse<AuditSummary>> {
    try {
      const res = await apiClient.get<ApiResponse<AuditSummary>>('/audit/run');
      return { data: res.data, message: res.message || 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка запуска аудита',
      };
    }
  },

  async runSingleCheck(checkType: string): Promise<ApiResponse<AuditCheckResult>> {
    try {
      const res = await apiClient.get<ApiResponse<AuditCheckResult>>(`/audit/check/${checkType}`);
      return { data: res.data, message: res.message || 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка запуска проверки',
      };
    }
  },
};
