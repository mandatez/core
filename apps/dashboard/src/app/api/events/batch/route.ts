import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { AgentEventSchema, verifyEvent, type AgentEvent } from '@mandatez/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_REQUEST = 1000;

interface BatchRequest {
  owner_id?: string;
  events?: unknown[];
}

interface EventError {
  index: number;
  event_id?: string;
  reason:
    | 'schema_invalid'
    | 'signature_invalid'
    | 'owner_mismatch'
    | 'agent_unknown'
    | 'public_key_mismatch';
  detail?: string;
}

export async function POST(request: NextRequest) {
  let body: BatchRequest;
  try {
    body = (await request.json()) as BatchRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request, { bodyOwnerId: body.owner_id?.trim() ?? null });
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const events = body.events;
  if (!Array.isArray(events)) {
    return NextResponse.json(
      { error: 'events must be an array of signed AgentEvent objects' },
      { status: 400 },
    );
  }
  if (events.length === 0) {
    return NextResponse.json({ accepted: 0, rejected: 0, errors: [] });
  }
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return NextResponse.json(
      {
        error: `Batch size ${events.length} exceeds limit of ${MAX_EVENTS_PER_REQUEST} events per request`,
      },
      { status: 413 },
    );
  }

  // Validate schema first so we have a parsed event_id and agent_id to
  // resolve the registered keys against. Schema-invalid rows are
  // recorded and skipped at this stage.
  const errors: EventError[] = [];
  const parsedEvents: Array<{ index: number; event: AgentEvent }> = [];

  for (let i = 0; i < events.length; i++) {
    const parsed = AgentEventSchema.safeParse(events[i]);
    if (!parsed.success) {
      errors.push({
        index: i,
        reason: 'schema_invalid',
        detail: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
      });
      continue;
    }
    parsedEvents.push({ index: i, event: parsed.data });
  }

  // Resolve each distinct agent_id's registered public_key. The event's
  // embedded public_key must match the one on the agents row, otherwise
  // anyone with an API key could mint events under a fresh keypair and
  // pin them to an existing agent (SCHEMA_AUDIT.md P0-4).
  const agentIds = Array.from(new Set(parsedEvents.map((p) => p.event.agent_id)));
  const registeredKeys = new Map<string, { owner_id: string; public_key: string }>();

  if (agentIds.length > 0) {
    const supabase = createServerClient();
    const { data: agentRows, error: agentLoadErr } = await supabase
      .from('agents')
      .select('id, owner_id, public_key')
      .in('id', agentIds);

    if (agentLoadErr) {
      return NextResponse.json(
        { error: `Failed to load agent identities: ${agentLoadErr.message}` },
        { status: 500 },
      );
    }

    for (const row of (agentRows ?? []) as Array<{
      id: string;
      owner_id: string;
      public_key: string;
    }>) {
      registeredKeys.set(row.id, { owner_id: row.owner_id, public_key: row.public_key });
    }
  }

  const validated: AgentEvent[] = [];

  for (const { index: i, event } of parsedEvents) {
    if (event.owner_id !== ownerId) {
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'owner_mismatch',
        detail: `event owner_id "${event.owner_id}" does not match authorized owner "${ownerId}"`,
      });
      continue;
    }

    const registered = registeredKeys.get(event.agent_id);
    if (!registered) {
      // Hide existence from cross-tenant probes — the agent either does
      // not exist or belongs to another owner. In both cases the caller
      // is not allowed to write for that agent_id.
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'agent_unknown',
        detail: `agent_id "${event.agent_id}" is not registered to this owner`,
      });
      continue;
    }
    if (registered.owner_id !== ownerId) {
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'agent_unknown',
        detail: `agent_id "${event.agent_id}" is not registered to this owner`,
      });
      continue;
    }
    if (event.public_key !== registered.public_key) {
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'public_key_mismatch',
        detail: 'event public_key does not match the agent\'s registered public_key',
      });
      continue;
    }

    const signatureValid = await verifyEvent(event);
    if (!signatureValid) {
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'signature_invalid',
      });
      continue;
    }

    validated.push(event);
  }

  // Reject the whole batch if any signature or schema check failed.
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: 'Batch contains invalid events — no events were inserted',
        accepted: 0,
        rejected: events.length,
        errors,
      },
      { status: 400 },
    );
  }

  // Reuse the supabase client from the identity-resolution step if we
  // opened one; otherwise create now. Either way, service-role is fine
  // because the batch has already been authorized owner-by-owner above.
  const insertClient = createServerClient();
  const rows = validated.map((event) => ({
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
  }));

  const { error: insertError } = await insertClient.from('agent_events').insert(rows);

  if (insertError) {
    return NextResponse.json(
      { error: `Bulk insert failed: ${insertError.message}`, accepted: 0, rejected: rows.length, errors: [] },
      { status: 500 },
    );
  }

  return NextResponse.json({
    accepted: rows.length,
    rejected: 0,
    errors: [],
  });
}
