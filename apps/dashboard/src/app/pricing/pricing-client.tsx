'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  NumberDisplay,
  SectionMarker,
  Tag,
  cn,
} from '@/components/ui';

type PlanId =
  | 'consumer_pro'
  | 'dashboard_starter'
  | 'dashboard_business'
  | null;

interface Tier {
  id: Exclude<PlanId, null>;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
  rank: number;
}

const TIERS: Tier[] = [
  {
    id: 'consumer_pro',
    name: 'Consumer Pro',
    price: '$19.99',
    period: '/mo',
    description:
      'For founders and individuals running personal agents on real data.',
    features: [
      'Unlimited agents',
      'Full event logging',
      'Policy engine',
      'Human oversight gate',
      'Email support',
    ],
    highlighted: false,
    rank: 1,
  },
  {
    id: 'dashboard_starter',
    name: 'Dashboard Starter',
    price: '$499',
    period: '/mo',
    description:
      'Compliance reporting and team oversight for a single standard.',
    features: [
      'Everything in Consumer Pro',
      'One compliance pack (HIPAA or EU AI Act)',
      'Audit trail export',
      'Slack + webhook alerts',
      '3 seats',
    ],
    highlighted: true,
    rank: 2,
  },
  {
    id: 'dashboard_business',
    name: 'Dashboard Business',
    price: '$1,499',
    period: '/mo',
    description: 'Full compliance coverage and white-label for growing teams.',
    features: [
      'All compliance packs (HIPAA + EU AI Act + SOC2)',
      'SSO',
      'SLA',
      'White-label SDK',
      'Dedicated Slack channel',
      '15 seats',
    ],
    highlighted: false,
    rank: 3,
  },
];

const PLAN_RANK: Record<Exclude<PlanId, null>, number> = {
  consumer_pro: 1,
  dashboard_starter: 2,
  dashboard_business: 3,
};

interface Usage {
  events_this_month: number | null;
  agents_registered: number | null;
}

export default function PricingClient() {
  const [currentPlan, setCurrentPlan] = useState<PlanId>(null);
  const [usage, setUsage] = useState<Usage>({
    events_this_month: null,
    agents_registered: null,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('mandatez_current_plan');
    if (
      stored === 'consumer_pro' ||
      stored === 'dashboard_starter' ||
      stored === 'dashboard_business'
    ) {
      setCurrentPlan(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ownerId = window.localStorage.getItem('mandatez_owner_id');
    if (!ownerId) return;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    let cancelled = false;

    Promise.all([
      fetch(
        `/api/events/search?owner_id=${encodeURIComponent(ownerId)}&from=${encodeURIComponent(monthStart.toISOString())}&limit=1`,
        { credentials: 'include' },
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`/api/agents/list?owner_id=${encodeURIComponent(ownerId)}`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([events, agents]) => {
      if (cancelled) return;
      const eventsCount =
        events && typeof events.total === 'number'
          ? events.total
          : events && typeof events.count === 'number'
            ? events.count
            : null;
      const agentsCount =
        agents && typeof agents.count === 'number' ? agents.count : null;
      setUsage({
        events_this_month: eventsCount,
        agents_registered: agentsCount,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const currentRank = currentPlan ? PLAN_RANK[currentPlan] : 0;
  const hasUsage =
    usage.events_this_month !== null || usage.agents_registered !== null;

  return (
    <div className="space-y-16">
      {/* Usage stats */}
      <section className="space-y-5">
        <SectionMarker number="01" label="USAGE THIS MONTH" />
        <Card variant="default" className="p-6">
          {hasUsage ? (
            <div className="grid gap-8 sm:grid-cols-2">
              <UsageStat
                label="Events logged"
                value={usage.events_this_month}
              />
              <UsageStat
                label="Agents registered"
                value={usage.agents_registered}
              />
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Connect your owner ID on{' '}
              <Link
                href="/identity"
                className="text-accent-primary underline underline-offset-4 hover:text-accent-primary-hover"
              >
                Identity
              </Link>{' '}
              to see live usage stats.
            </p>
          )}
        </Card>
      </section>

      {/* Plans */}
      <section className="space-y-5">
        <SectionMarker number="02" label="PLANS" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = currentPlan === tier.id;
            const isUpgrade = tier.rank > currentRank;
            const isDowngrade = currentRank > 0 && tier.rank < currentRank;

            return (
              <Card
                key={tier.id}
                variant="elevated"
                className={cn(
                  'relative flex h-full flex-col p-8',
                  isCurrent && 'border-accent-success/60',
                  tier.highlighted &&
                    !isCurrent &&
                    'border-accent-primary/60',
                )}
              >
                <div className="flex h-6 items-center gap-2">
                  {isCurrent && (
                    <Tag variant="success">CURRENT PLAN</Tag>
                  )}
                  {tier.highlighted && !isCurrent && (
                    <Tag variant="info">MOST POPULAR</Tag>
                  )}
                </div>

                <h3 className="mt-4 text-lg font-semibold text-text-primary">
                  {tier.name}
                </h3>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight text-text-primary">
                    {tier.price}
                  </span>
                  <span className="text-sm text-text-muted">
                    {tier.period}
                  </span>
                </div>

                <p className="mt-3 text-sm text-text-secondary">
                  {tier.description}
                </p>

                <ul className="mt-8 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm text-text-secondary"
                    >
                      <span className="mt-0.5 shrink-0 text-accent-primary">
                        —
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-10">
                  {isCurrent ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled
                      aria-current="true"
                    >
                      Current plan
                    </Button>
                  ) : isDowngrade ? (
                    <Button variant="secondary" className="w-full" asChild>
                      <Link href={`/organization?plan=${tier.id}`}>
                        Downgrade
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant={isUpgrade ? 'primary' : 'secondary'}
                      className="w-full"
                      asChild
                    >
                      <Link href={`/organization?plan=${tier.id}`}>
                        {currentPlan ? 'Upgrade' : 'Choose plan'}
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* One-time audit */}
      <section className="space-y-5">
        <SectionMarker number="03" label="ONE-TIME AUDIT" />
        <Card variant="default" className="p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-baseline gap-2">
                <h3 className="text-xl font-semibold text-text-primary">
                  Compliance Audit Report
                </h3>
                <span className="text-sm text-text-muted">
                  one-time
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-text-primary">
                  $500
                </span>
                <span className="text-sm text-text-muted">flat</span>
              </div>
              <p className="mt-3 text-sm text-text-secondary">
                One complete compliance report covering all agent activity for
                your chosen time period. No subscription required. Delivered
                within 5 business days.
              </p>
            </div>
            <Button variant="secondary" asChild>
              <Link href="mailto:hello@mandatez.com?subject=Compliance%20Audit%20Report">
                Request audit
              </Link>
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

function UsageStat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const display = useMemo(() => {
    if (value === null) return '—';
    return value.toLocaleString();
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <NumberDisplay size="sm" value={display} />
    </div>
  );
}
