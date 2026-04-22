import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  computeNextSendAt,
  REPORT_TYPES,
  type Frequency,
  type ReportType,
} from '@/lib/schedule-dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ReportSchedule {
  id: string;
  owner_id: string;
  email: string;
  report_types: ReportType[];
  frequency: Frequency;
  next_send_at: string;
  last_sent_at: string | null;
  active: boolean;
  created_at: string;
}

interface ScheduleInput {
  owner_id?: string;
  email?: string;
  report_types?: string[];
  frequency?: string;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeReportTypes(raw: unknown): ReportType[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ReportType[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    if (!REPORT_TYPES.includes(item as ReportType)) return null;
    if (!out.includes(item as ReportType)) out.push(item as ReportType);
  }
  return out;
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
    .from('report_schedules')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    schedule: (data as ReportSchedule | null) ?? null,
    exists: Boolean(data),
  });
}

export async function POST(request: NextRequest) {
  let body: ScheduleInput;
  try {
    body = (await request.json()) as ScheduleInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = body.owner_id?.trim();
  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id is required' }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: 'email must be a valid email address' },
      { status: 400 },
    );
  }

  const reportTypes = normalizeReportTypes(body.report_types);
  if (!reportTypes) {
    return NextResponse.json(
      {
        error: `report_types must be a non-empty array of: ${REPORT_TYPES.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const frequency = body.frequency as Frequency | undefined;
  if (frequency !== 'monthly' && frequency !== 'quarterly') {
    return NextResponse.json(
      { error: "frequency must be 'monthly' or 'quarterly'" },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const nextSendAt = computeNextSendAt(frequency).toISOString();

  // Deactivate any existing active schedule for this owner, then insert fresh.
  // One active schedule per owner is the intended UX.
  const { error: deactivateError } = await supabase
    .from('report_schedules')
    .update({ active: false })
    .eq('owner_id', ownerId)
    .eq('active', true);

  if (deactivateError) {
    return NextResponse.json({ error: deactivateError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('report_schedules')
    .insert({
      owner_id: ownerId,
      email,
      report_types: reportTypes,
      frequency,
      next_send_at: nextSendAt,
      active: true,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: data as ReportSchedule, saved: true });
}

export async function DELETE(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get('owner_id')?.trim();
  if (!ownerId) {
    return NextResponse.json(
      { error: 'owner_id query parameter is required' },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('report_schedules')
    .update({ active: false })
    .eq('owner_id', ownerId)
    .eq('active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true });
}