import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportType = 'owasp' | 'hipaa' | 'eu-ai-act';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

export interface AgentSummary {
  id: string;
  name: string;
  trust_score: number | null;
  trust_grade: TrustGrade | null;
  total_events: number | null;
  allowed_ratio: number | null;
}

export interface EventRow {
  id: string;
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
}

export interface ReportData {
  owner_id: string;
  report_type: ReportType;
  generated_at: string;
  period_days: number;
  agents: AgentSummary[];
  events: EventRow[];
  summary: {
    total_agents: number;
    total_events: number;
    by_outcome: { allowed: number; blocked: number; flagged: number; pending_approval: number };
    compliance_score: number;
    status: 'COMPLIANT' | 'NEEDS ATTENTION';
  };
}

const REPORT_TITLES: Record<ReportType, string> = {
  owasp: 'OWASP Agentic Top 10',
  hipaa: 'HIPAA AI Addendum',
  'eu-ai-act': 'EU AI Act',
};

// ---------------------------------------------------------------------------
// Report data assembly
// ---------------------------------------------------------------------------

export function assembleReportData(
  ownerId: string,
  reportType: ReportType,
  agents: AgentSummary[],
  events: EventRow[],
  periodDays: number,
): ReportData {
  const byOutcome = { allowed: 0, blocked: 0, flagged: 0, pending_approval: 0 };
  for (const e of events) {
    if (e.outcome in byOutcome) byOutcome[e.outcome as keyof typeof byOutcome]++;
  }

  const total = events.length;
  // Compliance score: weighted combination of allowed ratio + agent trust
  const allowedRatio = total > 0 ? byOutcome.allowed / total : 1;
  const avgTrust =
    agents.length > 0
      ? agents.reduce((sum, a) => sum + (a.trust_score ?? 0), 0) / agents.length
      : 0;
  const complianceScore = Math.round(allowedRatio * 60 + (avgTrust / 100) * 40);
  const status: 'COMPLIANT' | 'NEEDS ATTENTION' = complianceScore >= 75 ? 'COMPLIANT' : 'NEEDS ATTENTION';

  return {
    owner_id: ownerId,
    report_type: reportType,
    generated_at: new Date().toISOString(),
    period_days: periodDays,
    agents,
    events,
    summary: {
      total_agents: agents.length,
      total_events: total,
      by_outcome: byOutcome,
      compliance_score: complianceScore,
      status,
    },
  };
}

// ---------------------------------------------------------------------------
// Framework control mappings
// ---------------------------------------------------------------------------

interface ControlRow {
  id: string;
  title: string;
  control: string;
  evidenceKey: (data: ReportData) => string;
}

const OWASP_CONTROLS: ControlRow[] = [
  {
    id: 'ASI-01',
    title: 'Memory Poisoning',
    control: 'Signed immutable event log prevents tampering of agent memory',
    evidenceKey: (d) => `${d.summary.total_events} Ed25519-signed events`,
  },
  {
    id: 'ASI-02',
    title: 'Tool Misuse',
    control: 'Policy engine blocks unauthorized tool calls at runtime',
    evidenceKey: (d) => `${d.summary.by_outcome.blocked} blocked calls`,
  },
  {
    id: 'ASI-03',
    title: 'Privilege Compromise',
    control: 'Per-agent identity (Ed25519) + owner-scoped permissions',
    evidenceKey: (d) => `${d.summary.total_agents} identified agents`,
  },
  {
    id: 'ASI-04',
    title: 'Resource Overload',
    control: 'Rate-limit flagging + human oversight gate',
    evidenceKey: (d) => `${d.summary.by_outcome.flagged} flagged events`,
  },
  {
    id: 'ASI-05',
    title: 'Cascading Hallucinations',
    control: 'Every action traced to its originating agent via audit trail',
    evidenceKey: (d) => `${d.summary.total_events} traceable actions`,
  },
  {
    id: 'ASI-06',
    title: 'Intent Breaking',
    control: 'Policy rules enforce declared mandate boundaries',
    evidenceKey: () => 'Policy engine enforced',
  },
  {
    id: 'ASI-07',
    title: 'Misaligned & Deceptive Behaviors',
    control: 'Trust scoring flags behavioral drift over time',
    evidenceKey: (d) => `Avg trust ${Math.round(
      d.agents.reduce((s, a) => s + (a.trust_score ?? 0), 0) / Math.max(d.agents.length, 1),
    )}/100`,
  },
  {
    id: 'ASI-08',
    title: 'Repudiation',
    control: 'Cryptographic Ed25519 signatures on every event',
    evidenceKey: (d) => `${d.summary.total_events} signed events`,
  },
  {
    id: 'ASI-09',
    title: 'Identity Spoofing',
    control: 'Public-key verification of every agent event',
    evidenceKey: (d) => `${d.summary.total_agents} verified identities`,
  },
  {
    id: 'ASI-10',
    title: 'Overreliance',
    control: 'Human oversight gate requires approval for flagged actions',
    evidenceKey: (d) => `${d.summary.by_outcome.pending_approval} pending human review`,
  },
];

