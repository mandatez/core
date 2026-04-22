'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type State =
  | { kind: 'hidden' }
  | { kind: 'welcome' } // no owner_id known yet
  | { kind: 'empty'; ownerId: string }; // owner known, 0 agents

export function GetStartedBanner() {
  const [state, setState] = useState<State>({ kind: 'hidden' });

  useEffect(() => {
    let cancelled = false;

    const dismissed =
      window.localStorage.getItem('mandatez_onboarding_dismissed') === '1';
    if (dismissed) return;

    const ownerId = window.localStorage.getItem('mandatez_owner_id');
    if (!ownerId) {
      setState({ kind: 'welcome' });
      return;
    }

    fetch(`/api/agents/list?owner_id=${encodeURIComponent(ownerId)}`)
      .then((r) => r.json())
      .then((json: { count?: number }) => {
        if (cancelled) return;
        if ((json.count ?? 0) === 0) {
          setState({ kind: 'empty', ownerId });
        } else {
          setState({ kind: 'hidden' });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'welcome' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem('mandatez_onboarding_dismissed', '1');
    setState({ kind: 'hidden' });
  };

  if (state.kind === 'hidden') return null;

  const heading =
    state.kind === 'welcome'
      ? 'Welcome to MandateZ'
      : 'Register your first agent';

  const body =
    state.kind === 'welcome'
      ? "Let's set up your first governed agent — cryptographic identity, policy, and audit trail in about 5 minutes."
      : `Owner ${state.ownerId} has no registered agents yet. Finish onboarding to start signing events.`;

  return (
    <div className="relative overflow-hidden rounded-lg border border-blue-700/50 bg-gradient-to-br from-blue-950/60 via-gray-950 to-gray-950 p-6 md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-blue-300">
            Get Started
          </div>
          <h3 className="mt-2 text-lg md:text-xl font-semibold text-gray-50">
            {heading}
          </h3>
          <p className="mt-2 text-sm text-gray-300/90 leading-relaxed">{body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-mono uppercase tracking-wider text-gray-400">
            <Bullet>Ed25519 identity</Bullet>
            <Bullet>Policy preset</Bullet>
            <Bullet>SDK install snippet</Bullet>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={dismiss}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Dismiss
          </button>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Start onboarding →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-blue-400" />
      {children}
    </span>
  );
}
