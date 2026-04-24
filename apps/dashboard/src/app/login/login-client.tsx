'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in the environment.',
    );
  }
  return createBrowserClient(url, key);
}

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus({ kind: 'sending' });
    try {
      const supabase = getSupabaseBrowserClient();
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus({ kind: 'sent' });
    } catch (err) {
      setStatus({
        kind: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to send magic link',
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-800 rounded-lg bg-gray-950/40 p-6 space-y-5"
    >
      <div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-gray-500 mt-1">
          We&apos;ll email you a one-time link. No password required.
        </p>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="text-xs font-medium text-gray-400 uppercase tracking-wider"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={status.kind === 'sending' || status.kind === 'sent'}
          className="w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={
          !email.trim() || status.kind === 'sending' || status.kind === 'sent'
        }
        className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
      >
        {status.kind === 'sending'
          ? 'Sending…'
          : status.kind === 'sent'
            ? 'Check your inbox'
            : 'Send magic link'}
      </button>

      {status.kind === 'sent' && (
        <div className="border border-emerald-800/60 bg-emerald-950/20 rounded-md p-3 text-sm text-emerald-200">
          <div className="font-medium text-emerald-100">Magic link sent</div>
          <p className="text-emerald-200/80 mt-0.5 text-xs">
            Open the link on this device to finish signing in. You can close
            this tab once you&apos;ve clicked through.
          </p>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="border border-red-800 bg-red-900/20 rounded-md p-3 text-xs text-red-300 font-mono">
          {status.message}
        </div>
      )}
    </form>
  );
}
