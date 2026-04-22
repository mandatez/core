'use client';

import { useEffect, useState } from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Incident {
  title: string;
  date: string;
  severity: Severity;
  source: string;
  owasp?: string;
  prevention?: string;
  url: string;
  pinned?: boolean;
  live?: boolean;
}

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  created_at: string;
  author: string;
}

const HARDCODED_INCIDENTS: Incident[] = [
  {
    title:
      "Vercel breached via Context.ai — 'Allow All' OAuth grant pivots into infrastructure",
    date: 'Apr 19, 2026',
    severity: 'critical',
    source: 'BleepingComputer',
    owasp: 'ASI-02, ASI-03',
    prevention:
      "MandateZ policy engine blocks 'Allow All' OAuth grants before execution. Ed25519 identity binding prevents credential pivot.",
    url: 'https://www.bleepingcomputer.com/news/security/vercel-confirms-breach-as-hackers-claim-to-be-selling-stolen-data/',
    pinned: true,
  },
  {
    title:
      'Russian hacker uses Claude AI to compromise 600+ firewall devices across 55 countries',
    date: 'Jan 2026',
    severity: 'critical',
    source: 'AWS Security',
    owasp: 'ASI-02, ASI-08',
    prevention:
      'MandateZ blocks agent actions outside declared policy scope. Every action is cryptographically signed — non-repudiable by design.',
    url: '#',
  },
  {
    title:
      '48.9% of enterprises blind to their own AI agent traffic — Salt Security H1 2026 Report',
    date: 'Apr 2026',
    severity: 'high',
    source: 'Salt Security',
    owasp: 'ASI-03, ASI-09',
    prevention:
      'MandateZ Shadow Agent Discovery finds unregistered agents. Every agent gets a cryptographic identity on registration.',
    url: '#',
  },
  {
    title:
      "AI agent 'confused deputy' attack compromises OAuth token in enterprise deployment",
    date: 'Mar 2026',
    severity: 'high',
    source: 'OWASP Agentic Top 10',
    owasp: 'ASI-03',
    prevention:
      'MandateZ policy engine enforces least-privilege at runtime. No agent can exceed its declared mandate.',
    url: '#',
  },
  {
    title:
      'Agent memory poisoning attack forces LLM to exfiltrate customer data',
    date: 'Feb 2026',
    severity: 'medium',
    source: 'OWASP Agentic Top 10',
    owasp: 'ASI-01',
    prevention:
      'MandateZ audit trail logs every read/export action with tamper-evident Ed25519 signatures.',
    url: '#',
  },
];

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-yellow-400',
};

const SEV_GLOW: Record<Severity, string> = {
  critical: 'shadow-[0_0_14px_rgba(239,68,68,0.85)]',
  high: 'shadow-[0_0_12px_rgba(249,115,22,0.7)]',
  medium: 'shadow-[0_0_10px_rgba(251,191,36,0.6)]',
  low: 'shadow-[0_0_8px_rgba(250,204,21,0.5)]',
};

export default function BreachFeed() {
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchHN = async () => {
      try {
        const res = await fetch(
          'https://hn.algolia.com/api/v1/search?query=AI+agent+security+breach&tags=story&hitsPerPage=5',
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('HN fetch failed');
        const data = await res.json();
        const hits: Incident[] = ((data.hits as HNHit[]) || [])
          .filter((h) => h.title)
          .slice(0, 3)
          .map((h) => ({
            title: h.title as string,
            date: new Date(h.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            severity: 'medium' as Severity,
            source: `Hacker News · ${h.author}`,
            url:
              h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            live: true,
          }));
        if (!cancelled) {
          setLiveIncidents(hits);
          setLastUpdated(new Date());
        }
      } catch {
        // Silent fail — hardcoded incidents still display.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHN();
    const id = setInterval(fetchHN, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const pinned = HARDCODED_INCIDENTS.filter((i) => i.pinned);
  const rest = HARDCODED_INCIDENTS.filter((i) => !i.pinned);
  const ordered: Incident[] = [...pinned, ...liveIncidents, ...rest];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] font-mono text-white/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span>
          {loading && !liveIncidents.length
            ? 'Scanning the wire'
            : `${ordered.length} incidents · ${lastUpdated
                ? `updated ${lastUpdated.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'static feed'}`}
        </span>
      </div>

      <div className="space-y-4">
        {ordered.map((inc, idx) => (
          <IncidentCard key={`${inc.title}-${idx}`} incident={inc} />
        ))}
      </div>
    </div>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <a
      href={incident.url}
      target={incident.url === '#' ? undefined : '_blank'}
      rel="noopener noreferrer"
      className="group relative block border border-white/[0.08] bg-white/[0.015] p-6 transition-all duration-300 hover:border-white/25 hover:bg-white/[0.035] md:p-7"
    >
      <div className="flex items-start gap-5">
        <div className="relative mt-2 shrink-0">
          <span
            className={`block h-2.5 w-2.5 rounded-full ${SEV_DOT[incident.severity]} ${SEV_GLOW[incident.severity]}`}
          />
          <span
            className={`absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full opacity-60 ${SEV_DOT[incident.severity]}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {incident.pinned && (
              <span className="border border-blue-500/50 bg-blue-500/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-blue-300">
                Pinned
              </span>
            )}
            {incident.live && (
              <span className="flex items-center gap-1.5 border border-blue-400/60 bg-blue-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-blue-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />
                Live
              </span>
            )}
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">
              {incident.severity}
            </span>
            {incident.owasp && (
              <span className="border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-white/55">
                {incident.owasp}
              </span>
            )}
          </div>

          <h3 className="text-[17px] leading-snug text-white transition-colors group-hover:text-blue-200 md:text-[19px]">
            {incident.title}
          </h3>

          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-white/35">
            {incident.date} · {incident.source}
          </p>

          {incident.prevention && (
            <div className="mt-5 border-l-2 border-emerald-500/70 bg-emerald-500/[0.04] px-4 py-3">
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-emerald-300">
                Prevented by MandateZ
              </p>
              <p className="text-[13.5px] leading-relaxed text-white/75">
                {incident.prevention}
              </p>
            </div>
          )}
        </div>

        <div className="hidden shrink-0 self-center text-white/20 transition-all duration-300 group-hover:translate-x-1 group-hover:text-blue-300 md:block">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17L17 7M17 7H9M17 7V15" />
          </svg>
        </div>
      </div>
    </a>
  );
}
