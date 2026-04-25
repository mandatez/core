'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  SectionMarker,
  Tag,
} from '@/components/ui';

type Framework =
  | 'LangChain'
  | 'n8n'
  | 'CrewAI'
  | 'AutoGen'
  | 'OpenAI SDK'
  | 'Other';
type Environment = 'production' | 'staging' | 'development';

interface AgentResponse {
  agent_id: string;
  owner_id: string;
  name: string;
  framework: Framework;
  environment: Environment;
  public_key: string;
  private_key: string;
}

type Effect = 'allow' | 'block' | 'flag';

interface TemplateRule {
  action_types: string[];
  resource_pattern: string;
  effect: Effect;
}

interface PolicyTemplate {
  key: string;
  id: string;
  name: string;
  description: string;
  rule_count: number;
  rules: TemplateRule[];
}

const FRAMEWORKS: Framework[] = [
  'LangChain',
  'n8n',
  'CrewAI',
  'AutoGen',
  'OpenAI SDK',
  'Other',
];

const STEP_LABELS = [
  'Welcome',
  'Register agent',
  'Configure policy',
  'Install SDK',
  'Done',
] as const;

const EFFECT_VARIANT: Record<Effect, 'success' | 'danger' | 'warning'> = {
  allow: 'success',
  block: 'danger',
  flag: 'warning',
};

