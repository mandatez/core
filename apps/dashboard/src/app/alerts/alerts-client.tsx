'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Tag,
  cn,
} from '@/components/ui';

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

const inputClass =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 ' +
  'text-sm font-mono text-text-primary placeholder:text-text-muted ' +
  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 ' +
  'transition-colors';

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

interface RuleDef {
  key:
    | 'alert_on_blocked'
    | 'alert_on_flagged'
    | 'alert_on_grade_change'
    | 'alert_on_identity_breach';
  label: string;
  hint: string;
  severity: 'danger' | 'warning' | 'info';
  actionTags: string[];
}

const RULES: RuleDef[] = [
  {
    key: 'alert_on_blocked',
    label: 'Agent action blocked',
    hint: 'Fires when policy engine prevents an action.',
    severity: 'danger',
    actionTags: ['BLOCK', 'POLICY'],
  },
  {
    key: 'alert_on_flagged',
    label: 'Agent action flagged',
    hint: 'Fires when an action is held for human approval.',
    severity: 'warning',
    actionTags: ['FLAG', 'OVERSIGHT'],
  },
  {
    key: 'alert_on_grade_change',
    label: 'Trust grade change',
    hint: 'Fires when an agent changes verified status.',
    severity: 'info',
    actionTags: ['GRADE'],
  },
  {
    key: 'alert_on_identity_breach',
    label: 'Identity breach detected',
    hint: 'Fires when an identity check returns a known breach.',
    severity: 'danger',
    actionTags: ['BREACH', 'IDENTITY'],
  },
];

