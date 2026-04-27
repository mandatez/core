'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SegType = 'k' | 's' | 'c' | 'n' | 'p' | 'bad' | 'plain';
type Seg = readonly [SegType, string];

const CHAR_MS = 14;
const HOLD_AFTER_TYPING = 800;
const OUTCOME_STAGGER = 400;
const FOOTER_DELAY = 200;
const FOOTER_LINGER = 1500;
const REPLAY_INTERVAL = 18000;

const TOKEN_CLASS: Record<SegType, string> = {
  k: 'text-[#C792EA]',
  s: 'text-[#A5E8B7]',
  c: 'italic text-white/35',
  n: 'text-[#82AAFF]',
  p: 'text-white/70',
  bad: 'text-red-400',
  plain: 'text-white/85',
};

const LEFT_TOKENS: Seg[] = [
  ['c', '// Context.ai agent — no governance\n'],
  ['k', 'const'], ['plain', ' '],
  ['n', 'agent'], ['plain', ' '],
  ['p', '='], ['plain', ' '],
  ['k', 'new'], ['plain', ' '],
  ['n', 'AIAgent'], ['p', '({'],
  ['plain', '\n  permissions'],
  ['p', ': '], ['s', '"Allow All"'], ['p', ','],
  ['plain', '\n  auditLog'],
  ['p', ': '], ['k', 'null'], ['p', ','],
  ['plain', '\n  identity'],
  ['p', ': '], ['s', '"oauth_token_7f3k2"'],
  ['plain', ' '], ['c', '// stealable'],
  ['plain', '\n'], ['p', '});'],
  ['plain', '\n\n'],
  ['c', '// Attacker steals token, pivots into Vercel\n'],
  ['k', 'await'], ['plain', ' '],
  ['n', 'agent'], ['p', '.'], ['plain', 'grantOAuth'],
  ['p', '('], ['s', '"vercel:workspace:*"'], ['p', ');'],
  ['plain', '   '], ['bad', '✗ no policy check'],
  ['plain', '\n'],
  ['k', 'await'], ['plain', ' '],
  ['n', 'agent'], ['p', '.'], ['plain', 'readEnvVars'],
  ['p', '('], ['s', '"*"'], ['p', ');'],
  ['plain', '                  '],
  ['bad', '✗ no audit trail'],
];

const RIGHT_TOKENS: Seg[] = [
  ['c', '// MandateZ-governed agent\n'],
  ['k', 'const'], ['plain', ' '],
  ['n', 'agent'], ['plain', ' '],
  ['p', '='], ['plain', ' '],
  ['k', 'new'], ['plain', ' '],
  ['n', 'MandateZClient'], ['p', '({'],
  ['plain', '\n  agentId'],
  ['p', ': '], ['s', '"ag_ctx_ai_prod"'], ['p', ','],
  ['plain', '\n  privateKey'],
  ['p', ': '], ['n', 'process'], ['p', '.'],
  ['plain', 'env'], ['p', '.'], ['plain', 'AGENT_KEY'], ['p', ','],
  ['plain', ' '], ['c', '// Ed25519'],
  ['plain', '\n  policies'],
  ['p', ': ['],
  ['plain', '\n    '],
  ['p', '{ '], ['plain', 'action'], ['p', ': '],
  ['s', '"oauth:grant"'], ['p', ', '],
  ['plain', 'resource'], ['p', ': '],
  ['s', '"*"'], ['p', ', '],
  ['plain', 'outcome'], ['p', ': '],
  ['s', '"blocked"'], ['p', ' },'],
  ['plain', '\n    '],
  ['p', '{ '], ['plain', 'action'], ['p', ': '],
  ['s', '"read"'], ['p', ', '],
  ['plain', 'resource'], ['p', ': '],
  ['s', '"env:sensitive:*"'], ['p', ', '],
  ['plain', 'outcome'], ['p', ': '],
  ['s', '"blocked"'], ['p', ' }'],
  ['plain', '\n  '], ['p', ']'],
  ['plain', '\n'], ['p', '});'],
  ['plain', '\n\n'],
  ['c', '// Attacker attempts same pivot:\n'],
  ['k', 'await'], ['plain', ' '],
  ['n', 'agent'], ['p', '.'], ['plain', 'grantOAuth'],
  ['p', '('], ['s', '"vercel:workspace:*"'], ['p', ');'],
];

const RIGHT_OUTCOMES = [
  '→ BLOCKED by policy engine',
  '→ Event signed + logged',
  '→ Alert sent to security team',
];

function totalLen(segs: Seg[]): number {
  let n = 0;
  for (const seg of segs) n += seg[1].length;
  return n;
}

const LEFT_LEN = totalLen(LEFT_TOKENS);
const RIGHT_LEN = totalLen(RIGHT_TOKENS);
const TYPE_DONE_AT = Math.max(LEFT_LEN, RIGHT_LEN) * CHAR_MS;
const OUTCOMES_AT = TYPE_DONE_AT + HOLD_AFTER_TYPING;
const FOOTERS_AT =
  OUTCOMES_AT + RIGHT_OUTCOMES.length * OUTCOME_STAGGER + FOOTER_DELAY;
const TOTAL_DURATION = FOOTERS_AT + FOOTER_LINGER;

