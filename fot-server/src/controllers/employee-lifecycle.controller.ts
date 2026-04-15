import { Response } from 'express';
import { supabase } from '../config/database.js';
import { auditService } from '../services/audit.service.js';
import { employeeChangesService } from '../services/employee-changes.service.js';
import { loadStructureCache, decryptEmployee } from '../services/employee-mapper.service.js';
import { employeeCache } from '../services/employee-cache.service.js';
import {
  ensureArchiveSigurDepartment,
  syncLinkedEmployeeFromSigur,
} from '../services/sigur-linked-employees.service.js';
import { sigurService } from '../services/sigur.service.js';
import type { AuthenticatedRequest, EmployeeEncrypted } from '../types/index.js';
import { canAccessEmployeeInScope } from '../services/data-scope.service.js';

// Явный набор колонок для lifecycle-операций
const EMPLOYEE_LIFECYCLE_COLUMNS = 'id, full_name, last_name, first_name, middle_name, current_salary, salary_actual, salary_calculated, staff_units, birth_date, hire_date, country, pension_number, patent_issue_date, patent_expiry_date, email, org_department_id, org_company_id, position_id, sigur_employee_id, tab_number, current_status, permit_expiry_date, registration_cat1, registration_cat4, doc_receipt_date, work_object, employment_status, department_locked, is_archived, archived_at, created_at, updated_at, work_category';

/**
 * POST /api/employees/:id/archive
 */
export async function archive(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployeeInScope(req, Number(id)))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }

    const { data, error } = await supabase
      .from('employees')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', id)
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    employeeCache.invalidate(id);

    await auditService.logFromRequest(req, req.user.id, 'ARCHIVE_EMPLOYEE', {
      entityType: 'employee',
      entityId: id,
    });

    const structureCache = await loadStructureCache();
    const employee = decryptEmployee(data as EmployeeEncrypted, structureCache);
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Archive employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to archive employee' });
  }
}

/**
 * POST /api/employees/:id/restore
 */
export async function restore(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployeeInScope(req, Number(id)))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }

    const { data, error } = await supabase
      .from('employees')
      .update({ is_archived: false, archived_at: null })
      .eq('id', id)
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    employeeCache.invalidate(id);

    const structureCache = await loadStructureCache();
    const employee = decryptEmployee(data as unknown as EmployeeEncrypted, structureCache);

    await auditService.logFromRequest(req, req.user.id, 'RESTORE_EMPLOYEE', {
      entityType: 'employee',
      entityId: id,
    });

    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Restore employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to restore employee' });
  }
}

/**
 * POST /api/employees/:id/fire — уволить сотрудника
 */
export async function fire(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const employeeId = Number(id);
    if (!(await canAccessEmployeeInScope(req, employeeId))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from('employees')
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .eq('id', id)
      .single();

    if (existingError || !existing) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const connection = (req.body.connection as 'external' | 'internal') || undefined;
    let targetDepartmentId = existing.org_department_id || null;

    if (existing.sigur_employee_id) {
      if (!(await sigurService.isConfigured())) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const archive = await ensureArchiveSigurDepartment(req.user.id, connection);
      let movedToArchive = false;
      let blocked = false;

      try {
        await sigurService.updateEmployee(existing.sigur_employee_id, {
          departmentId: archive.sigurDepartmentId,
        }, connection);
        movedToArchive = true;

        await sigurService.blockEmployee(existing.sigur_employee_id, connection);
        blocked = true;
      } catch (error) {
        await auditService.logFromRequest(req, req.user.id, 'FIRE_EMPLOYEE', {
          entityType: 'employee',
          entityId: id,
          details: {
            source: 'sigur',
            partial_failure: true,
            movedToArchive,
            blocked,
            error: error instanceof Error ? error.message : 'Unknown Sigur error',
          },
        });

        res.status(movedToArchive ? 502 : 500).json({
          success: false,
          error: movedToArchive
            ? 'Сотрудник уже перемещён в архивный отдел Sigur, но блокировка не выполнена. Локальный статус не изменён.'
            : 'Не удалось выполнить увольнение сотрудника в Sigur',
          code: movedToArchive ? 'SIGUR_PARTIAL_FAILURE' : 'SIGUR_WRITE_FAILED',
        });
        return;
      }

      targetDepartmentId = archive.localDepartmentId || targetDepartmentId;

      if (archive.localDepartmentId && archive.localDepartmentId !== existing.org_department_id) {
        await employeeChangesService.changeDepartment(employeeId, archive.localDepartmentId, {
          reason: 'Увольнение — перевод в архивный отдел Sigur',
          lockDepartment: false,
          createdBy: req.user.id,
          effectiveDate: today,
        });
      }
    }

    const { data, error } = await supabase
      .from('employees')
      .update({
        employment_status: 'fired',
        org_department_id: targetDepartmentId,
        department_locked: false,
      })
      .eq('id', id)
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .single();

    if (error || !data) {
      res.status(500).json({ success: false, error: 'Failed to update employee status' });
      return;
    }

    employeeCache.invalidate(id);

    // Закрываем все активные назначения при увольнении
    await supabase
      .from('employee_assignments')
      .update({ effective_to: today })
      .eq('employee_id', id)
      .is('effective_to', null);

    await auditService.logFromRequest(req, req.user.id, 'FIRE_EMPLOYEE', {
      entityType: 'employee',
      entityId: id,
      details: {
        source: existing.sigur_employee_id ? 'sigur' : 'portal',
        target_department_id: targetDepartmentId,
      },
    });

    const structureCache = await loadStructureCache();
    const updatedEmployee = decryptEmployee(data as unknown as EmployeeEncrypted, structureCache);
    res.json({ success: true, data: updatedEmployee });
  } catch (error) {
    console.error('Fire employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to fire employee' });
  }
}

