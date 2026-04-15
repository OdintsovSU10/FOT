import { describe, expect, it } from 'vitest';
import {
  TIMESHEET_WORKFLOW_MONITOR_PERMISSION,
  TIMESHEET_WORKFLOW_REVIEW_PERMISSION,
  TIMESHEET_WORKFLOW_SUBMIT_PERMISSION,
  validateTimesheetWorkflowPermissions,
} from './access-control.js';

describe('validateTimesheetWorkflowPermissions', () => {
  it('rejects submit without /timesheet edit', () => {
    const error = validateTimesheetWorkflowPermissions(
      'brigadier',
      ['data.scope.department', TIMESHEET_WORKFLOW_SUBMIT_PERMISSION],
      { '/timesheet': 'view' },
    );

    expect(error).toContain('/timesheet');
  });

  it('rejects review with self scope', () => {
    const error = validateTimesheetWorkflowPermissions(
      'construction_manager',
      ['data.scope.self', TIMESHEET_WORKFLOW_REVIEW_PERMISSION],
      { '/timesheet-hr': 'edit' },
    );

    expect(error).toContain('department или all');
  });

  it('rejects monitor without hr page access', () => {
    const error = validateTimesheetWorkflowPermissions(
      'timesheet_hr',
      ['data.scope.all', TIMESHEET_WORKFLOW_MONITOR_PERMISSION],
      {},
    );

    expect(error).toContain('/timesheet-hr');
  });

  it('accepts valid submit, review and monitor configuration', () => {
    const error = validateTimesheetWorkflowPermissions(
      'timesheet_hr',
      [
        'data.scope.all',
        TIMESHEET_WORKFLOW_SUBMIT_PERMISSION,
        TIMESHEET_WORKFLOW_REVIEW_PERMISSION,
        TIMESHEET_WORKFLOW_MONITOR_PERMISSION,
      ],
      {
        '/timesheet': 'edit',
        '/timesheet-hr': 'edit',
      },
    );

    expect(error).toBeNull();
  });
});
