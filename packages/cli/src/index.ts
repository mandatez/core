#!/usr/bin/env node

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve as resolvePath } from 'node:path';

const require = createRequire(import.meta.url);

const DEFAULT_DASHBOARD_URL = 'https://core-dashboard-black.vercel.app';
const DEFAULT_DIRECTORY_URL = 'https://core-directory.vercel.app';

function dashboardUrl(): string {
  return (process.env.MANDATEZ_DASHBOARD_URL ?? DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
}

function directoryUrl(): string {
  return (process.env.MANDATEZ_DIRECTORY_URL ?? DEFAULT_DIRECTORY_URL).replace(/\/+$/, '');
}

function cliVersion(): string {
  try {
    return (require('../package.json') as { version: string }).version;
  } catch {
    return 'unknown';
  }
}

function tryPackageVersion(name: string): string {
  try {
    return (require(`${name}/package.json`) as { version: string }).version;
  } catch {
    return 'not installed';
  }
}

function die(message: string, code = 1): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function requireOwnerId(optionValue: string | undefined): string {
  const value = (optionValue ?? process.env.MANDATEZ_OWNER_ID ?? '').trim();
  if (!value) {
    die('--owner-id is required (or set MANDATEZ_OWNER_ID env var)');
  }
  return value;
}

function formatTable(rows: Array<Record<string, string>>, headers: string[]): string {
  const widths = headers.map((h) =>
    Math.max(h.length, ...rows.map((r) => (r[h] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  const separator = widths.map((w) => '─'.repeat(w)).join('  ');
  const out: string[] = [];
  out.push(line(headers));
  out.push(separator);
  for (const r of rows) out.push(line(headers.map((h) => r[h] ?? '')));
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// scan
// ---------------------------------------------------------------------------

interface DiscoveredAgent {
  name: string;
  location: string;
  framework: string;
  risk_level: 'critical' | 'high' | 'medium';
  mandatez_registered: boolean;
  recommendation: string;
  evidence?: string;
}

interface ShadowScanResponse {
  discovered_agents: DiscoveredAgent[];
  summary: {
    total_discovered: number;
    unregistered: number;
    critical_risk: number;
    risk_score: number;
  };
  scan_mode: 'authenticated' | 'demo';
  scanned_targets: string[];
}

async function runScan(options: {
  ownerId?: string;
  githubToken?: string;
  out: string;
}): Promise<void> {
  const ownerId = requireOwnerId(options.ownerId);
  const url = `${dashboardUrl()}/api/shadow-scan`;

  const body = {
    owner_id: ownerId,
    scan_targets: options.githubToken ? { github_token: options.githubToken } : undefined,
  };

  process.stdout.write(`Scanning via ${url}...\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    die(`shadow-scan failed: HTTP ${res.status} ${text}`);
  }

  const data = (await res.json()) as ShadowScanResponse;

  const rows = data.discovered_agents.map((a) => ({
    Risk: a.risk_level.toUpperCase(),
    Registered: a.mandatez_registered ? 'yes' : 'no',
    Framework: a.framework,
    Name: a.name,
    Location: a.location.length > 60 ? a.location.slice(0, 57) + '...' : a.location,
  }));

  process.stdout.write('\n');
  process.stdout.write(formatTable(rows, ['Risk', 'Registered', 'Framework', 'Name', 'Location']));
  process.stdout.write('\n\n');

  process.stdout.write(
    `Summary: ${data.summary.total_discovered} discovered · ${data.summary.unregistered} unregistered · ${data.summary.critical_risk} critical · risk score ${data.summary.risk_score}/100 (${data.scan_mode} mode)\n`,
  );

  const outPath = resolvePath(process.cwd(), options.out);
  await writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');
  process.stdout.write(`Full report written to ${outPath}\n`);
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

type ReportType = 'owasp' | 'eu-ai-act' | 'hipaa';

async function runReport(options: {
  ownerId?: string;
  type: string;
  from?: string;
  to?: string;
  out: string;
}): Promise<void> {
  const ownerId = requireOwnerId(options.ownerId);
  const reportType = options.type as ReportType;
  if (!['owasp', 'eu-ai-act', 'hipaa'].includes(reportType)) {
    die(`--type must be one of: owasp, eu-ai-act, hipaa (got "${options.type}")`);
  }

  const url = `${dashboardUrl()}/api/reports/generate`;

  process.stdout.write(`Generating ${reportType} report via ${url}...\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: ownerId,
      report_type: reportType,
      format: 'pdf',
      from: options.from,
      to: options.to,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    die(`report generation failed: HTTP ${res.status} ${text}`);
  }

  const pdfBytes = new Uint8Array(await res.arrayBuffer());
  const outPath = resolvePath(process.cwd(), options.out);
  await writeFile(outPath, pdfBytes);

  process.stdout.write(`Report saved to ${outPath} (${pdfBytes.byteLength.toLocaleString()} bytes)\n`);
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

interface VerifyResponse {
  verified: boolean;
  requesting_agent?: {
    id: string;
    name: string;
    trust_score: number;
    trust_grade: string;
  };
  target_agent?: {
    id: string;
    name: string;
    trust_score: number;
    trust_grade: string;
    public_key: string;
  };
  verification?: {
    score_met: boolean;
    grade_met: boolean;
    required_min_score: number;
    required_min_grade: string;
    verification_id: string;
  };
  error?: string;
}

async function runVerify(
  targetAgentId: string,
  options: { requestingAgent?: string; minScore: string },
): Promise<void> {
  const requestingId = options.requestingAgent ?? process.env.MANDATEZ_AGENT_ID;
  if (!requestingId) {
    die('--requesting-agent is required (or set MANDATEZ_AGENT_ID env var)');
  }

  const minScore = Number.parseInt(options.minScore, 10);
  if (!Number.isFinite(minScore)) {
    die(`--min-score must be a number (got "${options.minScore}")`);
  }

  const url = `${directoryUrl()}/api/agents/verify`;
  process.stdout.write(`Verifying ${targetAgentId} via ${url}...\n`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesting_agent_id: requestingId,
      target_agent_id: targetAgentId,
      required_min_score: minScore,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as VerifyResponse;

  if (!res.ok) {
    die(`verification failed: HTTP ${res.status} ${data.error ?? ''}`);
  }

  const status = data.verified ? 'VERIFIED' : 'NOT VERIFIED';
  process.stdout.write(`\n${status}\n\n`);

  if (data.target_agent) {
    process.stdout.write(`  target agent:    ${data.target_agent.name} (${data.target_agent.id})\n`);
    process.stdout.write(`  trust score:     ${data.target_agent.trust_score}/100\n`);
    process.stdout.write(`  trust grade:     ${data.target_agent.trust_grade}\n`);
    process.stdout.write(`  public key:      ${data.target_agent.public_key.slice(0, 32)}...\n`);
  }
  if (data.verification) {
    process.stdout.write(`  required score:  ${data.verification.required_min_score} (met: ${data.verification.score_met})\n`);
    process.stdout.write(`  required grade:  ${data.verification.required_min_grade} (met: ${data.verification.grade_met})\n`);
    process.stdout.write(`  verification id: ${data.verification.verification_id}\n`);
  }

  if (!data.verified) process.exit(2);
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

async function runStatus(): Promise<void> {
  const cli = cliVersion();
  const sdk = tryPackageVersion('@mandatez/sdk');
  const mcp = tryPackageVersion('@mandatez/mcp');

  process.stdout.write(`MandateZ CLI  ${cli}\n`);
  process.stdout.write(`@mandatez/sdk ${sdk}\n`);
  process.stdout.write(`@mandatez/mcp ${mcp}\n\n`);

  const url = dashboardUrl();
  process.stdout.write(`Dashboard: ${url}\n`);

  try {
    const res = await fetch(url, { method: 'HEAD' });
    process.stdout.write(res.ok ? `  reachable (HTTP ${res.status})\n` : `  unreachable (HTTP ${res.status})\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`  unreachable (${message})\n`);
  }

  const dirUrl = directoryUrl();
  process.stdout.write(`Directory: ${dirUrl}\n`);
  try {
    const res = await fetch(dirUrl, { method: 'HEAD' });
    process.stdout.write(res.ok ? `  reachable (HTTP ${res.status})\n` : `  unreachable (HTTP ${res.status})\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`  unreachable (${message})\n`);
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('mandatez')
  .description('CLI for MandateZ — AI agent trust infrastructure')
  .version(cliVersion());

program
  .command('scan')
  .description('Scan for shadow agents (ungoverned AI workloads) across your stack')
  .option('--owner-id <id>', 'Owner ID to scope the scan (or MANDATEZ_OWNER_ID env var)')
  .option('--github-token <token>', 'GitHub token to enable authenticated scan of your repos')
  .option('--out <file>', 'Path to write the full JSON report', 'shadow-report.json')
  .action(async (opts) => {
    try {
      await runScan(opts);
    } catch (err) {
      die(err instanceof Error ? err.message : String(err));
    }
  });

program
  .command('report')
  .description('Generate a compliance report PDF (owasp | eu-ai-act | hipaa)')
  .option('--owner-id <id>', 'Owner ID to scope the report (or MANDATEZ_OWNER_ID env var)')
  .option('--type <type>', 'Report pack: owasp | eu-ai-act | hipaa', 'owasp')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--out <file>', 'Path to write the PDF', 'mandatez-report.pdf')
  .action(async (opts) => {
    try {
      await runReport(opts);
    } catch (err) {
      die(err instanceof Error ? err.message : String(err));
    }
  });

program
  .command('verify <agent-id>')
  .description('Verify another agent through the MandateZ directory')
  .option('--requesting-agent <id>', 'Your agent ID (or MANDATEZ_AGENT_ID env var)')
  .option('--min-score <number>', 'Minimum trust score required for verification', '60')
  .action(async (targetAgentId: string, opts) => {
    try {
      await runVerify(targetAgentId, opts);
    } catch (err) {
      die(err instanceof Error ? err.message : String(err));
    }
  });

program
  .command('status')
  .description('Show SDK / MCP / CLI versions and check dashboard reachability')
  .action(async () => {
    try {
      await runStatus();
    } catch (err) {
      die(err instanceof Error ? err.message : String(err));
    }
  });

program.parseAsync(process.argv).catch((err) => {
  die(err instanceof Error ? err.message : String(err));
});
