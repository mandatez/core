'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowser();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setError(null);
      setLoading(false);
      setIsSignUp(false);
      setPassword('');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/activity');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <h2 className="text-2xl font-black tracking-tight uppercase">
          {isSignUp ? 'Create account' : 'Sign in'}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {isSignUp
            ? 'Start controlling what your AI can access.'
            : 'Welcome back.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-gray-400 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border border-gray-800 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-gray-400 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-transparent border border-gray-800 rounded text-gray-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              placeholder={isSignUp ? 'Minimum 6 characters' : ''}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
          >
            {loading
              ? '...'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {isSignUp ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