const EU_AI_ACT_CONTROLS: ControlRow[] = [
  {
    id: 'Art. 9',
    title: 'Risk Management System',
    control: 'Policy engine enforces runtime risk controls',
    evidenceKey: (d) => `${d.summary.by_outcome.blocked} risks prevented`,
  },
  {
    id: 'Art. 12',
    title: 'Record Keeping',
    control: 'Immutable signed audit trail retained per agent',
    evidenceKey: (d) => `${d.summary.total_events} records retained`,
  },
  {
    id: 'Art. 13',
    title: 'Transparency',
    control: 'Every action logged with resource, outcome, and policy',
    evidenceKey: (d) => `${d.summary.total_events} transparent events`,
  },
  {
    id: 'Art. 14',
    title: 'Human Oversight',
    control: 'Oversight gates require human approval for flagged actions',
    evidenceKey: (d) => `${d.summary.by_outcome.flagged} oversight triggers`,
  },
];

const HIPAA_CONTROLS: ControlRow[] = [
  {
    id: '164.308(a)(1)',
    title: 'Security Management',
    control: 'Policy engine enforces PHI access rules',
    evidenceKey: (d) => `${d.summary.by_outcome.blocked} blocked PHI attempts`,
  },
  {
    id: '164.308(a)(3)',
    title: 'Workforce Security',
    control: 'Per-agent identity with scoped access',
    evidenceKey: (d) => `${d.summary.total_agents} identified agents`,
  },
  {
    id: '164.312(a)(1)',
    title: 'Access Control',
    control: 'Policy rules gate all resource access',
    evidenceKey: (d) => `${d.summary.by_outcome.allowed} authorized accesses`,
  },
  {
    id: '164.312(b)',
    title: 'Audit Controls',
    control: 'Ed25519-signed immutable event log',
    evidenceKey: (d) => `${d.summary.total_events} audit records`,
  },
  {
    id: '164.312(c)(1)',
    title: 'Integrity',
    control: 'Cryptographic signatures prevent tampering',
    evidenceKey: () => 'Ed25519 signatures verified',
  },
];

function controlStatus(data: ReportData): 'COVERED' | 'PARTIAL' | 'NOT COVERED' {
  if (data.summary.total_events === 0) return 'NOT COVERED';
  if (data.summary.compliance_score >= 75) return 'COVERED';
  return 'PARTIAL';
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

const BRAND_COLOR: [number, number, number] = [59, 130, 246]; // blue-500
const TEXT_COLOR: [number, number, number] = [31, 41, 55]; // gray-800
const MUTED_COLOR: [number, number, number] = [107, 114, 128]; // gray-500
const EMERALD: [number, number, number] = [16, 185, 129];
const AMBER: [number, number, number] = [245, 158, 11];

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_COLOR);
    doc.text(
      'Generated by MandateZ  |  Confidential  |  mandatez.com',
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' },
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
  }
}

