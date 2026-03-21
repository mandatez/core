import { describe, it, expect } from 'vitest';
import { generateComplianceReport } from './report-generator';

const mockEvents = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    agent_id: 'ag_test1',
    owner_id: 'org_acme',
    timestamp: '2026-03-21T10:00:00.000Z',
    action_type: 'read',
    resource: 'emails',
    outcome: 'allowed',
    policy_id: null,
    metadata: {},
    signature: 'sig1',
    public_key: 'pk1',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    agent_id: 'ag_test1',
    owner_id: 'org_acme',
    timestamp: '2026-03-21T10:01:00.000Z',
    action_type: 'export',
    resource: 'reports',
    outcome: 'blocked',
    policy_id: 'pol_1',
    metadata: {},
    signature: 'sig2',
    public_key: 'pk1',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    agent_id: 'ag_test2',
    owner_id: 'org_acme',
    timestamp: '2026-03-21T10:02:00.000Z',
    action_type: 'call',
    resource: 'api/stripe',
    outcome: 'flagged',
    policy_id: 'pol_2',
    metadata: { amount: 100 },
    signature: 'sig3',
    public_key: 'pk2',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    agent_id: 'ag_test1',
    owner_id: 'org_acme',
    timestamp: '2026-03-21T10:03:00.000Z',
    action_type: 'read',
    resource: 'emails',
    outcome: 'allowed',
    policy_id: null,
    metadata: {},
    signature: 'sig4',
    public_key: 'pk1',
  },
];

describe('generateComplianceReport', () => {
  it('counts total events', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.summary.total_events).toBe(4);
  });

  it('breaks down by outcome', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.summary.by_outcome.allowed).toBe(2);
    expect(report.summary.by_outcome.blocked).toBe(1);
    expect(report.summary.by_outcome.flagged).toBe(1);
    expect(report.summary.by_outcome.pending_approval).toBe(0);
  });

  it('breaks down by action type', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.summary.by_action_type).toEqual({
      read: 2,
      export: 1,
      call: 1,
    });
  });

  it('ranks top resources', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.summary.top_resources[0]).toEqual({ resource: 'emails', count: 2 });
    expect(report.summary.top_resources).toHaveLength(3);
  });

  it('counts unique agents', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.summary.unique_agents).toBe(2);
  });

  it('includes owner_id and period', () => {
    const report = generateComplianceReport('org_acme', mockEvents, {
      from: '2026-03-21T00:00:00Z',
      to: '2026-03-22T00:00:00Z',
    });
    expect(report.owner_id).toBe('org_acme');
    expect(report.period.from).toBe('2026-03-21T00:00:00Z');
    expect(report.period.to).toBe('2026-03-22T00:00:00Z');
  });

  it('includes all events in output', () => {
    const report = generateComplianceReport('org_acme', mockEvents, { from: null, to: null });
    expect(report.events).toHaveLength(4);
  });

  it('handles empty events array', () => {
    const report = generateComplianceReport('org_acme', [], { from: null, to: null });
    expect(report.summary.total_events).toBe(0);
    expect(report.summary.unique_agents).toBe(0);
    expect(report.summary.top_resources).toEqual([]);
  });
});
