import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { randomUUID, sign, createPublicKey, createPrivateKey } from 'node:crypto';

// ── Inlined policy engine ───────────────────────────────────────────────

interface PolicyRule {
  id: string;
  action_types: string[];
  resource_pattern: string;
  effect: 'allow' | 'block' | 'flag';
}

interface PolicyEvaluation {
  outcome: 'allowed' | 'blocked' | 'flagged';
  matched_rule: PolicyRule | null;
  policy_id: string | null;
}

function matchResource(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  const pp = pattern.split('/');
  const rp = resource.split('/');
  let pi = 0;
  let ri = 0;
  while (pi < pp.length && ri < rp.length) {
    if (pp[pi] === '**') return true;
    if (pp[pi] === '*' || pp[pi] === rp[ri]) { pi++; ri++; }
    else return false;
  }
  return pi === pp.length && ri === rp.length;
}

function evaluatePolicy(
  rules: PolicyRule[],
  actionType: string,
  resource: string,
): PolicyEvaluation {
  for (const rule of rules) {
    const actionMatch = rule.action_types.includes('*') || rule.action_types.includes(actionType);
    if (actionMatch && matchResource(rule.resource_pattern, resource)) {
      const effectMap: Record<string, 'allowed' | 'blocked' | 'flagged'> = {
        allow: 'allowed', block: 'blocked', flag: 'flagged',
      };
      return {
        outcome: effectMap[rule.effect] ?? 'allowed',
        matched_rule: rule,
        policy_id: rule.id,
      };
    }
  }
  return { outcome: 'allowed', matched_rule: null, policy_id: null };
}

// ── Inlined event signing (Node.js native Ed25519) ─────────────────────

function createSignedEvent(
  input: {
    agent_id: string;
    owner_id: string;
    action_type: string;
    resource: string;
    outcome: string;
    policy_id: string | null;
    metadata: Record<string, unknown>;
  },
  privateKeyBase64: string,
) {
  const secretKeyBuf = Buffer.from(privateKeyBase64, 'base64');

  // libsodium Ed25519 secret key is 64 bytes: first 32 = seed, last 32 = public key
  const publicKeyBuf = secretKeyBuf.subarray(32, 64);
  const publicKeyB64 = publicKeyBuf.toString('base64');

  // Build the private key in PKCS8 DER for Node.js crypto
  // Ed25519 PKCS8 prefix (16 bytes) + 34 bytes (04 20 + 32-byte seed)
  const seed = secretKeyBuf.subarray(0, 32);
  const pkcs8Prefix = Buffer.from(
    '302e020100300506032b657004220420',
    'hex',
  );
  const pkcs8Der = Buffer.concat([pkcs8Prefix, seed]);
  const privateKeyObj = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });

  const unsigned = {
    event_id: randomUUID(),
    agent_id: input.agent_id,
    owner_id: input.owner_id,
    timestamp: new Date().toISOString(),
    action_type: input.action_type,
    resource: input.resource,
    outcome: input.outcome,
    policy_id: input.policy_id,
    metadata: input.metadata,
    public_key: publicKeyB64,
  };

  // Canonical JSON: keys sorted alphabetically
  const payload = JSON.stringify(unsigned, Object.keys(unsigned).sort());
  const sig = sign(null, Buffer.from(payload, 'utf-8'), privateKeyObj);

  return { ...unsigned, signature: sig.toString('base64') };
}

// ── Inlined Supabase REST insert ────────────────────────────────────────

async function emitEvent(
  event: Record<string, unknown>,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/agent_events`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: event.event_id,
      agent_id: event.agent_id,
      owner_id: event.owner_id,
      timestamp: event.timestamp,
      action_type: event.action_type,
      resource: event.resource,
      outcome: event.outcome,
      policy_id: event.policy_id,
      metadata: event.metadata,
      signature: event.signature,
      public_key: event.public_key,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase insert failed (${res.status}): ${body}`);
  }
}

// ── Node class ──────────────────────────────────────────────────────────

