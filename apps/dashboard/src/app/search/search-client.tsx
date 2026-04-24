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

const ACTION_TYPES = ['read', 'write', 'export', 'delete', 'call', 'payment'] as const;
const OUTCOMES = ['allowed', 'blocked', 'flagged'] as const;

type ActionType = (typeof ACTION_TYPES)[number];
type Outcome = (typeof OUTCOMES)[number];

const OUTCOME_STYLES: Record<string, string> = {
  allowed: 'bg-green-900/50 text-green-300 border-green-700',
  blocked: 'bg-red-900/50 text-red-300 border-red-700',
  flagged: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  pending_approval: 'bg-blue-900/50 text-blue-300 border-blue-700',
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
  // The export endpoint takes a single outcome, not a list — preserve the
  // first selected outcome and note this in the UI when more are chosen.
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

  // Persist owner_id to localStorage so repeat visits prefill correctly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.ownerId) {
      const stored = window.localStorage.getItem('mandatez_owner_id');
      if (stored) setState((s) => ({ ...s, ownerId: stored }));
    } else {
      window.localStorage.setItem('mandatez_owner_id', state.ownerId);
    }
  }, [state.ownerId]);

  // Refresh agent + policy dropdowns when owner changes. Supabase RLS
  // already owner-scopes these queries via the browser client, so we hit
  // the DB directly instead of round-tripping through a bespoke API route.
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
        // Non-fatal — dropdowns fall back to the prefetched lists.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.ownerId]);

  // Keep the URL in sync with the current state + offset.
  const syncUrl = useCallback(
    (nextState: SearchState, nextOffset: number) => {
      const qs = buildQueryString(nextState, nextOffset);
      router.replace(`/search?${qs}`);
    },
    [router],
  );

  // Primary search — debounced so typing in the free-text box doesn't
  // hammer the API. Filter-toggle changes apply immediately.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = useCallback(
    async (nextState: SearchState, nextOffset: number, { debounce }: { debounce: boolean }) => {
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

  // Initial load — only if we already have an owner_id in URL or storage.
  useEffect(() => {
    if (state.ownerId) {
      runSearch(state, offset, { debounce: false });
      syncUrl(state, offset);
    }
    // Intentionally run once on mount — subsequent calls flow through
    // updateFilter / onSubmit / pagination handlers.
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Filters sidebar */}
      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <form onSubmit={onManualSubmit} className="space-y-5">
          {/* Owner ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Owner ID
            </label>
            <input
              type="text"
              placeholder="owner_your_org"
              value={state.ownerId}
              onChange={onOwnerIdChange}
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Free text */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Search
            </label>
            <input
              type="search"
              placeholder="resource, policy, agent…"
              value={state.q}
              onChange={onQChange}
              autoFocus
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-gray-500">
              Matches resource, agent ID, policy ID, action type, outcome, and metadata.
            </p>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Date range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={state.from}
                onChange={(e) =>
                  updateAndSearch((s) => ({ ...s, from: e.target.value }))
                }
                className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
              <input
                type="datetime-local"
                value={state.to}
                onChange={(e) =>
                  updateAndSearch((s) => ({ ...s, to: e.target.value }))
                }
                className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Agent */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Agent
            </label>
            <select
              value={state.agentId}
              onChange={(e) =>
                updateAndSearch((s) => ({ ...s, agentId: e.target.value }))
              }
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.id}
                </option>
              ))}
            </select>
          </div>

          {/* Action type */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Action type
            </legend>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTION_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={state.actionTypes.has(type)}
                    onChange={() => toggleActionType(type)}
                    className="accent-blue-500"
                  />
                  {type}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Outcome */}
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Outcome
            </legend>
            <div className="space-y-1.5">
              {OUTCOMES.map((outcome) => (
                <label
                  key={outcome}
                  className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={state.outcomes.has(outcome)}
                    onChange={() => toggleOutcome(outcome)}
                    className="accent-blue-500"
                  />
                  {outcome}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Policy */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider">
              Policy
            </label>
            <select
              value={state.policyId}
              onChange={(e) =>
                updateAndSearch((s) => ({ ...s, policyId: e.target.value }))
              }
              className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">All policies</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.id}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onClearFilters}
            disabled={filterCount === 0}
            className="w-full text-xs px-3 py-2 rounded border border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear filters {filterCount > 0 ? `(${filterCount})` : ''}
          </button>
        </form>
      </aside>

      {/* Results main */}
      <section className="space-y-4 min-w-0">
        {/* Results header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-gray-300">
            {loading ? (
              <span className="text-gray-500">Searching…</span>
            ) : state.ownerId ? (
              <>
                <span className="font-semibold text-gray-100">
                  {total.toLocaleString()}
                </span>{' '}
                event{total === 1 ? '' : 's'} match
              </>
            ) : (
              <span className="text-gray-500">Enter an owner ID to search.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {state.outcomes.size > 1 && (
              <span
                className="text-[11px] text-yellow-300/80"
                title="The CSV exporter accepts one outcome at a time — it will export using the first selected outcome."
              >
                CSV: first outcome only
              </span>
            )}
            <a
              href={exportUrl}
              className="text-xs px-3 py-1.5 rounded border border-gray-700 hover:border-gray-500 text-gray-200 hover:text-white transition-colors"
            >
              Export results as CSV
            </a>
          </div>
        </div>

        {error && (
          <div className="border border-red-900/60 bg-red-950/30 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Results table */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Resource</th>
                <th className="text-left px-4 py-3 font-medium">Outcome</th>
                <th className="text-left px-4 py-3 font-medium">Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {events.length === 0 && !loading && state.ownerId && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No events match these filters.
                  </td>
                </tr>
              )}
              {events.map((event) => {
                const expanded = expandedId === event.id;
                const outcomeStyle =
                  OUTCOME_STYLES[event.outcome] ?? 'bg-gray-800 text-gray-300 border-gray-700';
                return (
                  <Fragment key={event.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : event.id)}
                      className="cursor-pointer hover:bg-gray-900/40 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-mono text-gray-200">{event.agent_id}</div>
                        {event.agent_name && event.agent_name !== event.agent_id && (
                          <div className="text-gray-500 text-[11px]">{event.agent_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-200">{event.action_type}</td>
                      <td className="px-4 py-3 text-xs text-gray-200 font-mono break-all">
                        {event.resource}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border font-medium ${outcomeStyle}`}
                        >
                          {event.outcome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        {event.policy_id ?? '—'}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-gray-950/60">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500">Event ID:</span>{' '}
                              <span className="font-mono text-gray-300 break-all">{event.id}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Owner:</span>{' '}
                              <span className="font-mono text-gray-300">{event.owner_id}</span>
                            </div>
                            <div className="md:col-span-2">
                              <span className="text-gray-500">Public key:</span>{' '}
                              <span className="font-mono text-gray-400 break-all">
                                {event.public_key}
                              </span>
                            </div>
                            <div className="md:col-span-2">
                              <span className="text-gray-500">Signature:</span>{' '}
                              <span className="font-mono text-gray-400 break-all">
                                {event.signature}
                              </span>
                            </div>
                            {Object.keys(event.metadata ?? {}).length > 0 && (
                              <div className="md:col-span-2">
                                <span className="text-gray-500">Metadata:</span>
                                <pre className="mt-1 bg-gray-900 rounded p-3 text-gray-300 overflow-x-auto">
                                  {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-gray-400">
            <button
              type="button"
              onClick={onPrev}
              disabled={offset <= 0 || loading}
              className="px-3 py-1.5 rounded border border-gray-800 hover:border-gray-600 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={offset + PAGE_SIZE >= total || loading}
              className="px-3 py-1.5 rounded border border-gray-800 hover:border-gray-600 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
