'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Tag,
  cn,
} from '@/components/ui';

const ACTION_TYPES = ['read', 'write', 'export', 'delete', 'call', 'payment'] as const;
const OUTCOMES = ['allowed', 'blocked', 'flagged'] as const;

type ActionType = (typeof ACTION_TYPES)[number];
type Outcome = (typeof OUTCOMES)[number];

type OutcomeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';
const OUTCOME_VARIANT: Record<string, OutcomeVariant> = {
  allowed: 'success',
  blocked: 'danger',
  flagged: 'warning',
  pending_approval: 'info',
};

interface EventRow {
  id: string;
  agent_id: string;
  agent_name: string | null;
  owner_id: string;
  timestamp: string;
  action_type: string;
  resource: string;
  outcome: string;
  policy_id: string | null;
  metadata: Record<string, unknown>;
  signature: string;
  public_key: string;
}

interface InitialFilters {
  q: string;
  owner_id: string;
  agent_id: string;
  action_type: string;
  outcome: string;
  from: string;
  to: string;
  policy_id: string;
  offset: number;
}

interface AgentOpt {
  id: string;
  name: string;
}
interface PolicyOpt {
  id: string;
  name: string;
}

interface Props {
  initialFilters: InitialFilters;
  initialAgents: AgentOpt[];
  initialPolicies: PolicyOpt[];
}

interface SearchState {
  q: string;
  ownerId: string;
  agentId: string;
  actionTypes: Set<ActionType>;
  outcomes: Set<Outcome>;
  from: string;
  to: string;
  policyId: string;
}

const PAGE_SIZE = 50;

const EXAMPLE_QUERIES = [
  'export customer_data',
  'pol_finops blocked',
  'agent ag_acme_billing',
  'payment flagged',
];

const inputClass =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 ' +
  'text-sm text-text-primary placeholder:text-text-muted ' +
  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 ' +
  'transition-colors';

const monoInputClass = cn(inputClass, 'font-mono');

function csvToSet<T extends string>(csv: string, valid: readonly T[]): Set<T> {
  if (!csv) return new Set();
  return new Set(
    csv
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter((x): x is T => (valid as readonly string[]).includes(x)),
  );
}

function setToCsv<T extends string>(set: Set<T>, valid: readonly T[]): string {
  const ordered = valid.filter((v) => set.has(v));
  return ordered.join(',');
}

function buildQueryString(state: SearchState, offset: number): string {
  const p = new URLSearchParams();
  p.set('owner_id', state.ownerId);
  if (state.q) p.set('q', state.q);
  if (state.agentId) p.set('agent_id', state.agentId);
  if (state.actionTypes.size > 0) p.set('action_type', setToCsv(state.actionTypes, ACTION_TYPES));
  if (state.outcomes.size > 0) p.set('outcome', setToCsv(state.outcomes, OUTCOMES));
  if (state.from) p.set('from', state.from);
  if (state.to) p.set('to', state.to);
  if (state.policyId) p.set('policy_id', state.policyId);
  p.set('limit', String(PAGE_SIZE));
  p.set('offset', String(offset));
  return p.toString();
}