function renderTokens(
  segs: Seg[],
  chars: number,
  showCursor: boolean,
): React.ReactNode[] {
  let remaining = chars;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < segs.length; i++) {
    if (remaining <= 0) break;
    const [t, txt] = segs[i];
    const slice = txt.length <= remaining ? txt : txt.slice(0, remaining);
    out.push(
      <span key={i} className={TOKEN_CLASS[t]}>
        {slice}
      </span>,
    );
    remaining -= slice.length;
  }
  if (showCursor) {
    out.push(
      <span
        key="cursor"
        aria-hidden
        className="terminal-cursor inline-block w-[7px] h-[1em] -mb-[2px] bg-white/85 align-middle"
      />,
    );
  }
  return out;
}

function SimStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes simFadeIn {
            from { opacity: 0; transform: translateY(3px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .sim-fade-in {
            animation: simFadeIn 280ms cubic-bezier(0.16,1,0.3,1) both;
          }
        `,
      }}
    />
  );
}

export function VercelSimulation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const inViewRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const [, forceTick] = useState(0);

  const tick = useCallback(() => forceTick((n) => (n + 1) & 0xffff), []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animate = useCallback(() => {
    if (startedAtRef.current === null) {
      rafRef.current = null;
      return;
    }
    const elapsed = performance.now() - startedAtRef.current;
    tick();
    if (elapsed < TOTAL_DURATION + 100) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      rafRef.current = null;
    }
  }, [tick]);

  const start = useCallback(() => {
    if (reducedMotionRef.current) {
      // Skip the animation entirely; jump to the final state.
      startedAtRef.current = performance.now() - TOTAL_DURATION;
      tick();
      return;
    }
    stopRaf();
    startedAtRef.current = performance.now();
    tick();
    rafRef.current = requestAnimationFrame(animate);
  }, [animate, stopRaf, tick]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;

    const el = containerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          inViewRef.current = e.isIntersecting;
          if (e.isIntersecting && startedAtRef.current === null) {
            start();
          }
        }
      },
      { rootMargin: '-20% 0px' },
    );
    obs.observe(el);

    return () => {
      obs.disconnect();
      stopRaf();
    };
    // start, stopRaf are stable refs; only run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (inViewRef.current && !reducedMotionRef.current) {
        start();
      }
    }, REPLAY_INTERVAL);
    return () => clearInterval(id);
  }, [start]);

  const elapsed =
    startedAtRef.current === null
      ? 0
      : Math.max(0, performance.now() - startedAtRef.current);

  const leftChars = Math.min(LEFT_LEN, Math.floor(elapsed / CHAR_MS));
  const rightChars = Math.min(RIGHT_LEN, Math.floor(elapsed / CHAR_MS));

  const leftTyping = leftChars < LEFT_LEN;
  const rightTyping = rightChars < RIGHT_LEN;

  const outcomesElapsed = Math.max(0, elapsed - OUTCOMES_AT);
  const outcomeCount =
    outcomesElapsed <= 0
      ? 0
      : Math.min(
          RIGHT_OUTCOMES.length,
          Math.floor(outcomesElapsed / OUTCOME_STAGGER) + 1,
        );

  const footersVisible = elapsed >= FOOTERS_AT;

  return (
    <div ref={containerRef}>
      <SimStyles />

      <div className="grid gap-5 lg:grid-cols-2">
        <CodePanel
          tone="red"
          label="Without MandateZ"
          sub="Context.ai — no governance"
          tokens={LEFT_TOKENS}
          chars={leftChars}
          showCursor={leftTyping}
          outcomes={[]}
          outcomesShown={0}
          footer="Breach. $2M ransom. Mandiant called."
          footerVisible={footersVisible}
        />
        <CodePanel
          tone="emerald"
          label="With MandateZ"
          sub="Governed — policy enforced at runtime"
          tokens={RIGHT_TOKENS}
          chars={rightChars}
          showCursor={rightTyping}
          outcomes={RIGHT_OUTCOMES}
          outcomesShown={outcomeCount}
          footer="Breach prevented. Vercel infrastructure untouched."
          footerVisible={footersVisible}
        />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={() => start()}
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 transition-colors hover:text-blue-300 focus-visible:text-blue-300 focus-visible:outline-none"
          aria-label="Replay simulation"
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}

function CodePanel({
  tone,
  label,
  sub,
  tokens,
  chars,
  showCursor,
  outcomes,
  outcomesShown,
  footer,
  footerVisible,
}: {
  tone: 'red' | 'emerald';
  label: string;
  sub: string;
  tokens: Seg[];
  chars: number;
  showCursor: boolean;
  outcomes: string[];
  outcomesShown: number;
  footer: string;
  footerVisible: boolean;
}) {
  const toneBar = tone === 'red' ? 'bg-red-500' : 'bg-emerald-500';
  const toneBg =
    tone === 'red'
      ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.05),transparent_60%)]'
      : 'bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.06),transparent_60%)]';

  return (
    <div
      className={`relative flex flex-col border border-white/[0.08] ${toneBg}`}
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${toneBar} opacity-75`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${toneBar}`}
            />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/75">
            {label}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
          {sub}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <pre
          className="m-0 overflow-x-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12.5px] leading-[1.65] text-white/85"
          aria-live="polite"
        >
          {renderTokens(tokens, chars, showCursor)}
          {outcomes.slice(0, outcomesShown).map((line, i) => (
            <span
              key={`out-${i}`}
              className="sim-fade-in mt-1 block text-emerald-400"
            >
              {line}
            </span>
          ))}
        </pre>
      </div>

      <div
        className={`font-mono border-t border-white/[0.06] px-4 py-2 text-[10.5px] uppercase tracking-[0.2em] transition-opacity duration-500 ${footerVisible ? 'opacity-100' : 'opacity-0'} ${tone === 'red' ? 'text-red-300/80' : 'text-emerald-300/80'}`}
      >
        {footer}
      </div>
    </div>
  );
}