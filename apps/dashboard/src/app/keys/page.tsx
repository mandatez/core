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
        <h2 className="text-2xl font-semibold text-text-primary">API Keys</h2>
        <p className="mt-1 text-text-secondary max-w-2xl">
          Enterprise-grade credentials for agents. Each key is a single
          revocable string that replaces raw Supabase URL + anon-key
          configuration. Keys are hashed before storage — plaintext is shown
          exactly once at generation.
        </p>
      </div>

      <KeysClient />
    </div>
  );
}
