import { createServerClient } from '@/lib/supabase-server';
import {
  IdentityChecksFeed,
  type IdentityCheckRow,
} from '@/components/identity-checks-feed';

export const dynamic = 'force-dynamic';

export default async function IdentityChecksPage() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('identity_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(200);

  const checks = (data ?? []) as IdentityCheckRow[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Identity Checks</h2>
        <p className="text-gray-400 mt-1">
          HaveIBeenPwned breach checks performed by your agents before interacting with identities.
        </p>
      </div>

      {error ? (
        <div className="text-red-400 border border-red-800 rounded-lg p-4">
          Failed to load identity checks: {error.message}
        </div>
      ) : (
        <IdentityChecksFeed initialChecks={checks} />
      )}

      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-medium mb-2">Perform an Identity Check</h3>
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
{`import { MandateZClient } from '@mandatez/sdk';

const client = new MandateZClient({
  agentId: 'ag_...',
  ownerId: 'your_owner_id',
  privateKey: '...',
  supabaseUrl: '...',
  supabaseAnonKey: '...',
  hibpApiKey: process.env.HIBP_API_KEY!,
});

const result = await client.checkIdentity({
  email: 'user@example.com',
  onFlagged: 'restrict',
});

if (result.recommendation === 'block') {
  throw new Error('Identity blocked: ' + result.breach_count + ' breaches');
}`}
        </pre>
      </div>
    </div>
  );
}
