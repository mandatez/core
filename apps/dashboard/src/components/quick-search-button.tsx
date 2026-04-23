'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Nav-mounted quick-search trigger. Opens a modal with a free-text
 * input; submitting navigates to /search with the q param set and
 * the stored owner_id from localStorage (if any). The full filter
 * UI lives on /search — this is an accelerator for the common case
 * of "I know the resource or agent ID I want to find".
 */
export function QuickSearchButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Autofocus once the modal renders.
    const t = setTimeout(() => inputRef.current?.focus(), 10);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Global ⌘K / Ctrl+K to open the modal, matching the Cmd-K convention
  // most audit/search UIs ship with.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
      const trigger = (isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (trigger) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const query = q.trim();
    const params = new URLSearchParams();
    if (query) params.set('q', query);

    const ownerId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (ownerId) params.set('owner_id', ownerId);

    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : '/search');
    setOpen(false);
    setQ('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Search events (⌘K)"
        aria-label="Search events"
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline text-xs text-gray-500 font-mono">⌘K</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick search"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <form
            onSubmit={onSubmit}
            className="relative w-full max-w-xl bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events by resource, agent ID, policy…"
                className="flex-1 bg-transparent border-none outline-none text-gray-100 text-sm placeholder:text-gray-600"
              />
              <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-800 text-gray-500">
                Enter
              </kbd>
            </div>
            <div className="px-4 py-3 text-xs text-gray-500 flex items-center justify-between">
              <span>
                Opens full search with filters, date range, CSV export, and shareable URLs.
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                Esc
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
