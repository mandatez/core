import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  computeNextSendAt,
  type Frequency,
  type ReportType,
} from '@/lib/schedule-dates';
import {
  assembleReportData,
  generateCompliancePdf,
  type AgentSummary,
  type EventRow,
} from '@/lib/pdf-generator';
import { sendComplianceReport, type EmailReportType } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// TODO: Add RESEND_API_KEY to Vercel environment variables.
// Get a free API key at resend.com (3000 emails/month free).
// Works with any domain internationally.

const PERIOD_DAYS = 90;

interface DueSchedule {
  id: string;
  owner_id: string;
  email: string;
  report_types: ReportType[];
  frequency: Frequency;
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. The secret MUST be
// configured in every environment — fail closed if it is missing so a
// misconfigured deployment cannot expose the cron endpoint to the public.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function formatPeriod(fromDate: Date, toDate: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const from = fromDate.toLocaleDateString('en-US', opts);
  const to = toDate.toLocaleDateString('en-US', opts);
  return `${from} to ${to}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const periodStart = new Date(now.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const periodLabel = formatPeriod(periodStart, now);

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
  let reportsEmailed = 0;
  const errors: Array<{ schedule_id: string; report_type?: string; message: string }> = [];

  for (const schedule of schedules) {
    // Fetch agents + events once per owner, reuse across all report_types
    const [agentsResult, eventsResult] = await Promise.all([
      supabase
        .from('agents')
        .select('id, name, trust_score, trust_grade, total_events, allowed_ratio')
        .eq('owner_id', schedule.owner_id),
      supabase
        .from('agent_events')
        .select('*')
        .eq('owner_id', schedule.owner_id)
        .gte('timestamp', periodStart.toISOString())
        .order('timestamp', { ascending: false }),
    ]);

    if (agentsResult.error) {
      errors.push({ schedule_id: schedule.id, message: `agents: ${agentsResult.error.message}` });
      continue;
    }
    if (eventsResult.error) {
      errors.push({ schedule_id: schedule.id, message: `events: ${eventsResult.error.message}` });
      continue;
    }

    const agents = (agentsResult.data ?? []) as AgentSummary[];
    const events = (eventsResult.data ?? []) as EventRow[];

    for (const reportType of schedule.report_types) {
      // Insert the generated_reports row first so we always have a record
      const { data: reportRow, error: insertError } = await supabase
        .from('generated_reports')
        .insert({
          schedule_id: schedule.id,
          owner_id: schedule.owner_id,
          report_type: reportType,
          email: schedule.email,
          status: 'pending_email',
        })
        .select('id')
        .single();

      if (insertError) {
        errors.push({
          schedule_id: schedule.id,
          report_type: reportType,
          message: insertError.message,
        });
        continue;
      }

      reportsGenerated += 1;

      // Generate PDF bytes
      let pdfBytes: Uint8Array;
      try {
        const report = assembleReportData(
          schedule.owner_id,
          reportType,
          agents,
          events,
          PERIOD_DAYS,
        );
        pdfBytes = generateCompliancePdf(report);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'PDF generation failed';
        errors.push({ schedule_id: schedule.id, report_type: reportType, message });
        await supabase
          .from('generated_reports')
          .update({ status: 'failed' })
          .eq('id', reportRow.id);
        continue;
      }

      // Send email via Resend
      const result = await sendComplianceReport({
        to: schedule.email,
        ownerId: schedule.owner_id,
        reportType: reportType as EmailReportType,
        pdfBuffer: pdfBytes,
        period: periodLabel,
      });

      if (result.ok) {
        reportsEmailed += 1;
        await supabase
          .from('generated_reports')
          .update({ status: 'emailed' })
          .eq('id', reportRow.id);
      } else {
        errors.push({
          schedule_id: schedule.id,
          report_type: reportType,
          message: result.error ?? 'Email send failed',
        });
        await supabase
          .from('generated_reports')
          .update({ status: 'failed' })
          .eq('id', reportRow.id);
      }
    }

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
    reports_emailed: reportsEmailed,
    errors,
  });
}

// Allow GET so Vercel's cron dashboard / manual browser hits work in dev.
// Cron itself uses POST with the Bearer token.
export async function GET(request: NextRequest) {
  return POST(request);
}
