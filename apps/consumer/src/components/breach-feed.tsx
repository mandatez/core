'use client';

import { useEffect, useState } from 'react';
import { Card, Tag } from '@/components/ui';

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
      "Vercel breached via Context.ai — employee's 'Allow All' OAuth grant enables infrastructure pivot",
    date: 'Apr 19, 2026',
    severity: 'critical',
    source: 'Vercel Security Bulletin',
    owasp: 'ASI-02, ASI-03',
    prevention:
      "MandateZ policy engine blocks 'Allow All' OAuth grants before execution. Ed25519 identity cannot be stolen — unlike OAuth tokens.",
    url: 'https://vercel.com/kb/bulletin/vercel-april-2026-security-incident',
    pinned: true,
  },
  {
    title:
      'Russian threat actor uses Claude AI to compromise 600+ firewall devices across 55 countries',
    date: 'Jan 2026',
    severity: 'critical',
    source: 'AWS Security / Gambit Security',
    owasp: 'ASI-02, ASI-08',
    prevention:
      'MandateZ policy engine blocks actions outside declared mandate scope. Every event is Ed25519 signed — cryptographically non-repudiable.',
    url: '#',
  },
  {
    title:
      '48.9% of enterprises have zero visibility into their own AI agent traffic — Salt Security H1 2026',
    date: 'Apr 2026',
    severity: 'high',
    source: 'Salt Security State of AI & API Security Report',
    owasp: 'ASI-03, ASI-09',
    prevention:
      'MandateZ Shadow Agent Discovery finds unregistered agents. Every registered agent gets a cryptographic identity — visible, auditable, governed.',
    url: '#',
  },
];

const SEV_DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-400',
  low: 'bg-yellow-400',
};

const SEV_TAG: Record<Severity, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
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
      <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-danger opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-danger" />
        </span>
        <span>
          {loading && !liveIncidents.length
            ? 'Scanning the wire'
            : `${ordered.length} incidents · ${
                lastUpdated
                  ? `updated ${lastUpdated.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'static feed'
              }`}
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
  const isCritical =
    incident.severity === 'critical' || incident.severity === 'high';
  const variant = isCritical ? 'danger-tinted' : 'default';

  return (
    <Card
      variant={variant}
      className="group relative block p-0 transition-colors hover:border-border-strong"
    >
      <a
        href={incident.url}
        target={incident.url === '#' ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="block p-6 md:p-7"
      >
        <div className="flex items-start gap-5">
          <div className="relative mt-2 shrink-0">
            <span
              className={`block h-2.5 w-2.5 rounded-full ${SEV_DOT[incident.severity]}`}
            />
            <span
              className={`absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full opacity-60 ${SEV_DOT[incident.severity]}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex min-h-[2rem] flex-wrap items-center gap-x-2 gap-y-2">
              {incident.pinned && <Tag variant="info">Pinned</Tag>}
              {incident.live && (
                <Tag variant="info" className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                  Live
                </Tag>
              )}
              <Tag variant={SEV_TAG[incident.severity]}>
                {incident.severity}
              </Tag>
              {incident.owasp && (
                <Tag variant="default">{incident.owasp}</Tag>
              )}
            </div>

            <h3 className="mt-3 text-[17px] leading-snug text-text-primary transition-colors group-hover:text-accent-primary-hover md:text-[19px]">
              {incident.title}
            </h3>

            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.15em] text-text-muted">
              {incident.date} · {incident.source}
            </p>

            {incident.prevention && (
              <Card variant="success-tinted" className="mt-5 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-success">
                  Prevented by MandateZ
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-text-primary">
                  {incident.prevention}
                </p>
              </Card>
            )}
          </div>

          <div className="hidden shrink-0 self-center text-text-muted transition-colors duration-200 group-hover:text-accent-primary md:block">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 17L17 7M17 7H9M17 7V15" />
            </svg>
          </div>
        </div>
      </a>
    </Card>
  );
}