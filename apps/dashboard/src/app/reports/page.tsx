import { ReportsClient } from './reports-client';
import { ExportEventsDialog } from '@/components/export-events-dialog';
import { Card, SectionMarker } from '@/components/ui';

export const metadata = {
  title: 'Compliance Reports — MandateZ',
  description:
    'One-click auditor-ready compliance reports for OWASP, EU AI Act, and HIPAA.',
};

export default function ReportsPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="01" label="COMPLIANCE REPORTS" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Generate compliance report
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            One-click, auditor-ready PDF reports built directly from your signed
            agent event stream.
          </p>
        </div>
      </header>

      <ReportsClient />

      <div className="flex flex-wrap items-center gap-3 border-t border-border-default pt-6 text-sm text-text-secondary">
        <span>Need the underlying data?</span>
        <ExportEventsDialog variant="link" label="Export raw events as CSV" />
      </div>

      <Card variant="default" className="p-6">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          What&apos;s in the report
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-text-secondary">
          <ReportBullet>
            Executive summary with overall compliance score and status
          </ReportBullet>
          <ReportBullet>
            Agent inventory table with trust scores and activity metrics
          </ReportBullet>
          <ReportBullet>
            Framework-specific control mapping (OWASP / EU AI Act / HIPAA)
          </ReportBullet>
          <ReportBullet>
            Audit trail sample of the most recent 20 signed events
          </ReportBullet>
          <ReportBullet>
            Every event is Ed25519-signed — tamper-evident by design
          </ReportBullet>
        </ul>
      </Card>
    </div>
  );
}

function ReportBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-accent-primary"
      />
      <span>{children}</span>
    </li>
  );
}
