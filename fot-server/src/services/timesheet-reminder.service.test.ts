import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedState = vi.hoisted(() => ({
  listTimesheetWorkflowRecipientIds: vi.fn(async () => ['user-1']),
}));

vi.mock('../config/database.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./notification.service.js', () => ({
  notificationService: {
    createMany: vi.fn(async () => undefined),
  },
}));

vi.mock('./push.service.js', () => ({
  pushService: {
    sendGenericNotification: vi.fn(async () => undefined),
  },
}));

vi.mock('./settings.service.js', () => ({
  settingsService: {
    getTimesheetReminderConfig: vi.fn(async () => ({
      enabled: true,
      timezone: 'Europe/Moscow',
      openingReminderHour: 9,
      deadlineMorningHour: 10,
      deadlineAfternoonHour: 16,
      escalationHour: 17,
      overdueHour: 9,
    })),
  },
}));

vi.mock('./timesheet-period.service.js', () => ({
  formatTimesheetHalfLabel: vi.fn(() => '1-15'),
  getTimesheetReminderEventsForDate: vi.fn(() => []),
  parseTimesheetApprovalPeriod: vi.fn(() => null),
}));

vi.mock('./timesheet-workflow-recipients.service.js', () => ({
  listTimesheetWorkflowRecipientIds: mockedState.listTimesheetWorkflowRecipientIds,
}));

import { listTimesheetReminderRecipientIds } from './timesheet-reminder.service.js';

describe('timesheet-reminder.service', () => {
  beforeEach(() => {
    mockedState.listTimesheetWorkflowRecipientIds.mockClear();
    mockedState.listTimesheetWorkflowRecipientIds.mockResolvedValue(['user-1']);
  });

  it('uses submit recipients for filing reminders and excludes admin roles', async () => {
    const recipients = await listTimesheetReminderRecipientIds('dept-a', 'deadline_morning');

    expect(recipients).toEqual(['user-1']);
    expect(mockedState.listTimesheetWorkflowRecipientIds).toHaveBeenCalledWith(
      'dept-a',
      ['submit'],
      {
        excludeRoleCodes: ['admin', 'super_admin'],
        includeDataScopes: ['department'],
      },
    );
  });

  it('uses department submit recipients for overdue reminders too', async () => {
    const recipients = await listTimesheetReminderRecipientIds('dept-a', 'overdue');

    expect(recipients).toEqual(['user-1']);
    expect(mockedState.listTimesheetWorkflowRecipientIds).toHaveBeenCalledWith(
      'dept-a',
      ['submit'],
      {
        excludeRoleCodes: ['admin', 'super_admin'],
        includeDataScopes: ['department'],
      },
    );
  });
});