const EFFECT_LABEL: Record<Effect, string> = {
  allow: 'ALLOW',
  block: 'BLOCK',
  flag: 'FLAG',
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [ownerId, setOwnerId] = useState('');
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('hipaa_healthcare');

  const [agentName, setAgentName] = useState('');
  const [framework, setFramework] = useState<Framework>('LangChain');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentResponse | null>(null);

  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policySaved, setPolicySaved] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    setOwnerId(stored ?? '');
    fetch('/api/policies/from-template', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { templates?: PolicyTemplate[] }) => {
        if (j.templates) setTemplates(j.templates);
      })
      .catch(() => {});
  }, []);

  const registerAgent = async () => {
    setRegisterError(null);
    if (!ownerId.trim()) {
      setRegisterError('Owner ID is required. Enter one above.');
      return;
    }
    if (!agentName.trim()) {
      setRegisterError('Agent name is required.');
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: ownerId.trim(),
          name: agentName.trim(),
          framework,
          environment,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed');
      setAgent(json as AgentResponse);
      window.localStorage.setItem('mandatez_owner_id', ownerId.trim());
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : 'Registration failed',
      );
    } finally {
      setRegistering(false);
    }
  };

  const savePolicy = async () => {
    if (!agent) return;
    setPolicyError(null);
    setSavingPolicy(true);
    try {
      const res = await fetch('/api/policies/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          owner_id: agent.owner_id,
          agent_id: agent.agent_id,
          template_id: selectedTemplate,
          name: `${agent.name} — ${selectedTemplate}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save policy');
      setPolicySaved(true);
      setStep(3);
    } catch (err) {
      setPolicyError(
        err instanceof Error ? err.message : 'Could not save policy',
      );
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-4">
        <SectionMarker number="00" label="ONBOARDING" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Set up your first governed agent
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Five minutes from here to a cryptographically signed agent shipping
            audit-ready events into your dashboard.
          </p>
        </div>
      </header>

      <Stepper step={step} />

      <div>
        {step === 0 && (
          <WelcomeStep
            ownerId={ownerId}
            onOwnerIdChange={setOwnerId}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <RegisterStep
            ownerId={ownerId}
            onOwnerIdChange={setOwnerId}
            name={agentName}
            onNameChange={setAgentName}
            framework={framework}
            onFrameworkChange={setFramework}
            environment={environment}
            onEnvironmentChange={setEnvironment}
            agent={agent}
            submitting={registering}
            error={registerError}
            onRegister={registerAgent}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && agent && (
          <PolicyStep
            templates={templates}
            selected={selectedTemplate}
            onSelect={setSelectedTemplate}
            saving={savingPolicy}
            saved={policySaved}
            error={policyError}
            onSave={savePolicy}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && agent && (
          <InstallStep
            agent={agent}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && agent && <DoneStep agent={agent} />}
      </div>
    </div>
  );
}

/* ================================= Stepper ================================= */

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className="flex flex-1 min-w-0 items-center gap-2">
            <div
              className={`flex items-center gap-2 truncate font-mono text-xs uppercase tracking-widest transition-colors ${
                active
                  ? 'text-accent-primary'
                  : done
                    ? 'text-accent-success'
                    : 'text-text-muted'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                  done
                    ? 'bg-accent-success text-white'
                    : active
                      ? 'bg-accent-primary text-white'
                      : 'border border-border-default bg-bg-overlay text-text-muted'
                }`}
              >
                {done ? '✓' : String(i + 1).padStart(2, '0')}
              </span>
              <span className="truncate">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span
                className={`h-px flex-1 ${
                  done ? 'bg-accent-success' : 'bg-border-default'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================= Step 0 ================================= */

function WelcomeStep({
  ownerId,
  onOwnerIdChange,
  onNext,
}: {
  ownerId: string;
  onOwnerIdChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <StepShell
      number="01"
      label="WELCOME"
      title="Let's set up your first governed agent."
      description="Five minutes from here to a cryptographically signed agent shipping audit-ready events into your dashboard."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <FeatureCard
          icon={<IconKey />}
          title="Cryptographic identity"
          body="Ed25519 keypair — non-stealable, not an OAuth token."
        />
        <FeatureCard
          icon={<IconShield />}
          title="Policy configuration"
          body="Declare what the agent can and cannot do at runtime."
        />
        <FeatureCard
          icon={<IconFeed />}
          title="Live event feed"
          body="Every action signed, logged, and streamed to your dashboard."
        />
      </div>

      <div className="mt-8 space-y-2">
        <Label>Owner ID</Label>
        <p className="text-xs leading-relaxed text-text-muted">
          Scopes every agent, policy, and event to you. Use anything stable —
          your Supabase auth UUID works best once you wire sign-in.
        </p>
        <input
          value={ownerId}
          onChange={(e) => onOwnerIdChange(e.target.value)}
          placeholder="owner_acme_prod"
          className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
        />
      </div>

      <StepFooter>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!ownerId.trim()}
          className="ml-auto"
        >
          Continue
        </Button>
      </StepFooter>
    </StepShell>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card variant="default" className="p-4">
      <div className="mb-3 text-accent-primary">{icon}</div>
      <div className="text-sm font-medium text-text-primary">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-text-secondary">
        {body}
      </div>
    </Card>
  );
}

/* ================================= Step 1 ================================= */

function RegisterStep({
  ownerId,
  onOwnerIdChange,
  name,
  onNameChange,
  framework,
  onFrameworkChange,
  environment,
  onEnvironmentChange,
  agent,
  submitting,
  error,
  onRegister,
  onBack,
  onNext,
}: {
  ownerId: string;
  onOwnerIdChange: (v: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  framework: Framework;
  onFrameworkChange: (v: Framework) => void;
  environment: Environment;
  onEnvironmentChange: (v: Environment) => void;
  agent: AgentResponse | null;
  submitting: boolean;
  error: string | null;
  onRegister: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <StepShell
      number="02"
      label="REGISTER AGENT"
      title="Generate a cryptographic identity."
      description="We generate an Ed25519 keypair on the server and return the private key to you once. We never store it."
    >
      {!agent ? (
        <div className="space-y-5">
          <Field label="Owner ID">
            <input
              value={ownerId}
              onChange={(e) => onOwnerIdChange(e.target.value)}
              placeholder="owner_acme_prod"
              className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
            />
          </Field>
          <Field label="Agent name">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="customer-support-agent"
              className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none transition-colors"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Framework">
              <select
                value={framework}
                onChange={(e) =>
                  onFrameworkChange(e.target.value as Framework)
                }
                className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none transition-colors"
              >
                {FRAMEWORKS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Environment">
              <select
                value={environment}
                onChange={(e) =>
                  onEnvironmentChange(e.target.value as Environment)
                }
                className="w-full rounded-md border border-border-default bg-bg-overlay px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:outline-none transition-colors"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </Field>
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <StepFooter>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={onRegister}
              loading={submitting}
              disabled={!name.trim() || !ownerId.trim()}
              className="ml-auto"
            >
              {submitting ? 'Generating keypair' : 'Generate identity'}
            </Button>
          </StepFooter>
        </div>
      ) : (
        <div className="space-y-5">
          <Card
            variant="default"
            className="border-l-2 border-accent-warning p-4"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-warning">
              Save your private key now — it will not be shown again
            </div>
            <div className="mt-2 text-xs leading-relaxed text-text-secondary">
              Store it in your secret manager (1Password, Vault, AWS Secrets
              Manager). MandateZ does not retain a copy. If you lose it, the
              agent cannot sign events and must be re-registered.
            </div>
          </Card>

          <ValueRow label="Agent ID" value={agent.agent_id} mono />
          <ValueRow label="Public key" value={agent.public_key} mono />
          <ValueRow label="Private key" value={agent.private_key} mono secret />

          <StepFooter>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button variant="primary" onClick={onNext} className="ml-auto">
              I&rsquo;ve saved my key
            </Button>
          </StepFooter>
        </div>
      )}
    </StepShell>
  );
}

/* ================================= Step 2 ================================= */

function PolicyStep({
  templates,
  selected,
  onSelect,
  saving,
  saved,
  error,
  onSave,
  onBack,
}: {
  templates: PolicyTemplate[];
  selected: string;
  onSelect: (key: string) => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const activeTemplate = templates.find((t) => t.key === selected);

  return (
    <StepShell
      number="03"
      label="CONFIGURE POLICY"
      title="Choose a starting template."
      description="Templates are curated policy configurations for common agent use cases. Pick the closest match — you can edit the rules afterwards."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => onSelect(template.key)}
            className={`rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${
              selected === template.key
                ? 'border-accent-primary bg-accent-primary/10'
                : 'border-border-default bg-bg-overlay hover:border-border-strong'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-snug text-text-primary">
                {template.name}
              </span>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border ${
                  selected === template.key
                    ? 'border-accent-primary bg-accent-primary'
                    : 'border-border-strong'
                }`}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">
              {template.description}
            </p>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {template.rule_count} rules · {template.id}
            </div>
          </button>
        ))}
      </div>

      {activeTemplate && (
        <Card variant="default" className="mt-6 p-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Rule preview — {activeTemplate.name}
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {activeTemplate.rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-3">
                <Tag variant={EFFECT_VARIANT[rule.effect]} className="w-16 justify-center">
                  {EFFECT_LABEL[rule.effect]}
                </Tag>
                <span className="w-32 shrink-0 truncate text-text-muted">
                  {rule.action_types.join(',')}
                </span>
                <span className="truncate text-text-secondary">
                  {rule.resource_pattern}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && (
        <div className="mt-4">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
      {saved && (
        <Card
          variant="default"
          className="mt-4 border-l-2 border-accent-success p-3"
        >
          <div className="font-mono text-xs uppercase tracking-widest text-accent-success">
            ✓ Policy saved
          </div>
        </Card>
      )}

      <StepFooter>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          loading={saving}
          disabled={!activeTemplate}
          className="ml-auto"
        >
          {saving ? 'Saving' : 'Save policy'}
        </Button>
      </StepFooter>
    </StepShell>
  );
}

/* ================================= Step 3 ================================= */

function InstallStep({
  agent,
  onBack,
  onNext,
}: {
  agent: AgentResponse;
  onBack: () => void;
  onNext: () => void;
}) {
  const snippet = useMemo(() => buildInstallSnippet(agent), [agent]);

  return (
    <StepShell
      number="04"
      label="INSTALL SDK"
      title={`Ship the ${agent.framework} integration.`}
      description="Drop this into your agent's entry point. Every call it makes after this line is signed, policy-checked, and audited."
    >
      <div className="space-y-5">
        <CommandBlock title="Install" body={snippet.install} />
        <CommandBlock title="Wire it up" body={snippet.code} />
        {snippet.note && (
          <p className="text-xs leading-relaxed text-text-muted">
            {snippet.note}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border-default pt-4 text-sm">
          <a
            href="https://mandatez.mintlify.app/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary underline-offset-4 hover:underline"
          >
            Full quickstart →
          </a>
          <span className="font-mono text-xs text-text-muted">
            {agent.agent_id}
          </span>
        </div>
      </div>

      <StepFooter>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} className="ml-auto">
          Finish
        </Button>
      </StepFooter>
    </StepShell>
  );
}

/* ================================= Step 4 ================================= */

function DoneStep({ agent }: { agent: AgentResponse }) {
  return (
    <StepShell
      number="05"
      label="DONE"
      title="Your agent is ready."
      description="You now have a cryptographically identified, policy-governed agent logging signed events into your dashboard."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultCard label="Agent ID" value={agent.agent_id} mono />
        <ResultCard label="Trust score" value="0 · Unverified" />
        <ResultCard label="Status" value="Active · ready to track events" />
      </div>

      <Card variant="default" className="mt-6 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Next steps
        </div>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-text-secondary">
          <li>Track your first event from your agent code.</li>
          <li>Watch the Events tab update live as your agent runs.</li>
          <li>
            Generate a compliance report once you have 50+ signed events.
          </li>
        </ol>
      </Card>

      <StepFooter>
        <Button asChild variant="success" className="ml-auto">
          <Link href="/">View dashboard</Link>
        </Button>
      </StepFooter>
    </StepShell>
  );
}

/* ============================ Snippet builder ============================ */

function buildInstallSnippet(agent: AgentResponse): {
  install: string;
  code: string;
  note?: string;
} {
  const common = `const client = new MandateZClient({
  agentId: '${agent.agent_id}',
  ownerId: '${agent.owner_id}',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});`;

  if (agent.framework === 'LangChain') {
    return {
      install: 'npm install @mandatez/sdk',
      code: `import { MandateZClient } from '@mandatez/sdk';
import { MandateZLangChainCallback } from '@mandatez/sdk';

${common}

// Attach as a LangChain callback:
const callback = new MandateZLangChainCallback(client);
// await chain.invoke({ input: '…' }, { callbacks: [callback] });`,
    };
  }

  if (agent.framework === 'n8n') {
    return {
      install: 'npm install @mandatez/sdk',
      code: `import { MandateZClient, MandateZN8nHook } from '@mandatez/sdk';

${common}

// In your n8n custom node or hook:
const hook = new MandateZN8nHook(client);
await hook.onWorkflowExecuted(executionData);`,
      note: 'For the n8n creator-portal node, see the @mandatez/n8n-nodes-mandatez package.',
    };
  }

  if (agent.framework === 'CrewAI' || agent.framework === 'AutoGen') {
    return {
      install: 'npm install @mandatez/sdk',
      code: `import { MandateZClient, withMandateZ } from '@mandatez/sdk';

${common}

// Wrap your runnable or crew step:
const governed = withMandateZ(rawAgent, client);
await governed.invoke({ task: '…' });`,
      note:
        agent.framework === 'CrewAI'
          ? 'For CrewAI crews, wrap each agent step so every task is signed independently.'
          : "For AutoGen, wrap each agent's run() call so multi-agent exchanges are fully auditable.",
    };
  }

  if (agent.framework === 'OpenAI SDK') {
    return {
      install: 'npm install @mandatez/sdk',
      code: `import { MandateZClient } from '@mandatez/sdk';
import OpenAI from 'openai';

${common}

const openai = new OpenAI();

// Track every call yourself:
await client.track({
  action_type: 'call',
  resource: 'openai.chat.completions',
  outcome: 'allowed',
});
const response = await openai.chat.completions.create({ /* … */ });`,
    };
  }

  return {
    install: 'npm install @mandatez/sdk',
    code: `import { MandateZClient } from '@mandatez/sdk';

${common}

// Track any action explicitly:
await client.track({
  action_type: 'call',
  resource: 'your.custom.resource',
  outcome: 'allowed',
});`,
    note: 'Framework not listed? client.track() works with any code path — sign one event per action.',
  };
}

/* ============================ UI primitives ============================ */

function StepShell({
  number,
  label,
  title,
  description,
  children,
}: {
  number: string;
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" className="p-6 md:p-8">
      <SectionMarker number={number} label={label} />
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center gap-3 border-t border-border-default pt-5">
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
      {children}
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="danger-tinted" className="p-3">
      <div className="font-mono text-xs text-accent-danger">{children}</div>
    </Card>
  );
}

function ValueRow({
  label,
  value,
  mono,
  secret,
}: {
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Card variant="default" className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          {label}
          {secret && (
            <span className="ml-2 text-accent-warning">· keep private</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {secret && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={copy}
            leftIcon={<IconCopy />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <div
        className={`mt-2 break-all text-sm text-text-primary ${
          mono ? 'font-mono' : ''
        }`}
      >
        {revealed ? value : '•'.repeat(Math.min(48, value.length))}
      </div>
    </Card>
  );
}

function CommandBlock({ title, body }: { title: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Card variant="default" className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          {title}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          leftIcon={<IconCopy />}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text-primary">
        {body}
      </pre>
    </Card>
  );
}

function ResultCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Card variant="default" className="p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
        {label}
      </div>
      <div
        className={`mt-2 break-all text-sm text-text-primary ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </Card>
  );
}

/* ============================= SVG icons ============================= */

function IconKey() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L21 2" />
      <path d="M17.5 5.5L21 2l0 4" />
      <path d="M14 8l3 3" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconFeed() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10M7 13h6M7 17h8" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
