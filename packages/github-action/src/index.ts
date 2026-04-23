import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Types — mirror apps/dashboard/src/app/api/shadow-scan/route.ts
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Detection patterns — kept in sync with the server-side scanner
// ---------------------------------------------------------------------------

interface FrameworkMatch {
  framework: string;
  pattern: RegExp;
}

const FRAMEWORKS: FrameworkMatch[] = [
  { framework: 'LangChain', pattern: /\blang(?:chain|graph)\b/i },
  { framework: 'CrewAI', pattern: /\bcrewai\b/i },
  { framework: 'AutoGen', pattern: /\bautogen\b/i },
  { framework: 'LlamaIndex', pattern: /\bllama[_-]?index\b/i },
  { framework: 'Anthropic SDK', pattern: /\banthropic\b/i },
  { framework: 'OpenAI SDK', pattern: /\bopenai\b/i },
];

const API_KEY_PATTERN =
  /\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|HUGGINGFACE_API_KEY|COHERE_API_KEY|LANGCHAIN_API_KEY|REPLICATE_API_TOKEN)\b/;

const MANDATEZ_PATTERN = /@mandatez\/sdk|MandateZClient|MandateZAgent|MandateZN8nHook/;

// Overly broad permissions block in a workflow file.
const BROAD_PERMISSIONS_PATTERN =
  /permissions\s*:\s*(write-all|read-all|"?\*"?)/i;

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

async function findWorkflowFiles(workspace: string): Promise<string[]> {
  const dir = path.join(workspace, '.github', 'workflows');
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) continue;
    results.push(path.join(dir, entry));
  }
  return results.sort();
}

function detectFramework(content: string): string | null {
  for (const f of FRAMEWORKS) {
    if (f.pattern.test(content)) return f.framework;
  }
  return null;
}

function matchedApiKey(content: string): string | null {
  const m = content.match(API_KEY_PATTERN);
  return m ? m[1] : null;
}

function hasMandateZ(content: string): boolean {
  return MANDATEZ_PATTERN.test(content);
}

function hasBroadPermissions(content: string): boolean {
  return BROAD_PERMISSIONS_PATTERN.test(content);
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

async function scanWorkspace(workspace: string, repoSlug: string): Promise<DiscoveredAgent[]> {
  const files = await findWorkflowFiles(workspace);
  const found: DiscoveredAgent[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const relPath = path.relative(workspace, filePath).replace(/\\/g, '/');
    const framework = detectFramework(content);
    const apiKey = matchedApiKey(content);

    if (!framework && !apiKey) continue;

    const registered = hasMandateZ(content);
    const broad = hasBroadPermissions(content);
    const detectedFramework = framework ?? 'Unknown';

    let risk: RiskLevel;
    if (!registered && apiKey) risk = 'critical';
    else if (!registered) risk = 'high';
    else if (broad) risk = 'medium';
    else risk = 'medium';

    const evidenceParts: string[] = [];
    if (framework) evidenceParts.push(`framework: ${framework}`);
    if (apiKey) evidenceParts.push(`env var: ${apiKey}`);
    if (broad) evidenceParts.push('workflow uses overly broad permissions');
    if (registered) evidenceParts.push('@mandatez/sdk import detected');

    let recommendation: string;
    if (registered) {
      recommendation = 'Already governed by MandateZ. Verify policy coverage is current.';
    } else if (apiKey) {
      recommendation = `Critical: LLM API key (${apiKey}) exposed in workflow env without policy enforcement. Register this agent before next deploy.`;
    } else {
      recommendation = `Unregistered ${detectedFramework} agent. Wrap with @mandatez/sdk to enforce policy and signed audit.`;
    }

    const baseName = path.basename(filePath);
    const displayName = repoSlug ? `${repoSlug.split('/')[1]} / ${baseName}` : baseName;
    const location = repoSlug
      ? `GitHub Actions: ${repoSlug} · ${relPath}`
      : `GitHub Actions: ${relPath}`;

    found.push({
      name: displayName,
      location,
      framework: detectedFramework,
      risk_level: risk,
      mandatez_registered: registered,
      recommendation,
      evidence: evidenceParts.join(' · '),
    });
  }

  return found;
}

// ---------------------------------------------------------------------------
// Dashboard POST
// ---------------------------------------------------------------------------

async function postToDashboard(
  dashboardUrl: string,
  ownerId: string,
  agents: DiscoveredAgent[],
): Promise<ShadowScanResponse> {
  const endpoint = `${dashboardUrl.replace(/\/+$/, '')}/api/shadow-scan`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner_id: ownerId || undefined,
      pre_scanned_agents: agents,
      source: 'github-action',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`shadow-scan API ${res.status}: ${body || res.statusText}`);
  }

  return (await res.json()) as ShadowScanResponse;
}

// ---------------------------------------------------------------------------
// Local fallback risk score (mirrors server logic)
// ---------------------------------------------------------------------------

function computeRiskScore(agents: DiscoveredAgent[]): ShadowScanSummary {
  const unregistered = agents.filter((a) => !a.mandatez_registered);
  const critical = unregistered.filter((a) => a.risk_level === 'critical').length;
  const high = unregistered.filter((a) => a.risk_level === 'high').length;
  const medium = unregistered.filter((a) => a.risk_level === 'medium').length;
  const registered = agents.length - unregistered.length;

  let score = 0;
  if (unregistered.length > 0) score += 40;
  score += critical * 18;
  score += high * 10;
  score += medium * 5;
  score -= registered * 4;

  return {
    total_discovered: agents.length,
    unregistered: unregistered.length,
    critical_risk: critical,
    risk_score: Math.max(0, Math.min(100, score)),
  };
}

