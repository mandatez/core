// Resend-backed transactional email for compliance report delivery.
//
// TODO: Add RESEND_API_KEY to Vercel environment variables.
//   Get a free API key at resend.com — 3000 emails/month free,
//   works with any domain internationally.
//
// Until you verify mandatez.com in Resend, the `from` address
// falls back to Resend's onboarding sender so the scheduler still
// works end-to-end in testing.

import { Resend } from 'resend';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://core-dashboard-black.vercel.app';

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ?? 'MandateZ Reports <onboarding@resend.dev>';

export type EmailReportType = 'owasp' | 'eu-ai-act' | 'hipaa';

const REPORT_COVERAGE: Record<EmailReportType, string> = {
  owasp: 'OWASP Agentic Top 10 — ASI-01 through ASI-10',
  'eu-ai-act': 'EU AI Act Articles 9, 12, 13, and 14',
  hipaa: 'HIPAA 164.308 and 164.312 safeguards',
};

const REPORT_LABEL: Record<EmailReportType, string> = {
  owasp: 'OWASP',
  'eu-ai-act': 'EU AI ACT',
  hipaa: 'HIPAA',
};

interface SendComplianceReportArgs {
  to: string;
  ownerId: string;
  reportType: EmailReportType;
  pdfBuffer: Uint8Array;
  period: string;
}

export interface SendComplianceReportResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function buildHtml(reportType: EmailReportType, period: string, ownerId: string): string {
  const coverage = REPORT_COVERAGE[reportType];
  const label = REPORT_LABEL[reportType];

  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; max-width: 640px; margin: 0 auto; padding: 24px;">
    <h2 style="margin: 0 0 12px; font-size: 20px;">Your MandateZ Compliance Report is ready</h2>
    <p style="margin: 0 0 16px; color: #374151;">
      Attached is your <strong>${label}</strong> compliance report for the period
      <strong>${period}</strong>.
    </p>
    <p style="margin: 0 0 8px; color: #374151;">This report covers:</p>
    <ul style="margin: 0 0 16px 20px; color: #374151;">
      <li>${coverage}</li>
    </ul>
    <p style="margin: 0 0 16px; color: #374151;">
      Every event in this report is <strong>Ed25519 signed</strong> and tamper-evident.
      Hand it to your auditor as-is.
    </p>
    <p style="margin: 20px 0;">
      <a
        href="${DASHBOARD_URL}"
        style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;"
      >
        Open Dashboard
      </a>
    </p>
    <p style="margin: 24px 0 0; font-size: 12px; color: #6b7280;">
      Sent to owner_id <code style="background: #f3f4f6; padding: 1px 4px; border-radius: 3px;">${ownerId}</code>.
      Manage or cancel scheduled reports at ${DASHBOARD_URL}/schedules.
    </p>
  </body>
</html>`;
}

export async function sendComplianceReport(
  args: SendComplianceReportArgs,
): Promise<SendComplianceReportResult> {
  const resend = getResend();
  if (!resend) {
    return {
      ok: false,
      skipped: true,
      error: 'RESEND_API_KEY is not set — email sending is disabled',
    };
  }

  const { to, ownerId, reportType, pdfBuffer, period } = args;
  const subject = `MandateZ ${REPORT_LABEL[reportType]} Compliance Report — ${period}`;
  const html = buildHtml(reportType, period, ownerId);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
      attachments: [
        {
          filename: `mandatez-${reportType}-report.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, messageId: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown Resend error',
    };
  }
}
