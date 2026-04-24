'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Clear local state that's scoped to the old session so the next
    // user doesn't inherit it.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('mandatez_current_org_id');
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={signingOut}
      className="text-xs px-3 py-1.5 rounded border border-gray-800 bg-gray-950/60 text-gray-300 hover:border-gray-600 hover:text-white disabled:opacity-50 transition-colors"
    >
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