// ---------------------------------------------------------------------------
// PR comment
// ---------------------------------------------------------------------------

const COMMENT_MARKER = '<!-- mandatez-agent-scan -->';

function riskBadge(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return '🔴 Critical';
    case 'high':
      return '🟠 High';
    case 'medium':
      return '🟡 Medium';
  }
}

function buildPrComment(
  agents: DiscoveredAgent[],
  summary: ShadowScanSummary,
  dashboardUrl: string,
): string {
  const scoreEmoji =
    summary.risk_score >= 75 ? '🚨' : summary.risk_score >= 50 ? '⚠️' : summary.risk_score >= 25 ? '🟡' : '✅';
  const headline =
    summary.unregistered === 0
      ? '**All detected agents are governed by MandateZ.**'
      : `**${summary.unregistered} ungoverned agent${summary.unregistered === 1 ? '' : 's'} found** (${summary.critical_risk} critical).`;

  const rows = agents
    .map((a) => {
      const regCell = a.mandatez_registered ? '✅ Governed' : '❌ Shadow';
      const cleanName = a.name.replace(/\|/g, '\\|');
      const cleanLoc = a.location.replace(/\|/g, '\\|');
      return `| ${cleanName} | \`${cleanLoc}\` | ${a.framework} | ${riskBadge(a.risk_level)} | ${regCell} |`;
    })
    .join('\n');

  const registerUrl = `${dashboardUrl.replace(/\/+$/, '')}/shadow-scan`;
  const table = agents.length
    ? `\n| Agent | Location | Framework | Risk | Status |\n|---|---|---|---|---|\n${rows}\n`
    : '\n_No AI agents detected in `.github/workflows/`._\n';

  return `${COMMENT_MARKER}
### ${scoreEmoji} MandateZ Agent Security Scan — Risk Score **${summary.risk_score}/100**

${headline}
${table}
${
    summary.unregistered > 0
      ? `\n[Register the ungoverned agents →](${registerUrl})\n`
      : ''
  }
<sub>Scanned by [MandateZ](https://github.com/mandatez/core) · wrap agents with \`@mandatez/sdk\` to close this gap.</sub>`;
}

async function upsertPrComment(
  token: string,
  body: string,
): Promise<void> {
  const ctx = github.context;
  const prNumber = ctx.payload.pull_request?.number;
  if (!prNumber) return;

  const octokit = github.getOctokit(token);
  const { owner, repo } = ctx.repo;

  const existing = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const prior = existing.data.find((c) => c.body?.includes(COMMENT_MARKER));
  if (prior) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: prior.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    const ownerId = core.getInput('owner-id');
    const failOnCritical = core.getBooleanInput('fail-on-critical');
    const commentOnPr = core.getBooleanInput('comment-on-pr');
    const dashboardUrl = core.getInput('dashboard-url') || 'https://core-dashboard-black.vercel.app';
    const githubToken = core.getInput('github-token');
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const repoSlug = process.env.GITHUB_REPOSITORY ?? '';

    core.info(`Scanning ${workspace} (repo: ${repoSlug || 'local'})`);

    const agents = await scanWorkspace(workspace, repoSlug);
    core.info(`Detected ${agents.length} AI agent${agents.length === 1 ? '' : 's'}`);

    let summary: ShadowScanSummary;
    let mode = 'local' as 'local' | 'dashboard';
    let responseAgents = agents;

    try {
      const response = await postToDashboard(dashboardUrl, ownerId, agents);
      summary = response.summary;
      responseAgents = response.discovered_agents;
      mode = 'dashboard';
      core.info(`Dashboard cross-reference complete (scan_mode=${response.scan_mode})`);
    } catch (err) {
      core.warning(
        `Dashboard POST failed, falling back to local risk score: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      summary = computeRiskScore(agents);
    }

    core.setOutput('risk_score', summary.risk_score);
    core.setOutput('total_discovered', summary.total_discovered);
    core.setOutput('unregistered', summary.unregistered);
    core.setOutput('critical_risk', summary.critical_risk);

    await core.summary
      .addHeading(`MandateZ Agent Scan — ${summary.risk_score}/100`)
      .addRaw(
        `Detected **${summary.total_discovered}** agent(s) · **${summary.unregistered}** ungoverned · **${summary.critical_risk}** critical (mode: ${mode}).`,
      )
      .write();

    if (commentOnPr && githubToken && github.context.payload.pull_request) {
      try {
        await upsertPrComment(githubToken, buildPrComment(responseAgents, summary, dashboardUrl));
      } catch (err) {
        core.warning(
          `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (failOnCritical && summary.critical_risk > 0) {
      core.setFailed(
        `Found ${summary.critical_risk} critical-risk ungoverned agent(s). Register them with MandateZ or set fail-on-critical=false to allow the workflow through.`,
      );
      return;
    }

    if (summary.unregistered > 0) {
      core.warning(
        `${summary.unregistered} ungoverned agent(s) detected — review them at ${dashboardUrl}/shadow-scan`,
      );
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

void run();
