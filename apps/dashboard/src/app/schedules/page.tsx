import SchedulesClient from './schedules-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compliance Report Scheduler — MandateZ',
  description:
    'Schedule auditor-ready compliance reports to land in your inbox automatically, every quarter.',
};

export default function SchedulesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Compliance Report Scheduler</h2>
        <p className="text-gray-400 mt-1">
          Get auditor-ready compliance reports automatically, every quarter.
        </p>
      </div>

      <SchedulesClient />

      <div className="border-t border-gray-800 pt-6 mt-12">
        <h3 className="text-lg font-medium mb-2">What&apos;s in the report?</h3>
        <ul className="text-sm text-gray-400 space-y-2 list-disc list-inside">
          <li>Executive summary with overall compliance score and status</li>
          <li>Agent inventory table with trust scores and activity metrics</li>
          <li>Framework-specific control mapping (OWASP / EU AI Act / HIPAA)</li>
          <li>Audit trail sample of the most recent 20 signed events</li>
          <li>Every event is Ed25519-signed — tamper-evident by design</li>
        </ul>
      </div>

      <div className="border border-amber-900/40 bg-amber-950/20 rounded-lg p-4 text-sm text-amber-200/90">
        <div className="font-medium text-amber-100 mb-1">Delivery requires Resend</div>
        <p className="text-amber-200/80">
          Reports are sent via{' '}
          <a
            href="https://resend.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-100"
          >
            Resend
          </a>
          . Make sure to add <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded">RESEND_API_KEY</code> to
          your environment variables — free tier is 3,000 emails/month and works with any domain
          internationally. Until a verified sender is configured, reports arrive from
          <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded ml-1">onboarding@resend.dev</code>.
        </p>
      </div>
    </div>
  );
}