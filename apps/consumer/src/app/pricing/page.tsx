import Link from 'next/link';
import {
  Button,
  Card,
  NumberDisplay,
  Section,
  Tag,
} from '@/components/ui';

const TIERS = [
  {
    name: 'Consumer Pro',
    price: '$19.99',
    cadence: '/mo',
    blurb: 'For individual developers',
    bullets: [
      'Unlimited personal agents',
      'Full audit trail',
      'Signed events + Ed25519',
    ],
    cta: 'Start free',
    ctaHref: '/login',
    highlight: false,
  },
  {
    name: 'Dashboard Starter',
    price: '$499',
    cadence: '/mo',
    blurb: 'For teams deploying agents',
    bullets: [
      'Up to 25 team agents',
      'Runtime policy engine',
      'Slack + webhook alerts',
    ],
    cta: 'Get started',
    ctaHref: '/login',
    highlight: true,
  },
  {
    name: 'Dashboard Business',
    price: '$1,499',
    cadence: '/mo',
    blurb: 'For enterprises',
    bullets: [
      'Unlimited agents',
      'SSO + RBAC',
      'Priority incident response',
    ],
    cta: 'Talk to sales',
    ctaHref: '/enterprise',
    highlight: false,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-[#080808] text-white">
      <Section className="relative">
        <div className="mx-auto max-w-7xl px-6 pt-24 md:px-10 lg:px-16">
          <h1
            className="font-display max-w-4xl font-semibold tracking-[-0.025em] leading-[1.05] text-white [word-break:normal] [overflow-wrap:normal] [hyphens:none]"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)' }}
          >
            Built for the scale of your mandate
            <span className="text-blue-500">.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
            Start with personal agents. Scale to teams. Generate auditor-ready
            compliance reports on demand.{' '}
            <span className="text-white">No consultants. No waiting.</span>
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TIERS.map((tier) => (
              <Card
                key={tier.name}
                variant="elevated"
                className={`relative flex flex-col p-7 transition-colors ${
                  tier.highlight
                    ? 'border-blue-500/60 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.10),transparent_60%)]'
                    : 'hover:border-border-strong'
                }`}
              >
                {tier.highlight && (
                  <Tag
                    variant="info"
                    className="absolute -top-3 left-6 bg-[#080808]"
                  >
                    Most Popular
                  </Tag>
                )}

                <Tag variant="default" className="self-start">
                  {tier.blurb}
                </Tag>

                <h3 className="font-display mt-3 text-[18px] font-medium tracking-tight text-text-primary">
                  {tier.name}
                </h3>

                <div className="mt-5">
                  <NumberDisplay
                    value={tier.price}
                    suffix={tier.cadence}
                    size="sm"
                    className="[&>span:first-child]:text-[2.5rem]"
                  />
                </div>

                <ul className="mt-7 flex-1 space-y-2.5">
                  {tier.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-3 text-[14px] text-text-secondary"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2.2"
                        className="mt-1 shrink-0"
                        aria-hidden
                      >
                        <path
                          d="M4 12l5 5L20 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-8">
                  <Button
                    asChild
                    variant={tier.highlight ? 'primary' : 'secondary'}
                    size="md"
                    className="w-full"
                  >
                    <Link href={tier.ctaHref}>{tier.cta}</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section tight className="relative border-t border-border-subtle">
        <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
          <Card
            variant="success-tinted"
            className="flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center"
          >
            <div>
              <Tag variant="success">One-time</Tag>
              <h2 className="font-display mt-3 text-[18px] font-medium tracking-tight text-text-primary md:text-[20px]">
                Compliance Audit Report{' '}
                <span className="text-text-muted">·</span> $500
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-text-secondary">
                OWASP Agentic Top 10, EU AI Act, or HIPAA pack generated from
                your signed event stream. Auditor-ready PDF in seconds.
              </p>
            </div>
            <Button asChild variant="success" size="md" className="shrink-0">
              <Link href="/report">
                Generate a report <span aria-hidden>→</span>
              </Link>
            </Button>
          </Card>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.25em] text-text-muted">
            Need enterprise compliance or white-label?{' '}
            <Link
              href="/enterprise"
              className="text-accent-primary transition-colors hover:text-accent-primary-hover"
            >
              See enterprise plans →
            </Link>
          </p>
        </div>
      </Section>
    </div>
  );
}