import { ReportsClient } from './reports-client';

export const metadata = {
  title: 'Compliance Reports — MandateZ',
  description: 'One-click auditor-ready compliance reports for OWASP, EU AI Act, and HIPAA.',
};

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Generate Compliance Report</h2>
        <p className="text-gray-400 mt-1">
          One-click, auditor-ready PDF reports from your signed agent event stream.
        </p>
      </div>

      <ReportsClient />

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
    </div>
  );
}
