import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AlertConfig {
  owner_id: string;
  slack_webhook_url: string | null;
  email_address: string | null;
  webhook_url: string | null;
  alert_on_blocked: boolean;
  alert_on_flagged: boolean;
  alert_on_grade_change: boolean;
  alert_on_identity_breach: boolean;
  updated_at?: string;
}

interface AlertConfigInput {
  owner_id?: string;
  slack_webhook_url?: string | null;
  email_address?: string | null;
  webhook_url?: string | null;
  alert_on_blocked?: boolean;
  alert_on_flagged?: boolean;
  alert_on_grade_change?: boolean;
  alert_on_identity_breach?: boolean;
}

const DEFAULT_CONFIG: Omit<AlertConfig, 'owner_id'> = {
  slack_webhook_url: null,
  email_address: null,
  webhook_url: null,
  alert_on_blocked: true,
  alert_on_flagged: true,
  alert_on_grade_change: true,
  alert_on_identity_breach: true,
};

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export async function GET(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get('owner_id')?.trim();
  if (!ownerId) {
    return NextResponse.json(
      { error: 'owner_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ config: { owner_id: ownerId, ...DEFAULT_CONFIG }, exists: false });
  }

  return NextResponse.json({ config: data as AlertConfig, exists: true });
}

export async function POST(request: NextRequest) {
  let body: AlertConfigInput;
  try {
    body = (await request.json()) as AlertConfigInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = normalizeString(body.owner_id);
  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id is required' }, { status: 400 });
  }

  const slack = normalizeString(body.slack_webhook_url);
  const email = normalizeString(body.email_address);
  const webhook = normalizeString(body.webhook_url);

  if (slack && !isHttpsUrl(slack)) {
    return NextResponse.json(
      { error: 'slack_webhook_url must be an HTTPS URL' },
      { status: 400 },
    );
  }
  if (webhook && !isHttpsUrl(webhook)) {
    return NextResponse.json(
      { error: 'webhook_url must be an HTTPS URL' },
      { status: 400 },
    );
  }
  if (email && !isEmail(email)) {
    return NextResponse.json(
      { error: 'email_address must be a valid email' },
      { status: 400 },
    );
  }

  const record: AlertConfig = {
    owner_id: ownerId,
    slack_webhook_url: slack,
    email_address: email,
    webhook_url: webhook,
    alert_on_blocked: normalizeBool(body.alert_on_blocked, true),
    alert_on_flagged: normalizeBool(body.alert_on_flagged, true),
    alert_on_grade_change: normalizeBool(body.alert_on_grade_change, true),
    alert_on_identity_breach: normalizeBool(body.alert_on_identity_breach, true),
  };

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('alert_configs')
    .upsert(record, { onConflict: 'owner_id' })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data as AlertConfig, saved: true });
}