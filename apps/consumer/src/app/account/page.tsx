'use client';

import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (!isLoaded) {
    return (
      <div className="pt-24 pl-8 md:pl-16 lg:pl-24 pr-8 md:pr-16 lg:pr-24">
        <div className="text-gray-500 py-12">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pt-24 pl-8 md:pl-16 lg:pl-24 pr-8 md:pr-16 lg:pr-24">
        <div className="text-gray-500 py-12">Not signed in.</div>
      </div>
    );
  }

  function copyOwnerId() {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  return (
    <div className="pt-24 pl-8 md:pl-16 lg:pl-24 pr-8 md:pr-16 lg:pr-24 py-16">
      <h2 className="text-2xl font-black tracking-tight uppercase">Account</h2>

      <div className="mt-8 space-y-6 max-w-lg">
        <div>
          <span className="text-sm text-gray-500 block mb-1">Email</span>
          <span className="text-gray-100">
            {user.primaryEmailAddress?.emailAddress ?? 'No email'}
          </span>
        </div>

        <div>
          <span className="text-sm text-gray-500 block mb-1">
            Your owner_id
            <span className="text-gray-600 ml-1">(use this in the SDK)</span>
          </span>
          <div className="flex items-center gap-3">
            <code className="text-blue-400 bg-gray-900 px-3 py-2 rounded text-sm font-mono">
              {user.id}
            </code>
            <button
              onClick={copyOwnerId}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-600 mb-4">
            Pass this as <code className="text-gray-500">ownerId</code> when creating your MandateZClient.
            All agent events will be scoped to this ID.
          </p>
          <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
{`const client = new MandateZClient({
  agentId: identity.agent_id,
  ownerId: '${user.id}',
  privateKey: identity.private_key,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
});`}
          </pre>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSignOut}
            className="px-6 py-3 border border-gray-700 hover:border-gray-400 text-gray-300 hover:text-white text-sm font-medium tracking-wide uppercase rounded transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
