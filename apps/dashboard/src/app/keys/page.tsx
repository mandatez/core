import { KeysClient } from './keys-client';

export const metadata = {
  title: 'API Keys — MandateZ',
  description:
    'Generate, list, and revoke enterprise API keys for your MandateZ agents.',
};

export default function KeysPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">API Keys</h2>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Enterprise-grade credentials for agents. Each key is a single revocable string
          that replaces raw Supabase URL + anon-key configuration. Keys are hashed before
          storage — plaintext is shown exactly once at generation.
        </p>
      </div>

      <KeysClient />

      <div className="border-t border-gray-800 pt-6 mt-10">
        <h3 className="text-base font-medium text-gray-100 mb-3">Using your key</h3>
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
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
      </div>
    </div>
  );
}
