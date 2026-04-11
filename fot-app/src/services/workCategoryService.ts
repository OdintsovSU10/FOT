import { apiClient } from '../api/client';
import type { IWorkCategory } from '../types/schedule';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IWorkCategoryInput {
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface IWorkCategoryUpdate {
  code?: string;
  name?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export const workCategoryService = {
  async list(): Promise<IWorkCategory[]> {
    const res = await apiClient.get<ApiResponse<IWorkCategory[]>>('/work-categories');
    if (!res.data) throw new Error(res.error || 'Ошибка загрузки категорий труда');
    return res.data;
  },

  async create(data: IWorkCategoryInput): Promise<IWorkCategory> {
    const res = await apiClient.post<ApiResponse<IWorkCategory>>('/work-categories', data);
    if (!res.data) throw new Error(res.error || 'Ошибка создания категории');
    return res.data;
  },

  async update(code: string, data: IWorkCategoryUpdate): Promise<IWorkCategory> {
    const res = await apiClient.put<ApiResponse<IWorkCategory>>(`/work-categories/${code}`, data);
    if (!res.data) throw new Error(res.error || 'Ошибка обновления категории');
    return res.data;
  },

  async remove(code: string): Promise<void> {
    const res = await apiClient.delete<ApiResponse<null>>(`/work-categories/${code}`);
    if (res.error) throw new Error(res.error);
  },
};
