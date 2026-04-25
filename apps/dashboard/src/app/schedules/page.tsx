import SchedulesClient from './schedules-client';
import { Card, SectionMarker } from '@/components/ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compliance Report Scheduler — MandateZ',
  description:
    'Schedule auditor-ready compliance reports to land in your inbox automatically, every quarter.',
};

export default function SchedulesPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="02" label="REPORT SCHEDULES" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Compliance report scheduler
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Get auditor-ready compliance reports automatically — every quarter,
            delivered to your team&apos;s inbox.
          </p>
        </div>
      </header>

      <SchedulesClient />

      <Card variant="default" className="p-6">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          What&apos;s in the report
        </div>
        <ul className="space-y-2 text-sm leading-relaxed text-text-secondary">
          <ScheduleBullet>
            Executive summary with overall compliance score and status
          </ScheduleBullet>
          <ScheduleBullet>
            Agent inventory table with trust scores and activity metrics
          </ScheduleBullet>
          <ScheduleBullet>
            Framework-specific control mapping (OWASP / EU AI Act / HIPAA)
          </ScheduleBullet>
          <ScheduleBullet>
            Audit trail sample of the most recent 20 signed events
          </ScheduleBullet>
          <ScheduleBullet>
            Every event is Ed25519-signed — tamper-evident by design
          </ScheduleBullet>
        </ul>
      </Card>

      <Card variant="default" className="border-l-2 border-accent-warning p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-warning">
          Delivery requires Resend
        </div>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Reports are sent via{' '}
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary underline-offset-4 hover:underline"
          >
            Resend
          </a>
          . Add{' '}
          <code className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-xs text-text-primary">
            RESEND_API_KEY
          </code>{' '}
          to your environment variables — free tier is 3,000 emails/month and
          works with any domain. Until a verified sender is configured, reports
          arrive from{' '}
          <code className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-xs text-text-primary">
            onboarding@resend.dev
          </code>
          .
        </p>
      </Card>
    </div>
  );
}

function ScheduleBullet({ children }: { children: React.ReactNode }) {
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
