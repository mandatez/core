import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireApiKeyAuth } from '@/lib/require-auth';
import { generateComplianceReport } from '@/lib/report-generator';

export async function GET(request: NextRequest) {
  const auth = await requireApiKeyAuth(request);
  if (!auth.ok) return auth.response;
  const ownerId = auth.ownerId;

  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') ?? 'json';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = createServerClient();

  let query = supabase
    .from('agent_events')
    .select('*')
    .eq('owner_id', ownerId)
    .order('timestamp', { ascending: true });

  if (from) query = query.gte('timestamp', from);
  if (to) query = query.lte('timestamp', to);

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const report = generateComplianceReport(ownerId, events ?? [], { from, to });

  if (format === 'pdf') {
    const pdfBuffer = renderReportToPdf(report);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mandatez-report-${ownerId}-${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json(report);
}

/**
 * Renders a compliance report to a basic PDF.
 * Uses raw PDF construction to avoid heavy dependencies.
 */
function renderReportToPdf(report: ReturnType<typeof generateComplianceReport>): Buffer {
  const lines: string[] = [];

  lines.push('MandateZ Compliance Report');
  lines.push('');
  lines.push(`Owner: ${report.owner_id}`);
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`Period: ${report.period.from ?? 'all'} to ${report.period.to ?? 'now'}`);
  lines.push('');
  lines.push('--- Summary ---');
  lines.push(`Total Events: ${report.summary.total_events}`);
  lines.push(`Allowed: ${report.summary.by_outcome.allowed}`);
  lines.push(`Blocked: ${report.summary.by_outcome.blocked}`);
  lines.push(`Flagged: ${report.summary.by_outcome.flagged}`);
  lines.push(`Pending: ${report.summary.by_outcome.pending_approval}`);
  lines.push('');
  lines.push('--- Actions by Type ---');
  for (const [type, count] of Object.entries(report.summary.by_action_type)) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push('');
  lines.push('--- Top Resources ---');
  for (const { resource, count } of report.summary.top_resources) {
    lines.push(`  ${resource}: ${count}`);
  }
  lines.push('');
  lines.push(`--- Event Log (${report.events.length} events) ---`);
  for (const event of report.events.slice(0, 100)) {
    lines.push(
      `  [${event.timestamp}] ${event.action_type} ${event.resource} → ${event.outcome}`,
    );
  }
  if (report.events.length > 100) {
    lines.push(`  ... and ${report.events.length - 100} more events`);
  }

  const text = lines.join('\n');

  // Minimal valid PDF with embedded text
  const textLines = text.split('\n');
  const streamContent = textLines
    .map((line, i) => `BT /F1 10 Tf 50 ${750 - i * 14} Td (${escapePdf(line)}) Tj ET`)
    .join('\n');

  const stream = `stream\n${streamContent}\nendstream`;
  const streamLength = streamContent.length;

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${Math.max(800, textLines.length * 14 + 100)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
${stream}
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

function escapePdf(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
