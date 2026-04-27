import Link from 'next/link';
import BreachFeed from '@/components/breach-feed';
import { VercelSimulation } from '@/components/vercel-simulation';
import { REPORT_2026 } from '@/data/governance-report-2026';
import {
  Button,
  Card,
  NumberDisplay,
  Section,
  Tag,
} from '@/components/ui';

const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

const H2_CLASS =
  'font-display text-[clamp(1.625rem,2.8vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-white [word-break:normal] [overflow-wrap:normal] [hyphens:none]';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#080808] text-white">
      <PageStyles />
      <NoiseOverlay />

      <Hero />
      <SocialProof />
      <BreachSection />
      <DifferenceSection />
      <HowItWorks />
      <TrustScoreSection />
      <ComplianceSection />
      <WorksWithSection />
      <PricingSection />
      <ReportTeaserSection />
      <ClosingCtaSection />
      <FooterSection />
    </div>
  );
}

/* =======================================================================
   Styles, overlays
   ======================================================================= */

function PageStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          :root {
            --mz-bg: #080808;
            --mz-fg: #ffffff;
            --mz-muted: rgba(255,255,255,0.55);
            --mz-line: rgba(255,255,255,0.08);
            --mz-blue: #2563EB;
            --mz-blue-glow: rgba(37,99,235,0.35);
            --mz-emerald: #10B981;
            --mz-red: #EF4444;
          }
          html { scroll-behavior: smooth; }

          @keyframes mz-orb-a {
            0%, 100% { transform: translate(-8%, 6%) scale(1); }
            50%      { transform: translate(6%, -4%) scale(1.12); }
          }
          @keyframes mz-orb-b {
            0%, 100% { transform: translate(12%, -10%) scale(1.05); }
            50%      { transform: translate(-8%, 10%) scale(0.92); }
          }
          @keyframes mz-reveal {
            from { opacity: 0; transform: translateY(22px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .mz-orb-a { animation: mz-orb-a 22s ease-in-out infinite; }
          .mz-orb-b { animation: mz-orb-b 28s ease-in-out infinite; }
          .mz-reveal { animation: mz-reveal 900ms cubic-bezier(0.16,1,0.3,1) both; }
          .mz-reveal-1 { animation-delay: 80ms; }
          .mz-reveal-2 { animation-delay: 220ms; }
          .mz-reveal-3 { animation-delay: 360ms; }
          .mz-reveal-4 { animation-delay: 500ms; }
          .mz-reveal-5 { animation-delay: 640ms; }

          .mz-grid {
            background-image:
              linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
            background-size: 64px 64px;
            mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 85%);
            -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, #000 40%, transparent 85%);
          }

          .mz-hairline {
            background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          }

          @media (prefers-reduced-motion: reduce) {
            .mz-orb-a, .mz-orb-b, .mz-reveal { animation: none !important; }
          }
        `,
      }}
    />
  );
}

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.5] mix-blend-overlay"
      style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundRepeat: 'repeat' }}
    />
  );
}

/* =======================================================================
   SECTION 1 — HERO
   ======================================================================= */

function Hero() {
  return (
    <section className="relative isolate flex min-h-screen items-center overflow-hidden">
      <div className="mz-grid absolute inset-0 -z-10" />

      <div
        aria-hidden
        className="mz-orb-a absolute -z-10 left-[-6%] top-[10%] h-[55vh] w-[55vh] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(37,99,235,0) 70%)' }}
      />
      <div
        aria-hidden
        className="mz-orb-b absolute -z-10 bottom-[-10%] right-[-5%] h-[60vh] w-[60vh] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.32) 0%, rgba(16,185,129,0) 72%)' }}
      />

      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-[#080808]" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pt-40 pb-24 md:px-10 lg:px-16">
        <h1
          className="mz-reveal mz-reveal-2 font-display font-bold tracking-[-0.03em] leading-[0.98] text-white [word-break:normal] [overflow-wrap:normal] [hyphens:none]"
          style={{ fontSize: 'clamp(2.25rem, 5.5vw, 4.5rem)' }}
        >
          <span className="inline-block">Every agent needs</span>
          <br />
          <span className="relative inline-block whitespace-nowrap">
            a mandate
            <span className="text-blue-500">.</span>
            <svg
              aria-hidden
              className="absolute -bottom-3 left-0 right-0 w-full"
              height="10"
              viewBox="0 0 600 10"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="5"
                x2="600"
                y2="5"
                stroke="url(#mz-line-grad)"
                strokeWidth="1.2"
              />
              <defs>
                <linearGradient id="mz-line-grad" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="30%" stopColor="rgba(37,99,235,0.8)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0.6)" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        </h1>

        <p className="mz-reveal mz-reveal-3 mt-8 max-w-[38ch] md:max-w-2xl text-[15px] leading-[1.55] text-white/60 md:text-[17px]">
          The Vercel breach happened because an AI agent had no policy engine,
          no cryptographic identity, and no audit trail.{' '}
          <span className="text-white/90">MandateZ prevents this at the source.</span>
        </p>

        <div className="mz-reveal mz-reveal-4 mt-10 flex flex-wrap items-center gap-4">
          <Button asChild variant="primary" size="lg">
            <Link href="/login">
              Get a free shadow scan in 60 seconds
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
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="#breach-feed">
              See the breach feed
              <span className="text-white/40" aria-hidden>↓</span>
            </a>
          </Button>
        </div>

        <div className="mz-reveal mz-reveal-5 mt-14 flex flex-wrap items-center gap-x-8 gap-y-3">
          <TrustSignal>OWASP Agentic Top 10 Compliant</TrustSignal>
          <span className="h-4 w-px bg-white/10" />
          <TrustSignal>EU AI Act Ready</TrustSignal>
          <span className="h-4 w-px bg-white/10" />
          <TrustSignal>Ed25519 Signed</TrustSignal>
        </div>
      </div>
    </section>
  );
}

function TrustSignal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/55">
        {children}
      </span>
    </div>
  );
}

/* =======================================================================
   SECTION 1.5 — SOCIAL PROOF
   ======================================================================= */

function SocialProof() {
  return (
    <Section tight className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 lg:px-16">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between md:gap-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/35">
            / Production
          </span>
          <p className="font-display max-w-3xl text-[15px] font-medium leading-snug tracking-tight text-white/85 md:text-[17px]">
            Trusted by teams shipping AI agents to production.
          </p>
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/35">
            Cross-vendor · Neutral
          </span>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 2 — LIVE BREACH FEED
   ======================================================================= */

function BreachSection() {
  return (
    <Section id="breach-feed" className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-6xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          AI Agent Incidents <span className="text-white/30">—</span> Live
        </h2>

        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
          Every incident below is an AI agent governance failure.{' '}
          <span className="text-white/85">Every one was preventable.</span>
        </p>

        <div className="mt-10">
          <BreachFeed />
        </div>

        <div className="mt-8 border-t border-white/[0.05] pt-6">
          <p className="font-mono text-[11px] leading-relaxed text-white/40">
            This feed updates automatically. Every incident maps to an OWASP
            Agentic Top 10 risk that MandateZ controls.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 3 — THE DIFFERENCE (Vercel simulation, code comparison)
   ======================================================================= */

function DifferenceSection() {
  return (
    <Section className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          How MandateZ blocks
          <br />
          the Vercel attack.
        </h2>

        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
          The attacker gained access by exploiting an AI agent with{' '}
          <span className="text-white/90">&ldquo;Allow All&rdquo;</span> OAuth
          permissions. Watch what happens with MandateZ governing the same
          request.
        </p>

        <div className="mt-10">
          <VercelSimulation />
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/[0.05] pt-6 md:flex-row md:items-center">
          <p className="max-w-2xl text-[14.5px] leading-relaxed text-white/55 md:text-[15px]">
            The difference:{' '}
            <span className="text-white">4 lines of policy configuration</span>{' '}
            and a cryptographic identity that cannot be stolen.
          </p>
          <Button asChild variant="ghost" size="md">
            <a href="#how-it-works">
              See the full technical breakdown
              <span aria-hidden>→</span>
            </a>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 4 — HOW IT WORKS
   ======================================================================= */

function HowItWorks() {
  const cards = [
    {
      glyph: <IconIdentity />,
      title: 'Cryptographic Identity',
      body: 'Every agent gets an Ed25519 keypair on registration. Every action is signed. Stolen tokens cannot impersonate a MandateZ agent.',
    },
    {
      glyph: <IconPolicy />,
      title: 'Runtime Policy Engine',
      body: 'Declare what your agent is and is not allowed to do. Policy violations are blocked before execution — not logged after the fact.',
    },
    {
      glyph: <IconAudit />,
      title: 'Tamper-Proof Audit Trail',
      body: 'Every event is cryptographically signed and stored immutably. One click generates an OWASP, EU AI Act, or HIPAA compliance PDF.',
    },
  ];

  return (
    <Section id="how-it-works" className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          Trust infrastructure
          <br />
          for every agent.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => (
            <div
              key={c.title}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-7 transition-colors hover:border-white/20 hover:bg-white/[0.035]"
            >
              <div className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 group-hover:w-full" />
              <div className="mb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="mb-5 text-blue-400">{c.glyph}</div>
              <h3 className="font-display text-[18px] font-medium tracking-tight">
                {c.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function IconIdentity() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="11" y="4" width="10" height="12" rx="5" />
      <path d="M16 16v4" />
      <path d="M7 28c0-5 4-9 9-9s9 4 9 9" />
      <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPolicy() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 3l11 4v8c0 7-5 12-11 14-6-2-11-7-11-14V7l11-4z" />
      <path d="M11.5 16l3 3 6-6" />
    </svg>
  );
}

function IconAudit() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h14l6 6v18H6z" />
      <path d="M20 4v6h6" />
      <path d="M10 16h12M10 20h12M10 24h8" />
    </svg>
  );
}

/* =======================================================================
   SECTION 5 — TRUST SCORE
   ======================================================================= */

function TrustScoreSection() {
  return (
    <Section tight className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className={`${H2_CLASS} max-w-2xl`}>
              Agent Trust Scores
              <br />
              <span className="text-white/50">— publicly verifiable.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
              When your agent reaches{' '}
              <span className="text-emerald-300">Verified</span> status, share
              the badge on GitHub, X, or your product page. Every badge links
              to a public trust profile.
            </p>
          </div>

          <TrustCard />
        </div>
      </div>
    </Section>
  );
}

function TrustCard() {
  return (
    <div className="relative w-full max-w-full overflow-hidden">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-full opacity-60 blur-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(37,99,235,0.12) 60%, transparent 80%)' }}
      />

      <div className="relative border border-white/[0.08] bg-[#0c0c0c] p-6 md:p-9">
        <span aria-hidden className="absolute left-0 top-0 h-3 w-3 border-l border-t border-emerald-400/70" />
        <span aria-hidden className="absolute right-0 top-0 h-3 w-3 border-r border-t border-emerald-400/70" />
        <span aria-hidden className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-emerald-400/70" />
        <span aria-hidden className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-emerald-400/70" />

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
            Mandate · ag_ctx_ai_prod
          </span>
          <Tag variant="success">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Verified
          </Tag>
        </div>

        <div className="mt-6">
          <NumberDisplay value="94" suffix="/ 100" size="md" />
        </div>

        <div className="mt-5 h-1 w-full overflow-hidden bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-emerald-400"
            style={{ width: '94%' }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-5">
          <Stat kicker="Events" value="2,847" />
          <Stat kicker="Allowed" value="98.2%" tone="emerald" />
          <Stat kicker="Active" value="91d" />
        </div>

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">
          Share your agent&rsquo;s trust profile
        </p>
      </div>
    </div>
  );
}

function Stat({ kicker, value, tone }: { kicker: string; value: string; tone?: 'emerald' }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/35">
        {kicker}
      </div>
      <div
        className={`font-display mt-1.5 text-[17px] font-semibold tracking-tight ${tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

/* =======================================================================
   SECTION 6 — COMPLIANCE
   ======================================================================= */

function ComplianceSection() {
  const packs = [
    {
      title: 'OWASP Agentic Top 10',
      body: 'ASI-01 through ASI-10 mapped to your agent’s signed event data.',
      code: 'ASI-01 … ASI-10',
    },
    {
      title: 'EU AI Act',
      body: 'Articles 9, 12, 13, 14 — enforcement August 2026.',
      code: 'ART 9 / 12 / 13 / 14',
    },
    {
      title: 'HIPAA AI Addendum',
      body: '164.308 and 164.312 safeguards.',
      code: '§164.308 · §164.312',
    },
  ];

  return (
    <Section className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          One click.{' '}
          <span className="text-white/50">Auditor-ready.</span>
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {packs.map((p) => (
            <div
              key={p.title}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-7 transition-colors hover:border-white/25 hover:bg-white/[0.035]"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/35">
                  Report Pack
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-300"
                  aria-hidden
                >
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="font-display mt-4 text-[18px] font-medium tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                {p.body}
              </p>
              <div className="mt-5 border-t border-white/[0.06] pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300/90">
                {p.code}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 border-t border-white/[0.05] pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[14.5px] text-white/60 md:text-[15px]">
            <span className="text-white">$500 per report.</span> Generated in
            seconds. No consultants. No waiting.
          </p>
          <Button asChild variant="secondary" size="md">
            <Link href="/pricing">
              See pricing <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 7 — WORKS WITH
   ======================================================================= */

function WorksWithSection() {
  const frameworks = [
    'LangChain',
    'n8n',
    'CrewAI',
    'LlamaIndex',
    'Claude Desktop',
    'Cursor',
    'Windsurf',
    'OpenAI',
    'Anthropic',
  ];

  return (
    <Section tight className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          Works with every framework.
        </h2>

        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          {frameworks.map((f) => (
            <Tag
              key={f}
              variant="default"
              className="px-3.5 py-1.5 text-[11.5px] tracking-[0.18em]"
            >
              {f}
            </Tag>
          ))}
        </div>

        <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
          <span className="text-white">Vendor-neutral by design.</span> No
          framework can be the audit layer for its own agents.
        </p>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 8 — PRICING
   ======================================================================= */

function PricingSection() {
  const tiers = [
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
  ];

  return (
    <Section className="relative border-t border-white/[0.05]">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <h2 className={`${H2_CLASS} max-w-4xl`}>
          Built for the scale of your mandate.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col border p-7 transition-colors ${
                t.highlight
                  ? 'border-blue-500/60 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.10),transparent_60%)]'
                  : 'border-white/[0.08] bg-white/[0.015] hover:border-white/25'
              }`}
            >
              {t.highlight && (
                <Tag variant="info" className="absolute -top-3 left-6 bg-[#080808]">
                  Most Popular
                </Tag>
              )}
              <Tag variant="default" className="self-start">
                {t.blurb}
              </Tag>
              <h3 className="font-display mt-3 text-[18px] font-medium tracking-tight">
                {t.name}
              </h3>

              <div className="mt-5">
                <NumberDisplay
                  value={t.price}
                  suffix={t.cadence}
                  size="sm"
                  className="[&>span:first-child]:text-[2.5rem]"
                />
              </div>

              <ul className="mt-7 space-y-2.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] text-white/70">
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
                      <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  asChild
                  variant={t.highlight ? 'primary' : 'secondary'}
                  size="md"
                  className="w-full"
                >
                  <Link href={t.ctaHref}>{t.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Card
          variant="success-tinted"
          className="mt-5 flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center"
        >
          <div>
            <Tag variant="success">One-time</Tag>
            <h4 className="font-display mt-3 text-[18px] font-medium tracking-tight md:text-[20px]">
              Compliance Report <span className="text-white/50">·</span> $500
            </h4>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/60">
              OWASP, EU AI Act, or HIPAA pack generated from your signed event
              stream. Auditor-ready PDF in seconds.
            </p>
          </div>
          <Button asChild variant="success" size="md" className="shrink-0">
            <Link href="/pricing">
              Generate a report <span aria-hidden>→</span>
            </Link>
          </Button>
        </Card>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 8.5 — STATE OF AI AGENT GOVERNANCE 2026 (REPORT TEASER)
   ======================================================================= */

function ReportTeaserSection() {
  const teaserStats = [
    REPORT_2026.key_stats[0], // 48.9%
    REPORT_2026.key_stats[2], // 40%+
    REPORT_2026.key_stats[3], // 9 days
  ];

  return (
    <Section className="relative overflow-hidden border-t border-white/[0.05]">
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 -z-10 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <h2 className={`${H2_CLASS} max-w-3xl`}>
              State of AI Agent Governance 2026
              <span className="text-blue-500">.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
              <span className="text-white">
                MandateZ original research on the governance gap.
              </span>{' '}
              {REPORT_2026.subtitle}.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              Published · {REPORT_2026.published}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              By · {REPORT_2026.author}
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {teaserStats.map((s, i) => (
            <div
              key={i}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-7 transition-colors hover:border-white/25 hover:bg-white/[0.035]"
            >
              <div className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 group-hover:w-full" />
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="mt-5">
                <NumberDisplay value={s.stat} size="sm" />
              </div>
              <p className="mt-4 text-[14px] leading-[1.55] text-white/65">
                {s.label}
              </p>
              <div className="mt-5 border-t border-white/[0.06] pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-blue-300/90">
                Source · {s.source}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/[0.05] pt-6">
          <Button asChild variant="primary" size="md">
            <Link href="/report">
              Read the full report
              <span aria-hidden>→</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" size="md">
            <Link href="/report?print=true">
              Download PDF
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
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </Link>
          </Button>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
            6 stats · 5 findings · 5 recommendations
          </span>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 8.75 — CLOSING CTA
   ======================================================================= */

function ClosingCtaSection() {
  return (
    <Section
      tight
      className="relative border-t border-white/[0.05] bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.08),transparent_70%)]"
    >
      <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
        <h2 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-white">
          Every agent needs a mandate.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/60 md:text-[16px]">
          Get a free shadow scan. See every agent in your stack in 60 seconds.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="primary" size="lg">
            <Link href="/login">
              Get a free shadow scan
              <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* =======================================================================
   SECTION 9 — FOOTER
   ======================================================================= */

function FooterSection() {
  return (
    <footer className="relative border-t border-white/[0.05] py-14">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="font-display text-[24px] font-bold tracking-[-0.025em]">
              Mandate<span className="text-blue-500">Z</span>
            </div>
            <p className="font-display mt-3 text-[15px] font-medium tracking-tight text-white/80">
              Every agent needs a mandate.
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              Build
            </div>
            <ul className="mt-3 space-y-2">
              <FooterLink href="https://mandatez.mintlify.app" external>mandatez.mintlify.app</FooterLink>
              <FooterLink href="https://github.com/mandatez/core" external>github.com/mandatez/core</FooterLink>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/35">
              Packages
            </div>
            <ul className="mt-3 space-y-2">
              <FooterLink href="https://www.npmjs.com/package/@mandatez/sdk" external>npm · @mandatez/sdk</FooterLink>
              <FooterLink href="https://www.npmjs.com/package/@mandatez/mcp" external>npm · @mandatez/mcp</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/[0.05] pt-5 md:flex-row md:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">
            © 2026 MandateZ · Neutral by design
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">
            Signed with Ed25519
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="inline-flex items-center gap-1.5 font-mono text-[12px] text-white/60 transition-colors hover:text-blue-300"
      >
        {children}
        {external && <span className="text-white/30">↗</span>}
      </a>
    </li>
  );
}