function drawCoverPage(doc: jsPDF, data: ReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top blue accent bar
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 8, 'F');

  // Wordmark
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.text('MandateZ', 20, 50);
  doc.setTextColor(...BRAND_COLOR);
  doc.text('Z', 20 + doc.getTextWidth('Mandate'), 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Compliance Report', 20, 58);

  // Title block
  const titleY = pageHeight / 2 - 30;
  doc.setFontSize(14);
  doc.setTextColor(...MUTED_COLOR);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPLIANCE REPORT', pageWidth / 2, titleY, { align: 'center' });

  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.text(REPORT_TITLES[data.report_type], pageWidth / 2, titleY + 18, { align: 'center' });

  // Divider
  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 25, titleY + 26, pageWidth / 2 + 25, titleY + 26);

  // Metadata
  const metaY = titleY + 50;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);

  const generatedDate = new Date(data.generated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows: [string, string][] = [
    ['Owner', data.owner_id],
    ['Generated', generatedDate],
    ['Period', `Last ${data.period_days} days`],
    ['Total Agents', String(data.summary.total_agents)],
    ['Total Events', String(data.summary.total_events)],
  ];

  let y = metaY;
  for (const [label, value] of rows) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(label, pageWidth / 2 - 40, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text(value, pageWidth / 2 + 5, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_COLOR);
  doc.text('Powered by MandateZ — mandatez.com', pageWidth / 2, pageHeight - 25, { align: 'center' });
  doc.text('Every agent needs a mandate.', pageWidth / 2, pageHeight - 18, { align: 'center' });
}

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_COLOR);
  doc.text(title, 20, y);

  doc.setDrawColor(...BRAND_COLOR);
  doc.setLineWidth(0.5);
  doc.line(20, y + 2, pageWidth - 20, y + 2);

  return y + 12;
}

function drawExecutiveSummary(doc: jsPDF, data: ReportData) {
  doc.addPage();
  let y = drawSectionHeader(doc, 'Executive Summary', 25);

  // Compliance banner
  const pageWidth = doc.internal.pageSize.getWidth();
  const statusColor = data.summary.status === 'COMPLIANT' ? EMERALD : AMBER;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(20, y, pageWidth - 40, 28, 3, 3, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('COMPLIANCE STATUS', 28, y + 10);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.status, 28, y + 22);

  // Score on right side
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COMPLIANCE SCORE', pageWidth - 28, y + 10, { align: 'right' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.summary.compliance_score}/100`, pageWidth - 28, y + 22, { align: 'right' });

  y += 40;

  // Key metrics row
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_COLOR);

  const metrics = [
    { label: 'Total agents monitored', value: data.summary.total_agents.toString() },
    { label: 'Total events logged', value: data.summary.total_events.toLocaleString() },
    { label: 'Allowed actions', value: data.summary.by_outcome.allowed.toLocaleString() },
    { label: 'Blocked actions', value: data.summary.by_outcome.blocked.toLocaleString() },
    { label: 'Flagged actions', value: data.summary.by_outcome.flagged.toLocaleString() },
    { label: 'Pending human approval', value: data.summary.by_outcome.pending_approval.toLocaleString() },
    { label: 'Report period', value: `Last ${data.period_days} days` },
    { label: 'Framework', value: REPORT_TITLES[data.report_type] },
  ];

  for (const m of metrics) {
    doc.setTextColor(...MUTED_COLOR);
    doc.text(`${m.label}:`, 25, y);
    doc.setTextColor(...TEXT_COLOR);
    doc.setFont('helvetica', 'bold');
    doc.text(m.value, 100, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }
}

