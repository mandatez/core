'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  SectionMarker,
  Tag,
  cn,
} from '@/components/ui';

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface NewKey {
  id: string;
  plaintext: string;
  prefix: string;
  name: string;
  created_at: string;
}

const inputClasses =
  'w-full rounded-md border border-border-default bg-bg-base px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-primary focus:outline-none transition-colors';

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function KeysClient() {
  const [ownerId, setOwnerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async (owner: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/keys?owner_id=${encodeURIComponent(owner)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { keys: ApiKeyRow[] };
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = ownerId.trim();
    if (!trimmed) {
      setKeys([]);
      return;
    }
    const t = window.setTimeout(() => fetchKeys(trimmed), 250);
    return () => window.clearTimeout(t);
  }, [ownerId, fetchKeys]);

  async function handleGenerate() {
    const ownerTrimmed = ownerId.trim();
    const nameTrimmed = newKeyName.trim();
    setError(null);

    if (!ownerTrimmed) {
      setError('Enter an owner_id first.');
      return;
    }
    if (!nameTrimmed) {
      setError(
        'Give this key a descriptive name (e.g. "Production agent fleet").',
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ owner_id: ownerTrimmed, name: nameTrimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        id: string;
        key: string;
        prefix: string;
        name: string;
        created_at: string;
      };
      setNewKey({
        id: data.id,
        plaintext: data.key,
        prefix: data.prefix,
        name: data.name,
        created_at: data.created_at,
      });
      setNewKeyName('');
      setCopied(false);
      fetchKeys(ownerTrimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string, prefix: string) {
    const confirmed = window.confirm(
      `Revoke key ${prefix}...? Any agent still using this key will start failing immediately. This cannot be undone.`,
    );
    if (!confirmed) return;

    setRevoking(id);
    setError(null);
    try {
      const res = await fetch(`/api/keys/${id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok && res.status !== 409) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (ownerId.trim()) fetchKeys(ownerId.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key');
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.plaintext);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard — copy manually.');
    }
  }

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);
  const ownerEmpty = !ownerId.trim();

  return (
    <div className="space-y-12">
      {/* Owner ID */}
      <section className="space-y-5">
        <SectionMarker number="01" label="API KEYS" />
        <Card variant="elevated" className="p-6">
          <div className="space-y-3">
            <label
              htmlFor="owner-id"
              className="font-mono text-xs uppercase tracking-widest text-text-muted"
            >
              Owner ID
            </label>
            <input
              id="owner-id"
              type="text"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              placeholder="user_2abc... or your organization id"
              className={cn(inputClasses, 'font-mono')}
            />
            <p className="text-xs text-text-muted">
              Keys are scoped to an owner_id. Each owner sees only their own
              keys.
            </p>
          </div>
        </Card>
      </section>

      {error && (
        <Card variant="danger-tinted" className="p-4">
          <p className="text-sm text-text-primary">{error}</p>
        </Card>
      )}

      {/* New key reveal */}
      {newKey && (
        <section className="space-y-5">
          <SectionMarker number="02" label="NEW KEY · COPY NOW" />
          <Card variant="success-tinted" className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-success/20">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-accent-success"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-text-primary">
                  Key generated — {newKey.name}
                </h3>
                <p className="mt-1 text-sm text-accent-warning">
                  <strong className="font-semibold">
                    Copy this key — it won&apos;t be shown again.
                  </strong>{' '}
                  Store it in your secret manager (AWS Secrets Manager, Vercel
                  env vars, 1Password, etc.).
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewKey(null)}
                aria-label="Dismiss"
              >
                ✕
              </Button>
            </div>

            <div className="flex items-stretch gap-2">
              <code className="flex-1 select-all break-all rounded border border-accent-success/40 bg-bg-base px-3 py-2.5 font-mono text-sm text-accent-success">
                {newKey.plaintext}
              </code>
              <Button variant="success" onClick={handleCopy}>
                {copied ? 'Copied ✓' : 'Copy'}
              </Button>
            </div>

            <pre className="overflow-x-auto rounded-md bg-bg-base/80 p-4 font-mono text-xs text-text-secondary">
{`import { MandateZClient } from '@mandatez/sdk';

const client = new MandateZClient({
  apiKey: '${newKey.plaintext}',
  agentId: 'ag_...',
  ownerId: '...',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
});`}
            </pre>
          </Card>
        </section>
      )}

      {/* Generate */}
      <section className="space-y-5">
        <SectionMarker number="03" label="GENERATE" />
        <Card variant="elevated" className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Generate a new API key
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Replaces raw Supabase credentials in your agent config with a
                single revocable string.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production agent fleet)"
                className={cn(inputClasses, 'flex-1')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
              />
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || ownerEmpty || !newKeyName.trim()}
                loading={generating}
                leftIcon={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                }
              >
                Generate new key
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Active keys */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <SectionMarker number="04" label="ACTIVE KEYS" />
          <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading
              ? 'Loading…'
              : `${activeKeys.length} active · ${revokedKeys.length} revoked`}
          </span>
        </div>

        {ownerEmpty ? (
          <EmptyState
            title="Enter an owner_id to see keys"
            description="Keys are scoped per owner. Provide an owner_id above to list, generate, or revoke credentials."
          />
        ) : activeKeys.length === 0 && !loading ? (
          <EmptyState
            title="No active keys yet"
            description="API keys replace raw Supabase credentials in your agent config. Generate your first key — name it after where it'll run, e.g. &quot;Production agent fleet&quot; or &quot;n8n workflow #4&quot;."
            action={
              <Button
                variant="primary"
                onClick={() => {
                  document.getElementById('owner-id')?.focus();
                  const next = document.querySelector<HTMLInputElement>(
                    'input[placeholder^="Key name"]',
                  );
                  next?.focus();
                }}
              >
                Name a key →
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {activeKeys.map((key) => (
              <Card
                key={key.id}
                variant="default"
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {key.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
                    <span>
                      created{' '}
                      {new Date(key.created_at).toLocaleDateString()}
                    </span>
                    <span>·</span>
                    <span>
                      last used {formatRelativeTime(key.last_used_at)}
                    </span>
                  </div>
                </div>
                <Tag variant="info">
                  {key.key_prefix}
                  …
                </Tag>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(key.id, key.key_prefix)}
                    disabled={revoking === key.id}
                    loading={revoking === key.id}
                    className="text-accent-danger hover:text-accent-danger"
                  >
                    Revoke
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {revokedKeys.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-text-muted hover:text-text-secondary">
              Show {revokedKeys.length} revoked{' '}
              {revokedKeys.length === 1 ? 'key' : 'keys'}
            </summary>
            <div className="mt-3 space-y-2 opacity-70">
              {revokedKeys.map((key) => (
                <Card
                  key={key.id}
                  variant="default"
                  className="flex flex-wrap items-center gap-3 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-text-secondary">
                      {key.name}
                    </div>
                    <div className="font-mono text-[11px] text-text-muted">
                      revoked {formatRelativeTime(key.revoked_at)}
                    </div>
                  </div>
                  <Tag variant="neutral">
                    {key.key_prefix}
                    …
                  </Tag>
                </Card>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Usage example */}
      <section className="space-y-5">
        <SectionMarker number="05" label="USAGE" />
        <Card variant="default" className="p-6">
          <h3 className="text-base font-semibold text-text-primary">
            Using your key
          </h3>
          <pre className="mt-4 overflow-x-auto rounded-md bg-bg-base/80 p-4 font-mono text-xs text-text-secondary">
{`import { MandateZClient } from '@mandatez/sdk';

// New (enterprise-friendly) — one string, revocable from this page
const client = new MandateZClient({
  apiKey: 'mz_live_...',
  agentId: 'ag_...',
  ownerId: '...',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
});

// The old config still works — raw Supabase URL + anon key:
const legacy = new MandateZClient({
  agentId: 'ag_...',
  ownerId: '...',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});`}
          </pre>
        </Card>
      </section>
    </div>
  );
}
