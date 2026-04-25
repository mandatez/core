'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
  NumberDisplay,
  Tag,
  cn,
} from '@/components/ui';

type RiskLevel = 'critical' | 'high' | 'medium';

interface DiscoveredAgent {
  name: string;
  location: string;
  framework: string;
  risk_level: RiskLevel;
  mandatez_registered: boolean;
  recommendation: string;
  evidence?: string;
}

interface ShadowScanSummary {
  total_discovered: number;
  unregistered: number;
  critical_risk: number;
  risk_score: number;
}

interface ShadowScanResponse {
  discovered_agents: DiscoveredAgent[];
  summary: ShadowScanSummary;
  scan_mode: 'authenticated' | 'demo';
  scanned_targets: string[];
}

const RISK_TAG: Record<RiskLevel, 'danger' | 'warning'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'warning',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
};

function riskScoreAccent(
  score: number,
): { accent: 'success' | 'warning' | 'danger'; label: string } {
  if (score >= 75) return { accent: 'danger', label: 'SEVERE EXPOSURE' };
  if (score >= 50) return { accent: 'danger', label: 'HIGH EXPOSURE' };
  if (score >= 25) return { accent: 'warning', label: 'MODERATE EXPOSURE' };
  return { accent: 'success', label: 'LOW EXPOSURE' };
}

const inputClass =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 ' +
  'text-sm font-mono text-text-primary placeholder:text-text-muted ' +
  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 ' +
  'transition-colors';