function drawAgentInventory(doc: jsPDF, data: ReportData) {
  doc.addPage();
  const y = drawSectionHeader(doc, 'Agent Inventory', 25);

  const body = data.agents.map((a) => {
    const score = a.trust_score ?? 0;
    const grade = (a.trust_grade ?? 'unverified').toUpperCase();
    const allowedPct = a.allowed_ratio != null ? `${(a.allowed_ratio * 100).toFixed(1)}%` : '—';
    const status = score >= 60 ? 'TRUSTED' : score >= 40 ? 'REVIEW' : 'LOW TRUST';
    return [a.id, a.name, `${Math.round(score)}/100`, grade, (a.total_events ?? 0).toString(), allowedPct, status];
  });

  if (body.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No agents registered for this owner in the reporting period.', 25, y);
    return;
  }

  autoTable(doc, {
    startY: y,
    head: [['Agent ID', 'Name', 'Trust Score', 'Grade', 'Events', 'Allowed %', 'Status']],
    body,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: 'normal' },
      1: { cellWidth: 30 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 20, right: 20 },
  });
}

function drawFrameworkSection(doc: jsPDF, data: ReportData) {
  const title =
    data.report_type === 'owasp'
      ? 'OWASP Agentic Top 10 Mapping'
      : data.report_type === 'eu-ai-act'
        ? 'EU AI Act Compliance Mapping'
        : 'HIPAA AI Addendum Mapping';

  const controls =
    data.report_type === 'owasp'
      ? OWASP_CONTROLS
      : data.report_type === 'eu-ai-act'
        ? EU_AI_ACT_CONTROLS
        : HIPAA_CONTROLS;

  doc.addPage();
  const y = drawSectionHeader(doc, title, 25);

  const status = controlStatus(data);
  const body = controls.map((c) => [c.id, c.title, c.control, status, c.evidenceKey(data)]);

  autoTable(doc, {
    startY: y,
    head: [['Ref', 'Risk / Requirement', 'MandateZ Control', 'Status', 'Evidence']],
    body,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: TEXT_COLOR, valign: 'top' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 60 },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 33 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const v = hookData.cell.raw as string;
        if (v === 'COVERED') hookData.cell.styles.textColor = EMERALD;
        else if (v === 'PARTIAL') hookData.cell.styles.textColor = AMBER;
        else hookData.cell.styles.textColor = [239, 68, 68];
      }
    },
    margin: { left: 20, right: 20 },
  });
}

function drawAuditSample(doc: jsPDF, data: ReportData) {
  doc.addPage();
  const y = drawSectionHeader(doc, 'Audit Trail Sample (Last 20 Events)', 25);

  const sample = data.events.slice(0, 20);

  if (sample.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...MUTED_COLOR);
    doc.text('No events recorded in the reporting period.', 25, y);
    return;
  }

  const body = sample.map((e) => {
    const ts = new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 19);
    return [
      ts,
      e.agent_id.length > 14 ? e.agent_id.slice(0, 14) + '…' : e.agent_id,
      e.action_type,
      e.resource.length > 20 ? e.resource.slice(0, 20) + '…' : e.resource,
      e.outcome,
      e.policy_id ?? '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'Agent', 'Action', 'Resource', 'Outcome', 'Policy']],
    body,
    theme: 'striped',
    headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 7, textColor: TEXT_COLOR },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 30 },
      2: { cellWidth: 18 },
      3: { cellWidth: 40 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 26 },
    },
    margin: { left: 20, right: 20 },
  });
}

/**
 * Generate a full PDF compliance report from ReportData.
 * Returns a Uint8Array suitable for NextResponse.
 */
export function generateCompliancePdf(data: ReportData): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  drawCoverPage(doc, data);
  drawExecutiveSummary(doc, data);
  drawAgentInventory(doc, data);
  drawFrameworkSection(doc, data);
  drawAuditSample(doc, data);

  addFooter(doc);

  return new Uint8Array(doc.output('arraybuffer'));
}
