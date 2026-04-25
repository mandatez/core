'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tag,
  cn,
} from '@/components/ui';

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

const EFFECT_TAG: Record<Effect, 'success' | 'danger' | 'warning'> = {
  allow: 'success',
  block: 'danger',
  flag: 'warning',
};

const inputClass =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 ' +
  'text-sm font-mono text-text-primary placeholder:text-text-muted ' +
  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 ' +
  'transition-colors';

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
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-base">Owner</CardTitle>
          <CardDescription>
            Set your owner ID to enable applying a template directly to one
            of your agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={ownerId}
              onChange={(e) => persistOwnerId(e.target.value)}
              placeholder="owner_acme_prod"
              className={cn(inputClass, 'flex-1')}
            />
            <span className="text-xs text-text-muted whitespace-nowrap font-mono uppercase tracking-wider">
              {loadingAgents
                ? 'LOADING…'
                : agents.length > 0
                  ? `${agents.length} AGENT${agents.length !== 1 ? 'S' : ''}`
                  : ownerId.trim()
                    ? 'NO AGENTS'
                    : 'NEEDS OWNER ID'}
            </span>
          </div>
        </CardContent>
      </Card>

      {agentsError && (
        <Card variant="danger-tinted">
          <CardContent className="px-4 py-3">
            <p className="text-sm text-accent-danger">{agentsError}</p>
          </CardContent>
        </Card>
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
    <Card variant="default" className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">
            {template.name}
          </CardTitle>
          <Tag>
            {template.rules.length} RULE{template.rules.length !== 1 ? 'S' : ''}
          </Tag>
        </div>
        <CardDescription>{template.description}</CardDescription>
        <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {template.id} · {template.key}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Apply to agent
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            disabled={agents.length === 0}
            className={cn(inputClass, 'disabled:text-text-muted')}
          >
            <option value="">All agents (owner-scoped)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.id}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={apply}
          loading={applying}
          disabled={applying || !ownerId}
        >
          {applying ? 'Applying…' : 'Use template'}
        </Button>

        {appliedPolicyId && (
          <div className="rounded-md border border-accent-success/30 bg-accent-success-subtle/30 px-3 py-2 text-xs text-accent-success">
            Created policy{' '}
            <span className="font-mono">{appliedPolicyId}</span>.
          </div>
        )}
        {applyError && (
          <div className="rounded-md border border-accent-danger/30 bg-accent-danger-subtle/30 px-3 py-2 text-xs text-accent-danger">
            {applyError}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-border-default pt-3 font-mono text-[11px] uppercase tracking-wider text-text-muted">
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            className="hover:text-text-primary transition-colors"
          >
            {rulesOpen ? '▾ Hide rules' : '▸ View rules'}
          </button>
          <span className="text-border-default">·</span>
          <button
            type="button"
            onClick={() => setCodeOpen((v) => !v)}
            className="hover:text-text-primary transition-colors"
          >
            {codeOpen ? '▾ Hide code' : '▸ Copy as code'}
          </button>
        </div>

        {rulesOpen && (
          <ul className="space-y-1.5 rounded-md border border-border-default bg-bg-base p-3">
            {template.rules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 flex-wrap">
                <Tag variant={EFFECT_TAG[rule.effect]}>
                  {rule.effect.toUpperCase()}
                </Tag>
                {rule.action_types.map((a) => (
                  <Tag key={a} variant="neutral">
                    {a}
                  </Tag>
                ))}
                <span className="font-mono text-[11px] text-text-secondary truncate">
                  {rule.resource_pattern}
                </span>
              </li>
            ))}
          </ul>
        )}

        {codeOpen && (
          <div className="rounded-md border border-border-default bg-bg-base">
            <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {template.key}.ts
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-accent-primary transition-colors"
              >
                {codeCopied ? 'COPIED ✓' : 'COPY'}
              </button>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
              {codeSnippet}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
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