export function ShadowScanClient({ initialOwnerId = '' }: { initialOwnerId?: string }) {
  const [ownerId, setOwnerId] = useState(initialOwnerId);
  const [githubToken, setGithubToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShadowScanResponse | null>(null);

  async function handleScan() {
    setError(null);
    setScanning(true);
    setResult(null);

    try {
      const res = await fetch('/api/shadow-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: ownerId.trim() || undefined,
          scan_targets: {
            github_token: githubToken.trim() || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Scan failed' }))) as {
          error?: string;
        };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as ShadowScanResponse;
      setResult(data);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'mandatez_shadow_scan_unregistered',
          String(data.summary.unregistered),
        );
        window.dispatchEvent(new Event('mandatez:shadow-scan-updated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function downloadReport() {
    if (!result) return;
    if (!ownerId.trim()) {
      setError('Enter an owner_id to generate a downloadable PDF report.');
      return;
    }
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ owner_id: ownerId.trim(), report_type: 'owasp' }),
      });
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mandatez-shadow-agent-risk-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed');
    }
  }

  function shareReport() {
    if (!result) return;
    const text = `I ran a Shadow Agent Scan with MandateZ — found ${result.summary.unregistered} ungoverned AI agents in my stack (risk score ${result.summary.risk_score}/100). How blind is yours?`;
    const url = 'https://mandatez.com/shadow-scan';
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    if (typeof window !== 'undefined') window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }

  function buildRegisterHref(agent: DiscoveredAgent): string {
    const params = new URLSearchParams({
      name: agent.name.split(' / ')[0],
      framework: agent.framework,
      source: 'shadow-scan',
    });
    return `/identity?${params.toString()}`;
  }

  return (
    <div className="space-y-8">
      {/* Scan form */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-base">Run a scan</CardTitle>
          <CardDescription>
            Free, no account required. Add a GitHub token for deep repository
            analysis — token is used in-memory and never stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="owner-id"
              className="block font-mono text-[10px] uppercase tracking-widest text-text-muted"
            >
              Owner ID <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="owner-id"
              type="text"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="user_2abc… — leave blank for anonymous demo scan"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="github-token"
              className="block font-mono text-[10px] uppercase tracking-widest text-text-muted"
            >
              GitHub token{' '}
              <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_… for deeper scan of your repositories"
              className={inputClass}
            />
            <p className="text-xs text-text-muted">
              Scans{' '}
              <code className="font-mono text-text-secondary">
                .github/workflows/*.yml
              </code>{' '}
              for unregistered LangChain, CrewAI, AutoGen and LlamaIndex
              agents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleScan}
              loading={scanning}
              disabled={scanning}
            >
              {scanning ? 'Scanning…' : 'Run shadow scan'}
            </Button>
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
              FREE · NO ACCOUNT REQUIRED
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card variant="danger-tinted">
          <CardContent className="px-4 py-3">
            <p className="text-sm text-accent-danger">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* During scan */}
      {scanning && !result && (
        <Card variant="default">
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <LoadingSpinner size="lg" />
            <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
              Scanning targets · cross-referencing registered agents
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pre-scan empty state */}
      {!scanning && !result && !error && (
        <EmptyState
          title="What is shadow agent discovery?"
          description="Most teams don't know which AI agents are running in their stack. Shadow Scan inspects your repos, workflows, and infrastructure for agent fingerprints, then flags any operating without identity, policy, or audit trail."
        />
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Stats strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="DISCOVERED"
              value={result.summary.total_discovered}
            />
            <SummaryCard
              label="UNREGISTERED"
              value={result.summary.unregistered}
              accent="warning"
            />
            <SummaryCard
              label="CRITICAL RISK"
              value={result.summary.critical_risk}
              accent="danger"
            />
            <SummaryCard
              label="SCAN MODE"
              value={result.scan_mode === 'authenticated' ? 'LIVE' : 'DEMO'}
              accent={result.scan_mode === 'authenticated' ? 'success' : 'primary'}
            />
          </div>

          {/* Post-scan all-clear empty state */}
          {result.discovered_agents.length === 0 ? (
            <EmptyState
              title="All clear"
              description="No shadow agents detected in the targets we could reach. Run again with a GitHub token connected to deepen the scan."
              action={<Tag variant="success">CLEAN</Tag>}
            />
          ) : (
            <section className="space-y-3">
              <header className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-text-primary">
                  Discovered agents
                </h2>
                <Tag variant="neutral">
                  {result.discovered_agents.length} TOTAL
                </Tag>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                {result.discovered_agents.map((agent, i) => (
                  <DiscoveredAgentCard
                    key={i}
                    agent={agent}
                    registerHref={buildRegisterHref(agent)}
                  />
                ))}
              </div>
            </section>
          )}

          <RiskReportCard
            summary={result.summary}
            onDownload={downloadReport}
            onShare={shareReport}
          />

          {result.summary.unregistered > 0 && (
            <Card variant="default">
              <CardHeader>
                <CardTitle className="text-base">
                  You have {result.summary.unregistered} ungoverned{' '}
                  {result.summary.unregistered === 1 ? 'agent' : 'agents'}
                </CardTitle>
                <CardDescription>
                  The scan is free. Registering and governing your agents
                  requires a MandateZ account — five-minute setup, first agent
                  free forever.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="primary" asChild>
                  <Link href="/pricing">Start governing these agents →</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'success' | 'warning' | 'danger' | 'primary';
}) {
  return (
    <Card variant="default">
      <CardContent className="px-4 py-4">
        <NumberDisplay value={value} size="sm" accent={accent} />
        <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function DiscoveredAgentCard({
  agent,
  registerHref,
}: {
  agent: DiscoveredAgent;
  registerHref: string;
}) {
  const variant = agent.mandatez_registered ? 'default' : 'danger-tinted';
  return (
    <Card variant={variant}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-mono break-all leading-snug">
            {agent.name}
          </CardTitle>
          <Tag variant={RISK_TAG[agent.risk_level]}>
            {RISK_LABEL[agent.risk_level]}
          </Tag>
        </div>
        <CardDescription className="font-mono text-[11px] break-all">
          {agent.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag variant="neutral">{agent.framework.toUpperCase()}</Tag>
          {agent.mandatez_registered ? (
            <Tag variant="success">REGISTERED</Tag>
          ) : (
            <Tag variant="danger">SHADOW</Tag>
          )}
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">
          {agent.recommendation}
        </p>
        {!agent.mandatez_registered && (
          <Button variant="primary" size="sm" asChild>
            <Link href={registerHref}>Register this agent →</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RiskReportCard({
  summary,
  onDownload,
  onShare,
}: {
  summary: ShadowScanSummary;
  onDownload: () => void;
  onShare: () => void;
}) {
  const meta = riskScoreAccent(summary.risk_score);
  const barColor =
    meta.accent === 'success'
      ? 'bg-accent-success'
      : meta.accent === 'warning'
        ? 'bg-accent-warning'
        : 'bg-accent-danger';

  return (
    <Card variant="elevated">
      <CardHeader>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              SHADOW AGENT RISK REPORT
            </div>
            <CardTitle className="mt-1 text-xl">
              Your agent exposure
            </CardTitle>
          </div>
          <div className="text-right">
            <NumberDisplay
              value={summary.risk_score}
              suffix="/100"
              size="sm"
              accent={meta.accent}
            />
            <div
              className={cn(
                'mt-2 font-mono text-[10px] uppercase tracking-widest',
                meta.accent === 'success' && 'text-accent-success',
                meta.accent === 'warning' && 'text-accent-warning',
                meta.accent === 'danger' && 'text-accent-danger',
              )}
            >
              {meta.label}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-base">
          <div
            className={cn('h-full transition-all duration-700', barColor)}
            style={{ width: `${summary.risk_score}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="DISCOVERED" value={summary.total_discovered} />
          <Stat
            label="UNREGISTERED"
            value={summary.unregistered}
            accent="warning"
          />
          <Stat
            label="CRITICAL"
            value={summary.critical_risk}
            accent="danger"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border-default pt-5">
          <Button variant="primary" onClick={onDownload}>
            Download PDF report
          </Button>
          <Button variant="secondary" onClick={onShare}>
            Share this report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'warning' | 'danger';
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </div>
      <div className="mt-1">
        <NumberDisplay value={value} size="sm" accent={accent} />
      </div>
    </div>
  );
}
