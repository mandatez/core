import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { REPORT_2026 } from '@/data/governance-report-2026';
import {
  ReportPrintButton,
  ReportAutoPrint,
} from '@/components/report-print-controls';
import { Button } from '@/components/ui';

const syne = { className: 'font-display' };
const mono = { className: 'font-mono' };
const inter = { className: 'font-sans' };

const OG_IMAGE =
  'https://core-dashboard-black.vercel.app/api/trust-card/ag_ctx_ai_prod';

export const metadata: Metadata = {
  title: `${REPORT_2026.title} — MandateZ Research`,
  description: REPORT_2026.subtitle,
  openGraph: {
    title: REPORT_2026.title,
    description: REPORT_2026.subtitle,
    type: 'article',
    siteName: 'MandateZ',
    url: 'https://core-consumer.vercel.app/report',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: REPORT_2026.title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: REPORT_2026.title,
    description: REPORT_2026.subtitle,
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: 'https://core-consumer.vercel.app/report',
  },
};

export default function ReportPage() {
  return (
    <div className={`${inter.className} relative min-h-screen bg-[#080808] text-white`}>
      <ReportStyles />
      <Suspense fallback={null}>
        <ReportAutoPrint />
      </Suspense>

      {/* Print action bar — hidden when printing */}
      <div className="no-print fixed top-20 right-6 z-40 flex items-center gap-3">
        <ReportPrintButton />
      </div>

      <article className="report-root mx-auto max-w-4xl px-6 pb-24 pt-40 md:px-10">
        {/* ===== COVER ===== */}
        <header className="report-cover border-b border-white/[0.08] pb-20">
          <div className="flex items-center gap-3">
            <span
              className={`${mono.className} text-[11px] uppercase tracking-[0.32em] text-blue-300`}
            >
              / MZ Research · 2026 · 01
            </span>
            <span className="mz-hairline h-px w-16" />
          </div>

          <h1
            className={`${syne.className} mt-10 font-bold tracking-[-0.03em] leading-[0.95]`}
            style={{ fontSize: 'clamp(2.75rem, 7vw, 5.25rem)' }}
          >
            {REPORT_2026.title}
            <span className="text-blue-500">.</span>
          </h1>

          <p className="mt-8 max-w-3xl text-[18px] leading-[1.5] text-white/65 md:text-[22px]">
            {REPORT_2026.subtitle}
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2">
            <Meta kicker="Published" value={REPORT_2026.published} />
            <span className="h-4 w-px bg-white/10" />
            <Meta kicker="Author" value={REPORT_2026.author} />
            <span className="h-4 w-px bg-white/10" />
            <Meta kicker="Pages" value="6" />
          </div>
        </header>

        {/* ===== EXECUTIVE SUMMARY ===== */}
        <Section
          label="Executive Summary"
          index="00"
          title="The infrastructure gap has become the security gap."
        >
          <div className="space-y-6">
            {REPORT_2026.executive_summary.map((p, i) => (
              <p
                key={i}
                className="text-[17px] leading-[1.7] text-white/75 md:text-[18px]"
              >
                {p}
              </p>
            ))}
          </div>
        </Section>

        {/* ===== KEY STATISTICS ===== */}
        <Section label="Key Statistics" index="01" title="Six numbers that define 2026.">
          <div className="grid gap-4 md:grid-cols-2">
            {REPORT_2026.key_stats.map((s, i) => (
              <StatCard key={i} index={i + 1} {...s} />
            ))}
          </div>
        </Section>

        {/* ===== FINDINGS ===== */}
        <Section label="Findings" index="02" title="Five structural observations.">
          <div className="space-y-10">
            {REPORT_2026.findings.map((f) => (
              <Finding key={f.number} {...f} />
            ))}
          </div>
        </Section>

        {/* ===== RECOMMENDATIONS ===== */}
        <Section
          label="Recommendations"
          index="03"
          title="What to do before August 2, 2026."
        >
          <ol className="space-y-5">
            {REPORT_2026.recommendations.map((r, i) => (
              <Recommendation key={i} index={i + 1} text={r} />
            ))}
          </ol>
        </Section>

        {/* ===== CTA ===== */}
        <section className="report-cta mt-20 border border-blue-500/30 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.14),transparent_70%)] p-10 md:p-14">
          <div
            className={`${mono.className} text-[10px] uppercase tracking-[0.3em] text-blue-300`}
          >
            / Next Step
          </div>
          <h3
            className={`${syne.className} mt-4 text-[32px] font-bold tracking-[-0.02em] md:text-[44px]`}
          >
            Govern your agents today.
          </h3>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-white/65 md:text-[17px]">
            The Vercel breach, the EU AI Act, the OWASP Top 10 — they all point at
            the same missing layer. MandateZ is that layer. Open source, neutral,
            cross-vendor. Five minutes to your first signed event.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild variant="primary" size="lg">
              <a
                href="https://mandatez.mintlify.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                mandatez.mintlify.app
                <span aria-hidden>→</span>
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/">Back to mandatez.com</Link>
            </Button>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="mt-20 border-t border-white/[0.08] pt-8">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <p
              className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-white/35`}
            >
              © 2026 MandateZ Research · mandatez.com
            </p>
            <p
              className={`${mono.className} text-[10px] uppercase tracking-[0.25em] text-white/30`}
            >
              Neutral · Cross-Vendor · Open Protocol
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}

/* ============================================================
   Components
   ============================================================ */

function Meta({ kicker, value }: { kicker: string; value: string }) {
  return (
    <div>
      <div
        className={`${mono.className} text-[9px] uppercase tracking-[0.3em] text-white/35`}
      >
        {kicker}
      </div>
      <div
        className={`${syne.className} mt-1 text-[15px] font-semibold tracking-tight text-white/90`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  label,
  index,
  title,
  children,
}: {
  label: string;
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section mt-20 border-t border-white/[0.06] pt-12">
      <div className="flex items-center gap-3">
        <span
          className={`${mono.className} text-[11px] uppercase tracking-[0.32em] text-blue-300`}
        >
          / {index}
        </span>
        <span className="mz-hairline h-px w-10" />
        <span
          className={`${mono.className} text-[11px] uppercase tracking-[0.32em] text-white/50`}
        >
          {label}
        </span>
      </div>
      <h2
        className={`${syne.className} mt-5 max-w-3xl text-[32px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[44px]`}
      >
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function StatCard({
  index,
  stat,
  label,
  source,
}: {
  index: number;
  stat: string;
  label: string;
  source: string;
}) {
  return (
    <div className="stat-card relative flex flex-col border border-white/[0.08] bg-white/[0.015] p-6 transition-all hover:border-white/20 hover:bg-white/[0.035]">
      <div
        className={`${mono.className} absolute right-4 top-4 text-[9px] uppercase tracking-[0.28em] text-white/25`}
      >
        {String(index).padStart(2, '0')}
      </div>
      <div
        className={`${syne.className} font-bold tracking-[-0.03em] text-white`}
        style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', lineHeight: '1' }}
      >
        {stat}
      </div>
      <p className="mt-4 text-[14.5px] leading-[1.55] text-white/70">{label}</p>
      <div
        className={`${mono.className} mt-5 border-t border-white/[0.06] pt-3 text-[10px] uppercase tracking-[0.22em] text-blue-300/90`}
      >
        Source · {source}
      </div>
    </div>
  );
}

function Finding({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="finding grid gap-4 border-l border-white/[0.08] pl-6 md:grid-cols-[auto_1fr] md:gap-8 md:border-none md:pl-0">
      <div
        className={`${syne.className} text-blue-400 font-bold tracking-[-0.03em] md:text-right`}
        style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', lineHeight: '1' }}
      >
        {number}
      </div>
      <div>
        <h3
          className={`${syne.className} text-[22px] font-bold leading-tight tracking-[-0.015em] md:text-[28px]`}
        >
          {title}
        </h3>
        <p className="mt-3 text-[16px] leading-[1.7] text-white/70 md:text-[17px]">
          {body}
        </p>
      </div>
    </div>
  );
}

function Recommendation({ index, text }: { index: number; text: string }) {
  return (
    <li className="recommendation flex items-start gap-5 border-l border-white/[0.08] pl-5">
      <span
        className={`${mono.className} flex h-8 w-8 shrink-0 items-center justify-center border border-blue-500/40 bg-blue-500/10 text-[12px] font-semibold text-blue-300`}
      >
        {String(index).padStart(2, '0')}
      </span>
      <span className="pt-1 text-[16px] leading-[1.6] text-white/85 md:text-[17px]">
        {text}
      </span>
    </li>
  );
}

/* ============================================================
   Styles — screen + print
   ============================================================ */

function ReportStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .mz-hairline {
            background-image: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          }

          @media print {
            @page {
              size: A4;
              margin: 18mm 16mm;
            }

            html, body {
              background: #ffffff !important;
              color: #0a0a0a !important;
            }

            .no-print { display: none !important; }

            nav, footer.no-print { display: none !important; }

            .report-root {
              max-width: 100% !important;
              padding: 0 !important;
              color: #0a0a0a !important;
            }

            .report-root * {
              color: #0a0a0a !important;
              border-color: rgba(0,0,0,0.15) !important;
              background: transparent !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }

            .report-root a,
            .report-root .text-blue-300,
            .report-root .text-blue-400,
            .report-root .text-blue-500 {
              color: #1d4ed8 !important;
            }

            .report-root .text-emerald-300,
            .report-root .text-emerald-400 {
              color: #047857 !important;
            }

            .report-root .text-white\\/35,
            .report-root .text-white\\/30,
            .report-root .text-white\\/25,
            .report-root .text-white\\/50 {
              color: rgba(10,10,10,0.55) !important;
            }

            .report-root h1,
            .report-root h2,
            .report-root h3 {
              color: #0a0a0a !important;
              page-break-after: avoid;
              break-after: avoid;
            }

            .report-section,
            .report-cta,
            .finding,
            .stat-card,
            .recommendation {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .report-section {
              margin-top: 8mm !important;
              padding-top: 6mm !important;
              border-top: 1px solid rgba(0,0,0,0.12) !important;
            }

            .report-cover {
              padding-bottom: 10mm !important;
              border-bottom: 1px solid rgba(0,0,0,0.15) !important;
            }

            .stat-card {
              border: 1px solid rgba(0,0,0,0.15) !important;
              padding: 5mm !important;
            }

            .report-cta {
              border: 1px solid rgba(0,0,0,0.15) !important;
              padding: 8mm !important;
              margin-top: 10mm !important;
            }

            .mz-hairline { display: none !important; }

            /* Force page break before each major section after the cover */
            .report-section { page-break-before: auto; }

            a[href]::after { content: ""; }
          }
        `,
      }}
    />
  );
}
