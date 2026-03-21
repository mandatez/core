import { z } from 'zod';

/**
 * Canonical AgentEvent schema — the spine of MandateZ.
 *
 * Every agent action produces one of these. Every surface reads from
 * this same shape. Do not modify without explicit instruction.
 */
export const AgentEventSchema = z.object({
  event_id: z.string().uuid(),
  agent_id: z.string().regex(/^ag_[A-Za-z0-9_-]+$/, 'agent_id must start with ag_ prefix'),
  owner_id: z.string().min(1),
  timestamp: z.string().datetime(),
  action_type: z.enum(['read', 'write', 'export', 'delete', 'call', 'payment']),
  resource: z.string().min(1),
  outcome: z.enum(['allowed', 'blocked', 'flagged', 'pending_approval']),
  policy_id: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  signature: z.string().min(1),
  public_key: z.string().min(1),
});

/** Canonical AgentEvent type — do not rename */
export type AgentEvent = z.infer<typeof AgentEventSchema>;

/** Input type for creating events before signing (no signature/public_key yet) */
export const AgentEventInputSchema = AgentEventSchema.omit({
  event_id: true,
  signature: true,
  public_key: true,
  timestamp: true,
});

export type AgentEventInput = z.infer<typeof AgentEventInputSchema>;
