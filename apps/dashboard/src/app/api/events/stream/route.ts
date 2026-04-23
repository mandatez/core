import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { extractApiKey, validateApiKey } from '@/lib/auth';

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

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get('owner_id')?.trim();
  if (!ownerId) {
    return new Response(
      JSON.stringify({ error: 'owner_id query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Optional API key auth. If provided, its owner must match owner_id.
  const apiKey = extractApiKey(request.headers);
  if (apiKey) {
    const validation = await validateApiKey(apiKey);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: `API key ${validation.reason}` }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (validation.owner_id !== ownerId) {
      return new Response(
        JSON.stringify({ error: 'owner_id does not match API key owner' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const supabase = createServerClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
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
            safeEnqueue(
              formatSse('event', {
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
              }),
            );
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
