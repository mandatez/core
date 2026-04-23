'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: string;
}

export function OrgSwitcher() {
  const [userId, setUserId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations?user_id=${encodeURIComponent(uid)}`);
      const json = await res.json();
      if (!res.ok) return;
      const list = json.organizations as Organization[];
      setOrgs(list);

      const stored = window.localStorage.getItem('mandatez_current_org_id');
      const chosen = list.find((o) => o.id === stored) ?? list[0];
      if (chosen) {
        setActiveId(chosen.id);
        window.localStorage.setItem('mandatez_current_org_id', chosen.id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function sync() {
      const uid = window.localStorage.getItem('mandatez_owner_id');
      setUserId(uid);
      if (uid) void load(uid);
    }
    sync();

    function onStorage(e: StorageEvent) {
      if (e.key === 'mandatez_owner_id' || e.key === 'mandatez_current_org_id') {
        sync();
      }
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('mandatez:org-changed', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('mandatez:org-changed', sync);
    };
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      window.addEventListener('click', onClick);
      return () => window.removeEventListener('click', onClick);
    }
  }, [open]);

  function choose(orgId: string) {
    window.localStorage.setItem('mandatez_current_org_id', orgId);
    setActiveId(orgId);
    setOpen(false);
    window.dispatchEvent(new Event('mandatez:org-changed'));
  }

  if (!userId) {
    return (
      <Link
        href="/organization"
        className="ml-auto text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-900/60 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
      >
        Set up org
      </Link>
    );
  }

  const active = orgs.find((o) => o.id === activeId);

  return (
    <div ref={rootRef} className="ml-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-gray-800 bg-gray-950/60 text-gray-200 hover:border-gray-600 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
        <span className="font-medium">
          {loading ? 'Loading…' : active ? active.name : 'No organization'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 z-40 rounded-lg border border-gray-800 bg-gray-950 shadow-xl overflow-hidden"
          role="listbox"
        >
          {orgs.length === 0 ? (
            <div className="p-4 text-xs text-gray-500">
              You aren&apos;t a member of any organization yet.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {orgs.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => choose(o.id)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                      o.id === activeId
                        ? 'bg-blue-950/40 text-blue-200'
                        : 'text-gray-200 hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{o.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono truncate">
                        {o.slug} · {o.role}
                      </div>
                    </div>
                    {o.id === activeId && (
                      <span className="text-blue-300 text-xs">✓</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-gray-800">
            <Link
              href="/organization"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs text-blue-400 hover:bg-gray-900 transition-colors"
            >
              Manage organization →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
