import { apiClient } from './client';
import type {
  OrgDepartment,
  OrgStructureResponse,
} from '../types';

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

const orgQuery = (orgId?: string) => orgId ? `?organization_id=${orgId}` : '';

export const structureApi = {
  async getTree(organizationId?: string): Promise<ApiResponse<OrgStructureResponse>> {
    try {
      const res = await apiClient.get<ApiResponse<OrgStructureResponse>>(`/structure${orgQuery(organizationId)}`);
      return { data: res.data, message: res.message || 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка загрузки структуры',
      };
    }
  },

  async createDepartment(
    name: string,
    description?: string,
    organizationId?: string,
    parentId?: string | null,
  ): Promise<ApiResponse<OrgDepartment>> {
    try {
      const res = await apiClient.post<ApiResponse<OrgDepartment>>(`/structure/departments${orgQuery(organizationId)}`, {
        name,
        parent_id: parentId || null,
        description,
      });
      return { data: res.data, message: res.message || 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка создания отдела',
      };
    }
  },

  async clearStructure(organizationId?: string): Promise<ApiResponse<{ employeesDeleted: number; departmentsDeleted: number }>> {
    try {
      const res = await apiClient.delete<ApiResponse<{ employeesDeleted: number; departmentsDeleted: number }>>(`/structure/clear${orgQuery(organizationId)}`);
      return { data: res.data, message: res.message || 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка очистки структуры',
      };
    }
  },

  async deleteDepartment(id: string, organizationId?: string): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/structure/departments/${id}${orgQuery(organizationId)}`);
      return { message: 'ok' };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Ошибка удаления отдела',
      };
    }
  },
};