function buildExportUrl(state: SearchState): string {
  const p = new URLSearchParams();
  p.set('owner_id', state.ownerId);
  if (state.agentId) p.set('agent_id', state.agentId);
  const firstOutcome = [...state.outcomes][0];
  if (firstOutcome) p.set('outcome', firstOutcome);
  if (state.from) p.set('from', state.from);
  if (state.to) p.set('to', state.to);
  p.set('format', 'csv');
  return `/api/events/export?${p.toString()}`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function SearchClient({ initialFilters, initialAgents, initialPolicies }: Props) {
  const router = useRouter();

  const initialState = useMemo<SearchState>(
    () => ({
      q: initialFilters.q,
      ownerId: initialFilters.owner_id,
      agentId: initialFilters.agent_id,
      actionTypes: csvToSet(initialFilters.action_type, ACTION_TYPES),
      outcomes: csvToSet(initialFilters.outcome, OUTCOMES),
      from: initialFilters.from,
      to: initialFilters.to,
      policyId: initialFilters.policy_id,
    }),
    [initialFilters],
  );
  const [state, setState] = useState<SearchState>(initialState);

  const [offset, setOffset] = useState(initialFilters.offset);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOpt[]>(initialAgents);
  const [policies, setPolicies] = useState<PolicyOpt[]>(initialPolicies);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.ownerId) {
      const stored = window.localStorage.getItem('mandatez_owner_id');
      if (stored) setState((s) => ({ ...s, ownerId: stored }));
    } else {
      window.localStorage.setItem('mandatez_owner_id', state.ownerId);
    }
  }, [state.ownerId]);

  useEffect(() => {
    if (!state.ownerId) {
      setAgents([]);
      setPolicies([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const [agentsRes, policiesRes] = await Promise.all([
          supabase
            .from('agents')
            .select('id, name')
            .eq('owner_id', state.ownerId)
            .order('name', { ascending: true })
            .limit(500),
          supabase
            .from('policies')
            .select('id, name')
            .eq('owner_id', state.ownerId)
            .order('name', { ascending: true })
            .limit(200),
        ]);
        if (cancelled) return;
        if (agentsRes.data) setAgents(agentsRes.data as AgentOpt[]);
        if (policiesRes.data) setPolicies(policiesRes.data as PolicyOpt[]);
      } catch {
        // Non-fatal — fall back to prefetched lists.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.ownerId]);

  const syncUrl = useCallback(
    (nextState: SearchState, nextOffset: number) => {
      const qs = buildQueryString(nextState, nextOffset);
      router.replace(`/search?${qs}`);
    },
    [router],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useCallback(
    async (
      nextState: SearchState,
      nextOffset: number,
      { debounce }: { debounce: boolean },
    ) => {
      if (!nextState.ownerId) {
        setEvents([]);
        setTotal(0);
        return;
      }

      const fire = async () => {
        setLoading(true);
        setError(null);
        try {
          const qs = buildQueryString(nextState, nextOffset);
          const res = await fetch(`/api/events/search?${qs}`, {
            credentials: 'include',
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? `HTTP ${res.status}`);
          }
          const body = (await res.json()) as { events: EventRow[]; total: number };
          setEvents(body.events);
          setTotal(body.total);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setEvents([]);
          setTotal(0);
        } finally {
          setLoading(false);
        }
      };

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (debounce) {
        debounceRef.current = setTimeout(fire, 300);
      } else {
        fire();
      }
    },
    [],
  );

  useEffect(() => {
    if (state.ownerId) {
      runSearch(state, offset, { debounce: false });
      syncUrl(state, offset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateAndSearch = useCallback(
    (
      updater: (prev: SearchState) => SearchState,
      opts: { debounce?: boolean; resetOffset?: boolean } = {},
    ) => {
      const next = updater(state);
      const nextOffset = opts.resetOffset === false ? offset : 0;
      setState(next);
      setOffset(nextOffset);
      runSearch(next, nextOffset, { debounce: opts.debounce ?? false });
      syncUrl(next, nextOffset);
    },
    [offset, runSearch, state, syncUrl],
  );

  const onOwnerIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    updateAndSearch((s) => ({ ...s, ownerId: value }), { debounce: true });
  };

  const onQChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateAndSearch((s) => ({ ...s, q: value }), { debounce: true });
  };

  const toggleActionType = (type: ActionType) => {
    updateAndSearch((s) => {
      const next = new Set(s.actionTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...s, actionTypes: next };
    });
  };

  const toggleOutcome = (outcome: Outcome) => {
    updateAndSearch((s) => {
      const next = new Set(s.outcomes);
      if (next.has(outcome)) next.delete(outcome);
      else next.add(outcome);
      return { ...s, outcomes: next };
    });
  };

  const onClearFilters = () => {
    updateAndSearch(() => ({
      q: '',
      ownerId: state.ownerId,
      agentId: '',
      actionTypes: new Set(),
      outcomes: new Set(),
      from: '',
      to: '',
      policyId: '',
    }));
  };

  const onManualSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateAndSearch((s) => s);
  };

  const onPrev = () => {
    if (offset <= 0) return;
    const nextOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(nextOffset);
    runSearch(state, nextOffset, { debounce: false });
    syncUrl(state, nextOffset);
  };
  const onNext = () => {
    if (offset + PAGE_SIZE >= total) return;
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    runSearch(state, nextOffset, { debounce: false });
    syncUrl(state, nextOffset);
  };

  const exportUrl = useMemo(() => buildExportUrl(state), [state]);

  const filterCount =
    (state.q ? 1 : 0) +
    (state.agentId ? 1 : 0) +
    state.actionTypes.size +
    state.outcomes.size +
    (state.from ? 1 : 0) +
    (state.to ? 1 : 0) +
    (state.policyId ? 1 : 0);

  const activeChips = buildActiveChips(state, agents, policies);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Filters sidebar */}
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <form onSubmit={onManualSubmit} className="space-y-5">
          <FilterField label="Owner ID">
            <input
              type="text"
              placeholder="owner_your_org"
              value={state.ownerId}
              onChange={onOwnerIdChange}
              className={monoInputClass}
            />
          </FilterField>

          <FilterField
            label="Search"
            hint="Matches resource, agent ID, policy ID, action type, outcome, metadata."
          >
            <input
              type="search"
              placeholder="resource, policy, agent…"
              value={state.q}
              onChange={onQChange}
              autoFocus
              className={inputClass}
            />
          </FilterField>

          <FilterField label="Date range">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={state.from}
                onChange={(e) =>
                  updateAndSearch((s) => ({ ...s, from: e.target.value }))
                }
                className={cn(inputClass, 'px-2 py-1.5 text-xs')}
              />
              <input
                type="datetime-local"
                value={state.to}
                onChange={(e) =>
                  updateAndSearch((s) => ({ ...s, to: e.target.value }))
                }
                className={cn(inputClass, 'px-2 py-1.5 text-xs')}
              />
            </div>
          </FilterField>

          <FilterField label="Agent">
            <select
              value={state.agentId}
              onChange={(e) =>
                updateAndSearch((s) => ({ ...s, agentId: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.id}
                </option>
              ))}
            </select>
          </FilterField>

          <fieldset className="space-y-1.5">
            <legend className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Action type
            </legend>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTION_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={state.actionTypes.has(type)}
                    onChange={() => toggleActionType(type)}
                    className="accent-accent-primary"
                  />
                  {type}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Outcome
            </legend>
            <div className="space-y-1.5">
              {OUTCOMES.map((outcome) => (
                <label
                  key={outcome}
                  className="flex cursor-pointer items-center gap-2 text-sm text-text-primary"
                >
                  <input
                    type="checkbox"
                    checked={state.outcomes.has(outcome)}
                    onChange={() => toggleOutcome(outcome)}
                    className="accent-accent-primary"
                  />
                  {outcome}
                </label>
              ))}
            </div>
          </fieldset>

          <FilterField label="Policy">
            <select
              value={state.policyId}
              onChange={(e) =>
                updateAndSearch((s) => ({ ...s, policyId: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">All policies</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.id}
                </option>
              ))}
            </select>
          </FilterField>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClearFilters}
            disabled={filterCount === 0}
            className="w-full"
          >
            Clear filters {filterCount > 0 ? `(${filterCount})` : ''}
          </Button>
        </form>
      </aside>

      {/* Results */}
      <section className="min-w-0 space-y-4">
        {/* Results header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-text-primary">
            {loading ? (
              <span className="text-text-muted">Searching…</span>
            ) : state.ownerId ? (
              <>
                <span className="font-semibold">{total.toLocaleString()}</span>{' '}
                event{total === 1 ? '' : 's'} match
              </>
            ) : (
              <span className="text-text-muted">Enter an owner ID to search.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state.outcomes.size > 1 && (
              <Tag
                variant="warning"
                title="The CSV exporter accepts one outcome at a time — it will export using the first selected outcome."
              >
                CSV: FIRST OUTCOME ONLY
              </Tag>
            )}
            <Button variant="secondary" size="sm" asChild>
              <a href={exportUrl}>Export results as CSV</a>
            </Button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => updateAndSearch((s) => chip.clear(s))}
                className="group inline-flex items-center gap-1.5 rounded border border-accent-primary/30 bg-accent-primary/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-accent-primary transition-colors hover:border-accent-primary"
              >
                <span className="truncate max-w-[200px]">{chip.label}</span>
                <span className="text-accent-primary/70 group-hover:text-accent-primary">
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <Card variant="danger-tinted">
            <CardContent className="px-4 py-3">
              <p className="text-sm text-accent-danger">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!state.ownerId ? (
          <EmptyState
            title="Enter an owner ID to search"
            description="Search every signed AgentEvent across your stack. Try one of these to get a feel for the query language:"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUERIES.map((q) => (
                  <Tag key={q} variant="neutral">
                    {q.toUpperCase()}
                  </Tag>
                ))}
              </div>
            }
          />
        ) : events.length === 0 && !loading ? (
          <EmptyState
            title="No events match"
            description="Try broadening your filters — clear an outcome, widen the date range, or remove the policy filter."
            action={
              filterCount > 0 ? (
                <Button variant="secondary" size="sm" onClick={onClearFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                expanded={expandedId === event.id}
                onToggle={() =>
                  setExpandedId(expandedId === event.id ? null : event.id)
                }
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-border-default pt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrev}
              disabled={offset <= 0 || loading}
            >
              ← Previous
            </Button>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
              PAGE {currentPage} / {totalPages} · {offset + 1}–
              {Math.min(offset + PAGE_SIZE, total)} OF{' '}
              {total.toLocaleString()}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onNext}
              disabled={offset + PAGE_SIZE >= total || loading}
            >
              Next →
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

interface ChipDef {
  id: string;
  label: string;
  clear: (s: SearchState) => SearchState;
}

function buildActiveChips(
  state: SearchState,
  agents: AgentOpt[],
  policies: PolicyOpt[],
): ChipDef[] {
  const chips: ChipDef[] = [];

  if (state.q) {
    chips.push({
      id: 'q',
      label: `Q: ${state.q}`,
      clear: (s) => ({ ...s, q: '' }),
    });
  }
  if (state.agentId) {
    const a = agents.find((x) => x.id === state.agentId);
    chips.push({
      id: 'agent',
      label: `AGENT: ${a?.name ?? state.agentId}`,
      clear: (s) => ({ ...s, agentId: '' }),
    });
  }
  for (const t of state.actionTypes) {
    chips.push({
      id: `at-${t}`,
      label: `ACTION: ${t}`,
      clear: (s) => {
        const next = new Set(s.actionTypes);
        next.delete(t);
        return { ...s, actionTypes: next };
      },
    });
  }
  for (const o of state.outcomes) {
    chips.push({
      id: `oc-${o}`,
      label: `OUTCOME: ${o}`,
      clear: (s) => {
        const next = new Set(s.outcomes);
        next.delete(o);
        return { ...s, outcomes: next };
      },
    });
  }
  if (state.from) {
    chips.push({
      id: 'from',
      label: `FROM ${state.from}`,
      clear: (s) => ({ ...s, from: '' }),
    });
  }
  if (state.to) {
    chips.push({
      id: 'to',
      label: `TO ${state.to}`,
      clear: (s) => ({ ...s, to: '' }),
    });
  }
  if (state.policyId) {
    const p = policies.find((x) => x.id === state.policyId);
    chips.push({
      id: 'pol',
      label: `POLICY: ${p?.name ?? state.policyId}`,
      clear: (s) => ({ ...s, policyId: '' }),
    });
  }

  return chips;
}

function FilterField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] leading-relaxed text-text-muted">{hint}</p>
      )}
    </div>
  );
}

function EventCard({
  event,
  expanded,
  onToggle,
}: {
  event: EventRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const outcomeVariant = OUTCOME_VARIANT[event.outcome] ?? 'neutral';
  return (
    <Card variant="default">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag variant="neutral">
                {event.action_type.toUpperCase()}
              </Tag>
              <Tag variant={outcomeVariant}>
                {event.outcome.toUpperCase()}
              </Tag>
              <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
            <div className="font-mono text-xs text-text-primary break-all">
              {event.resource}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-muted">
              <Tag>{event.agent_id}</Tag>
              {event.agent_name && event.agent_name !== event.agent_id && (
                <span>{event.agent_name}</span>
              )}
              {event.policy_id && (
                <>
                  <span>·</span>
                  <span>{event.policy_id}</span>
                </>
              )}
            </div>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-default px-5 py-4">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <Field label="EVENT ID" value={event.id} />
            <Field label="OWNER" value={event.owner_id} />
            <Field
              className="sm:col-span-2"
              label="PUBLIC KEY"
              value={event.public_key}
            />
            <Field
              className="sm:col-span-2"
              label="SIGNATURE"
              value={event.signature}
            />
            {Object.keys(event.metadata ?? {}).length > 0 && (
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  METADATA
                </dt>
                <dd>
                  <pre className="mt-1 overflow-x-auto rounded-md border border-border-default bg-bg-base p-3 font-mono text-[11px] leading-relaxed text-text-secondary">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 break-all font-mono text-[11px] text-text-secondary">
        {value}
      </dd>
    </div>
  );
}