/**
 * POST /api/employees/:id/rehire — восстановить на работу
 */
export async function rehire(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployeeInScope(req, Number(id)))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }

    const { data, error } = await supabase
      .from('employees')
      .update({ employment_status: 'active' })
      .eq('id', id)
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    employeeCache.invalidate(id);

    // Создаём новое назначение при восстановлении
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('employee_assignments')
      .insert({
        employee_id: Number(id),
        org_department_id: data.org_department_id || null,
        position_id: data.position_id || null,
        effective_from: today,
        is_primary: true,
        assignment_type: 'main',
        change_reason: 'Восстановление на работу',
        created_by: req.user.id,
      });

    await auditService.logFromRequest(req, req.user.id, 'REHIRE_EMPLOYEE', {
      entityType: 'employee',
      entityId: id,
    });

    const structureCache = await loadStructureCache();
    const employee = decryptEmployee(data as unknown as EmployeeEncrypted, structureCache);
    res.json({ success: true, data: employee });
  } catch (error) {
    console.error('Rehire employee error:', error);
    res.status(500).json({ success: false, error: 'Failed to rehire employee' });
  }
}

/**
 * POST /api/employees/:id/move-department — переместить в другой отдел
 */
export async function moveDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const employeeId = Number(id);
    if (!(await canAccessEmployeeInScope(req, employeeId))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }
    const { org_department_id } = req.body as { org_department_id: string };

    if (!org_department_id) {
      res.status(400).json({ success: false, error: 'org_department_id required' });
      return;
    }

    const { data: employeeRow, error: employeeError } = await supabase
      .from('employees')
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .eq('id', id)
      .single();

    if (employeeError || !employeeRow) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    if (employeeRow.sigur_employee_id) {
      if (!(await sigurService.isConfigured())) {
        res.status(503).json({ success: false, error: 'Sigur не настроен' });
        return;
      }

      const { data: targetDepartment, error: targetDepartmentError } = await supabase
        .from('org_departments')
        .select('id, sigur_department_id')
        .eq('id', org_department_id)
        .single();

      if (targetDepartmentError || !targetDepartment) {
        res.status(400).json({ success: false, error: 'Целевой отдел не найден' });
        return;
      }

      if (!targetDepartment.sigur_department_id) {
        res.status(409).json({ success: false, error: 'У выбранного отдела нет привязки к Sigur' });
        return;
      }

      const connection = (req.body.connection as 'external' | 'internal') || undefined;
      await sigurService.updateEmployee(employeeRow.sigur_employee_id, {
        departmentId: targetDepartment.sigur_department_id,
      }, connection);

      if (employeeRow.org_department_id !== org_department_id) {
        await employeeChangesService.changeDepartment(employeeId, org_department_id, {
          reason: 'Перевод в другой отдел',
          lockDepartment: false,
          createdBy: req.user.id,
        });
      }

      await syncLinkedEmployeeFromSigur(employeeId, connection);
    } else {
      await employeeChangesService.changeDepartment(employeeId, org_department_id, {
        reason: 'Перевод в другой отдел',
        lockDepartment: true,
        createdBy: req.user.id,
      });
    }

    employeeCache.invalidate(id);

    const { data, error } = await supabase
      .from('employees')
      .select(EMPLOYEE_LIFECYCLE_COLUMNS)
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    await auditService.logFromRequest(req, req.user.id, 'MOVE_EMPLOYEE_DEPARTMENT', {
      entityType: 'employee',
      entityId: id,
      details: {
        org_department_id,
        source: employeeRow.sigur_employee_id ? 'sigur' : 'portal',
      },
    });

    const structureCache = await loadStructureCache();
    const updatedEmployee = decryptEmployee(data as unknown as EmployeeEncrypted, structureCache);
    res.json({ success: true, data: updatedEmployee });
  } catch (error) {
    console.error('Move department error:', error);
    res.status(500).json({ success: false, error: 'Failed to move employee' });
  }
}

