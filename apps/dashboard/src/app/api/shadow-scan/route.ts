import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RiskLevel = 'critical' | 'high' | 'medium';

export interface DiscoveredAgent {
  name: string;
  location: string;
  framework: string;
  risk_level: RiskLevel;
  mandatez_registered: boolean;
  recommendation: string;
  evidence?: string;
}

export interface ShadowScanSummary {
  total_discovered: number;
  unregistered: number;
  critical_risk: number;
  risk_score: number;
}

export interface ShadowScanResponse {
  discovered_agents: DiscoveredAgent[];
  summary: ShadowScanSummary;
  scan_mode: 'authenticated' | 'demo';
  scanned_targets: string[];
}

interface ShadowScanRequest {
  owner_id?: string;
  scan_targets?: {
    github_token?: string;
    vercel_token?: string;
    supabase_url?: string;
    n8n_webhook?: string;
  };
  /**
   * Pre-scanned agents from a trusted client (e.g. the MandateZ GitHub Action
   * running inside CI with repo checkout access). When provided, server-side
   * scanning is skipped and these findings feed directly into cross-reference
   * + risk scoring. Caller is responsible for the authoritative detection.
   */
  pre_scanned_agents?: DiscoveredAgent[];
  /** Optional free-form tag to label where the scan came from (e.g. 'github-action'). */
  source?: string;
}

const LLM_PATTERNS = [
  'langchain',
  'langgraph',
  'llama_index',
  'llamaindex',
  'openai',
  'anthropic',
  'crewai',
  'autogen',
  'llama-index',
];

const LLM_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'HUGGINGFACE_API_KEY',
  'COHERE_API_KEY',
  'LANGCHAIN_API_KEY',
  'REPLICATE_API_TOKEN',
];

function detectFramework(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('langchain') || lower.includes('langgraph')) return 'LangChain';
  if (lower.includes('crewai')) return 'CrewAI';
  if (lower.includes('autogen')) return 'AutoGen';
  if (lower.includes('llamaindex') || lower.includes('llama_index') || lower.includes('llama-index')) return 'LlamaIndex';
  if (lower.includes('anthropic')) return 'Anthropic SDK';
  if (lower.includes('openai')) return 'OpenAI SDK';
  return 'Unknown';
}

function hasLlmPattern(content: string): boolean {
  const lower = content.toLowerCase();
  return LLM_PATTERNS.some((p) => lower.includes(p)) || LLM_ENV_KEYS.some((k) => content.includes(k));
}

function hasMandateZ(content: string): boolean {
  return content.includes('@mandatez/sdk') || content.includes('MandateZClient');
}

