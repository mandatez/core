'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

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
    const res = await fetch(`/api/organizations?user_id=${encodeURIComponent(uid)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load organizations');
    return json.organizations as Organization[];
  }, []);

  const loadOrgDetail = useCallback(async (orgId: string, uid: string) => {
    const res = await fetch(
      `/api/organizations/${orgId}?user_id=${encodeURIComponent(uid)}`,
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
      window.localStorage.setItem('mandatez_current_org_id', json.organization.id);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgEmail('');
      setStatus({ kind: 'success', message: `Organization "${json.organization.name}" created.` });
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
        { method: 'DELETE' },
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
          body: JSON.stringify({ user_id: userId, role: nextRole }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Update failed');
      setStatus({ kind: 'success', message: `Role updated.` });
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
        { method: 'DELETE' },
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

  return (
    <div className="space-y-8">
      {/* User ID bootstrap */}
      <SectionCard
        label="A · Identity"
        title="Your MandateZ user ID"
        description="The dashboard still uses the shared owner/user id while auth is wired."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="owner_123"
            className="flex-1 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
          />
          <button
            onClick={() => {
              if (userId.trim()) {
                window.localStorage.setItem('mandatez_owner_id', userId.trim());
                void refresh(userId.trim());
              }
            }}
            disabled={loading || !userId.trim()}
            className="px-4 py-2 text-sm border border-gray-700 rounded-md text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading…' : 'Load'}
          </button>
        </div>
      </SectionCard>

      {/* No orgs — create first */}
      {!loading && userId && orgs.length === 0 && (
        <SectionCard
          label="B · Bootstrap"
          title="Create your first organization"
          description="You'll become the owner and first admin."
        >
          <div className="space-y-3">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Acme Corp Security"
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value)}
              placeholder="acme-corp (optional — auto-generated from name)"
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
            />
            <input
              type="email"
              value={newOrgEmail}
              onChange={(e) => setNewOrgEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={createOrg}
              disabled={!newOrgName.trim() || !newOrgEmail.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
            >
              Create organization
            </button>
          </div>
        </SectionCard>
      )}

      {/* Active org detail */}
      {org && (
        <>
          <SectionCard
            label="B · Organization"
            title={org.name}
            description={`${org.slug} · created ${new Date(org.created_at).toLocaleDateString()}`}
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-700 bg-gray-900/60">
                <span className="text-gray-500 text-xs uppercase tracking-wider">
                  Your role
                </span>
                <span className="font-medium text-gray-100">
                  {myRole ? ROLE_LABELS[myRole] : '—'}
                </span>
              </span>
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-emerald-700/60 bg-emerald-950/30 text-emerald-300 text-xs">
                  Owner
                </span>
              )}
              <Link
                href="/organization/settings"
                className="ml-auto text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4"
              >
                Organization settings →
              </Link>
            </div>

            {orgs.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider self-center">
                  Switch org:
                </span>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => switchOrg(o.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      o.id === activeOrgId
                        ? 'border-blue-500 bg-blue-950/40 text-blue-200'
                        : 'border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Invite (admin only) */}
          {isAdmin && (
            <SectionCard
              label="C · Invite"
              title="Invite a team member"
              description="Pick the smallest role that fits. You can change roles any time."
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  type="text"
                  value={inviteeId}
                  onChange={(e) => setInviteeId(e.target.value)}
                  placeholder="user id"
                  className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                />
                <input
                  type="email"
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                  placeholder="analyst@company.com"
                  className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={inviteeRole}
                  onChange={(e) => setInviteeRole(e.target.value as Role)}
                  className="rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="security_analyst">Security analyst</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={invite}
                  disabled={!inviteeId.trim() || !inviteeEmail.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                  Invite
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {ROLE_DESCRIPTIONS[inviteeRole]}
              </p>
            </SectionCard>
          )}

          {/* Members list */}
          <SectionCard
            label="D · Members"
            title={`${members.length} member${members.length === 1 ? '' : 's'}`}
            description="Admins can change roles or remove members. The owner cannot be removed."
          >
            <div className="space-y-2">
              {members.map((m) => {
                const isThisOwner = m.user_id === org.owner_id;
                const isSelf = m.user_id === userId;
                return (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 border border-gray-800 rounded-md bg-gray-950/40 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-100 font-medium truncate">
                        {m.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-500">(you)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono truncate">
                        {m.user_id}
                      </div>
                    </div>

                    {isAdmin && !isThisOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.user_id, e.target.value as Role)}
                        className="text-xs rounded-md border border-gray-800 bg-gray-900/50 px-2 py-1 text-gray-200 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="security_analyst">Security analyst</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="text-xs text-gray-300 px-2">
                        {ROLE_LABELS[m.role]}
                      </span>
                    )}

                    {isThisOwner && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-emerald-700/60 bg-emerald-950/30 text-emerald-300">
                        Owner
                      </span>
                    )}

                    {!m.accepted_at && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-amber-700/60 bg-amber-950/30 text-amber-300">
                        Pending
                      </span>
                    )}

                    {isAdmin && !isThisOwner && (
                      <button
                        onClick={() => removeMember(m.user_id, m.email)}
                        className="text-xs px-2.5 py-1 rounded border border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-900/40 hover:border-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Danger zone */}
          {isOwner && (
            <SectionCard
              label="E · Danger zone"
              title="Delete organization"
              description="Deletes the org and all member rows. Agents, events, and reports are NOT deleted — they remain owned by the owner's user id."
            >
              <button
                onClick={deleteOrg}
                className="px-5 py-2.5 border border-red-800 bg-red-950/40 hover:bg-red-900/50 text-red-200 text-sm font-medium rounded-md transition-colors"
              >
                Delete {org.name}
              </button>
            </SectionCard>
          )}
        </>
      )}

      <StatusBanner status={status} />
    </div>
  );
}

/* ----------------------------- primitives ------------------------------ */

function SectionCard({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-gray-800 rounded-lg p-6 space-y-5 bg-gray-950/40">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-blue-400 font-mono">
          {label}
        </div>
        <h3 className="text-lg font-semibold mt-2">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status }: { status: Status }) {
  if (status.kind === 'idle' || status.kind === 'loading') return null;
  if (status.kind === 'success') {
    return (
      <div className="text-xs text-emerald-300 font-mono">✓ {status.message}</div>
    );
  }
  return <div className="text-xs text-red-300 font-mono">✗ {status.message}</div>;
}
