import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { extractApiKey, validateApiKey } from '@/lib/auth';
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
  reason: 'schema_invalid' | 'signature_invalid' | 'owner_mismatch';
  detail?: string;
}

export async function POST(request: NextRequest) {
  let body: BatchRequest;
  try {
    body = (await request.json()) as BatchRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Auth: prefer API key; fall back to owner_id in body.
  const apiKey = extractApiKey(request.headers);
  let authorizedOwnerId: string | null = null;

  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `API key ${validation.reason}` },
        { status: 401 },
      );
    }
    authorizedOwnerId = validation.owner_id;
  }

  const bodyOwnerId = body.owner_id?.trim();
  const ownerId = authorizedOwnerId ?? bodyOwnerId;

  if (!ownerId) {
    return NextResponse.json(
      { error: 'owner_id is required (pass in body or authenticate with API key)' },
      { status: 401 },
    );
  }

  // If both provided, they must match — prevents cross-tenant inserts.
  if (authorizedOwnerId && bodyOwnerId && authorizedOwnerId !== bodyOwnerId) {
    return NextResponse.json(
      { error: 'owner_id in body does not match API key owner' },
      { status: 403 },
    );
  }

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

  // Validate schema + signatures before any database write.
  const errors: EventError[] = [];
  const validated: AgentEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    const parsed = AgentEventSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({
        index: i,
        reason: 'schema_invalid',
        detail: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
      });
      continue;
    }

    const event = parsed.data;

    if (event.owner_id !== ownerId) {
      errors.push({
        index: i,
        event_id: event.event_id,
        reason: 'owner_mismatch',
        detail: `event owner_id "${event.owner_id}" does not match authorized owner "${ownerId}"`,
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

  const supabase = createServerClient();
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

  const { error: insertError } = await supabase.from('agent_events').insert(rows);

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
