'use client';

import { useState } from 'react';
import Link from 'next/link';

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

const RISK_STYLE: Record<RiskLevel, { label: string; badge: string; dot: string }> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-900/40 text-red-300 border-red-800',
    dot: 'bg-red-400',
  },
  high: {
    label: 'High',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-800',
    dot: 'bg-amber-400',
  },
  medium: {
    label: 'Medium',
    badge: 'bg-yellow-900/30 text-yellow-300 border-yellow-800',
    dot: 'bg-yellow-400',
  },
};

function riskScoreColor(score: number): { text: string; bar: string; label: string } {
  if (score >= 75) return { text: 'text-red-400', bar: 'bg-red-500', label: 'Severe Exposure' };
  if (score >= 50) return { text: 'text-amber-400', bar: 'bg-amber-500', label: 'High Exposure' };
  if (score >= 25) return { text: 'text-yellow-400', bar: 'bg-yellow-500', label: 'Moderate Exposure' };
  return { text: 'text-emerald-400', bar: 'bg-emerald-500', label: 'Low Exposure' };
}

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
        body: JSON.stringify({
          owner_id: ownerId.trim() || undefined,
          scan_targets: {
            github_token: githubToken.trim() || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Scan failed' }))) as { error?: string };
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
      <div className="border border-gray-800 rounded-lg p-6 bg-gray-950/40">
        <div className="space-y-5">
          <div>
            <label htmlFor="owner-id" className="block text-sm font-medium text-gray-200 mb-2">
              Owner ID <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="owner-id"
              type="text"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="user_2abc... — leave blank for anonymous demo scan"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="github-token" className="block text-sm font-medium text-gray-200 mb-2">
              GitHub Token <span className="text-gray-500">(optional)</span>
            </label>
            <input
              id="github-token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_... for deeper scan of your repositories"
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">
              Scans <code className="font-mono text-gray-400">.github/workflows/*.yml</code> for unregistered LangChain, CrewAI, AutoGen and LlamaIndex agents. Token is used in-memory and never stored.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {scanning ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
                  </svg>
                  Scanning...
                </>
              ) : (
                <>
                  Run Shadow Scan
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </>
              )}
            </button>
            <span className="text-xs text-gray-500">
              Free · no account required
            </span>
          </div>

          <p className="text-xs text-gray-500 border-t border-gray-900 pt-4">
            Basic scan runs without tokens using representative patterns. Connect GitHub for full repository analysis.
          </p>
        </div>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-900/20 rounded-lg p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Agents Discovered" value={result.summary.total_discovered} color="text-gray-100" />
            <SummaryCard label="Unregistered" value={result.summary.unregistered} color="text-amber-400" />
            <SummaryCard label="Critical Risk" value={result.summary.critical_risk} color="text-red-400" />
            <SummaryCard label="Scan Mode" value={result.scan_mode === 'authenticated' ? 'LIVE' : 'DEMO'} color={result.scan_mode === 'authenticated' ? 'text-emerald-400' : 'text-blue-400'} />
          </div>

          {/* Agents table */}
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60 border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Framework</th>
                    <th className="px-4 py-3 font-medium">Risk</th>
                    <th className="px-4 py-3 font-medium">Registered</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {result.discovered_agents.map((agent, i) => {
                    const risk = RISK_STYLE[agent.risk_level];
                    return (
                      <tr key={i} className="hover:bg-gray-900/30 transition-colors">
                        <td className="px-4 py-3 text-gray-200 font-mono text-xs max-w-[220px] truncate">
                          {agent.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[260px] truncate">
                          {agent.location}
                        </td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{agent.framework}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${risk.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                            {risk.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {agent.mandatez_registered ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-emerald-900/40 text-emerald-300 border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-gray-900 text-gray-400 border-gray-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                              Shadow
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {agent.mandatez_registered ? (
                            <span className="text-xs text-gray-600">—</span>
                          ) : (
                            <Link
                              href={buildRegisterHref(agent)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                            >
                              Register with MandateZ
                              <span aria-hidden>→</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk report card */}
          <RiskReportCard
            summary={result.summary}
            onDownload={downloadReport}
            onShare={shareReport}
          />

          {/* Free tier funnel */}
          {result.summary.unregistered > 0 && (
            <div className="border border-blue-900/60 bg-blue-950/20 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-900/60 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-300">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-100">
                    You have {result.summary.unregistered} ungoverned {result.summary.unregistered === 1 ? 'agent' : 'agents'}.
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    The scan is free. Registering and governing your agents requires a MandateZ account — five-minute setup, first agent free forever.
                  </p>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                  >
                    Start governing these agents
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
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
  const color = riskScoreColor(summary.risk_score);
  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-gradient-to-br from-gray-950 to-gray-900/40">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Shadow Agent Risk Report</div>
          <h3 className="text-xl font-semibold text-gray-100 mt-1">Your Agent Exposure</h3>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-bold ${color.text} font-mono leading-none`}>
            {summary.risk_score}
            <span className="text-2xl text-gray-600">/100</span>
          </div>
          <div className={`text-xs uppercase tracking-wider mt-2 ${color.text}`}>
            {color.label}
          </div>
        </div>
      </div>

      <div className="mt-5 h-2 bg-gray-900 rounded-full overflow-hidden">
        <div
          className={`h-full ${color.bar} transition-all duration-700`}
          style={{ width: `${summary.risk_score}%` }}
        />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Total discovered</div>
          <div className="text-gray-100 text-lg font-semibold mt-1">{summary.total_discovered}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Unregistered</div>
          <div className="text-amber-300 text-lg font-semibold mt-1">{summary.unregistered}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Critical</div>
          <div className="text-red-300 text-lg font-semibold mt-1">{summary.critical_risk}</div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 pt-5 border-t border-gray-800">
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-white text-gray-900 text-sm font-medium transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Download PDF Report
        </button>
        <button
          onClick={onShare}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-800 hover:bg-gray-900 text-gray-300 text-sm font-medium transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
          Share this report
        </button>
      </div>
    </div>
  );
}
