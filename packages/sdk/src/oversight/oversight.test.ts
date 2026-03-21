import { describe, it, expect, vi } from 'vitest';
import { OversightGate } from './index.js';
import type { AlertChannel, OversightAlert } from './index.js';

function mockChannel(shouldThrow = false): AlertChannel & { calls: OversightAlert[] } {
  const calls: OversightAlert[] = [];
  return {
    calls,
    send: async (alert: OversightAlert) => {
      if (shouldThrow) throw new Error('channel down');
      calls.push(alert);
    },
  };
}

function makeGate(overrides: Record<string, unknown> = {}, channels: AlertChannel[] = []) {
  return new OversightGate({
    require_human_approval: ['export', 'delete', 'payment'],
    channels,
    timeout_seconds: 1,
    timeout_action: 'block' as const,
    ...overrides,
  });
}

const testAlert: OversightAlert = {
  agent_id: 'ag_test123',
  action_type: 'export',
  resource: 'reports',
  metadata: {},
  timestamp: new Date().toISOString(),
  requires_approval: true,
};

describe('OversightGate', () => {
  describe('requiresApproval', () => {
    it('returns true for configured action types', () => {
      const gate = makeGate();
      expect(gate.requiresApproval('export')).toBe(true);
      expect(gate.requiresApproval('delete')).toBe(true);
      expect(gate.requiresApproval('payment')).toBe(true);
    });

    it('returns false for non-configured action types', () => {
      const gate = makeGate();
      expect(gate.requiresApproval('read')).toBe(false);
      expect(gate.requiresApproval('write')).toBe(false);
      expect(gate.requiresApproval('call')).toBe(false);
    });
  });

  describe('sendAlerts', () => {
    it('sends to all channels', async () => {
      const ch1 = mockChannel();
      const ch2 = mockChannel();
      const gate = makeGate({}, [ch1, ch2]);

      const { errors } = await gate.sendAlerts(testAlert);

      expect(errors).toHaveLength(0);
      expect(ch1.calls).toHaveLength(1);
      expect(ch2.calls).toHaveLength(1);
      expect(ch1.calls[0].agent_id).toBe('ag_test123');
    });

    it('collects errors without throwing', async () => {
      const good = mockChannel();
      const bad = mockChannel(true);
      const gate = makeGate({}, [good, bad]);

      const { errors } = await gate.sendAlerts(testAlert);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('channel down');
      expect(good.calls).toHaveLength(1);
    });
  });

  describe('requestApproval', () => {
    it('returns approved when human approves', async () => {
      const gate = makeGate({}, [mockChannel()]);
      const result = await gate.requestApproval(testAlert, async () => true);

      expect(result.decision).toBe('approved');
      expect(result.outcome).toBe('allowed');
      expect(result.timed_out).toBe(false);
    });

    it('returns rejected when human rejects', async () => {
      const gate = makeGate({}, [mockChannel()]);
      const result = await gate.requestApproval(testAlert, async () => false);

      expect(result.decision).toBe('rejected');
      expect(result.outcome).toBe('blocked');
      expect(result.timed_out).toBe(false);
    });

    it('times out and blocks when timeout_action is block', async () => {
      const gate = makeGate({ timeout_seconds: 0.1, timeout_action: 'block' }, [mockChannel()]);
      const neverResolve = () => new Promise<boolean>(() => {});
      const result = await gate.requestApproval(testAlert, neverResolve);

      expect(result.decision).toBe('timeout');
      expect(result.outcome).toBe('blocked');
      expect(result.timed_out).toBe(true);
    });

    it('times out and allows when timeout_action is allow', async () => {
      const gate = makeGate({ timeout_seconds: 0.1, timeout_action: 'allow' }, [mockChannel()]);
      const neverResolve = () => new Promise<boolean>(() => {});
      const result = await gate.requestApproval(testAlert, neverResolve);

      expect(result.decision).toBe('timeout');
      expect(result.outcome).toBe('allowed');
      expect(result.timed_out).toBe(true);
    });

    it('applies timeout_action immediately when no callback provided', async () => {
      const ch = mockChannel();
      const gate = makeGate({ timeout_action: 'block' }, [ch]);
      const result = await gate.requestApproval(testAlert);

      expect(result.decision).toBe('timeout');
      expect(result.outcome).toBe('blocked');
      expect(result.timed_out).toBe(true);
      expect(ch.calls).toHaveLength(1);
    });

    it('fires alerts before waiting for approval', async () => {
      const ch = mockChannel();
      const gate = makeGate({}, [ch]);
      let alertFiredBeforeResolve = false;

      const result = await gate.requestApproval(testAlert, async () => {
        alertFiredBeforeResolve = ch.calls.length > 0;
        return true;
      });

      expect(alertFiredBeforeResolve).toBe(true);
      expect(result.decision).toBe('approved');
    });
  });
});
