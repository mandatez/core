'use client';

import { useEffect, useState } from 'react';

type Outcome = '' | 'allowed' | 'blocked' | 'flagged' | 'pending_approval';
type Format = 'csv' | 'json';

interface Props {
  /**
   * Visual style of the trigger. `button` = solid gray pill for page headers,
   * `link` = underlined text for inline placements like the reports page.
   */
  variant?: 'button' | 'link';
  label?: string;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ExportEventsDialog({ variant = 'button', label = 'Export CSV' }: Props) {
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [from, setFrom] = useState(() =>
    isoDateOnly(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
  );
  const [to, setTo] = useState(() => isoDateOnly(new Date()));
  const [agentId, setAgentId] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('');
  const [format, setFormat] = useState<Format>('csv');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (stored && !ownerId) setOwnerId(stored);
  }, [open, ownerId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleExport() {
    setError(null);
    if (!ownerId.trim()) {
      setError('owner_id is required');
      return;
    }
    if (new Date(from) > new Date(to)) {
      setError('"From" must be before "To"');
      return;
    }

    setDownloading(true);
    try {
      const params = new URLSearchParams({
        owner_id: ownerId.trim(),
        from: new Date(from).toISOString(),
        to: new Date(`${to}T23:59:59.999Z`).toISOString(),
        format,
      });
      if (agentId.trim()) params.set('agent_id', agentId.trim());
      if (outcome) params.set('outcome', outcome);

      const res = await fetch(`/api/events/export?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mandatez-events-${from}-to-${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      window.localStorage.setItem('mandatez_owner_id', ownerId.trim());
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setDownloading(false);
    }
  }

  const triggerClass =
    variant === 'link'
      ? 'text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4'
      : 'text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-900/60 text-gray-200 hover:border-gray-500 hover:text-white transition-colors';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-lg border border-gray-800 bg-gray-950 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400 font-mono">
                Raw export
              </div>
              <h3 className="text-lg font-semibold mt-1">Export agent events</h3>
              <p className="text-sm text-gray-500 mt-1">
                Download signed event records for auditors, SIEM ingest, or offline analysis.
              </p>
            </div>

            <Field label="Owner ID">
              <input
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="owner_123"
                className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none font-mono"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none font-mono"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Agent ID (optional)">
                <input
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="ag_..."
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                />
              </Field>
              <Field label="Outcome">
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as Outcome)}
                  className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All</option>
                  <option value="allowed">Allowed</option>
                  <option value="blocked">Blocked</option>
                  <option value="flagged">Flagged</option>
                  <option value="pending_approval">Pending approval</option>
                </select>
              </Field>
            </div>

            <Field label="Format">
              <div className="inline-flex rounded-md border border-gray-800 overflow-hidden">
                {(['csv', 'json'] as Format[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                      format === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-950/40 text-gray-300 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Field>

            {error && (
              <div className="border border-red-800 bg-red-900/20 rounded-md p-3 text-xs text-red-300 font-mono">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={downloading || !ownerId.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
              >
                {downloading ? 'Exporting…' : `Download ${format.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
