import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { createSignedEvent, generateAgentIdentity } from '@mandatez/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGENT_ID_RE = /^ag_[A-Za-z0-9_-]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> },
) {
  const { agent_id } = await params;

  if (!AGENT_ID_RE.test(agent_id)) {
    return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
  }

  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();

  const { data: agent, error: fetchErr } = await supabase
    .from('agents')
    .select('id, owner_id, public_key, metadata')
    .eq('id', agent_id)
    .single();

  // Return 404 on mismatch so we do not leak whether an agent_id exists
  // across tenants.
  if (fetchErr || !agent || agent.owner_id !== auth.ownerId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const existingMeta = (agent.metadata ?? {}) as Record<string, unknown>;
  if (existingMeta.revoked === true) {
    return NextResponse.json(
      { error: 'Agent is already revoked', agent_id, revoked_at: existingMeta.revoked_at },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const revokedPublicKey = `REVOKED_${Date.now()}`;

  const { error: updateErr } = await supabase
    .from('agents')
    .update({
      public_key: revokedPublicKey,
      metadata: {
        ...existingMeta,
        revoked: true,
        revoked_at: nowIso,
        previous_public_key: agent.public_key,
      },
    })
    .eq('id', agent_id);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to revoke agent: ${updateErr.message}` },
      { status: 500 },
    );
  }

  // Sign a system audit event for the revocation itself. We generate a
  // throwaway keypair so the event is cryptographically self-verifying,
  // but its public_key will not match the agent's stored public_key —
  // that mismatch is exactly the "new events fail verification" property.
  try {
    const systemKeys = await generateAgentIdentity();
    const event = await createSignedEvent(
      {
        agent_id,
        owner_id: agent.owner_id,
        action_type: 'delete',
        resource: `agent/${agent_id}`,
        outcome: 'allowed',
        policy_id: null,
        metadata: {
          reason: 'manual_revocation',
          system_action: true,
          revoked_by: 'dashboard',
        },
      },
      systemKeys.private_key,
    );

    await supabase.from('agent_events').insert({
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
    });
  } catch (err) {
    // Revocation itself succeeded — log but do not fail the request.
    console.error('Failed to emit revocation audit event:', err);
  }

  return NextResponse.json({
    revoked: true,
    agent_id,
    revoked_at: nowIso,
  });
}
