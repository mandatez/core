'use client';

import { useEffect, useState } from 'react';

interface AlertConfig {
  owner_id: string;
  slack_webhook_url: string | null;
  email_address: string | null;
  webhook_url: string | null;
  alert_on_blocked: boolean;
  alert_on_flagged: boolean;
  alert_on_grade_change: boolean;
  alert_on_identity_breach: boolean;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

type TestStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string };

const WEBHOOK_PAYLOAD_EXAMPLE = `{
  "event": "agent_blocked",
  "agent_id": "ag_...",
  "action_type": "export",
  "resource": "customer_data",
  "policy_id": "pol_...",
  "timestamp": "2026-04-22T..."
}`;

function defaultConfig(ownerId: string): AlertConfig {
  return {
    owner_id: ownerId,
    slack_webhook_url: null,
    email_address: null,
    webhook_url: null,
    alert_on_blocked: true,
    alert_on_flagged: true,
    alert_on_grade_change: true,
    alert_on_identity_breach: true,
  };
}

export default function AlertsClient() {
  const [ownerId, setOwnerId] = useState('');
  const [config, setConfig] = useState<AlertConfig>(defaultConfig(''));
  const [showPayload, setShowPayload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle' });
  const [slackTest, setSlackTest] = useState<TestStatus>({ kind: 'idle' });
  const [webhookTest, setWebhookTest] = useState<TestStatus>({ kind: 'idle' });

  // Hydrate owner_id from localStorage if present (no Supabase auth wired yet).
  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (stored) {
      setOwnerId(stored);
    }
  }, []);

  const loadConfig = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setSaveStatus({ kind: 'idle' });
    try {
      const res = await fetch(`/api/alerts?owner_id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setConfig(json.config as AlertConfig);
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!ownerId.trim()) {
      setSaveStatus({ kind: 'error', message: 'owner_id is required' });
      return;
    }
    setSaveStatus({ kind: 'loading' });
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, owner_id: ownerId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setConfig(json.config as AlertConfig);
      window.localStorage.setItem('mandatez_owner_id', ownerId.trim());
      setSaveStatus({
        kind: 'success',
        message: 'Alert configuration saved.',
      });
    } catch (err) {
      setSaveStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  };

  const sendTest = async (
    channel: 'slack' | 'webhook',
    url: string | null,
    setter: (s: TestStatus) => void,
  ) => {
    if (!url) {
      setter({ kind: 'error', message: 'Enter a URL first' });
      return;
    }
    setter({ kind: 'sending' });
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, url }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Delivery failed');
      }
      setter({ kind: 'ok' });
    } catch (err) {
      setter({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Delivery failed',
      });
    }
  };

  const update = <K extends keyof AlertConfig>(key: K, value: AlertConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="space-y-10">
      {/* Owner ID */}
      <SectionCard
        label="Owner"
        title="Your MandateZ owner ID"
        description="Used to scope alert configuration. Pre-filled from your last session."
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
            onClick={() => loadConfig(ownerId.trim())}
            disabled={loading || !ownerId.trim()}
            className="px-4 py-2 text-sm border border-gray-700 rounded-md text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading…' : 'Load config'}
          </button>
        </div>
      </SectionCard>

      {/* Channels */}
      <SectionCard
        label="A · Channels"
        title="Delivery channels"
        description="Configure one or more. MandateZ fan-outs alerts to every channel you enable."
      >
        <div className="space-y-6">
          {/* Slack */}
          <ChannelField
            title="Slack Webhook"
            helper="Create a Slack webhook at api.slack.com/apps"
            value={config.slack_webhook_url ?? ''}
            onChange={(v) => update('slack_webhook_url', v || null)}
            placeholder="https://hooks.slack.com/services/..."
            trailing={
              <TestButton
                label="Send test"
                status={slackTest}
                onClick={() =>
                  sendTest('slack', config.slack_webhook_url, setSlackTest)
                }
              />
            }
          />

          {/* Email */}
          <ChannelField
            title="Email"
            helper="Alerts delivered via transactional email. Respect your security inbox."
            value={config.email_address ?? ''}
            onChange={(v) => update('email_address', v || null)}
            placeholder="security@yourcompany.com"
            type="email"
          />

          {/* Custom webhook */}
          <div className="space-y-3">
            <ChannelField
              title="Custom Webhook"
              helper="POST JSON to your own endpoint. Use for PagerDuty, Opsgenie, or your SIEM."
              value={config.webhook_url ?? ''}
              onChange={(v) => update('webhook_url', v || null)}
              placeholder="https://your-api.com/mandatez-webhook"
              trailing={
                <TestButton
                  label="Send test"
                  status={webhookTest}
                  onClick={() =>
                    sendTest('webhook', config.webhook_url, setWebhookTest)
                  }
                />
              }
            />
            <button
              type="button"
              onClick={() => setShowPayload((v) => !v)}
              className="text-xs font-mono text-gray-500 hover:text-blue-300 transition-colors"
            >
              {showPayload ? '▾' : '▸'} Payload preview
            </button>
            {showPayload && (
              <pre className="text-xs text-gray-300 bg-black/40 border border-gray-800 rounded-md p-4 overflow-x-auto font-mono">
                {WEBHOOK_PAYLOAD_EXAMPLE}
              </pre>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Triggers */}
      <SectionCard
        label="B · Triggers"
        title="When to alert"
        description="Only enabled triggers fire notifications. Disable anything that creates noise."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Agent action blocked"
            hint="Fires when policy engine prevents an action."
            value={config.alert_on_blocked}
            onChange={(v) => update('alert_on_blocked', v)}
            tone="red"
          />
          <ToggleRow
            label="Agent action flagged"
            hint="Fires when an action is held for human approval."
            value={config.alert_on_flagged}
            onChange={(v) => update('alert_on_flagged', v)}
            tone="amber"
          />
          <ToggleRow
            label="Trust grade change"
            hint="Fires when an agent changes verified status."
            value={config.alert_on_grade_change}
            onChange={(v) => update('alert_on_grade_change', v)}
            tone="blue"
          />
          <ToggleRow
            label="Identity breach detected"
            hint="Fires when an identity check returns a known breach."
            value={config.alert_on_identity_breach}
            onChange={(v) => update('alert_on_identity_breach', v)}
            tone="red"
          />
        </div>
      </SectionCard>

      {/* Save */}
      <div className="flex flex-col gap-3 border-t border-gray-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <StatusBanner status={saveStatus} />
        <button
          onClick={saveConfig}
          disabled={saveStatus.kind === 'loading' || !ownerId.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
        >
          {saveStatus.kind === 'loading' ? 'Saving…' : 'Save Alert Config'}
        </button>
      </div>

      {/* How alerts work */}
      <div className="border-t border-gray-800 pt-8">
        <h3 className="text-lg font-medium mb-2">How alerts work</h3>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          When any of the above events occur for your agents, MandateZ sends an
          instant notification to all configured channels.{' '}
          <span className="text-gray-200">
            Blocked events fire before the action executes
          </span>{' '}
          — you know in real time, not after the fact.
        </p>
      </div>
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

function ChannelField({
  title,
  helper,
  value,
  onChange,
  placeholder,
  type,
  trailing,
}: {
  title: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-gray-200">{title}</label>
        <span className="text-[11px] text-gray-500">{helper}</span>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type={type ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
        />
        {trailing}
      </div>
    </div>
  );
}

function TestButton({
  label,
  status,
  onClick,
}: {
  label: string;
  status: TestStatus;
  onClick: () => void;
}) {
  const text =
    status.kind === 'sending'
      ? 'Sending…'
      : status.kind === 'ok'
        ? 'Delivered ✓'
        : label;

  const color =
    status.kind === 'ok'
      ? 'border-emerald-700 text-emerald-300'
      : status.kind === 'error'
        ? 'border-red-700 text-red-300'
        : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={status.kind === 'sending'}
        className={`px-4 py-2 text-xs border rounded-md transition-colors disabled:opacity-50 ${color}`}
      >
        {text}
      </button>
      {status.kind === 'error' && (
        <span className="text-[10px] text-red-400 font-mono max-w-[220px] truncate">
          {status.message}
        </span>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  tone,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  tone: 'red' | 'amber' | 'blue';
}) {
  const toneDot =
    tone === 'red' ? 'bg-red-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-blue-400';

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="group flex items-center justify-between gap-4 border border-gray-800 rounded-md bg-gray-950/60 p-4 text-left hover:border-gray-700 transition-colors"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${value ? toneDot : 'bg-gray-700'}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-100">{label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{hint}</div>
        </div>
      </div>
      <span
        className={`relative shrink-0 h-6 w-11 rounded-full transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-800'
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
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
