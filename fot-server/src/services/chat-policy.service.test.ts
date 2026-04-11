import { describe, expect, it } from 'vitest';
import { chatPolicyService, type IChatUserContext } from './chat-policy.service.js';

const makeUser = (overrides: Partial<IChatUserContext>): IChatUserContext => ({
  id: overrides.id || 'user-a',
  full_name: overrides.full_name || 'Тестовый Пользователь',
  position_type: overrides.position_type || 'worker_office',
  supervisor_id: overrides.supervisor_id ?? null,
  employee_id: overrides.employee_id ?? 1,
  department_id: overrides.department_id ?? 'dept-a',
  chat_inbound_mode: overrides.chat_inbound_mode || 'open',
  is_approved: overrides.is_approved ?? true,
});

describe('chatPolicyService.evaluatePair', () => {
  it('allows direct chat inside the same department', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-sales' }),
      targetUser: makeUser({ id: 'worker-2', department_id: 'dept-sales' }),
      hasGrant: false,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 1,
    });

    expect(decision.availability).toBe('direct');
    expect(decision.availability_reason_code).toBe('direct_same_department');
  });

  it('allows direct chat for direct supervisor links', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-a', supervisor_id: 'header-1' }),
      targetUser: makeUser({ id: 'header-1', position_type: 'header', department_id: 'dept-b' }),
      hasGrant: false,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 2,
    });

    expect(decision.availability).toBe('direct');
    expect(decision.availability_reason_code).toBe('direct_supervisor');
  });

  it('requires request for a manager from another department', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-a' }),
      targetUser: makeUser({ id: 'header-1', position_type: 'header', department_id: 'dept-b' }),
      hasGrant: false,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 2,
    });

    expect(decision.availability).toBe('request');
    expect(decision.availability_reason_code).toBe('request_cross_department_manager');
  });

  it('respects requests_only mode for protected users', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-a' }),
      targetUser: makeUser({ id: 'director-1', position_type: 'director', department_id: 'dept-top', chat_inbound_mode: 'requests_only' }),
      hasGrant: false,
      requestStatus: 'outgoing_pending',
      headerLevel: 2,
      targetLevel: 5,
    });

    expect(decision.availability).toBe('request');
    expect(decision.request_status).toBe('outgoing_pending');
    expect(decision.availability_reason_code).toBe('request_requests_only');
  });

  it('forbids new cross-department chats for regular employees', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-a' }),
      targetUser: makeUser({ id: 'worker-2', department_id: 'dept-b' }),
      hasGrant: false,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 1,
    });

    expect(decision.availability).toBe('forbidden');
    expect(decision.availability_reason_code).toBe('forbidden_cross_department');
  });

  it('allows privileged HR/admin roles to chat directly', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'worker-1', department_id: 'dept-a' }),
      targetUser: makeUser({ id: 'hr-1', position_type: 'hr', department_id: 'dept-hr' }),
      hasGrant: false,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 3,
    });

    expect(decision.availability).toBe('direct');
    expect(decision.availability_reason_code).toBe('direct_privileged_role');
  });

  it('allows explicitly granted contacts even when inbound chat is disabled', () => {
    const decision = chatPolicyService.evaluatePair({
      currentUser: makeUser({ id: 'assistant-1', department_id: 'dept-a' }),
      targetUser: makeUser({ id: 'director-1', department_id: 'dept-top', chat_inbound_mode: 'disabled', position_type: 'director' }),
      hasGrant: true,
      requestStatus: null,
      headerLevel: 2,
      targetLevel: 5,
    });

    expect(decision.availability).toBe('direct');
    expect(decision.availability_reason_code).toBe('direct_grant');
  });
});
