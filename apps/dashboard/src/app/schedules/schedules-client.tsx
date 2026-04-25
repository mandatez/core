'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Tag,
} from '@/components/ui';

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
  const [hasLoaded, setHasLoaded] = useState(false);
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
      void loadSchedule(stored);
    } else {
      setHasLoaded(true);
    }
  }, []);

  async function loadSchedule(id: string) {
    if (!id) return;
    try {
      const res = await fetch(
        `/api/schedules?owner_id=${encodeURIComponent(id)}`,
        { credentials: 'include' },
      );
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
    } finally {
      setHasLoaded(true);
    }
  }

  async function saveSchedule() {
    if (!ownerId.trim()) {
      setSaveStatus({ kind: 'error', message: 'owner_id is required' });
      return;
    }
    if (reportTypes.length === 0) {
      setSaveStatus({
        kind: 'error',
        message: 'Select at least one report type',
      });
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
          const err = await res
            .json()
            .catch(() => ({ error: 'Request failed' }));
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
      setGenerateError(
        err instanceof Error ? err.message : 'Generate failed',
      );
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
      {/* Existing schedule banner OR empty state */}
      {schedule ? (
        <ActiveScheduleCard
          schedule={schedule}
          onCancel={cancelSchedule}
          onTriggerNow={generateNow}
          triggering={generatingNow}
        />
      ) : hasLoaded ? (
        <EmptyState
          icon={<IconCalendar />}
          title="No active schedule"
          description="Configure delivery below — your first quarterly compliance bundle will arrive automatically."
        />
      ) : null}

      {/* Form card */}
      <Card variant="elevated" className="p-6 md:p-8">
        <div className="space-y-8">
          {/* Owner */}
          <FormSection
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
                className="flex-1 rounded-md border border-border-default bg-bg-overlay px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
              />
              <Button
                variant="secondary"
                onClick={() => loadSchedule(ownerId.trim())}
                disabled={!ownerId.trim()}
              >
                Load schedule
              </Button>
            </div>
          </FormSection>

          {/* Email */}
          <FormSection
            label="B · Destination"
            title="Email address"
            description="Where the quarterly PDF bundle will be delivered."
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="security@yourcompany.com"
              className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
            />
          </FormSection>

          {/* Report types */}
          <FormSection
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
                    className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${
                      selected
                        ? 'border-accent-primary bg-accent-primary/10'
                        : 'border-border-default bg-bg-overlay hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-3.5 w-3.5 rounded-sm border ${
                          selected
                            ? 'border-accent-primary bg-accent-primary'
                            : 'border-border-strong bg-transparent'
                        }`}
                        aria-hidden
                      />
                      <span className="text-sm font-medium text-text-primary">
                        {REPORT_LABELS[type]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </FormSection>

          {/* Frequency */}
          <FormSection
            label="D · Cadence"
            title="Delivery frequency"
            description="Quarterly matches most audit cycles. Monthly is for live-production teams."
          >
            <div className="inline-flex gap-2">
              {(['monthly', 'quarterly'] as Frequency[]).map((f) => (
                <Button
                  key={f}
                  variant={frequency === f ? 'primary' : 'secondary'}
                  size="md"
                  onClick={() => setFrequency(f)}
                  className="capitalize"
                >
                  {f}
                </Button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
              Cron · {frequency === 'monthly' ? '0 9 1 * *' : '0 9 1 */3 *'}
            </p>
          </FormSection>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border-default pt-6 sm:flex-row sm:items-center sm:justify-between">
          <StatusBanner status={saveStatus} />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={generateNow}
              loading={generatingNow}
              disabled={!ownerId.trim() || reportTypes.length === 0}
            >
              {generatingNow ? 'Generating' : 'Generate now'}
            </Button>
            <Button
              variant="primary"
              onClick={saveSchedule}
              loading={saveStatus.kind === 'loading'}
              disabled={!ownerId.trim()}
            >
              {saveStatus.kind === 'loading' ? 'Saving' : 'Schedule reports'}
            </Button>
          </div>
        </div>
      </Card>

      {generateError && (
        <Card variant="danger-tinted" className="p-4">
          <div className="font-mono text-xs text-accent-danger">
            {generateError}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function ActiveScheduleCard({
  schedule,
  onCancel,
  onTriggerNow,
  triggering,
}: {
  schedule: ReportSchedule;
  onCancel: () => void;
  onTriggerNow: () => void;
  triggering: boolean;
}) {
  return (
    <Card variant="default" className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag variant="success">Active</Tag>
            <Tag variant="info" className="font-mono">
              {schedule.frequency === 'monthly' ? '0 9 1 * *' : '0 9 1 */3 *'}
            </Tag>
          </div>
          <div className="text-sm text-text-primary">
            Next report:{' '}
            <span className="font-medium">
              {formatDate(schedule.next_send_at)}
            </span>{' '}
            →{' '}
            <span className="font-mono text-accent-success">
              {schedule.email}
            </span>
          </div>
          <div className="text-sm text-text-secondary">
            Includes:{' '}
            {schedule.report_types.map((t) => REPORT_LABELS[t]).join(', ')} ·{' '}
            <span className="capitalize">{schedule.frequency}</span>
          </div>
          {schedule.last_sent_at && (
            <div className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              Last sent · {formatDate(schedule.last_sent_at)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onTriggerNow}
            loading={triggering}
          >
            Trigger now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-accent-danger hover:text-accent-danger"
          >
            Cancel schedule
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FormSection({
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
    <section className="space-y-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-primary">
          {label}
        </div>
        <h3 className="mt-2 text-base font-semibold text-text-primary">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') {
    return <span className="font-mono text-xs text-text-muted" />;
  }
  if (status.kind === 'success') {
    return (
      <span className="font-mono text-xs uppercase tracking-widest text-accent-success">
        ✓ {status.message}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs uppercase tracking-widest text-accent-danger">
      ✗ {status.message}
    </span>
  );
}

function IconCalendar() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
