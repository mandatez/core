'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button, Card, SectionMarker, cn } from '@/components/ui';

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

const inputClasses =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors';

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
      <Card variant="default" className="p-6">
        <p className="text-sm text-text-secondary">
          No active organization loaded.{' '}
          <Link
            href="/organization"
            className="text-accent-primary underline underline-offset-4 hover:text-accent-primary-hover"
          >
            Go to organization overview →
          </Link>
        </p>
      </Card>
    );
  }

  const isOwner = org.owner_id === userId;
  const saving = status.kind === 'saving';

  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <SectionMarker number="01" label="NAME & SLUG" />
        <Card variant="elevated" className="p-6">
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClasses}
              />
            </Field>
            <Field
              label="Slug"
              hint="Lowercase letters, digits, and hyphens. 3–48 characters."
            >
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className={cn(inputClasses, 'font-mono')}
              />
            </Field>
            <Button
              variant="primary"
              onClick={save}
              disabled={saving}
              loading={saving}
            >
              Save changes
            </Button>
          </div>
        </Card>
      </section>

      {isOwner && (
        <section className="space-y-5">
          <SectionMarker number="02" label="TRANSFER OWNERSHIP" />
          <Card variant="elevated" className="p-6">
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Move ownership to another member. The new owner is promoted to
                admin automatically. You remain a member with admin rights.
              </p>
              <Field label="New owner">
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className={inputClasses}
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
              </Field>
              <Button
                variant="destructive"
                onClick={transfer}
                disabled={!transferTo || saving}
                loading={saving}
              >
                Transfer ownership
              </Button>
            </div>
          </Card>
        </section>
      )}

      {status.kind === 'success' && (
        <div className="font-mono text-xs text-accent-success">
          ✓ {status.message}
        </div>
      )}
      {status.kind === 'error' && (
        <div className="font-mono text-xs text-accent-danger">
          ✗ {status.message}
        </div>
      )}
    </div>
  );
}

function Field({
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
      <label className="font-mono text-xs uppercase tracking-widest text-text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
