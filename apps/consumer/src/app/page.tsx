import Link from 'next/link';
import { Syne, JetBrains_Mono, Inter } from 'next/font/google';
import BreachFeed from '@/components/breach-feed';
import { REPORT_2026 } from '@/data/governance-report-2026';

const syne = Syne({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export default function LandingPage() {
  return (
    <div className={`${inter.className} relative min-h-screen bg-[#080808] text-white`}>
      <PageStyles />
      <NoiseOverlay />

      <Hero />
      <BreachSection />
      <VercelSimulation />
      <HowItWorks />
      <TrustScoreSection />
      <ComplianceSection />
      <WorksWithSection />
      <PricingSection />
      <ReportTeaserSection />
      <FooterSection />
    </div>
  );
}

/* =======================================================================
   Styles, fonts, overlays
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
          @keyframes mz-tick {
            0%   { transform: translateY(0); opacity: 0.55; }
            50%  { opacity: 1; }
            100% { transform: translateY(-3px); opacity: 0.55; }
          }
          @keyframes mz-scanline {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(100%); }
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

          .mz-scan {
            position: absolute; inset: 0;
            background: linear-gradient(180deg, transparent 0%, rgba(37,99,235,0.08) 50%, transparent 100%);
            height: 120px;
            animation: mz-scanline 7s linear infinite;
            pointer-events: none;
          }

          .mz-hairline {
            background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          }

          .mz-code pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .mz-code .k  { color: #C792EA; }   /* keyword */
          .mz-code .s  { color: #A5E8B7; }   /* string */
          .mz-code .c  { color: rgba(255,255,255,0.35); font-style: italic; } /* comment */
          .mz-code .n  { color: #82AAFF; }   /* name */
          .mz-code .p  { color: rgba(255,255,255,0.7); } /* punct */
          .mz-code .bad { color: #EF4444; }
          .mz-code .ok  { color: #10B981; }

          @media (prefers-reduced-motion: reduce) {
            .mz-orb-a, .mz-orb-b, .mz-reveal, .mz-scan { animation: none !important; }
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
    <section className="relative isolate overflow-hidden min-h-screen flex items-center">
      {/* grid */}
      <div className="mz-grid absolute inset-0 -z-10" />

      {/* orbs */}
      <div
        aria-hidden
        className="mz-orb-a absolute -z-10 top-[10%] left-[-6%] h-[55vh] w-[55vh] rounded-full blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.55) 0%, rgba(37,99,235,0) 70%)' }}
      />
      <div
        aria-hidden
        className="mz-orb-b absolute -z-10 bottom-[-10%] right-[-5%] h-[60vh] w-[60vh] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.32) 0%, rgba(16,185,129,0) 72%)' }}
      />

      {/* vignette */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-[#080808]" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pt-40 pb-24 md:px-10 lg:px-16">
        {/* eyebrow */}
        <div className="mz-reveal mz-reveal-1 mb-10 flex items-center gap-3">
          <span className={`${mono.className} text-[10px] uppercase tracking-[0.32em] text-white/40`}>
            MZ · 001 — The Trust Layer for AI Agents
          </span>
          <span className="mz-hairline h-px w-16 md:w-24" />
        </div>

        <h1
          className={`${syne.className} mz-reveal mz-reveal-2 font-extrabold tracking-[-0.035em] leading-[0.92] text-white`}
          style={{ fontSize: 'clamp(3.2rem, 10vw, 10.5rem)' }}
        >
          Every agent needs
          <br />
          <span className="relative inline-block">
            a mandate
            <span className="text-blue-500">.</span>
            <svg
              aria-hidden
              className="absolute -bottom-4 left-0 right-0 w-full"
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

        <p className="mz-reveal mz-reveal-3 mt-12 max-w-2xl text-[17px] leading-[1.55] text-white/60 md:text-[19px]">
          The Vercel breach happened because an AI agent had no policy engine,
          no cryptographic identity, and no audit trail.{' '}
          <span className="text-white/90">MandateZ prevents this at the source.</span>
        </p>

        {/* CTAs */}
        <div className="mz-reveal mz-reveal-4 mt-12 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className={`${inter.className} group relative inline-flex items-center gap-2 bg-[#2563EB] px-7 py-4 text-[13px] font-medium tracking-wide text-white transition-all hover:bg-[#1d4ed8] hover:shadow-[0_0_40px_rgba(37,99,235,0.45)]`}
          >
            Get Started Free
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#breach-feed"
            className="group inline-flex items-center gap-2 border border-white/15 bg-white/[0.02] px-7 py-4 text-[13px] font-medium tracking-wide text-white/80 transition-all hover:border-white/40 hover:bg-white/[0.05] hover:text-white"
          >
            See the breach feed
            <span className="text-white/40 transition-transform group-hover:translate-y-0.5">↓</span>
          </a>
        </div>

        {/* Trust signals */}
        <div className="mz-reveal mz-reveal-5 mt-16 flex flex-wrap items-center gap-x-8 gap-y-4">
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
      <span className={`${mono.className} text-[10.5px] uppercase tracking-[0.22em] text-white/55`}>
        {children}
      </span>
    </div>
  );
}

/* =======================================================================
   SECTION 2 — LIVE BREACH FEED
   ======================================================================= */

function BreachSection() {
  return (
    <section
      id="breach-feed"
      className="relative border-t border-white/[0.05] py-28 md:py-36"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="02" label="Threat Intelligence" accent="red" />

        <h2
          className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}
        >
          AI Agent Incidents <span className="text-white/30">—</span> Live
        </h2>

        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-white/55 md:text-[17px]">
          Every incident below is an AI agent governance failure.
          <br className="hidden md:block" />
          <span className="text-white/85"> Every one was preventable.</span>
        </p>

        <div className="mt-14">
          <BreachFeed />
        </div>

        <div className="mt-10 border-t border-white/[0.05] pt-8">
          <p className={`${mono.className} text-[11px] leading-relaxed text-white/40`}>
            This feed updates automatically. Every incident maps to an OWASP
            Agentic Top 10 risk that MandateZ controls.
          </p>
        </div>
      </div>
    </section>
  );
}

/* =======================================================================
   SECTION 3 — VERCEL SIMULATION
   ======================================================================= */

function VercelSimulation() {
  return (
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="03" label="Threat Simulation" accent="blue" />

        <h2 className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[60px]`}>
          How MandateZ blocks
          <br />
          the Vercel attack.
        </h2>

        <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-white/55 md:text-[17px]">
          The attacker gained access by exploiting an AI agent with{' '}
          <span className="text-white/90">&ldquo;Allow All&rdquo;</span> OAuth
          permissions. Here&rsquo;s what happens with MandateZ.
        </p>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <CodePanel
            tone="red"
            label="Without MandateZ"
            sub="Context.ai — no governance"
            footer="Breach. $2M ransom. Mandiant called."
            code={
              <>
                <span className="c">{'// Context.ai agent — no governance'}</span>
                {'\n'}
                <span className="k">const</span> <span className="n">agent</span> <span className="p">=</span> <span className="k">new</span> <span className="n">AIAgent</span><span className="p">(</span><span className="p">{'{'}</span>
                {'\n  '}permissions<span className="p">:</span> <span className="s">&quot;Allow All&quot;</span><span className="p">,</span>
                {'\n  '}auditLog<span className="p">:</span> <span className="k">null</span><span className="p">,</span>
                {'\n  '}identity<span className="p">:</span> <span className="s">&quot;oauth_token_7f3k2&quot;</span> <span className="c">{'// stealable'}</span>
                {'\n'}<span className="p">{'}'}</span><span className="p">)</span><span className="p">;</span>
                {'\n\n'}
                <span className="c">{'// Attacker steals token, pivots into Vercel'}</span>
                {'\n'}
                <span className="k">await</span> <span className="n">agent</span><span className="p">.</span>grantOAuth<span className="p">(</span><span className="s">&quot;vercel:workspace:*&quot;</span><span className="p">)</span><span className="p">;</span> <span className="bad">{'✗ no policy check'}</span>
                {'\n'}
                <span className="k">await</span> <span className="n">agent</span><span className="p">.</span>readEnvVars<span className="p">(</span><span className="s">&quot;*&quot;</span><span className="p">)</span><span className="p">;</span>                 <span className="bad">{'✗ no audit trail'}</span>
              </>
            }
          />

          <CodePanel
            tone="emerald"
            label="With MandateZ"
            sub="Governed — policy enforced at runtime"
            footer="Breach prevented. Vercel infrastructure untouched."
            code={
              <>
                <span className="c">{'// MandateZ-governed agent'}</span>
                {'\n'}
                <span className="k">const</span> <span className="n">agent</span> <span className="p">=</span> <span className="k">new</span> <span className="n">MandateZClient</span><span className="p">(</span><span className="p">{'{'}</span>
                {'\n  '}agentId<span className="p">:</span> <span className="s">&quot;ag_ctx_ai_prod&quot;</span><span className="p">,</span>
                {'\n  '}privateKey<span className="p">:</span> <span className="n">process</span><span className="p">.</span>env<span className="p">.</span>AGENT_KEY<span className="p">,</span> <span className="c">{'// Ed25519'}</span>
                {'\n  '}policies<span className="p">:</span> <span className="p">[</span>
                {'\n    '}<span className="p">{'{'}</span> action<span className="p">:</span> <span className="s">&quot;oauth:grant&quot;</span><span className="p">,</span> resource<span className="p">:</span> <span className="s">&quot;*&quot;</span><span className="p">,</span> outcome<span className="p">:</span> <span className="s">&quot;blocked&quot;</span> <span className="p">{'}'}</span><span className="p">,</span>
                {'\n    '}<span className="p">{'{'}</span> action<span className="p">:</span> <span className="s">&quot;read&quot;</span><span className="p">,</span> resource<span className="p">:</span> <span className="s">&quot;env:sensitive:*&quot;</span><span className="p">,</span> outcome<span className="p">:</span> <span className="s">&quot;blocked&quot;</span> <span className="p">{'}'}</span>
                {'\n  '}<span className="p">]</span>
                {'\n'}<span className="p">{'}'}</span><span className="p">)</span><span className="p">;</span>
                {'\n\n'}
                <span className="c">{'// Attacker attempts same pivot:'}</span>
                {'\n'}
                <span className="k">await</span> <span className="n">agent</span><span className="p">.</span>grantOAuth<span className="p">(</span><span className="s">&quot;vercel:workspace:*&quot;</span><span className="p">)</span><span className="p">;</span>
                {'\n'}
                <span className="ok">{'→ BLOCKED by policy engine'}</span>
                {'\n'}
                <span className="ok">{'→ Event signed + logged'}</span>
                {'\n'}
                <span className="ok">{'→ Alert sent to security team'}</span>
              </>
            }
          />
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-white/[0.05] pt-8 md:flex-row md:items-center">
          <p className="max-w-2xl text-[15px] leading-relaxed text-white/55 md:text-[16px]">
            The difference: <span className="text-white">4 lines of policy configuration</span> and
            a cryptographic identity that cannot be stolen.
          </p>
          <a
            href="#"
            className="group inline-flex items-center gap-2 border-b border-white/20 pb-1 text-[13px] font-medium text-white/80 transition-colors hover:border-blue-400 hover:text-blue-300"
          >
            See the full technical breakdown
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function CodePanel({
  tone,
  label,
  sub,
  footer,
  code,
}: {
  tone: 'red' | 'emerald';
  label: string;
  sub: string;
  footer: string;
  code: React.ReactNode;
}) {
  const toneBar = tone === 'red' ? 'bg-red-500' : 'bg-emerald-500';
  const toneGlow =
    tone === 'red'
      ? 'shadow-[0_0_80px_rgba(239,68,68,0.12)]'
      : 'shadow-[0_0_80px_rgba(16,185,129,0.14)]';
  const toneBg =
    tone === 'red'
      ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.07),transparent_60%)]'
      : 'bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_60%)]';

  return (
    <div
      className={`mz-code relative flex flex-col border border-white/[0.08] ${toneBg} ${toneGlow}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`relative flex h-2 w-2`}>
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${toneBar} opacity-75`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${toneBar}`} />
          </span>
          <span className={`${mono.className} text-[11px] uppercase tracking-[0.2em] text-white/75`}>
            {label}
          </span>
        </div>
        <span className={`${mono.className} text-[10px] uppercase tracking-[0.2em] text-white/30`}>
          {sub}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="mz-scan opacity-40" aria-hidden />
        <pre
          className={`${mono.className} relative overflow-x-auto px-5 py-6 text-[12.5px] leading-[1.75] text-white/85`}
        >
          {code}
        </pre>
      </div>

      <div className={`${mono.className} border-t border-white/[0.06] px-5 py-3 text-[10.5px] uppercase tracking-[0.2em] ${tone === 'red' ? 'text-red-300/80' : 'text-emerald-300/80'}`}>
        {footer}
      </div>
    </div>
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
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="04" label="Architecture" accent="blue" />

        <h2 className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}>
          Trust infrastructure
          <br />
          for every agent.
        </h2>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <div
              key={c.title}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-8 transition-all hover:border-white/20 hover:bg-white/[0.035]"
            >
              <div className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 group-hover:w-full" />
              <div className={`${mono.className} mb-6 text-[10px] uppercase tracking-[0.3em] text-white/30`}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="mb-6 text-blue-400">{c.glyph}</div>
              <h3 className={`${syne.className} text-[22px] font-bold tracking-tight md:text-[26px]`}>
                {c.title}
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/55">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IconIdentity() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="11" y="4" width="10" height="12" rx="5" />
      <path d="M16 16v4" />
      <path d="M7 28c0-5 4-9 9-9s9 4 9 9" />
      <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPolicy() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3l11 4v8c0 7-5 12-11 14-6-2-11-7-11-14V7l11-4z" />
      <path d="M11.5 16l3 3 6-6" />
    </svg>
  );
}

function IconAudit() {
  return (
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
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
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionLabel index="05" label="Verification" accent="emerald" />
            <h2 className={`${syne.className} mt-6 max-w-2xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[60px]`}>
              Agent Trust Scores
              <br />
              <span className="text-white/50">— publicly verifiable.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/55 md:text-[17px]">
              When your agent reaches <span className="text-emerald-300">Verified</span> status,
              share the badge on GitHub, X, or your product page.
              Every badge links to a public trust profile.
            </p>
          </div>

          <TrustCard />
        </div>
      </div>
    </section>
  );
}

function TrustCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-full opacity-60 blur-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(37,99,235,0.12) 60%, transparent 80%)' }}
      />

      <div className="relative border border-white/[0.08] bg-[#0c0c0c] p-8 md:p-10">
        {/* corner accents */}
        <span aria-hidden className="absolute left-0 top-0 h-3 w-3 border-l border-t border-emerald-400/70" />
        <span aria-hidden className="absolute right-0 top-0 h-3 w-3 border-r border-t border-emerald-400/70" />
        <span aria-hidden className="absolute left-0 bottom-0 h-3 w-3 border-l border-b border-emerald-400/70" />
        <span aria-hidden className="absolute right-0 bottom-0 h-3 w-3 border-r border-b border-emerald-400/70" />

        <div className="flex items-center justify-between">
          <span className={`${mono.className} text-[10px] uppercase tracking-[0.3em] text-white/40`}>
            Mandate · ag_ctx_ai_prod
          </span>
          <span className={`${mono.className} inline-flex items-center gap-1.5 border border-emerald-400/60 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.25em] text-emerald-300`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Verified
          </span>
        </div>

        <div className="mt-8 flex items-end gap-4">
          <span
            className={`${syne.className} leading-none font-extrabold tracking-[-0.04em]`}
            style={{ fontSize: 'clamp(5rem, 12vw, 8.5rem)' }}
          >
            94
          </span>
          <span className={`${mono.className} pb-3 text-[11px] uppercase tracking-[0.3em] text-white/40`}>
            / 100
          </span>
        </div>

        {/* bar */}
        <div className="mt-6 h-1 w-full overflow-hidden bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-400 to-emerald-400"
            style={{ width: '94%' }}
          />
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-6">
          <Stat kicker="Events" value="2,847" />
          <Stat kicker="Allowed" value="98.2%" tone="emerald" />
          <Stat kicker="Active" value="91d" />
        </div>

        <p className={`${mono.className} mt-8 text-[10px] uppercase tracking-[0.25em] text-white/30`}>
          Share your agent&rsquo;s trust profile
        </p>
      </div>
    </div>
  );
}

function Stat({ kicker, value, tone }: { kicker: string; value: string; tone?: 'emerald' }) {
  return (
    <div>
      <div className={`${mono.className} text-[9px] uppercase tracking-[0.28em] text-white/35`}>
        {kicker}
      </div>
      <div
        className={`${syne.className} mt-1.5 text-[22px] font-bold tracking-tight ${tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}
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
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="06" label="Compliance" accent="blue" />

        <h2 className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}>
          One click.
          <br />
          <span className="text-white/50">Auditor-ready.</span>
        </h2>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {packs.map((p) => (
            <div
              key={p.title}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-8 transition-all hover:border-white/25 hover:bg-white/[0.035]"
            >
              <div className="flex items-center justify-between">
                <span className={`${mono.className} text-[9px] uppercase tracking-[0.28em] text-white/35`}>
                  Report Pack
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-300">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className={`${syne.className} mt-5 text-[24px] font-bold tracking-tight`}>
                {p.title}
              </h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-white/55">
                {p.body}
              </p>
              <div className={`${mono.className} mt-6 border-t border-white/[0.06] pt-4 text-[10px] uppercase tracking-[0.22em] text-blue-300/90`}>
                {p.code}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-3 border-t border-white/[0.05] pt-8 md:flex-row md:items-center md:justify-between">
          <p className={`${inter.className} text-[15px] text-white/60 md:text-[16px]`}>
            <span className="text-white">$500 per report.</span> Generated in seconds. No consultants. No waiting.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.02] px-6 py-3 text-[13px] font-medium text-white/80 transition-all hover:border-white/40 hover:text-white"
          >
            See pricing <span>→</span>
          </Link>
        </div>
      </div>
    </section>
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
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="07" label="Ecosystem" accent="blue" />

        <h2 className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}>
          Works with
          <br />
          every framework.
        </h2>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          {frameworks.map((f) => (
            <span
              key={f}
              className={`${mono.className} cursor-default border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[12px] uppercase tracking-[0.18em] text-white/70 transition-all hover:border-blue-400/60 hover:bg-blue-500/5 hover:text-blue-200`}
            >
              {f}
            </span>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-[16px] leading-relaxed text-white/55 md:text-[17px]">
          <span className="text-white">Vendor-neutral by design.</span>{' '}
          No framework can be the audit layer for its own agents.
        </p>
      </div>
    </section>
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
    <section className="relative border-t border-white/[0.05] py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="08" label="Pricing" accent="blue" />

        <h2 className={`${syne.className} mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}>
          Built for the scale
          <br />
          of your mandate.
        </h2>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col border p-8 transition-all ${
                t.highlight
                  ? 'border-blue-500/60 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.12),transparent_60%)] shadow-[0_0_60px_rgba(37,99,235,0.18)]'
                  : 'border-white/[0.08] bg-white/[0.015] hover:border-white/25'
              }`}
            >
              {t.highlight && (
                <span className={`${mono.className} absolute -top-3 left-6 bg-[#080808] px-2 text-[9px] uppercase tracking-[0.3em] text-blue-300`}>
                  Most Popular
                </span>
              )}
              <div className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-white/40`}>
                {t.blurb}
              </div>
              <h3 className={`${syne.className} mt-3 text-[24px] font-bold tracking-tight`}>
                {t.name}
              </h3>

              <div className="mt-6 flex items-baseline gap-1">
                <span className={`${syne.className} text-[48px] font-extrabold leading-none tracking-[-0.03em]`}>
                  {t.price}
                </span>
                <span className={`${mono.className} text-[12px] text-white/50`}>
                  {t.cadence}
                </span>
              </div>

              <ul className="mt-8 space-y-3">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[14px] text-white/70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" className="mt-1 shrink-0">
                      <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href={t.ctaHref}
                className={`mt-10 inline-flex items-center justify-center px-6 py-3.5 text-[13px] font-medium tracking-wide transition-all ${
                  t.highlight
                    ? 'bg-[#2563EB] text-white hover:bg-[#1d4ed8] hover:shadow-[0_0_30px_rgba(37,99,235,0.45)]'
                    : 'border border-white/15 bg-white/[0.02] text-white/85 hover:border-white/40 hover:text-white'
                }`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Compliance report callout */}
        <div className="mt-6 flex flex-col items-start justify-between gap-5 border border-emerald-500/30 bg-[radial-gradient(ellipse_at_left,rgba(16,185,129,0.10),transparent_70%)] p-8 md:flex-row md:items-center">
          <div>
            <div className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-emerald-300`}>
              One-time
            </div>
            <h4 className={`${syne.className} mt-2 text-[24px] font-bold tracking-tight md:text-[28px]`}>
              Compliance Report <span className="text-white/50">·</span> $500
            </h4>
            <p className="mt-2 max-w-xl text-[14.5px] text-white/60">
              OWASP, EU AI Act, or HIPAA pack generated from your signed event stream. Auditor-ready PDF in seconds.
            </p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center gap-2 border border-emerald-400/40 bg-emerald-500/10 px-6 py-3 text-[13px] font-medium text-emerald-200 transition-all hover:border-emerald-300 hover:bg-emerald-500/15"
          >
            Generate a report <span>→</span>
          </Link>
        </div>
      </div>
    </section>
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
    <section className="relative overflow-hidden border-t border-white/[0.05] py-28 md:py-36">
      <div
        aria-hidden
        className="absolute -top-24 left-1/2 -z-10 h-[40vh] w-[80vw] -translate-x-1/2 rounded-full opacity-40 blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <SectionLabel index="8.5" label="Original Research" accent="blue" />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <h2
              className={`${syne.className} max-w-3xl text-4xl font-extrabold leading-[0.98] tracking-[-0.02em] md:text-[64px]`}
            >
              State of AI Agent
              <br />
              Governance 2026<span className="text-blue-500">.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-white/55 md:text-[17px]">
              <span className="text-white">
                MandateZ original research on the governance gap.
              </span>{' '}
              {REPORT_2026.subtitle}.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <span
              className={`${mono.className} text-[10px] uppercase tracking-[0.28em] text-white/35`}
            >
              Published · {REPORT_2026.published}
            </span>
            <span
              className={`${mono.className} text-[10px] uppercase tracking-[0.28em] text-white/35`}
            >
              By · {REPORT_2026.author}
            </span>
          </div>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {teaserStats.map((s, i) => (
            <div
              key={i}
              className="group relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-8 transition-all hover:border-white/25 hover:bg-white/[0.035]"
            >
              <div className="absolute left-0 top-0 h-px w-0 bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 group-hover:w-full" />
              <div
                className={`${mono.className} text-[10px] uppercase tracking-[0.3em] text-white/30`}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div
                className={`${syne.className} mt-6 font-extrabold tracking-[-0.03em] text-white`}
                style={{
                  fontSize: 'clamp(2.75rem, 6vw, 4rem)',
                  lineHeight: '1',
                }}
              >
                {s.stat}
              </div>
              <p className="mt-5 text-[14.5px] leading-[1.55] text-white/65">
                {s.label}
              </p>
              <div
                className={`${mono.className} mt-6 border-t border-white/[0.06] pt-4 text-[10px] uppercase tracking-[0.22em] text-blue-300/90`}
              >
                Source · {s.source}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-white/[0.05] pt-8">
          <Link
            href="/report"
            className={`${inter.className} group inline-flex items-center gap-2 bg-[#2563EB] px-7 py-3.5 text-[13px] font-medium tracking-wide text-white transition-all hover:bg-[#1d4ed8] hover:shadow-[0_0_40px_rgba(37,99,235,0.45)]`}
          >
            Read the full report
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href="/report?print=true"
            className="inline-flex items-center gap-2 border border-white/15 bg-white/[0.02] px-7 py-3.5 text-[13px] font-medium tracking-wide text-white/80 transition-all hover:border-white/40 hover:text-white"
          >
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
          <span
            className={`${mono.className} ml-auto text-[10px] uppercase tracking-[0.25em] text-white/35`}
          >
            6 stats · 5 findings · 5 recommendations
          </span>
        </div>
      </div>
    </section>
  );
}

/* =======================================================================
   SECTION 9 — FOOTER
   ======================================================================= */

function FooterSection() {
  return (
    <footer className="relative border-t border-white/[0.05] py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className={`${syne.className} text-[32px] font-extrabold tracking-[-0.03em]`}>
              Mandate<span className="text-blue-500">Z</span>
            </div>
            <p className={`${syne.className} mt-4 text-[20px] font-semibold tracking-tight text-white/80`}>
              Every agent needs a mandate.
            </p>
          </div>

          <div>
            <div className={`${mono.className} text-[10px] uppercase tracking-[0.28em] text-white/35`}>
              Build
            </div>
            <ul className="mt-4 space-y-2.5">
              <FooterLink href="https://mandatez.mintlify.app" external>mandatez.mintlify.app</FooterLink>
              <FooterLink href="https://github.com/mandatez/core" external>github.com/mandatez/core</FooterLink>
            </ul>
          </div>

          <div>
            <div className={`${mono.className} text-[10px] uppercase tracking-[0.28em] text-white/35`}>
              Packages
            </div>
            <ul className="mt-4 space-y-2.5">
              <FooterLink href="https://www.npmjs.com/package/@mandatez/sdk" external>npm · @mandatez/sdk</FooterLink>
              <FooterLink href="https://www.npmjs.com/package/@mandatez/mcp" external>npm · @mandatez/mcp</FooterLink>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-white/[0.05] pt-6 md:flex-row md:items-center">
          <p className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-white/30`}>
            © 2026 MandateZ · Neutral by design
          </p>
          <p className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-white/30`}>
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
        className={`${mono.className} inline-flex items-center gap-1.5 text-[12px] text-white/60 transition-colors hover:text-blue-300`}
      >
        {children}
        {external && <span className="text-white/30">↗</span>}
      </a>
    </li>
  );
}

/* =======================================================================
   Shared primitives
   ======================================================================= */

function SectionLabel({
  index,
  label,
  accent,
}: {
  index: string;
  label: string;
  accent: 'blue' | 'emerald' | 'red';
}) {
  const color =
    accent === 'red'
      ? 'text-red-400'
      : accent === 'emerald'
        ? 'text-emerald-300'
        : 'text-blue-400';

  return (
    <div className="flex items-center gap-3">
      <span className={`${mono.className} ${color} text-[11px] uppercase tracking-[0.32em]`}>
        / {index}
      </span>
      <span className="mz-hairline h-px w-10" />
      <span className={`${mono.className} text-[11px] uppercase tracking-[0.32em] text-white/50`}>
        {label}
      </span>
    </div>
  );
}