export default function AlertsClient() {
  const [ownerId, setOwnerId] = useState('');
  const [config, setConfig] = useState<AlertConfig>(defaultConfig(''));
  const [showPayload, setShowPayload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Status>({ kind: 'idle' });
  const [slackTest, setSlackTest] = useState<TestStatus>({ kind: 'idle' });
  const [webhookTest, setWebhookTest] = useState<TestStatus>({ kind: 'idle' });

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
      const res = await fetch(`/api/alerts?owner_id=${encodeURIComponent(id)}`, {
        credentials: 'include',
      });
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
        credentials: 'include',
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
        credentials: 'include',
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

  const enabledRuleCount = RULES.filter((r) => config[r.key]).length;

  return (
    <div className="space-y-10">
      {/* Owner ID */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Owner ID</CardTitle>
          <CardDescription>
            Used to scope alert configuration. Pre-filled from your last
            session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="owner_123"
              className={cn(inputClass, 'flex-1')}
            />
            <Button
              variant="secondary"
              onClick={() => loadConfig(ownerId.trim())}
              disabled={loading || !ownerId.trim()}
            >
              {loading ? 'Loading…' : 'Load config'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Channels */}
      <section className="space-y-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Channels
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Configure one or more. Alerts fan out to every connected
              channel.
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChannelCard
            title="Slack"
            description="Webhook delivery to a Slack channel."
            connected={Boolean(config.slack_webhook_url)}
            input={
              <input
                type="text"
                value={config.slack_webhook_url ?? ''}
                onChange={(e) =>
                  update('slack_webhook_url', e.target.value || null)
                }
                placeholder="https://hooks.slack.com/services/…"
                className={inputClass}
              />
            }
            primaryAction={
              <Button
                variant="secondary"
                size="sm"
                disabled={slackTest.kind === 'sending'}
                onClick={() =>
                  sendTest('slack', config.slack_webhook_url, setSlackTest)
                }
              >
                {slackTest.kind === 'sending'
                  ? 'Sending…'
                  : slackTest.kind === 'ok'
                    ? 'Delivered'
                    : 'Send test'}
              </Button>
            }
            footnote={
              slackTest.kind === 'error' ? slackTest.message : undefined
            }
            footnoteTone={slackTest.kind === 'error' ? 'danger' : 'muted'}
          />

          <ChannelCard
            title="Email"
            description="Transactional email to your security inbox."
            connected={Boolean(config.email_address)}
            input={
              <input
                type="email"
                value={config.email_address ?? ''}
                onChange={(e) =>
                  update('email_address', e.target.value || null)
                }
                placeholder="security@yourcompany.com"
                className={inputClass}
              />
            }
          />

          <ChannelCard
            title="Webhook"
            description="POST JSON to your endpoint — PagerDuty, Opsgenie, SIEM."
            connected={Boolean(config.webhook_url)}
            input={
              <input
                type="text"
                value={config.webhook_url ?? ''}
                onChange={(e) => update('webhook_url', e.target.value || null)}
                placeholder="https://your-api.com/mandatez-webhook"
                className={inputClass}
              />
            }
            primaryAction={
              <Button
                variant="secondary"
                size="sm"
                disabled={webhookTest.kind === 'sending'}
                onClick={() =>
                  sendTest('webhook', config.webhook_url, setWebhookTest)
                }
              >
                {webhookTest.kind === 'sending'
                  ? 'Sending…'
                  : webhookTest.kind === 'ok'
                    ? 'Delivered'
                    : 'Send test'}
              </Button>
            }
            footnote={
              webhookTest.kind === 'error' ? webhookTest.message : undefined
            }
            footnoteTone={webhookTest.kind === 'error' ? 'danger' : 'muted'}
            extras={
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowPayload((v) => !v)}
                  className="font-mono text-[11px] uppercase tracking-wider text-text-muted hover:text-accent-primary transition-colors"
                >
                  {showPayload ? '▾ Hide payload' : '▸ Payload preview'}
                </button>
                {showPayload && (
                  <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-base p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
                    {WEBHOOK_PAYLOAD_EXAMPLE}
                  </pre>
                )}
              </div>
            }
          />
        </div>
      </section>

      {/* Rules */}
      <section className="space-y-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Alert rules
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Only enabled rules fire notifications. Disable anything that
              creates noise.
            </p>
          </div>
          <Tag variant="neutral">
            {enabledRuleCount}/{RULES.length} ENABLED
          </Tag>
        </header>

        {RULES.length === 0 ? (
          <EmptyState
            title="No alert rules"
            description="Add a rule to start receiving notifications when your agents trigger policy decisions."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {RULES.map((rule) => (
              <RuleCard
                key={rule.key}
                rule={rule}
                enabled={config[rule.key]}
                onToggle={(v) => update(rule.key, v)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex flex-col gap-3 border-t border-border-default pt-6 sm:flex-row sm:items-center sm:justify-between">
        <StatusBanner status={saveStatus} />
        <Button
          variant="primary"
          onClick={saveConfig}
          loading={saveStatus.kind === 'loading'}
          disabled={saveStatus.kind === 'loading' || !ownerId.trim()}
        >
          {saveStatus.kind === 'loading' ? 'Saving…' : 'Save alert config'}
        </Button>
      </div>

      {/* How alerts work */}
      <Card variant="default">
        <CardHeader>
          <CardTitle className="text-base">How alerts work</CardTitle>
          <CardDescription>
            When a rule fires, MandateZ sends an instant notification to every
            connected channel. Blocked events fire{' '}
            <span className="text-text-primary">before</span> the action
            executes — you know in real time, not after the fact.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

/* ----------------------------- primitives ------------------------------ */

function ChannelCard({
  title,
  description,
  connected,
  input,
  primaryAction,
  footnote,
  footnoteTone = 'muted',
  extras,
}: {
  title: string;
  description: string;
  connected: boolean;
  input: React.ReactNode;
  primaryAction?: React.ReactNode;
  footnote?: string;
  footnoteTone?: 'danger' | 'muted';
  extras?: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Tag variant={connected ? 'success' : 'neutral'}>
            {connected ? 'CONNECTED' : 'NOT SET'}
          </Tag>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {input}
        {primaryAction}
        {footnote && (
          <span
            className={cn(
              'font-mono text-[11px]',
              footnoteTone === 'danger'
                ? 'text-accent-danger'
                : 'text-text-muted',
            )}
          >
            {footnote}
          </span>
        )}
        {extras}
      </CardContent>
    </Card>
  );
}

function RuleCard({
  rule,
  enabled,
  onToggle,
}: {
  rule: RuleDef;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const severityVariant: 'danger' | 'warning' | 'info' = rule.severity;
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={cn(
        'group text-left transition-colors',
        'rounded-lg border bg-bg-elevated p-4',
        enabled
          ? 'border-border-strong'
          : 'border-border-default hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag variant={severityVariant}>{rule.severity.toUpperCase()}</Tag>
            {rule.actionTags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">
              {rule.label}
            </div>
            <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              {rule.hint}
            </div>
          </div>
        </div>
        <span
          className={cn(
            'relative shrink-0 h-6 w-11 rounded-full transition-colors',
            enabled ? 'bg-accent-primary' : 'bg-bg-overlay',
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
              enabled ? 'left-[22px]' : 'left-0.5',
            )}
          />
        </span>
      </div>
    </button>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') {
    return <span className="font-mono text-xs text-text-muted" />;
  }
  if (status.kind === 'success') {
    return (
      <span className="font-mono text-xs uppercase tracking-wider text-accent-success">
        ✓ {status.message}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs uppercase tracking-wider text-accent-danger">
      ✗ {status.message}
    </span>
  );
}
