'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [ownerId, setOwnerId] = useState('');
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('hipaa_healthcare');

  // Step 2 form state
  const [agentName, setAgentName] = useState('');
  const [framework, setFramework] = useState<Framework>('LangChain');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentResponse | null>(null);

  // Step 3 state
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policySaved, setPolicySaved] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    setOwnerId(stored ?? '');
    fetch('/api/policies/from-template')
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
    <div className="max-w-3xl mx-auto">
      <Stepper step={step} />

      <div className="mt-10">
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
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-mono uppercase tracking-wider truncate transition-colors ${
                active
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                  : done
                    ? 'text-emerald-300'
                    : 'text-gray-500'
              }`}
            >
              <span
                className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-[10px] ${
                  done
                    ? 'bg-emerald-500 text-black'
                    : active
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span
                className={`h-px flex-1 ${done ? 'bg-emerald-700' : 'bg-gray-800'}`}
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
      label="Step 1 · Welcome"
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

      <div className="mt-8">
        <Label>Owner ID</Label>
        <p className="text-xs text-gray-500 mt-1 mb-2">
          Scopes every agent, policy, and event to you. Use anything stable —
          your Supabase auth UUID works best once you wire sign-in.
        </p>
        <input
          value={ownerId}
          onChange={(e) => onOwnerIdChange(e.target.value)}
          placeholder="owner_acme_prod"
          className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <StepFooter>
        <PrimaryButton onClick={onNext} disabled={!ownerId.trim()}>
          Continue →
        </PrimaryButton>
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
    <div className="rounded-md border border-gray-800 bg-gray-950/50 p-4">
      <div className="text-blue-400 mb-3">{icon}</div>
      <div className="text-sm font-medium text-gray-100">{title}</div>
      <div className="text-xs text-gray-500 mt-1 leading-relaxed">{body}</div>
    </div>
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
      label="Step 2 · Register Your First Agent"
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
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Agent name">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="customer-support-agent"
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Framework">
              <select
                value={framework}
                onChange={(e) => onFrameworkChange(e.target.value as Framework)}
                className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
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
                className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </Field>
          </div>

          {error && (
            <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <StepFooter>
            <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
            <PrimaryButton
              onClick={onRegister}
              disabled={submitting || !name.trim() || !ownerId.trim()}
            >
              {submitting ? 'Generating keypair…' : 'Generate identity'}
            </PrimaryButton>
          </StepFooter>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-md border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            <div className="font-semibold text-amber-100">
              Save your private key now — it will not be shown again.
            </div>
            <div className="mt-1 text-amber-200/80 text-xs leading-relaxed">
              Store it in your secret manager (1Password, Vault, AWS Secrets
              Manager). MandateZ does not retain a copy. If you lose it, the
              agent cannot sign events and must be re-registered.
            </div>
          </div>

          <ValueRow label="Agent ID" value={agent.agent_id} mono />
          <ValueRow label="Public key" value={agent.public_key} mono />
          <ValueRow label="Private key" value={agent.private_key} mono secret />

          <StepFooter>
            <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
            <PrimaryButton onClick={onNext}>
              I&rsquo;ve saved my key →
            </PrimaryButton>
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
      label="Step 3 · Pick a Policy Template"
      title="Choose a starting template."
      description="Templates are curated policy configurations for common agent use cases. Pick the closest match — you can edit the rules afterwards."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.key}
            type="button"
            onClick={() => onSelect(template.key)}
            className={`text-left rounded-md border p-4 transition-colors ${
              selected === template.key
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-gray-800 bg-gray-950/40 hover:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-100 leading-snug">
                {template.name}
              </span>
              <span
                className={`h-4 w-4 shrink-0 rounded-full border ${
                  selected === template.key
                    ? 'border-blue-400 bg-blue-500'
                    : 'border-gray-700'
                }`}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              {template.description}
            </p>
            <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-gray-600">
              {template.rule_count} rules · {template.id}
            </div>
          </button>
        ))}
      </div>

      {activeTemplate && (
        <div className="mt-6 rounded-md border border-gray-800 bg-black/40 p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
            Rule preview — {activeTemplate.name}
          </div>
          <div className="space-y-1 font-mono text-xs">
            {activeTemplate.rules.map((rule, i) => (
              <div key={i} className="flex gap-3 items-start">
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

      {error && (
        <div className="mt-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="mt-4 rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Policy saved.
        </div>
      )}

      <StepFooter>
        <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        <PrimaryButton onClick={onSave} disabled={saving || !activeTemplate}>
          {saving ? 'Saving…' : 'Save policy'}
        </PrimaryButton>
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
  const snippet = useMemo(
    () => buildInstallSnippet(agent),
    [agent],
  );

  return (
    <StepShell
      label="Step 4 · Install the SDK"
      title={`Ship the ${agent.framework} integration.`}
      description="Drop this into your agent's entry point. Every call it makes after this line is signed, policy-checked, and audited."
    >
      <div className="space-y-5">
        <CommandBlock title="Install" body={snippet.install} />
        <CommandBlock title="Wire it up" body={snippet.code} />
        {snippet.note && (
          <p className="text-xs text-gray-500 leading-relaxed">
            {snippet.note}
          </p>
        )}

        <div className="border-t border-gray-800 pt-4 flex items-center justify-between text-sm">
          <a
            href="https://mandatez.mintlify.app/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Full quickstart →
          </a>
          <span className="text-xs text-gray-500 font-mono">
            {agent.agent_id}
          </span>
        </div>
      </div>

      <StepFooter>
        <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        <PrimaryButton onClick={onNext}>Finish →</PrimaryButton>
      </StepFooter>
    </StepShell>
  );
}

/* ================================= Step 4 ================================= */

function DoneStep({ agent }: { agent: AgentResponse }) {
  return (
    <StepShell
      label="Step 5 · Done"
      title="Your agent is ready."
      description="You now have a cryptographically identified, policy-governed agent logging signed events into your dashboard."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <ResultCard label="Agent ID" value={agent.agent_id} mono />
        <ResultCard label="Trust score" value="0 · Unverified" />
        <ResultCard label="Status" value="Active · ready to track events" />
      </div>

      <div className="mt-6 rounded-md border border-gray-800 bg-gray-950/40 p-4">
        <div className="text-xs font-mono uppercase tracking-wider text-gray-500">
          Next steps
        </div>
        <ol className="mt-3 space-y-2 text-sm text-gray-300 list-decimal list-inside">
          <li>Track your first event from your agent code.</li>
          <li>Watch the Events tab update live as your agent runs.</li>
          <li>
            Generate a compliance report once you have 50+ signed events.
          </li>
        </ol>
      </div>

      <StepFooter>
        <Link
          href="/"
          className="ml-auto inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-5 py-3 text-sm font-medium text-white transition-colors"
        >
          Go to Dashboard →
        </Link>
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
          : 'For AutoGen, wrap each agent\'s run() call so multi-agent exchanges are fully auditable.',
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
    <div className="rounded-lg border border-gray-800 bg-gray-950/30 p-6 md:p-8">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-400">
        {label}
      </div>
      <h2 className="mt-3 text-2xl font-semibold text-gray-50">{title}</h2>
      <p className="mt-2 text-sm text-gray-400 max-w-2xl leading-relaxed">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function StepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center gap-3 border-t border-gray-800 pt-5">
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ml-auto rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-gray-800 hover:border-gray-600 px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
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
    <div>
      <Label>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
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
    <div className="rounded-md border border-gray-800 bg-black/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
          {label}
          {secret && (
            <span className="ml-2 text-amber-400">· keep private</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {secret && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-gray-200 transition-colors"
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          )}
          <button
            type="button"
            onClick={copy}
            className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-blue-300 transition-colors"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
      <div
        className={`mt-2 text-sm text-gray-200 break-all ${mono ? 'font-mono' : ''}`}
      >
        {revealed ? value : '•'.repeat(Math.min(48, value.length))}
      </div>
    </div>
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
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-500">
          {title}
        </span>
        <button
          onClick={copy}
          className="text-[11px] uppercase tracking-wider text-gray-500 hover:text-blue-300 transition-colors"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre className="rounded-md border border-gray-800 bg-black/40 p-4 text-xs text-gray-200 overflow-x-auto font-mono leading-relaxed">
        {body}
      </pre>
    </div>
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
    <div className="rounded-md border border-gray-800 bg-gray-950/40 p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-gray-500">
        {label}
      </div>
      <div
        className={`mt-2 text-sm text-gray-100 break-all ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

/* ============================= SVG icons ============================= */

function IconKey() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L21 2" />
      <path d="M17.5 5.5L21 2l0 4" />
      <path d="M14 8l3 3" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconFeed() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10M7 13h6M7 17h8" />
    </svg>
  );
}
