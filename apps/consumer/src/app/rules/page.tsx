import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Section,
  SectionMarker,
  Tag,
} from '@/components/ui';

const DASHBOARD_URL = 'https://core-dashboard-black.vercel.app';

interface AsiRisk {
  code: string;
  name: string;
  description: string;
  control: string;
}

const ASI_RISKS: AsiRisk[] = [
  {
    code: 'ASI-01',
    name: 'Memory Poisoning',
    description:
      'Adversaries inject malicious content into an agent’s short or long-term memory — vector stores, conversation history, or retrieved context — to manipulate future decisions or exfiltrate data.',
    control:
      'MandateZ signs every memory write event with the agent’s Ed25519 key and logs it to a tamper-proof audit trail. Untrusted writes can be policy-blocked at the source.',
  },
  {
    code: 'ASI-02',
    name: 'Tool Misuse',
    description:
      'An agent invokes legitimate tools — file systems, APIs, payment rails — for unintended or malicious purposes, often after being tricked by a prompt injection or compromised input.',
    control:
      'The MandateZ runtime policy engine evaluates every tool call against declared rules and blocks unauthorized invocations before execution. Each call is signed and auditable.',
  },
  {
    code: 'ASI-03',
    name: 'Privilege Compromise',
    description:
      'An agent operates with broader permissions than its task requires — “Allow All” OAuth scopes, root credentials, or unscoped API keys — and an attacker leverages that surface to pivot.',
    control:
      'MandateZ enforces least-privilege through resource-pattern policies. Wildcards on sensitive resources are blocked by default and human-approval gates fire on privilege escalation attempts.',
  },
  {
    code: 'ASI-04',
    name: 'Resource Overload',
    description:
      'Agents consume excessive compute, tokens, network, or downstream API calls — either through runaway loops, hostile inputs, or cascading sub-agent invocations — degrading availability.',
    control:
      'Rate-limit policies and budget caps fire at the policy engine layer. Anomalous consumption surfaces in the event stream within seconds of the signed event being emitted.',
  },
  {
    code: 'ASI-05',
    name: 'Cascading Hallucination Attacks',
    description:
      'A hallucination from one agent becomes input to the next, propagating false facts through multi-agent systems until they are acted on as ground truth — producing outputs grounded in nothing.',
    control:
      'Every inter-agent message in MandateZ is a signed event linking output to its originating agent. Provenance is preserved across hops, enabling downstream consumers to validate upstream claims.',
  },
  {
    code: 'ASI-06',
    name: 'Intent Breaking and Goal Manipulation',
    description:
      'Adversarial inputs redirect an agent away from its declared goal — turning a research agent into an exfiltration tool, or a coding agent into an unintended payment trigger.',
    control:
      'MandateZ mandates declared action_types and resource scopes per agent. Deviations from declared intent are flagged or blocked, and the human oversight gate halts execution on high-risk drift.',
  },
  {
    code: 'ASI-07',
    name: 'Misaligned and Deceptive Behaviors',
    description:
      'An agent optimizes for an objective that diverges from operator intent — gaming evaluation metrics, hiding side effects, or producing deceptive outputs that pass surface-level checks.',
    control:
      'The signed event stream captures full chain-of-action telemetry. Compliance reports surface behavioral patterns inconsistent with declared mandate, producing an evidence trail for review.',
  },
  {
    code: 'ASI-08',
    name: 'Repudiation and Untraceability',
    description:
      'After an incident, there is no way to prove which agent took which action, when, or under whose authority — making post-mortem, attribution, and legal accountability impossible.',
    control:
      'Every MandateZ event carries an Ed25519 signature and the agent’s public key. The full action ledger is cryptographically non-repudiable and exportable as an auditor-ready artifact.',
  },
  {
    code: 'ASI-09',
    name: 'Identity Spoofing and Impersonation',
    description:
      'An attacker who steals an agent’s OAuth token, API key, or session credential can impersonate that agent end-to-end. Downstream systems have no way to distinguish legitimate calls from spoofed ones.',
    control:
      'MandateZ replaces stealable tokens with Ed25519 keypairs bound to agent identity. A signed event proves authorship — possessing a leaked token alone cannot forge a valid signature.',
  },
  {
    code: 'ASI-10',
    name: 'Overwhelming Human Oversight',
    description:
      'When agents fire too many approval requests, alerts, or notifications, humans rubber-stamp them. The oversight layer collapses and high-risk actions slip through without genuine review.',
    control:
      'The MandateZ oversight gate triggers only on policy-flagged actions — export, delete, payment by default — with timeout-based auto-block. Routine actions stay out of the human queue.',
  },
];

export const metadata = {
  title: 'OWASP Agentic Top 10 — MandateZ',
  description:
    'Every AI agent risk in the OWASP Agentic Top 10, mapped to a MandateZ control. Reference for security teams, compliance auditors, and developers shipping AI agents.',
};

export default function RulesPage() {
  return (
    <div className="relative min-h-screen bg-[#080808] text-white">
      <Section className="relative">
        <div className="mx-auto max-w-5xl px-6 pt-24 md:px-10 lg:px-16">
          <SectionMarker number="01" label="OWASP AGENTIC TOP 10" />

          <h1
            className="font-display mt-4 max-w-4xl font-semibold tracking-[-0.025em] leading-[1.05] text-white [word-break:normal] [overflow-wrap:normal] [hyphens:none]"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)' }}
          >
            Every AI agent risk, mapped to a MandateZ control
            <span className="text-blue-500">.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-secondary md:text-[17px]">
            MandateZ ships templates and detection for all ten OWASP Agentic
            risks. Generated reports map your signed event stream against this
            framework — auditor-ready, in seconds.
          </p>

          <div className="mt-12 space-y-4">
            {ASI_RISKS.map((risk) => (
              <Card
                key={risk.code}
                variant="default"
                className="overflow-hidden"
              >
                <CardHeader className="gap-3 p-6">
                  <div className="flex items-center gap-3">
                    <Tag variant="info">{risk.code}</Tag>
                    <span className="h-px flex-1 bg-border-subtle" />
                  </div>
                  <CardTitle className="font-display text-[17px] font-medium md:text-[18px]">
                    {risk.name}
                  </CardTitle>
                  <CardDescription className="text-[14.5px] leading-relaxed">
                    {risk.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <Card variant="success-tinted" className="p-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-success">
                      MandateZ control
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-text-primary">
                      {risk.control}
                    </p>
                  </Card>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section tight className="relative border-t border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 md:px-10 lg:px-16">
          <Card
            variant="default"
            className="flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center"
          >
            <div>
              <Tag variant="info">Compliance</Tag>
              <h2 className="font-display mt-3 text-[18px] font-medium tracking-tight text-text-primary md:text-[20px]">
                Generate an OWASP Agentic Top 10 compliance report
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
                One-click export of your agent’s signed event stream mapped
                against ASI-01 through ASI-10. PDF + JSON, auditor-ready.
              </p>
            </div>
            <Button asChild variant="primary" size="md" className="shrink-0">
              <Link href={`${DASHBOARD_URL}/reports`}>
                Generate report <span aria-hidden>→</span>
              </Link>
            </Button>
          </Card>
        </div>
      </Section>
    </div>
  );
}