import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Long-lived stream. Vercel caps this at plan-specific limits; clients should reconnect.
export const maxDuration = 300;

const HEARTBEAT_MS = 15_000;

interface AgentEventRow {
  id: string;
  agent_id: string;
  owner_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  metadata: Record<string, unknown> | null;
  signature: string;
  public_key: string;
}

function formatSse(event: string, data: unknown, id?: string): string {
  const idLine = id ? `id: ${id}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function toStreamEvent(row: AgentEventRow): {
  event_id: string;
  agent_id: string;
  owner_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  metadata: Record<string, unknown>;
  signature: string;
  public_key: string;
} {
  return {
    event_id: row.id,
    agent_id: row.agent_id,
    owner_id: row.owner_id,
    timestamp: row.timestamp,
    action_type: row.action_type,
    resource: row.resource,
    outcome: row.outcome,
    policy_id: row.policy_id,
    metadata: row.metadata ?? {},
    signature: row.signature,
    public_key: row.public_key,
  };
}

export async function GET(request: NextRequest) {
  const bodyOwnerId = request.nextUrl.searchParams.get('owner_id')?.trim() ?? null;
  const auth = await requireApiKeyAuth(request, { bodyOwnerId });
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  // SSE resume: if the client supplies Last-Event-ID, look up the
  // timestamp of that event so we can replay everything that happened
  // while they were disconnected before joining the live channel.
  const lastEventId = request.headers.get('last-event-id')?.trim() || null;

  const supabase = createServerClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(formatSse('ready', { owner_id: ownerId, timestamp: new Date().toISOString() }));

      // --- Catch-up phase ---------------------------------------------
      // Replay any events with timestamp > last seen event's timestamp.
      if (lastEventId) {
        try {
          const { data: lastRow } = await supabase
            .from('agent_events')
            .select('timestamp')
            .eq('id', lastEventId)
            .eq('owner_id', ownerId)
            .maybeSingle();

          if (lastRow?.timestamp) {
            const { data: missed } = await supabase
              .from('agent_events')
              .select(
                'id, agent_id, owner_id, timestamp, action_type, resource, outcome, policy_id, metadata, signature, public_key',
              )
              .eq('owner_id', ownerId)
              .gt('timestamp', lastRow.timestamp)
              .order('timestamp', { ascending: true })
              .limit(1000);

            for (const row of (missed ?? []) as AgentEventRow[]) {
              safeEnqueue(formatSse('event', toStreamEvent(row), row.id));
            }
          }
        } catch {
          // Catch-up failure must not break the live stream.
        }
      }

      const channel = supabase
        .channel(`agent_events:${ownerId}:${Date.now()}`)
        .on(
          'postgres_changes' as unknown as 'system',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'agent_events',
            filter: `owner_id=eq.${ownerId}`,
          } as Record<string, unknown>,
          (payload: { new: AgentEventRow }) => {
            const row = payload.new;
            safeEnqueue(formatSse('event', toStreamEvent(row), row.id));
          },
        )
        .subscribe();

      // Heartbeat keeps proxies from closing the connection on idle.
      const heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        void supabase.removeChannel(channel);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