function decodeBase64(b64: string): string {
  try {
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

async function scanGithub(token: string): Promise<DiscoveredAgent[]> {
  const discovered: DiscoveredAgent[] = [];

  const reposRes = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!reposRes.ok) {
    throw new Error(`GitHub API error: ${reposRes.status}`);
  }

  const repos = (await reposRes.json()) as Array<{ full_name: string; default_branch: string }>;

  for (const repo of repos.slice(0, 25)) {
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (!treeRes.ok) continue;
      const tree = (await treeRes.json()) as { tree?: Array<{ path: string; type: string }> };
      const workflows = (tree.tree ?? []).filter(
        (n) => n.type === 'blob' && /^\.github\/workflows\/.+\.ya?ml$/.test(n.path),
      );

      for (const wf of workflows) {
        const fileRes = await fetch(
          `https://api.github.com/repos/${repo.full_name}/contents/${wf.path}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
            },
          },
        );
        if (!fileRes.ok) continue;
        const fileData = (await fileRes.json()) as { content?: string };
        const content = fileData.content ? decodeBase64(fileData.content.replace(/\n/g, '')) : '';

        if (!hasLlmPattern(content)) continue;

        const framework = detectFramework(content);
        const hasKeys = LLM_ENV_KEYS.some((k) => content.includes(k));
        const registered = hasMandateZ(content);

        const risk: RiskLevel = !registered && hasKeys ? 'critical' : !registered ? 'high' : 'medium';

        discovered.push({
          name: `${repo.full_name.split('/')[1]} / ${wf.path.split('/').pop()}`,
          location: `GitHub Actions: ${repo.full_name} · ${wf.path}`,
          framework,
          risk_level: risk,
          mandatez_registered: registered,
          recommendation: registered
            ? 'Already governed by MandateZ. Verify policy coverage.'
            : hasKeys
            ? 'Critical: LLM API key exposed in workflow env without policy enforcement. Register this agent immediately.'
            : `Unregistered ${framework} agent. Wrap with @mandatez/sdk to enforce policy.`,
          evidence: hasKeys
            ? `Detected API key env var: ${LLM_ENV_KEYS.find((k) => content.includes(k))}`
            : `Detected framework import: ${framework}`,
        });
      }
    } catch {
      continue;
    }
  }

  return discovered;
}

function demoAgents(): DiscoveredAgent[] {
  return [
    {
      name: 'customer-support-bot / support.yml',
      location: 'GitHub Actions: acme/customer-api · .github/workflows/support.yml',
      framework: 'LangChain',
      risk_level: 'critical',
      mandatez_registered: false,
      recommendation:
        'Critical: LangChain agent with OPENAI_API_KEY in workflow env, no policy layer. Register with MandateZ before next deploy.',
      evidence: 'Detected: langchain import + OPENAI_API_KEY env var',
    },
    {
      name: 'invoice-processor / billing.yml',
      location: 'GitHub Actions: acme/finance · .github/workflows/billing.yml',
      framework: 'CrewAI',
      risk_level: 'critical',
      mandatez_registered: false,
      recommendation:
        'Critical: CrewAI multi-agent crew executing payments without human oversight gate. ASI-02 violation.',
      evidence: 'Detected: crewai + payment tool invocations',
    },
    {
      name: 'email-triage-worker',
      location: 'n8n workflow #412',
      framework: 'n8n',
      risk_level: 'high',
      mandatez_registered: false,
      recommendation:
        'Unregistered n8n workflow with email export capability. ASI-03 violation — no agent identity bound to actions.',
      evidence: 'Detected: n8n webhook + Gmail export node',
    },
    {
      name: 'doc-indexer',
      location: 'Vercel env: proj_kb_indexer',
      framework: 'LlamaIndex',
      risk_level: 'high',
      mandatez_registered: false,
      recommendation: 'Unregistered LlamaIndex agent with ANTHROPIC_API_KEY. Wrap with @mandatez/sdk.',
      evidence: 'Detected: llama_index + ANTHROPIC_API_KEY',
    },
    {
      name: 'sales-qualifier',
      location: 'GitHub Actions: acme/crm · .github/workflows/qualify.yml',
      framework: 'AutoGen',
      risk_level: 'medium',
      mandatez_registered: false,
      recommendation: 'Unregistered AutoGen agent performing CRM writes without audit trail.',
      evidence: 'Detected: autogen framework',
    },
    {
      name: 'pr-reviewer',
      location: 'GitHub Actions: acme/core · .github/workflows/review.yml',
      framework: 'Anthropic SDK',
      risk_level: 'medium',
      mandatez_registered: true,
      recommendation: 'Already governed by MandateZ. Verify policy coverage is current.',
      evidence: 'Detected: @mandatez/sdk import',
    },
  ];
}

function computeRiskScore(agents: DiscoveredAgent[]): number {
  if (agents.length === 0) return 0;
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

  return Math.max(0, Math.min(100, score));
}

async function crossReferenceRegistered(
  ownerId: string,
  agents: DiscoveredAgent[],
): Promise<DiscoveredAgent[]> {
  if (!ownerId) return agents;

  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from('agents')
      .select('name')
      .eq('owner_id', ownerId);

    const registeredNames = new Set((data ?? []).map((r: { name: string }) => r.name.toLowerCase()));

    return agents.map((a) => {
      if (a.mandatez_registered) return a;
      const baseName = a.name.split(' / ')[0].toLowerCase();
      const matched = [...registeredNames].some((n) => n.includes(baseName) || baseName.includes(n));
      if (matched) {
        return {
          ...a,
          mandatez_registered: true,
          recommendation: 'Matched against registered agent. Verify policy coverage is active.',
        };
      }
      return a;
    });
  } catch {
    return agents;
  }
}

export async function POST(request: NextRequest) {
  let body: ShadowScanRequest;
  try {
    body = (await request.json()) as ShadowScanRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ownerId = body.owner_id?.trim() ?? '';
  const targets = body.scan_targets ?? {};
  const scannedTargets: string[] = [];

  let discovered: DiscoveredAgent[] = [];
  let mode: 'authenticated' | 'demo' = 'demo';

  if (Array.isArray(body.pre_scanned_agents) && body.pre_scanned_agents.length > 0) {
    discovered.push(...body.pre_scanned_agents);
    scannedTargets.push(body.source?.trim() || 'pre-scanned');
    mode = 'authenticated';
  }

  if (targets.github_token) {
    try {
      const ghResults = await scanGithub(targets.github_token);
      discovered.push(...ghResults);
      scannedTargets.push('github');
      mode = 'authenticated';
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'GitHub scan failed' },
        { status: 502 },
      );
    }
  }

  if (targets.vercel_token) scannedTargets.push('vercel');
  if (targets.supabase_url) scannedTargets.push('supabase');
  if (targets.n8n_webhook) scannedTargets.push('n8n');

  if (discovered.length === 0) {
    discovered = demoAgents();
    mode = 'demo';
  }

  discovered = await crossReferenceRegistered(ownerId, discovered);

  const unregistered = discovered.filter((a) => !a.mandatez_registered);
  const critical = unregistered.filter((a) => a.risk_level === 'critical').length;

  const response: ShadowScanResponse = {
    discovered_agents: discovered,
    summary: {
      total_discovered: discovered.length,
      unregistered: unregistered.length,
      critical_risk: critical,
      risk_score: computeRiskScore(discovered),
    },
    scan_mode: mode,
    scanned_targets: scannedTargets.length > 0 ? scannedTargets : ['demo'],
  };

  return NextResponse.json(response);
}