export class MandateZ implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MandateZ',
    name: 'mandateZ',
    icon: 'file:mandatez.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["mode"]}}',
    description:
      'Cryptographic audit trail and policy enforcement for n8n agents',
    defaults: {
      name: 'MandateZ',
    },
    inputs: ['main'],
    outputs: ['main'],
    usableAsTool: true,
    credentials: [
      {
        name: 'mandateZApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Mode',
        name: 'mode',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Audit',
            value: 'audit',
            description:
              'Log a cryptographically signed event for this workflow execution',
          },
          {
            name: 'Policy Check',
            value: 'policyCheck',
            description:
              'Check action against a policy before execution and return the outcome',
          },
        ],
        default: 'audit',
        description: 'Whether to audit-log or policy-check this action',
      },
      {
        displayName: 'Agent ID',
        name: 'agent_id',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'ag_xxxxxxxxxxxxxxxxxxxxx',
        description: 'The MandateZ agent ID (ag_ prefix)',
      },
      {
        displayName: 'Agent Private Key',
        name: 'agent_private_key',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        required: true,
        description:
          'The Ed25519 private key for this agent (base64-encoded). Keep this secret.',
      },
      {
        displayName: 'Action Type',
        name: 'action_type',
        type: 'options',
        options: [
          { name: 'Read', value: 'read' },
          { name: 'Write', value: 'write' },
          { name: 'Export', value: 'export' },
          { name: 'Delete', value: 'delete' },
          { name: 'Call', value: 'call' },
          { name: 'Payment', value: 'payment' },
        ],
        default: 'call',
        required: true,
        description: 'The type of action being performed',
      },
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'emails, api/stripe, database',
        description: 'The resource being accessed',
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '{}',
        description: 'Additional context as JSON (workflow ID, node name, etc.)',
      },
      {
        displayName: 'Policy Rules (JSON)',
        name: 'policy_rules',
        type: 'json',
        default: '[]',
        displayOptions: {
          show: {
            mode: ['policyCheck'],
          },
        },
        description:
          'Array of policy rules. Each rule: { "id": "rule-1", "action_types": ["export"], "resource_pattern": "*", "effect": "block" }',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('mandateZApi');

    const mode = this.getNodeParameter('mode', 0) as string;
    const agentId = this.getNodeParameter('agent_id', 0) as string;
    const privateKey = this.getNodeParameter('agent_private_key', 0) as string;
    const supabaseUrl = credentials.supabase_url as string;
    const supabaseAnonKey = credentials.supabase_anon_key as string;
    const ownerId = credentials.mandatez_owner_id as string;

    for (let i = 0; i < items.length; i++) {
      const actionType = this.getNodeParameter('action_type', i) as string;
      const resource = this.getNodeParameter('resource', i) as string;
      const metadataRaw = this.getNodeParameter('metadata', i) as string;
      const metadata =
        typeof metadataRaw === 'string'
          ? JSON.parse(metadataRaw || '{}')
          : metadataRaw;

      let outcome: string = 'allowed';
      let policyId: string | null = null;
      let matchedRule: PolicyRule | null = null;

      if (mode === 'policyCheck') {
        const policyRulesRaw = this.getNodeParameter('policy_rules', i) as string;
        const policyRules: PolicyRule[] =
          typeof policyRulesRaw === 'string'
            ? JSON.parse(policyRulesRaw || '[]')
            : policyRulesRaw;

        const evaluation = evaluatePolicy(policyRules, actionType, resource);
        outcome = evaluation.outcome;
        policyId = evaluation.policy_id;
        matchedRule = evaluation.matched_rule;
      }

      const eventMetadata = mode === 'policyCheck'
        ? { ...metadata, n8n_mode: 'policyCheck', matched_rule_id: matchedRule?.id ?? null }
        : { ...metadata, n8n_mode: 'audit', n8n_workflow_execution: true };

      const event = createSignedEvent(
        {
          agent_id: agentId,
          owner_id: ownerId,
          action_type: actionType,
          resource,
          outcome,
          policy_id: policyId,
          metadata: eventMetadata,
        },
        privateKey,
      );

      await emitEvent(event, supabaseUrl, supabaseAnonKey);

      const result: IDataObject = {
        event_id: event.event_id,
        outcome: event.outcome,
        signature: event.signature,
        timestamp: event.timestamp,
        action_type: event.action_type,
        resource: event.resource,
      };

      if (mode === 'policyCheck') {
        result.policy_id = event.policy_id;
        result.matched_rule = matchedRule;
      }

      returnData.push({ json: result });
    }

    return [returnData];
  }
}
