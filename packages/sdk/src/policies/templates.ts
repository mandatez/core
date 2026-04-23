import type { PolicyRule } from '../policy/index.js';

export interface PolicyTemplate {
  /** Stable template identifier. Used as the `preset_id` on saved policies. */
  id: string;
  /** Display name shown in onboarding and dashboard galleries. */
  name: string;
  /** Human summary — shown next to the template in pickers. */
  description: string;
  /** Ordered rules for the PolicyEngine. First match wins, so the trailing
   *  catch-all block only fires on actions no prior rule matched. */
  rules: readonly PolicyRule[];
}

const ALL_ACTION_TYPES: PolicyRule['action_types'] = [
  'read',
  'write',
  'delete',
  'export',
  'call',
  'payment',
];

export const POLICY_TEMPLATES = {
  hipaa_healthcare: {
    id: 'tpl_hipaa',
    name: 'HIPAA Healthcare Agent',
    description:
      'For agents handling PHI. Blocks export, requires approval for writes, logs all reads.',
    rules: [
      { id: 'r1', action_types: ['export'], resource_pattern: '*', effect: 'block' },
      { id: 'r2', action_types: ['delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r3', action_types: ['write'], resource_pattern: 'phi/*', effect: 'flag' },
      { id: 'r4', action_types: ['read'], resource_pattern: 'phi/*', effect: 'allow' },
      { id: 'r5', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
  fintech_payments: {
    id: 'tpl_fintech',
    name: 'Fintech Payments Agent',
    description:
      'For agents processing payments. All payment actions require human approval.',
    rules: [
      { id: 'r1', action_types: ['payment'], resource_pattern: '*', effect: 'flag' },
      { id: 'r2', action_types: ['delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r3', action_types: ['export'], resource_pattern: 'customer/*', effect: 'flag' },
      { id: 'r4', action_types: ['read'], resource_pattern: 'customer/*', effect: 'allow' },
      { id: 'r5', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
  customer_support: {
    id: 'tpl_support',
    name: 'Customer Support Agent',
    description:
      'For agents responding to customer tickets. Read-only on customer data, write to tickets only.',
    rules: [
      { id: 'r1', action_types: ['read'], resource_pattern: 'customers/*', effect: 'allow' },
      { id: 'r2', action_types: ['read'], resource_pattern: 'tickets/*', effect: 'allow' },
      { id: 'r3', action_types: ['write'], resource_pattern: 'tickets/*', effect: 'allow' },
      { id: 'r4', action_types: ['delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r5', action_types: ['export'], resource_pattern: '*', effect: 'block' },
      { id: 'r6', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
  code_assistant: {
    id: 'tpl_code',
    name: 'Code Assistant Agent',
    description:
      'For agents that review or generate code. Read code, open PRs, no direct deploys.',
    rules: [
      { id: 'r1', action_types: ['read'], resource_pattern: 'repo/*', effect: 'allow' },
      { id: 'r2', action_types: ['write'], resource_pattern: 'repo/pull-requests/*', effect: 'allow' },
      { id: 'r3', action_types: ['call'], resource_pattern: 'github/*', effect: 'allow' },
      { id: 'r4', action_types: ['call'], resource_pattern: 'deploy/*', effect: 'flag' },
      { id: 'r5', action_types: ['delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r6', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
  data_analyst: {
    id: 'tpl_analyst',
    name: 'Data Analyst Agent',
    description:
      'For agents running queries on data warehouses. Read-only, no writes or exports without approval.',
    rules: [
      { id: 'r1', action_types: ['read'], resource_pattern: 'warehouse/*', effect: 'allow' },
      { id: 'r2', action_types: ['call'], resource_pattern: 'warehouse/query/*', effect: 'allow' },
      { id: 'r3', action_types: ['export'], resource_pattern: '*', effect: 'flag' },
      { id: 'r4', action_types: ['write', 'delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r5', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
  sales_outbound: {
    id: 'tpl_sales',
    name: 'Sales Outbound Agent',
    description:
      'For agents running cold outreach. Write to CRM, send emails with approval, no exports.',
    rules: [
      { id: 'r1', action_types: ['read'], resource_pattern: 'crm/*', effect: 'allow' },
      { id: 'r2', action_types: ['write'], resource_pattern: 'crm/contacts/*', effect: 'allow' },
      { id: 'r3', action_types: ['call'], resource_pattern: 'email/send', effect: 'flag' },
      { id: 'r4', action_types: ['export'], resource_pattern: '*', effect: 'block' },
      { id: 'r5', action_types: ['delete'], resource_pattern: '*', effect: 'block' },
      { id: 'r6', action_types: ALL_ACTION_TYPES, resource_pattern: '*', effect: 'block' },
    ],
  },
} as const satisfies Record<string, PolicyTemplate>;

export type PolicyTemplateKey = keyof typeof POLICY_TEMPLATES;

/** Find a template by its key (e.g. `hipaa_healthcare`) or id (e.g. `tpl_hipaa`). */
export function findTemplate(
  keyOrId: string,
): PolicyTemplate | undefined {
  if (keyOrId in POLICY_TEMPLATES) {
    return POLICY_TEMPLATES[keyOrId as PolicyTemplateKey];
  }
  for (const template of Object.values(POLICY_TEMPLATES)) {
    if (template.id === keyOrId) return template;
  }
  return undefined;
}

/** Array form for UI rendering — preserves insertion order. */
export const POLICY_TEMPLATE_LIST: readonly (PolicyTemplate & { key: PolicyTemplateKey })[] =
  (Object.keys(POLICY_TEMPLATES) as PolicyTemplateKey[]).map((key) => ({
    key,
    ...POLICY_TEMPLATES[key],
  }));
