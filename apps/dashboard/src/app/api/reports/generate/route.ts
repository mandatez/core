import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  assembleReportData,
  generateCompliancePdf,
  type AgentSummary,
  type EventRow,
  type ReportType,
} from '@/lib/pdf-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VALID_REPORT_TYPES: ReportType[] = ['owasp', 'hipaa', 'eu-ai-act'];
const PERIOD_DAYS = 90;

export async function POST(request: NextRequest) {
  let body: { owner_id?: string; report_type?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = body.owner_id?.trim();
  const reportType = body.report_type as ReportType | undefined;
  const format = body.format ?? 'pdf';

  if (!ownerId) {
    return NextResponse.json({ error: 'owner_id is required' }, { status: 400 });
  }
  if (!reportType || !VALID_REPORT_TYPES.includes(reportType)) {
    return NextResponse.json(
      { error: `report_type must be one of: ${VALID_REPORT_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Parallel fetch: agents + events
  const [agentsResult, eventsResult] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name, trust_score, trust_grade, total_events, allowed_ratio')
      .eq('owner_id', ownerId),
    supabase
      .from('agent_events')
      .select('*')
      .eq('owner_id', ownerId)
      .gte('timestamp', periodStart)
      .order('timestamp', { ascending: false }),
  ]);

  if (agentsResult.error) {
    return NextResponse.json({ error: `Failed to fetch agents: ${agentsResult.error.message}` }, { status: 500 });
  }
  if (eventsResult.error) {
    return NextResponse.json({ error: `Failed to fetch events: ${eventsResult.error.message}` }, { status: 500 });
  }

  const agents = (agentsResult.data ?? []) as AgentSummary[];
  const events = (eventsResult.data ?? []) as EventRow[];

  const report = assembleReportData(ownerId, reportType, agents, events, PERIOD_DAYS);

  if (format === 'json') {
    return NextResponse.json(report);
  }

  const pdfBytes = generateCompliancePdf(report);
  const filename = `mandatez-${reportType}-report-${Date.now()}.pdf`;

  return new NextResponse(pdfBytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
