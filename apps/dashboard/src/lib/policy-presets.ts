export type PresetId = 'strict' | 'standard' | 'observe';

export interface PolicyRule {
  action_type: 'read' | 'write' | 'export' | 'delete' | 'call' | 'payment';
  resource: string;
  outcome: 'allowed' | 'blocked' | 'flagged';
}

export interface PolicyPreset {
  id: PresetId;
  name: string;
  description: string;
  rules: PolicyRule[];
}

export const POLICY_PRESETS: readonly PolicyPreset[] = [
  {
    id: 'strict',
    name: 'Strict',
    description: 'Block everything except explicitly allowed actions.',
    rules: [
      { action_type: 'read', resource: 'public:*', outcome: 'allowed' },
      { action_type: 'call', resource: 'public:*', outcome: 'allowed' },
      { action_type: 'write', resource: '*', outcome: 'blocked' },
      { action_type: 'export', resource: '*', outcome: 'blocked' },
      { action_type: 'delete', resource: '*', outcome: 'blocked' },
      { action_type: 'payment', resource: '*', outcome: 'blocked' },
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Flag high-risk actions, allow everything else.',
    rules: [
      { action_type: 'read', resource: '*', outcome: 'allowed' },
      { action_type: 'write', resource: '*', outcome: 'allowed' },
      { action_type: 'call', resource: '*', outcome: 'allowed' },
      { action_type: 'export', resource: '*', outcome: 'flagged' },
      { action_type: 'delete', resource: '*', outcome: 'flagged' },
      { action_type: 'payment', resource: '*', outcome: 'flagged' },
    ],
  },
  {
    id: 'observe',
    name: 'Observe Only',
    description: 'Log all actions, block nothing. Good for testing.',
    rules: [
      { action_type: 'read', resource: '*', outcome: 'allowed' },
      { action_type: 'write', resource: '*', outcome: 'allowed' },
      { action_type: 'call', resource: '*', outcome: 'allowed' },
      { action_type: 'export', resource: '*', outcome: 'allowed' },
      { action_type: 'delete', resource: '*', outcome: 'allowed' },
      { action_type: 'payment', resource: '*', outcome: 'allowed' },
    ],
  },
];

export function findPreset(id: string | undefined): PolicyPreset | undefined {
  return POLICY_PRESETS.find((p) => p.id === id);
}
