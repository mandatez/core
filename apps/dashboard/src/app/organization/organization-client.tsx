'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  SectionMarker,
  Tag,
  cn,
} from '@/components/ui';

type Role = 'admin' | 'security_analyst' | 'viewer';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
  role?: Role;
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: Role;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  security_analyst: 'Security analyst',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full control — invite, remove, change roles, delete org.',
  security_analyst:
    'Read everything, approve/reject oversight. No membership changes.',
  viewer: 'Read-only access to events, agents, and reports.',
};

const ROLE_TAG_VARIANT: Record<Role, 'info' | 'neutral'> = {
  admin: 'info',
  security_analyst: 'info',
  viewer: 'neutral',
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

const inputClasses =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors';

export default function OrganizationClient() {
  const [userId, setUserId] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Invite form
  const [inviteeId, setInviteeId] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeRole, setInviteeRole] = useState<Role>('viewer');

  // Create org form (only shown when user has no orgs)
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  const loadOrgs = useCallback(async (uid: string) => {
    const res = await fetch(
      `/api/organizations?user_id=${encodeURIComponent(uid)}`,
      { credentials: 'include' },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load organizations');
    return json.organizations as Organization[];
  }, []);

  const loadOrgDetail = useCallback(async (orgId: string, uid: string) => {
    const res = await fetch(
      `/api/organizations/${orgId}?user_id=${encodeURIComponent(uid)}`,
      { credentials: 'include' },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load organization');
    return json as { organization: Organization; members: Member[] };
  }, []);

  const refresh = useCallback(
    async (uid: string) => {
      setLoading(true);
      setStatus({ kind: 'idle' });
      try {
        const list = await loadOrgs(uid);
        setOrgs(list);

        const storedOrgId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('mandatez_current_org_id')
            : null;
        const chosen = list.find((o) => o.id === storedOrgId) ?? list[0];

        if (chosen) {
          setActiveOrgId(chosen.id);
          window.localStorage.setItem('mandatez_current_org_id', chosen.id);
          const detail = await loadOrgDetail(chosen.id, uid);
          setOrg(detail.organization);
          setMembers(detail.members);
          const myMember = detail.members.find((m) => m.user_id === uid);
          setMyRole((myMember?.role as Role | undefined) ?? chosen.role ?? null);
        } else {
          setActiveOrgId(null);
          setOrg(null);
          setMembers([]);
          setMyRole(null);
        }
      } catch (err) {
        setStatus({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Load failed',
        });
      } finally {
        setLoading(false);
      }
    },
    [loadOrgs, loadOrgDetail],
  );

  useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('mandatez_owner_id')
        : null;
    if (stored) {
      setUserId(stored);
      void refresh(stored);
    }
  }, [refresh]);

  async function switchOrg(orgId: string) {
    if (!userId) return;
    window.localStorage.setItem('mandatez_current_org_id', orgId);
    setActiveOrgId(orgId);
    setLoading(true);
    try {
      const detail = await loadOrgDetail(orgId, userId);
      setOrg(detail.organization);
      setMembers(detail.members);
      const myMember = detail.members.find((m) => m.user_id === userId);
      setMyRole((myMember?.role as Role | undefined) ?? null);
      window.dispatchEvent(new Event('mandatez:org-changed'));
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Switch failed',
      });
    } finally {
      setLoading(false);
    }
  }

  async function createOrg() {
    if (!userId.trim()) {
      setStatus({ kind: 'error', message: 'user_id is required' });
      return;
    }
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId.trim(),
          name: newOrgName.trim(),
          slug: newOrgSlug.trim() || newOrgName.trim(),
          email: newOrgEmail.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Create failed');

      window.localStorage.setItem('mandatez_owner_id', userId.trim());
      window.localStorage.setItem(
        'mandatez_current_org_id',
        json.organization.id,
      );
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgEmail('');
      setStatus({
        kind: 'success',
        message: `Organization "${json.organization.name}" created.`,
      });
      window.dispatchEvent(new Event('mandatez:org-changed'));
      await refresh(userId.trim());
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Create failed',
      });
    }
  }

  async function invite() {
    if (!activeOrgId) return;
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          invitee_user_id: inviteeId.trim(),
          email: inviteeEmail.trim(),
          role: inviteeRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Invite failed');

      setInviteeId('');
      setInviteeEmail('');
      setInviteeRole('viewer');
      setStatus({ kind: 'success', message: `Invited ${json.member.email}.` });
      await refresh(userId);
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Invite failed',
      });
    }
  }

  async function removeMember(targetId: string, label: string) {
    if (!activeOrgId) return;
    if (!confirm(`Remove ${label} from the organization?`)) return;
    try {
      const res = await fetch(
        `/api/organizations/${activeOrgId}/members/${encodeURIComponent(targetId)}?user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Remove failed');
      setStatus({ kind: 'success', message: `Removed ${label}.` });
      await refresh(userId);
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Remove failed',
      });
    }
  }

  async function changeRole(targetId: string, nextRole: Role) {
    if (!activeOrgId) return;
    try {
      const res = await fetch(
        `/api/organizations/${activeOrgId}/members/${encodeURIComponent(targetId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ user_id: userId, role: nextRole }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setStatus({ kind: 'success', message: 'Role updated.' });
      await refresh(userId);
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Update failed',
      });
    }
  }

  async function deleteOrg() {
    if (!activeOrgId || !org) return;
    if (org.owner_id !== userId) return;
    const confirmText = prompt(
      `Type the organization slug "${org.slug}" to confirm deletion. This is irreversible.`,
    );
    if (confirmText !== org.slug) return;
    try {
      const res = await fetch(
        `/api/organizations/${activeOrgId}?user_id=${encodeURIComponent(userId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      window.localStorage.removeItem('mandatez_current_org_id');
      setStatus({ kind: 'success', message: 'Organization deleted.' });
      window.dispatchEvent(new Event('mandatez:org-changed'));
      await refresh(userId);
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  }

  const isAdmin = myRole === 'admin';
  const isOwner = org?.owner_id === userId;
  const pendingMembers = members.filter((m) => !m.accepted_at);
  const acceptedMembers = members.filter((m) => m.accepted_at);
  const onlyFounder =
    org && acceptedMembers.length <= 1 && pendingMembers.length === 0;

  return (
    <div className="space-y-12">
      {/* Identity */}
      <section className="space-y-5">
        <SectionMarker number="01" label="ORGANIZATION" />
        <Card variant="elevated" className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Your MandateZ user ID
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                The dashboard still uses the shared owner/user id while auth is
                wired.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="owner_123"
                className={cn(inputClasses, 'flex-1 font-mono')}
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (userId.trim()) {
                    window.localStorage.setItem(
                      'mandatez_owner_id',
                      userId.trim(),
                    );
                    void refresh(userId.trim());
                  }
                }}
                disabled={loading || !userId.trim()}
                loading={loading}
              >
                Load
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* No orgs — create first */}
      {!loading && userId && orgs.length === 0 && (
        <section className="space-y-5">
          <SectionMarker number="02" label="BOOTSTRAP" />
          <Card variant="elevated" className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Create your first organization
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  You&apos;ll become the owner and first admin.
                </p>
              </div>
              <div className="space-y-3">
                <Field label="Name">
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Acme Corp Security"
                    className={inputClasses}
                  />
                </Field>
                <Field
                  label="Slug"
                  hint="Lowercase letters, digits, and hyphens. Auto-generated if blank."
                >
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value)}
                    placeholder="acme-corp"
                    className={cn(inputClasses, 'font-mono')}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={newOrgEmail}
                    onChange={(e) => setNewOrgEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={inputClasses}
                  />
                </Field>
                <Button
                  variant="primary"
                  onClick={createOrg}
                  disabled={!newOrgName.trim() || !newOrgEmail.trim()}
                  loading={status.kind === 'loading'}
                >
                  Create organization
                </Button>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Active org detail */}
      {org && (
        <>
          <section className="space-y-5">
            <SectionMarker number="02" label="DETAILS" />
            <Card variant="elevated" className="p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {org.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-text-muted">
                      {org.slug} · created{' '}
                      {new Date(org.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Link
                    href="/organization/settings"
                    className="text-sm text-accent-primary underline underline-offset-4 hover:text-accent-primary-hover"
                  >
                    Organization settings →
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Tag variant="neutral">
                    Role: {myRole ? ROLE_LABELS[myRole] : '—'}
                  </Tag>
                  {isOwner && <Tag variant="success">OWNER</Tag>}
                </div>

                {orgs.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
                    <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
                      Switch org:
                    </span>
                    {orgs.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => switchOrg(o.id)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          o.id === activeOrgId
                            ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                            : 'border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary',
                        )}
                      >
                        {o.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </section>

          {/* Invite (admin only) */}
          {isAdmin && (
            <section className="space-y-5">
              <SectionMarker number="03" label="INVITE" />
              <Card variant="elevated" className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      Invite a team member
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      Pick the smallest role that fits. You can change roles
                      any time.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      type="text"
                      value={inviteeId}
                      onChange={(e) => setInviteeId(e.target.value)}
                      placeholder="user id"
                      className={cn(inputClasses, 'font-mono')}
                    />
                    <input
                      type="email"
                      value={inviteeEmail}
                      onChange={(e) => setInviteeEmail(e.target.value)}
                      placeholder="analyst@company.com"
                      className={inputClasses}
                    />
                    <select
                      value={inviteeRole}
                      onChange={(e) => setInviteeRole(e.target.value as Role)}
                      className={inputClasses}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="security_analyst">Security analyst</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      variant="primary"
                      onClick={invite}
                      disabled={!inviteeId.trim() || !inviteeEmail.trim()}
                    >
                      Send invite
                    </Button>
                  </div>
                  <p className="text-xs text-text-muted">
                    {ROLE_DESCRIPTIONS[inviteeRole]}
                  </p>
                </div>
              </Card>
            </section>
          )}

          {/* Pending invites */}
          {pendingMembers.length > 0 && (
            <section className="space-y-5">
              <SectionMarker number="04" label="PENDING INVITES" />
              <div className="space-y-2">
                {pendingMembers.map((m) => (
                  <Card
                    key={m.id}
                    variant="default"
                    className="flex flex-wrap items-center gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {m.email}
                      </div>
                      <div className="truncate font-mono text-[11px] text-text-muted">
                        {m.user_id}
                      </div>
                    </div>
                    <Tag variant={ROLE_TAG_VARIANT[m.role]}>
                      {ROLE_LABELS[m.role]}
                    </Tag>
                    <Tag variant="warning">PENDING</Tag>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => invite()}
                          disabled
                          title="Resend coming soon"
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(m.user_id, m.email)}
                          className="text-accent-danger hover:text-accent-danger"
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Members */}
          <section className="space-y-5">
            <SectionMarker
              number={isAdmin ? '05' : '03'}
              label={`MEMBERS · ${members.length}`}
            />
            {onlyFounder ? (
              <EmptyState
                title="No team members yet"
                description="You're flying solo. Invite a teammate above to share oversight, approvals, and reporting access."
              />
            ) : (
              <div className="space-y-2">
                {acceptedMembers.map((m) => {
                  const isThisOwner = m.user_id === org.owner_id;
                  const isSelf = m.user_id === userId;
                  return (
                    <Card
                      key={m.id}
                      variant="default"
                      className="flex flex-wrap items-center gap-3 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          {m.email}
                          {isSelf && (
                            <span className="ml-2 text-xs text-text-muted">
                              (you)
                            </span>
                          )}
                        </div>
                        <div className="truncate font-mono text-[11px] text-text-muted">
                          {m.user_id}
                        </div>
                      </div>

                      {isAdmin && !isThisOwner ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            changeRole(m.user_id, e.target.value as Role)
                          }
                          className={cn(inputClasses, 'w-auto py-1 text-xs')}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="security_analyst">
                            Security analyst
                          </option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Tag variant={ROLE_TAG_VARIANT[m.role]}>
                          {ROLE_LABELS[m.role]}
                        </Tag>
                      )}

                      {isThisOwner && <Tag variant="success">OWNER</Tag>}

                      {isAdmin && !isThisOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(m.user_id, m.email)}
                          className="text-accent-danger hover:text-accent-danger"
                        >
                          Remove
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Danger zone */}
          {isOwner && (
            <section className="space-y-5">
              <SectionMarker number="06" label="DANGER ZONE" />
              <Card variant="danger-tinted" className="p-6">
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-text-primary">
                    Delete organization
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Deletes the org and all member rows. Agents, events, and
                    reports are NOT deleted — they remain owned by the
                    owner&apos;s user id.
                  </p>
                  <Button variant="destructive" onClick={deleteOrg}>
                    Delete {org.name}
                  </Button>
                </div>
              </Card>
            </section>
          )}
        </>
      )}

      <StatusBanner status={status} />
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

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') return null;
  if (status.kind === 'success') {
    return (
      <div className="font-mono text-xs text-accent-success">
        ✓ {status.message}
      </div>
    );
  }
  return (
    <div className="font-mono text-xs text-accent-danger">
      ✗ {status.message}
    </div>
  );
}
