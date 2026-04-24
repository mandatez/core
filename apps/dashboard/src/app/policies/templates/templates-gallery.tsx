'use client';

import { useEffect, useMemo, useState } from 'react';

type Effect = 'allow' | 'block' | 'flag';
type ActionType = 'read' | 'write' | 'delete' | 'export' | 'call' | 'payment' | '*';

export interface TemplateRuleView {
  action_types: ActionType[];
  resource_pattern: string;
  effect: Effect;
}

export interface TemplateView {
  key: string;
  id: string;
  name: string;
  description: string;
  rules: TemplateRuleView[];
}

interface AgentOption {
  id: string;
  name: string;
}

const EFFECT_STYLE: Record<Effect, string> = {
  allow: 'text-green-400',
  block: 'text-red-400',
  flag: 'text-amber-400',
};

const EFFECT_LABEL: Record<Effect, string> = {
  allow: 'ALLOW',
  block: 'BLOCK',
  flag: 'FLAG',
};

export function TemplatesGallery({ templates }: { templates: TemplateView[] }) {
  const [ownerId, setOwnerId] = useState('');
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (stored) setOwnerId(stored);
  }, []);

  useEffect(() => {
    if (!ownerId.trim()) {
      setAgents([]);
      return;
    }
    setLoadingAgents(true);
    setAgentsError(null);
    const controller = new AbortController();
    fetch(`/api/agents/list?owner_id=${encodeURIComponent(ownerId.trim())}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((j: { agents?: AgentOption[]; error?: string }) => {
        if (j.error) throw new Error(j.error);
        setAgents(j.agents ?? []);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setAgentsError(err instanceof Error ? err.message : 'Failed to load agents');
      })
      .finally(() => setLoadingAgents(false));
    return () => controller.abort();
  }, [ownerId]);

  const persistOwnerId = (value: string) => {
    setOwnerId(value);
    if (typeof window !== 'undefined' && value.trim()) {
      window.localStorage.setItem('mandatez_owner_id', value.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-gray-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 mb-1">
            Owner ID
          </div>
          <input
            value={ownerId}
            onChange={(e) => persistOwnerId(e.target.value)}
            placeholder="owner_acme_prod"
            className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </label>
        <div className="text-xs text-gray-500">
          {loadingAgents
            ? 'Loading agents…'
            : agents.length > 0
              ? `${agents.length} agent${agents.length !== 1 ? 's' : ''} available`
              : ownerId.trim()
                ? 'No agents for this owner yet'
                : 'Enter your owner ID to enable "Apply"'}
        </div>
      </div>

      {agentsError && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {agentsError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard
            key={template.key}
            template={template}
            agents={agents}
            ownerId={ownerId.trim()}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  agents,
  ownerId,
}: {
  template: TemplateView;
  agents: AgentOption[];
  ownerId: string;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [appliedPolicyId, setAppliedPolicyId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const codeSnippet = useMemo(() => formatTemplateSnippet(template), [template]);

  const apply = async () => {
    if (!ownerId) {
      setApplyError('Set your Owner ID above first.');
      return;
    }
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/policies/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: ownerId,
          template_id: template.key,
          agent_id: selectedAgent || null,
        }),
      });
      const json = (await res.json()) as { policy?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAppliedPolicyId(json.policy?.id ?? null);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-5 flex flex-col gap-4">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-100 leading-snug">
            {template.name}
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 whitespace-nowrap">
            {template.rules.length} rules
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400 leading-relaxed">
          {template.description}
        </p>
        <div className="mt-2 text-[10px] font-mono text-gray-600">
          {template.id} · {template.key}
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
          Apply to agent
        </label>
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          disabled={agents.length === 0}
          className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 disabled:text-gray-600 focus:border-blue-500 focus:outline-none"
        >
          <option value="">All agents (owner-scoped)</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.id}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying || !ownerId}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed px-3 py-2 text-xs font-medium text-white transition-colors"
          >
            {applying ? 'Applying…' : 'Apply template'}
          </button>
        </div>
        {appliedPolicyId && (
          <div className="rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            Created policy{' '}
            <span className="font-mono text-emerald-200">{appliedPolicyId}</span>.
          </div>
        )}
        {applyError && (
          <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {applyError}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 border-t border-gray-800 pt-3">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="hover:text-gray-200 transition-colors"
        >
          {rulesOpen ? '▾ Hide rules' : '▸ View rules'}
        </button>
        <span className="text-gray-700">·</span>
        <button
          type="button"
          onClick={() => setCodeOpen((v) => !v)}
          className="hover:text-gray-200 transition-colors"
        >
          {codeOpen ? '▾ Hide code' : '▸ Copy as code'}
        </button>
      </div>

      {rulesOpen && (
        <div className="rounded-md border border-gray-800 bg-black/40 p-3">
          <div className="space-y-1 font-mono text-[11px]">
            {template.rules.map((rule, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span
                  className={`w-14 shrink-0 font-semibold ${EFFECT_STYLE[rule.effect]}`}
                >
                  {EFFECT_LABEL[rule.effect]}
                </span>
                <span className="text-gray-500 w-32 shrink-0 truncate">
                  {rule.action_types.join(',')}
                </span>
                <span className="text-gray-300 truncate">
                  {rule.resource_pattern}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {codeOpen && (
        <div className="rounded-md border border-gray-800 bg-black/40">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
              {template.key}.ts
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-blue-300 transition-colors"
            >
              {codeCopied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <pre className="text-[11px] text-gray-300 p-3 overflow-x-auto font-mono leading-relaxed">
            {codeSnippet}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatTemplateSnippet(template: TemplateView): string {
  const rulesSrc = template.rules
    .map(
      (r, i) =>
        `    { id: 'r${i + 1}', action_types: ${JSON.stringify(r.action_types)}, resource_pattern: '${r.resource_pattern}', effect: '${r.effect}' }`,
    )
    .join(',\n');
  return `import { POLICY_TEMPLATES, MandateZClient } from '@mandatez/sdk';

// Use the template directly:
const template = POLICY_TEMPLATES.${template.key};

// Or hand-roll the same rules:
const policy = {
  id: '${template.id}',
  owner_id: 'your_owner_id',
  name: ${JSON.stringify(template.name)},
  rules: [
${rulesSrc}
  ],
};

const client = new MandateZClient({
  agentId: 'ag_...',
  ownerId: 'your_owner_id',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
  policies: [policy],
});`;
}
