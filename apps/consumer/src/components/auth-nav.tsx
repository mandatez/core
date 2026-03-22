'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

export function AuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
    >
      Sign out
    </button>
  );
}
