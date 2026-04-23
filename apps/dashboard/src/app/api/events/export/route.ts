import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_OUTCOMES = ['allowed', 'blocked', 'flagged', 'pending_approval'] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

const CSV_COLUMNS = [
  'event_id',
  'agent_id',
  'agent_name',
  'timestamp',
  'action_type',
  'resource',
  'outcome',
  'policy_id',
  'signature',
  'public_key',
] as const;

interface EventRow {
  id: string;
  agent_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  signature: string;
  public_key: string;
}

interface AgentRow {
  id: string;
  name: string | null;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // RFC 4180: quote when the cell contains a comma, quote, CR, or LF.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseDate(value: string | null, fallback: Date): Date | null {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const params = request.nextUrl.searchParams;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDate(params.get('from'), thirtyDaysAgo);
  const to = parseDate(params.get('to'), now);
  if (!from || !to) {
    return NextResponse.json(
      { error: 'from and to must be valid ISO dates' },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: 'from must be before to' },
      { status: 400 },
    );
  }

  const agentId = params.get('agent_id')?.trim() || null;
  const outcomeParam = params.get('outcome')?.trim() || null;
  if (outcomeParam && !VALID_OUTCOMES.includes(outcomeParam as Outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` },
      { status: 400 },
    );
  }
  const outcome = outcomeParam as Outcome | null;

  const format = (params.get('format')?.trim() || 'csv').toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: "format must be 'csv' or 'json'" },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  let query = supabase
    .from('agent_events')
    .select('id, agent_id, timestamp, action_type, resource, outcome, policy_id, signature, public_key')
    .eq('owner_id', ownerId)
    .gte('timestamp', from.toISOString())
    .lte('timestamp', to.toISOString())
    .order('timestamp', { ascending: false });

  if (agentId) query = query.eq('agent_id', agentId);
  if (outcome) query = query.eq('outcome', outcome);

  const { data: events, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (events ?? []) as EventRow[];

  // Join in agent names in a single query, keyed by id.
  const agentIds = Array.from(new Set(rows.map((r) => r.agent_id)));
  const agentNameById: Record<string, string> = {};
  if (agentIds.length > 0) {
    const { data: agents, error: agentErr } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds);
    if (agentErr) {
      return NextResponse.json({ error: agentErr.message }, { status: 500 });
    }
    for (const a of (agents ?? []) as AgentRow[]) {
      agentNameById[a.id] = a.name ?? '';
    }
  }

  const fromStamp = from.toISOString().slice(0, 10);
  const toStamp = to.toISOString().slice(0, 10);
  const filenameBase = `mandatez-events-${fromStamp}-to-${toStamp}`;

  if (format === 'json') {
    const payload = rows.map((r) => ({
      event_id: r.id,
      agent_id: r.agent_id,
      agent_name: agentNameById[r.agent_id] ?? '',
      timestamp: r.timestamp,
      action_type: r.action_type,
      resource: r.resource,
      outcome: r.outcome,
      policy_id: r.policy_id,
      signature: r.signature,
      public_key: r.public_key,
    }));
    return new NextResponse(JSON.stringify({ count: payload.length, events: payload }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filenameBase}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const lines: string[] = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.agent_id,
        agentNameById[r.agent_id] ?? '',
        r.timestamp,
        r.action_type,
        r.resource,
        r.outcome,
        r.policy_id ?? '',
        r.signature,
        r.public_key,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  // Prepend UTF-8 BOM so Excel auto-detects encoding.
  const csv = '﻿' + lines.join('\r\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
