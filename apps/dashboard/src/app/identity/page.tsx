import { createServerClient } from '@/lib/supabase-server';
import {
  IdentityChecksFeed,
  type IdentityCheckRow,
} from '@/components/identity-checks-feed';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SectionMarker,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

const SDK_SNIPPET = `import { MandateZClient } from '@mandatez/sdk';

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
}`;

export default async function IdentityChecksPage() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('identity_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(200);

  const checks = (data ?? []) as IdentityCheckRow[];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <SectionMarker number="01" label="IDENTITY CHECKS" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
            Identity verification
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            HaveIBeenPwned breach checks performed by your agents before they
            interact with an identity. Every check is signed and persisted on
            the event spine.
          </p>
        </div>
      </header>

      {error ? (
        <Card variant="danger-tinted">
          <CardContent className="px-6 py-4">
            <p className="text-sm text-accent-danger">
              Failed to load identity checks: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : (
        <IdentityChecksFeed initialChecks={checks} />
      )}

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-base">Run an identity check</CardTitle>
          <CardDescription>
            Identity checks are emitted from your agent process via the SDK.
            They land here in real time as soon as they sign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border-default bg-bg-base p-4 font-mono text-[11px] leading-relaxed text-text-secondary">
            {SDK_SNIPPET}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
