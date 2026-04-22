'use client';

import { useCallback, useEffect, useState } from 'react';

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
      const res = await fetch(`/api/keys?owner_id=${encodeURIComponent(owner)}`);
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
      setError('Give this key a descriptive name (e.g. "Production agent fleet").');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`/api/keys/${id}/revoke`, { method: 'POST' });
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

  return (
    <div className="space-y-8">
      <div className="border border-gray-800 rounded-lg p-5">
        <label htmlFor="owner-id" className="block text-sm font-medium text-gray-200 mb-2">
          Owner ID
        </label>
        <input
          id="owner-id"
          type="text"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          placeholder="user_2abc... or your organization id"
          className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors"
        />
        <p className="text-xs text-gray-500 mt-2">
          Keys are scoped to an owner_id. Each owner sees only their own keys.
        </p>
      </div>

      {error && (
        <div className="border border-red-800 bg-red-900/20 rounded-lg p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* One-time new key display */}
      {newKey && (
        <div className="border border-emerald-700 bg-emerald-950/30 rounded-lg p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-emerald-200">Key generated — {newKey.name}</h3>
              <p className="text-sm text-amber-200 mt-1">
                <strong className="font-semibold">Copy this key — it won&apos;t be shown again.</strong>{' '}
                Store it in your secret manager (AWS Secrets Manager, Vercel env vars, 1Password, etc.).
              </p>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="text-gray-500 hover:text-gray-300 text-sm"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-emerald-200 bg-black/60 border border-emerald-900/60 rounded px-3 py-2.5 break-all select-all">
              {newKey.plaintext}
            </code>
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          <pre className="text-xs text-gray-400 bg-gray-950/60 rounded p-3 overflow-x-auto">
{`import { MandateZClient } from '@mandatez/sdk';

const client = new MandateZClient({
  apiKey: '${newKey.plaintext}',
  agentId: 'ag_...',
  ownerId: '...',
  privateKey: process.env.AGENT_PRIVATE_KEY!,
});`}
          </pre>
        </div>
      )}

      {/* Generate form */}
      <div className="border border-gray-800 rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-base font-medium text-gray-100">Generate a new API key</h3>
          <p className="text-xs text-gray-500 mt-1">
            Replaces raw Supabase credentials in your agent config with a single revocable string.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. Production agent fleet)"
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-600 text-sm focus:outline-none focus:border-blue-600 transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !ownerId.trim() || !newKeyName.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {generating ? 'Generating...' : 'Generate New Key'}
          </button>
        </div>
      </div>

      {/* Existing keys */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-gray-100">Active keys</h3>
          <span className="text-xs text-gray-500">
            {loading ? 'Loading...' : `${activeKeys.length} active · ${revokedKeys.length} revoked`}
          </span>
        </div>

        {!ownerId.trim() ? (
          <div className="text-gray-500 text-sm text-center py-12 border border-gray-800 rounded-lg">
            Enter an owner_id above to list existing keys.
          </div>
        ) : activeKeys.length === 0 && !loading ? (
          <div className="text-gray-500 text-sm text-center py-12 border border-gray-800 rounded-lg">
            No active keys for this owner_id. Generate one above to get started.
          </div>
        ) : (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60 border-b border-gray-800">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Prefix</th>
                    <th className="px-4 py-3 font-medium">Last Used</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {activeKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-900/30 transition-colors">
                      <td className="px-4 py-3 text-gray-200">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {key.key_prefix}...
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatRelativeTime(key.last_used_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(key.id, key.key_prefix)}
                          disabled={revoking === key.id}
                          className="text-xs px-2.5 py-1 rounded border border-red-900/60 bg-red-950/30 text-red-300 font-medium hover:bg-red-900/40 hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {revoking === key.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {revokedKeys.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
              Show {revokedKeys.length} revoked {revokedKeys.length === 1 ? 'key' : 'keys'}
            </summary>
            <div className="mt-3 border border-gray-900 rounded-lg overflow-hidden opacity-70">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-900">
                  {revokedKeys.map((key) => (
                    <tr key={key.id} className="text-xs">
                      <td className="px-4 py-2.5 text-gray-500">{key.name}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-600">{key.key_prefix}...</td>
                      <td className="px-4 py-2.5 text-gray-600">
                        Revoked {formatRelativeTime(key.revoked_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
