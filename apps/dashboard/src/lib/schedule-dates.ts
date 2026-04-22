export type Frequency = 'monthly' | 'quarterly';

export const REPORT_TYPES = ['owasp', 'eu-ai-act', 'hipaa'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/**
 * First day of the next period in UTC, at 00:00:00.
 *
 * Quarterly cadence anchors on Jan / Apr / Jul / Oct. Monthly rolls over
 * to the first of the following month. Running on the 1st at 09:00 UTC
 * (see vercel.json cron) still produces the next period correctly because
 * we only compare against `next_send_at <= now()` at trigger time.
 */
export function computeNextSendAt(frequency: Frequency, from: Date = new Date()): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();

  if (frequency === 'monthly') {
    return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  }

  const quarterStartMonths = [0, 3, 6, 9];
  const nextQuarterMonth = quarterStartMonths.find((m) => m > month);
  if (nextQuarterMonth === undefined) {
    return new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  }
  return new Date(Date.UTC(year, nextQuarterMonth, 1, 0, 0, 0, 0));
}