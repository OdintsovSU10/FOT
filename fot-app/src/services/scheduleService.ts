import { apiClient } from '../api/client';
import type { IWorkSchedule, IDepartmentSchedule, IEmployeeSchedule, IResolvedSchedule } from '../types/schedule';

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export const scheduleService = {
  /** Список шаблонов графиков */
  async list(): Promise<IWorkSchedule[]> {
    const res = await apiClient.get<ApiResponse<IWorkSchedule[]>>('/schedules');
    if (!res.data) throw new Error(res.error || 'Ошибка загрузки графиков');
    return res.data;
  },

  /** Создать шаблон */
  async create(data: Omit<IWorkSchedule, 'id' | 'is_default' | 'created_at' | 'updated_at'>): Promise<IWorkSchedule> {
    const res = await apiClient.post<ApiResponse<IWorkSchedule>>('/schedules', data);
    if (!res.data) throw new Error(res.error || 'Ошибка создания графика');
    return res.data;
  },

  /** Обновить шаблон */
  async update(id: string, data: Partial<IWorkSchedule>): Promise<IWorkSchedule> {
    const res = await apiClient.put<ApiResponse<IWorkSchedule>>(`/schedules/${id}`, data);
    if (!res.data) throw new Error(res.error || 'Ошибка обновления графика');
    return res.data;
  },

  /** Удалить шаблон */
  async remove(id: string): Promise<void> {
    const res = await apiClient.delete<ApiResponse<null>>(`/schedules/${id}`);
    if (res.error) throw new Error(res.error);
  },

  /** График отдела (история) */
  async getDepartmentSchedule(deptId: string): Promise<IDepartmentSchedule[]> {
    const res = await apiClient.get<ApiResponse<IDepartmentSchedule[]>>(`/schedules/department/${deptId}`);
    if (!res.data) throw new Error(res.error || 'Ошибка загрузки графика отдела');
    return res.data;
  },

  /** Назначить график отделу */
  async assignDepartment(deptId: string, data: { schedule_id: string; effective_from: string; effective_to?: string | null }): Promise<IDepartmentSchedule> {
    const res = await apiClient.put<ApiResponse<IDepartmentSchedule>>(`/schedules/department/${deptId}`, data);
    if (!res.data) throw new Error(res.error || 'Ошибка назначения графика');
    return res.data;
  },

  /** График сотрудника (история) */
  async getEmployeeSchedule(empId: number): Promise<IEmployeeSchedule[]> {
    const res = await apiClient.get<ApiResponse<IEmployeeSchedule[]>>(`/schedules/employee/${empId}`);
    if (!res.data) throw new Error(res.error || 'Ошибка загрузки графика сотрудника');
    return res.data;
  },

  /** Назначить график сотруднику */
  async assignEmployee(empId: number, data: { schedule_id: string; effective_from: string; effective_to?: string | null; reason?: string }): Promise<IEmployeeSchedule> {
    const res = await apiClient.put<ApiResponse<IEmployeeSchedule>>(`/schedules/employee/${empId}`, data);
    if (!res.data) throw new Error(res.error || 'Ошибка назначения графика сотруднику');
    return res.data;
  },

  /** Удалить переопределение */
  async removeEmployeeOverride(empId: number, schedId: string): Promise<void> {
    const res = await apiClient.delete<ApiResponse<null>>(`/schedules/employee/${empId}/${schedId}`);
    if (res.error) throw new Error(res.error);
  },

  /** Resolve для одного сотрудника */
  async resolve(empId: number, date?: string): Promise<IResolvedSchedule> {
    const params = date ? `?date=${date}` : '';
    const res = await apiClient.get<ApiResponse<IResolvedSchedule>>(`/schedules/resolve/${empId}${params}`);
    if (!res.data) throw new Error(res.error || 'Ошибка определения графика');
    return res.data;
  },
};
