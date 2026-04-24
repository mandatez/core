'use client';

import { useEffect, useState } from 'react';

type ReportType = 'owasp' | 'eu-ai-act' | 'hipaa';
type Frequency = 'monthly' | 'quarterly';

interface ReportSchedule {
  id: string;
  owner_id: string;
  email: string;
  report_types: ReportType[];
  frequency: Frequency;
  next_send_at: string;
  last_sent_at: string | null;
  active: boolean;
  created_at: string;
}

const REPORT_LABELS: Record<ReportType, string> = {
  owasp: 'OWASP Agentic Top 10',
  'eu-ai-act': 'EU AI Act',
  hipaa: 'HIPAA AI Addendum',
};

const ALL_TYPES: ReportType[] = ['owasp', 'eu-ai-act', 'hipaa'];

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SchedulesClient() {
  const [ownerId, setOwnerId] = useState('');
  const [email, setEmail] = useState('');
  const [reportTypes, setReportTypes] = useState<ReportType[]>(['owasp']);
  const [frequency, setFrequency] = useState<Frequency>('quarterly');
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle' });
  const [generatingNow, setGeneratingNow] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (stored) {
      setOwnerId(stored);
      loadSchedule(stored);
    }
  }, []);

  async function loadSchedule(id: string) {
    if (!id) return;
    try {
      const res = await fetch(`/api/schedules?owner_id=${encodeURIComponent(id)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      const s = json.schedule as ReportSchedule | null;
      setSchedule(s);
      if (s) {
        setEmail(s.email);
        setReportTypes(s.report_types);
        setFrequency(s.frequency);
      }
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load',
      });
    }
  }

  async function saveSchedule() {
    if (!ownerId.trim()) {
      setSaveStatus({ kind: 'error', message: 'owner_id is required' });
      return;
    }
    if (reportTypes.length === 0) {
      setSaveStatus({ kind: 'error', message: 'Select at least one report type' });
      return;
    }

    setSaveStatus({ kind: 'loading' });
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: ownerId.trim(),
          email: email.trim(),
          report_types: reportTypes,
          frequency,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');

      window.localStorage.setItem('mandatez_owner_id', ownerId.trim());
      setSchedule(json.schedule as ReportSchedule);
      setSaveStatus({ kind: 'success', message: 'Schedule saved.' });
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  }

  async function cancelSchedule() {
    if (!ownerId.trim()) return;
    if (!confirm('Cancel the active report schedule?')) return;

    try {
      const res = await fetch(
        `/api/schedules?owner_id=${encodeURIComponent(ownerId.trim())}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cancel failed');

      setSchedule(null);
      setSaveStatus({ kind: 'success', message: 'Schedule cancelled.' });
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Cancel failed',
      });
    }
  }

  async function generateNow() {
    setGenerateError(null);
    if (!ownerId.trim()) {
      setGenerateError('Enter an owner_id first');
      return;
    }
    if (reportTypes.length === 0) {
      setGenerateError('Select at least one report type');
      return;
    }

    setGeneratingNow(true);
    try {
      for (const reportType of reportTypes) {
        const res = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            owner_id: ownerId.trim(),
            report_type: reportType,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mandatez-${reportType}-report.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGeneratingNow(false);
    }
  }

  function toggleType(type: ReportType) {
    setReportTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  return (
    <div className="space-y-8">
      {schedule ? (
        <div className="border border-emerald-800/60 rounded-lg bg-emerald-950/20 p-5">
          <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-mono">
            Active schedule
          </div>
          <div className="mt-2 text-sm text-gray-200">
            Next report:{' '}
            <span className="font-medium text-white">
              {formatDate(schedule.next_send_at)}
            </span>{' '}
            →{' '}
            <span className="font-mono text-emerald-300">{schedule.email}</span>
          </div>
          <div className="mt-1 text-sm text-gray-400">
            Includes:{' '}
            {schedule.report_types.map((t) => REPORT_LABELS[t]).join(', ')} ·{' '}
            <span className="capitalize">{schedule.frequency}</span>
          </div>
          {schedule.last_sent_at && (
            <div className="mt-1 text-xs text-gray-500">
              Last sent: {formatDate(schedule.last_sent_at)}
            </div>
          )}
          <button
            type="button"
            onClick={cancelSchedule}
            className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
          >
            Cancel schedule
          </button>
        </div>
      ) : null}

      {/* Owner ID */}
      <SectionCard
        label="A · Owner"
        title="Your MandateZ owner ID"
        description="Used to scope the schedule and fetch agent events."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            placeholder="owner_123"
            className="flex-1 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
          />
          <button
            onClick={() => loadSchedule(ownerId.trim())}
            disabled={!ownerId.trim()}
            className="px-4 py-2 text-sm border border-gray-700 rounded-md text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Load schedule
          </button>
        </div>
      </SectionCard>

      {/* Email */}
      <SectionCard
        label="B · Destination"
        title="Email address"
        description="Where the quarterly PDF bundle will be delivered."
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="security@yourcompany.com"
          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
        />
      </SectionCard>

      {/* Report types */}
      <SectionCard
        label="C · Reports"
        title="Which reports to include"
        description="One bundle, one email — every selected framework in a single delivery."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {ALL_TYPES.map((type) => {
            const selected = reportTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`border rounded-md p-4 text-left transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-950/30'
                    : 'border-gray-800 bg-gray-950/40 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3.5 w-3.5 rounded-sm border ${
                      selected
                        ? 'border-blue-400 bg-blue-500'
                        : 'border-gray-600 bg-transparent'
                    }`}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-gray-100">
                    {REPORT_LABELS[type]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Frequency */}
      <SectionCard
        label="D · Cadence"
        title="Delivery frequency"
        description="Quarterly matches most audit cycles. Monthly is for live-production teams."
      >
        <div className="inline-flex rounded-md border border-gray-800 overflow-hidden">
          {(['monthly', 'quarterly'] as Frequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`px-4 py-2 text-sm capitalize transition-colors ${
                frequency === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-950/40 text-gray-300 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Save + Generate now */}
      <div className="flex flex-col gap-3 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <StatusBanner status={saveStatus} />
        <div className="flex gap-3">
          <button
            onClick={generateNow}
            disabled={generatingNow || !ownerId.trim() || reportTypes.length === 0}
            className="px-5 py-3 border border-gray-700 hover:border-gray-500 text-sm font-medium text-gray-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generatingNow ? 'Generating…' : 'Generate now'}
          </button>
          <button
            onClick={saveSchedule}
            disabled={saveStatus.kind === 'loading' || !ownerId.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
          >
            {saveStatus.kind === 'loading' ? 'Saving…' : 'Schedule Reports'}
          </button>
        </div>
      </div>

      {generateError && (
        <div className="border border-red-800 bg-red-900/20 rounded-md p-3 text-xs text-red-300 font-mono">
          {generateError}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- primitives ------------------------------ */

function SectionCard({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-800 rounded-lg p-6 space-y-5 bg-gray-950/40">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400 font-mono">
          {label}
        </div>
        <h3 className="text-lg font-semibold mt-2">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') {
    return <span className="text-xs text-gray-500 font-mono" />;
  }
  if (status.kind === 'success') {
    return (
      <span className="text-xs text-emerald-300 font-mono">
        ✓ {status.message}
      </span>
    );
  }
  return (
    <span className="text-xs text-red-300 font-mono">
      ✗ {status.message}
    </span>
  );
}
