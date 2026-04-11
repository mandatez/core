#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  generateAgentIdentity,
  createSignedEvent,
  SupabaseTransport,
  PolicyEngine,
  computeTrustScore,
  checkIdentity as hibpCheckIdentity,
} from '@mandatez/sdk';
import type {
  AgentEventInput,
  Policy,
} from '@mandatez/sdk';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OWNER_ID = process.env.MANDATEZ_OWNER_ID ?? 'default-owner';
const HIBP_API_KEY = process.env.HIBP_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY',
  );
  process.exit(1);
}

const transport = new SupabaseTransport({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
});

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'mandatez',
  version: '0.1.1',
});

// ---------------------------------------------------------------------------
// Tool 1 — register_agent
// ---------------------------------------------------------------------------

server.tool(
  'register_agent',
  'Generate an Ed25519 keypair and register a new MandateZ agent. Returns agent_id and private_key.',
  {
    name: z.string().describe('Human-readable agent name'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional metadata to attach to the agent'),
  },
  async ({ name, metadata }) => {
    const identity = await generateAgentIdentity();

    // Insert agent into Supabase agents table
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const { error } = await supabase.from('agents').insert({
      id: identity.agent_id,
      owner_id: OWNER_ID,
      name,
      public_key: identity.public_key,
      metadata: metadata ?? {},
    });

    if (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to register agent: ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              agent_id: identity.agent_id,
              public_key: identity.public_key,
              private_key: identity.private_key,
              name,
              owner_id: OWNER_ID,
              message:
                'Agent registered. Store the private_key securely — it is needed to sign events.',
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 2 — track_event
// ---------------------------------------------------------------------------

server.tool(
  'track_event',
  'Log a cryptographically signed AgentEvent to the MandateZ audit trail.',
  {
    agent_id: z.string().describe('Agent ID (ag_ prefix)'),
    private_key: z.string().describe('Agent Ed25519 private key (base64)'),
    action_type: z
      .enum(['read', 'write', 'export', 'delete', 'call', 'payment'])
      .describe('Type of action the agent performed'),
    resource: z.string().describe('Resource accessed, e.g. "emails", "api/stripe"'),
    outcome: z
      .enum(['allowed', 'blocked', 'flagged', 'pending_approval'])
      .optional()
      .describe('Outcome of the action (defaults to "allowed")'),
    policy_id: z.string().optional().describe('Policy ID that governed this action'),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Additional context about the event'),
  },
  async ({ agent_id, private_key, action_type, resource, outcome, policy_id, metadata }) => {
    const eventInput: AgentEventInput = {
      agent_id,
      owner_id: OWNER_ID,
      action_type,
      resource,
      outcome: outcome ?? 'allowed',
      policy_id: policy_id ?? null,
      metadata: metadata ?? {},
    };

    try {
      const signed = await createSignedEvent(eventInput, private_key);
      const emitted = await transport.emitEvent(signed);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                event_id: emitted.event_id,
                agent_id: emitted.agent_id,
                action_type: emitted.action_type,
                resource: emitted.resource,
                outcome: emitted.outcome,
                timestamp: emitted.timestamp,
                signature: emitted.signature.slice(0, 16) + '...',
                message: 'Event signed and logged successfully.',
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to track event: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 3 — get_trust_profile
// ---------------------------------------------------------------------------

server.tool(
  'get_trust_profile',
  'Compute and return the trust score, grade, and behavioral profile for an agent.',
  {
    agent_id: z.string().describe('Agent ID (ag_ prefix)'),
  },
  async ({ agent_id }) => {
    try {
      const events = await transport.fetchAgentEvents(agent_id);
      const profile = computeTrustScore(events);

      // Persist updated trust profile
      await transport.updateAgentTrust(agent_id, profile).catch(() => {});

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                agent_id,
                ...profile,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to get trust profile: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 4 — check_policy
// ---------------------------------------------------------------------------

server.tool(
  'check_policy',
  'Evaluate an action against policy rules and return whether it is allowed, blocked, or flagged.',
  {
    action_type: z
      .enum(['read', 'write', 'export', 'delete', 'call', 'payment'])
      .describe('Action type to evaluate'),
    resource: z.string().describe('Resource to check, e.g. "api/stripe"'),
    policies: z
      .array(
        z.object({
          id: z.string(),
          owner_id: z.string(),
          name: z.string(),
          rules: z.array(
            z.object({
              id: z.string(),
              action_types: z.array(z.string()),
              resource_pattern: z.string(),
              effect: z.enum(['allow', 'block', 'flag']),
            }),
          ),
        }),
      )
      .describe('Array of policy objects with rules to evaluate against'),
  },
  async ({ action_type, resource, policies }) => {
    const engine = new PolicyEngine();

    for (const policy of policies) {
      engine.addPolicy(policy as Policy);
    }

    const result = engine.evaluate(action_type, resource);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              action_type,
              resource,
              outcome: result.outcome,
              matched_rule: result.matched_rule,
              policy_id: result.policy_id,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Tool 5 — get_audit_trail
// ---------------------------------------------------------------------------

server.tool(
  'get_audit_trail',
  'Retrieve the last N events from an agent\'s audit trail.',
  {
    agent_id: z.string().describe('Agent ID (ag_ prefix)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('Number of events to return (default 50, max 1000)'),
  },
  async ({ agent_id, limit }) => {
    try {
      const events = await transport.fetchAgentEvents(agent_id);
      const n = limit ?? 50;
      const recent = events.slice(-n);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                agent_id,
                total_events: events.length,
                returned: recent.length,
                events: recent.map((e) => ({
                  event_id: e.event_id,
                  action_type: e.action_type,
                  resource: e.resource,
                  outcome: e.outcome,
                  timestamp: e.timestamp,
                  policy_id: e.policy_id,
                  metadata: e.metadata,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to get audit trail: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Tool 6 — check_identity
// ---------------------------------------------------------------------------

server.tool(
  'check_identity',
  'Check if an email has been involved in known data breaches before allowing agent access. Uses HaveIBeenPwned.',
  {
    email: z.string().email().describe('Email address to check against HIBP'),
    agent_id: z.string().describe('Agent ID that is about to interact with this identity'),
    on_flagged: z
      .enum(['restrict', 'block', 'allow'])
      .optional()
      .describe('What to do if the identity is flagged (default: restrict)'),
  },
  async ({ email, agent_id, on_flagged }) => {
    if (!HIBP_API_KEY) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'HIBP_API_KEY environment variable is not set. Set it to enable identity checks.',
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await hibpCheckIdentity(email, HIBP_API_KEY);

      // Persist to identity_checks via transport (fire-and-forget-ish)
      await transport
        .insertIdentityCheck({
          ownerId: OWNER_ID,
          agentId: agent_id,
          email,
          result,
        })
        .catch(() => {});

      const onFlagged = on_flagged ?? 'restrict';
      let recommendation: 'allow' | 'restrict' | 'block';
      if (result.status === 'blocked') recommendation = 'block';
      else if (result.status === 'flagged') recommendation = onFlagged;
      else recommendation = 'allow';

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                email,
                agent_id,
                status: result.status,
                risk_score: result.risk_score,
                breach_count: result.breach_count,
                breaches: result.breaches.map((b) => b.name),
                recommendation,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Identity check failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