/**
 * GET /api/employees/:id/history
 */
export async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!(await canAccessEmployeeInScope(req, Number(id)))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }

    const { data: emp } = await supabase.from('employees').select('id').eq('id', id).single();

    if (!emp) {
      res.status(404).json({ success: false, error: 'Employee not found' });
      return;
    }

    const { data, error } = await supabase
      .from('employee_history')
      .select('*')
      .eq('employee_id', id)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Get employee history error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch history' });
      return;
    }

    const structureCache = await loadStructureCache();

    const events = (data || []).map((row: Record<string, unknown>) => {
      const eventData = row.event_data as Record<string, unknown> || {};
      let decryptedData: Record<string, unknown> = {};

      if (row.event_type === 'salary') {
        decryptedData = {
          salary: eventData.salary ? parseFloat(String(eventData.salary)) : null,
          reason: eventData.reason,
          order_number: eventData.order_number,
          note: eventData.note || null,
        };
      } else if (row.event_type === 'assignment') {
        decryptedData = {
          department: eventData.department_id ? structureCache.departments.get(eventData.department_id as string) || null : null,
          department_id: eventData.department_id,
          position: eventData.position_id ? structureCache.positions.get(eventData.position_id as string) || null : null,
          position_id: eventData.position_id,
          site_id: eventData.site_id,
          is_primary: eventData.is_primary,
          type: eventData.type,
          reason: eventData.reason,
          order_number: eventData.order_number,
        };
      }

      return {
        employee_id: row.employee_id,
        event_type: row.event_type,
        event_id: row.event_id,
        event_date: row.event_date,
        event_end_date: row.event_end_date,
        event_data: decryptedData,
        created_at: row.created_at,
        created_by: row.created_by,
      };
    });

    res.json({ success: true, data: events });
  } catch (error) {
    console.error('Get employee history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
}

/**
 * PUT /api/employees/:id/history/:eventId
 */
export async function updateHistoryEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = Number(req.params.id);
    if (!(await canAccessEmployeeInScope(req, employeeId))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }
    const eventId = req.params.eventId;

    if (eventId.startsWith('sal_')) {
      const historyId = Number(eventId.replace('sal_', ''));
      await employeeChangesService.updateSalaryHistory(historyId, employeeId, {
        salary: req.body.salary,
        effective_date: req.body.effective_date,
        change_reason: req.body.change_reason,
        note: req.body.note,
      });
    } else {
      await employeeChangesService.updateAssignment(eventId, employeeId, {
        position_id: req.body.position_id,
        org_department_id: req.body.org_department_id,
        effective_from: req.body.effective_date,
        change_reason: req.body.change_reason,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update history event error:', error);
    res.status(500).json({ success: false, error: 'Failed to update history event' });
  }
}

/**
 * DELETE /api/employees/:id/history/:eventId
 */
export async function deleteHistoryEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const employeeId = Number(req.params.id);
    if (!(await canAccessEmployeeInScope(req, employeeId))) {
      res.status(403).json({ success: false, error: 'Нет доступа к сотруднику' });
      return;
    }
    const eventId = req.params.eventId;

    if (eventId.startsWith('sal_')) {
      const historyId = Number(eventId.replace('sal_', ''));
      await employeeChangesService.deleteSalaryHistory(historyId, employeeId);
    } else {
      await employeeChangesService.deleteAssignment(eventId, employeeId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete history event error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete history event' });
  }
}
