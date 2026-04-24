'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  user_id: string;
  email: string;
  role: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function SettingsClient() {
  const [userId, setUserId] = useState('');
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const load = useCallback(async (uid: string, orgId: string) => {
    const res = await fetch(
      `/api/organizations/${orgId}?user_id=${encodeURIComponent(uid)}`,
      { credentials: 'include' },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load');
    setOrg(json.organization);
    setMembers(json.members);
    setName(json.organization.name);
    setSlug(json.organization.slug);
  }, []);

  useEffect(() => {
    const uid =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    const orgId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_current_org_id')
        : null;
    if (!uid || !orgId) return;
    setUserId(uid);
    load(uid, orgId).catch((err: unknown) =>
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Load failed',
      }),
    );
  }, [load]);

  async function save() {
    if (!org) return;
    setStatus({ kind: 'saving' });
    try {
      const body: Record<string, string> = { user_id: userId };
      if (name.trim() && name !== org.name) body.name = name.trim();
      if (slug.trim() && slug !== org.slug) body.slug = slug.trim();

      if (!body.name && !body.slug) {
        setStatus({ kind: 'idle' });
        return;
      }

      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setOrg(json.organization);
      setStatus({ kind: 'success', message: 'Saved.' });
      window.dispatchEvent(new Event('mandatez:org-changed'));
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  }

  async function transfer() {
    if (!org || !transferTo.trim()) return;
    if (transferTo === org.owner_id) return;
    if (
      !confirm(
        `Transfer ownership of "${org.name}" to ${transferTo}? This cannot be undone, and you will lose owner privileges.`,
      )
    ) {
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          transfer_to_user_id: transferTo.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Transfer failed');
      setOrg(json.organization);
      setTransferTo('');
      setStatus({ kind: 'success', message: 'Ownership transferred.' });
      window.dispatchEvent(new Event('mandatez:org-changed'));
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Transfer failed',
      });
    }
  }

  if (!org) {
    return (
      <div className="border border-gray-800 rounded-lg p-6 text-sm text-gray-400">
        No active organization loaded.{' '}
        <Link href="/organization" className="text-blue-400 hover:underline">
          Go to organization overview →
        </Link>
      </div>
    );
  }

  const isOwner = org.owner_id === userId;

  return (
    <div className="space-y-6">
      <section className="border border-gray-800 rounded-lg p-6 space-y-4 bg-gray-950/40">
        <h3 className="text-lg font-semibold">Name & slug</h3>
        <div className="space-y-3">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="Slug">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, digits, and hyphens. 3–48 characters.
            </p>
          </Field>
        </div>
        <button
          onClick={save}
          disabled={status.kind === 'saving'}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
        >
          {status.kind === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      {isOwner && (
        <section className="border border-gray-800 rounded-lg p-6 space-y-4 bg-gray-950/40">
          <h3 className="text-lg font-semibold">Transfer ownership</h3>
          <p className="text-sm text-gray-400">
            Move ownership to another member. The new owner is promoted to admin
            automatically. You remain a member with admin rights.
          </p>
          <select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Choose a member…</option>
            {members
              .filter((m) => m.user_id !== org.owner_id)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.email} ({m.user_id})
                </option>
              ))}
          </select>
          <button
            onClick={transfer}
            disabled={!transferTo || status.kind === 'saving'}
            className="px-5 py-2.5 border border-amber-700 bg-amber-950/40 hover:bg-amber-900/50 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 text-sm font-medium rounded-md transition-colors"
          >
            Transfer ownership
          </button>
        </section>
      )}

      {status.kind === 'success' && (
        <div className="text-xs text-emerald-300 font-mono">✓ {status.message}</div>
      )}
      {status.kind === 'error' && (
        <div className="text-xs text-red-300 font-mono">✗ {status.message}</div>
      )}
    </div>
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
