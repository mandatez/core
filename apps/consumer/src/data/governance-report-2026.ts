export const REPORT_2026 = {
  title: 'State of AI Agent Governance 2026',
  subtitle:
    'The gap between AI agent deployment and the infrastructure to govern it',
  published: 'April 2026',
  author: 'MandateZ Research',

  executive_summary: [
    'In 2026, more than $600B flowed into AI agent ecosystems while nearly half of the enterprises deploying them admitted zero visibility into their own agent traffic.',
    'The Vercel/Context.ai breach of April 19, 2026 proved that ungoverned agents are not a theoretical risk — they are the entry point for the next generation of credential compromise.',
    'With the EU AI Act enforcement deadline of August 2, 2026 and the OWASP Agentic Top 10 now in force, the infrastructure gap is no longer optional to solve.',
  ],

  key_stats: [
    {
      stat: '48.9%',
      label:
        'of enterprises have zero visibility into their own AI agent traffic',
      source: 'Salt Security H1 2026',
    },
    {
      stat: '$600B+',
      label: 'invested in AI agent ecosystems in 2026',
      source: 'AIBMag Enterprise AI Report 2026',
    },
    {
      stat: '40%+',
      label:
        'of enterprise AI agent projects projected to fail without governance controls by 2027',
      source: 'Gartner AI Adoption Report 2026',
    },
    {
      stat: '9 days',
      label:
        'detection lag in the Vercel/Context.ai breach — the average for ungoverned agent incidents',
      source: 'Vercel Security Bulletin, April 2026',
    },
    {
      stat: 'August 2, 2026',
      label:
        'EU AI Act enforcement deadline — automated audit trails become mandatory',
      source: 'EU Regulation 2024/1689',
    },
    {
      stat: '0',
      label:
        'neutral, cross-vendor AI agent governance standards exist today',
      source: 'MandateZ Research',
    },
  ],

  findings: [
    {
      number: '01',
      title: 'The governance gap is structural',
      body:
        'No hyperscaler can be the neutral audit layer for AI agents without a conflict of interest. OpenAI cannot audit Claude agents. Anthropic cannot audit GPT agents. The governance layer must come from a vendor with no platform stake — and none currently exists at scale.',
    },
    {
      number: '02',
      title: 'The Vercel breach proved the attack vector',
      body:
        "On April 19, 2026, an indexing agent with 'Allow All' OAuth permissions became the pivot point for a credential exfiltration that touched hundreds of enterprise projects. The agent had no cryptographic identity, no policy engine, and no audit trail. Nine days passed before detection.",
    },
    {
      number: '03',
      title: 'Regulation arrived before infrastructure',
      body:
        "The OWASP Agentic Top 10 dropped December 2025. The EU AI Act enforcement deadline is August 2, 2026. Enterprise compliance teams are now asking 'how do we prove what our agents did?' — and finding no standardized answer.",
    },
    {
      number: '04',
      title: 'Shadow agents are the real attack surface',
      body:
        '48.9% of enterprises cannot inventory their own AI agents. The agents they cannot see are the ones attackers will target. Every major AI agent incident of the past 12 months began with an unmonitored, ungoverned agent.',
    },
    {
      number: '05',
      title: 'Trust scoring is the missing signal',
      body:
        'Current security tools measure model safety, not agent behavior over time. A trust score that accumulates across 90 days of clean operation — and collapses on the first anomaly — is the signal CISOs are missing. It cannot be gamed without 90 days of real operation.',
    },
  ],

  recommendations: [
    'Register every AI agent with a cryptographic identity before deployment',
    'Enforce least-privilege policies at the action layer, not the OAuth scope layer',
    'Run a shadow agent scan before assuming your inventory is complete',
    'Generate an OWASP Agentic Top 10 compliance report before August 2, 2026',
    'Require human approval for export, delete, and payment action classes',
  ],
} as const;

export type Report2026 = typeof REPORT_2026;
