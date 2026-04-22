import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  computeNextSendAt,
  type Frequency,
  type ReportType,
} from '@/lib/schedule-dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DueSchedule {
  id: string;
  owner_id: string;
  email: string;
  report_types: ReportType[];
  frequency: Frequency;
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. If the secret is
// set we enforce it. If not (local dev, manual trigger), we allow — callers
// already need SUPABASE_SERVICE_ROLE_KEY in env to reach the DB.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: due, error } = await supabase
    .from('report_schedules')
    .select('id, owner_id, email, report_types, frequency')
    .eq('active', true)
    .lte('next_send_at', nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const schedules = (due ?? []) as DueSchedule[];
  let reportsGenerated = 0;
  const errors: Array<{ schedule_id: string; message: string }> = [];

  for (const schedule of schedules) {
    const rows = schedule.report_types.map((reportType) => ({
      schedule_id: schedule.id,
      owner_id: schedule.owner_id,
      report_type: reportType,
      email: schedule.email,
      status: 'pending_email' as const,
    }));

    const { error: insertError } = await supabase
      .from('generated_reports')
      .insert(rows);

    if (insertError) {
      errors.push({ schedule_id: schedule.id, message: insertError.message });
      continue;
    }

    // TODO: integrate transactional email provider (Resend / Postmark /
    // SES). Each generated_reports row should be picked up by that worker,
    // which calls /api/reports/generate with { owner_id, report_type },
    // attaches the PDF, sends to schedule.email, and flips status='emailed'.
    console.log(
      `[schedules/trigger] Would email ${schedule.report_types.join(', ')} ` +
        `report(s) to ${schedule.email} for owner ${schedule.owner_id}`,
    );

    reportsGenerated += rows.length;

    const nextSendAt = computeNextSendAt(schedule.frequency, now).toISOString();
    const { error: updateError } = await supabase
      .from('report_schedules')
      .update({ last_sent_at: nowIso, next_send_at: nextSendAt })
      .eq('id', schedule.id);

    if (updateError) {
      errors.push({ schedule_id: schedule.id, message: updateError.message });
    }
  }

  return NextResponse.json({
    processed: schedules.length,
    reports_generated: reportsGenerated,
    errors,
  });
}

// Allow GET so Vercel's cron dashboard / manual browser hits work in dev.
// Cron itself uses POST with the Bearer token.
export async function GET(request: NextRequest) {
  return POST(request);
}