import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SectionMarker,
  Tag,
} from '@/components/ui';
import { CopyCodeBlock } from './copy-code-block';

export const metadata = {
  title: 'MandateZ Proxy Mode — Zero-Code Governance',
  description:
    "Route your agent's outbound API calls through MandateZ and enforce policy at the network layer. No SDK install required.",
};

const PROXY_BASE = 'https://core-dashboard-black.vercel.app/api/proxy';

const SUPPORTED_TARGETS = [
  { api: 'OpenAI', pattern: 'openai/v1/*' },
  { api: 'Anthropic', pattern: 'anthropic/v1/*' },
  { api: 'Stripe', pattern: 'stripe/*' },
  { api: 'Supabase', pattern: 'supabase/*' },
  { api: 'Slack', pattern: 'slack/*' },
  { api: 'GitHub', pattern: 'github/*' },
  {
    api: 'Twilio / SendGrid / Resend',
    pattern: 'twilio/* · sendgrid/* · resend/*',
  },
  { api: 'Vercel', pattern: 'vercel/*' },
  { api: 'Custom domain', pattern: 'your-domain.com/*' },
];

const PYTHON_EXAMPLE = `import httpx

# Point your OpenAI/Anthropic/any HTTP client at MandateZ.
# Every outbound call now flows through policy enforcement.
client = httpx.Client(
    base_url="${PROXY_BASE}",
    headers={
        "X-MandateZ-Agent-ID": "ag_your_agent_id",
        "X-MandateZ-Owner-ID": "your_owner_id",
    },
    timeout=30.0,
)

# Each call: add the target URL, ship your real API key as usual.
response = client.post(
    "/",
    headers={
        "X-MandateZ-Target-URL": "https://api.openai.com/v1/chat/completions",
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello"}],
    },
)`;

const NODE_EXAMPLE = `const response = await fetch(
  '${PROXY_BASE}',
  {
    method: 'POST',
    headers: {
      'X-MandateZ-Agent-ID':   'ag_your_agent_id',
      'X-MandateZ-Owner-ID':   'your_owner_id',
      'X-MandateZ-Target-URL': 'https://api.openai.com/v1/chat/completions',
      'Content-Type':          'application/json',
      'Authorization':         \`Bearer \${process.env.OPENAI_API_KEY}\`,
    },
    body: JSON.stringify({
      model:    'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  }
);

// A 403 means MandateZ policy blocked the call before it hit OpenAI.
if (response.status === 403) {
  const { policy_id, reason } = await response.json();
  throw new Error(\`Blocked by \${policy_id}: \${reason}\`);
}`;

const CURL_EXAMPLE = `curl -X POST '${PROXY_BASE}' \\
  -H 'X-MandateZ-Agent-ID: ag_your_agent_id' \\
  -H 'X-MandateZ-Owner-ID: your_owner_id' \\
  -H 'X-MandateZ-Target-URL: https://api.openai.com/v1/chat/completions' \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H 'Content-Type: application/json' \\
  --data '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}'`;

export default function ProxyPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <SectionMarker number="01" label="PROXY SETUP" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
              Proxy mode
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-relaxed text-text-secondary">
              Zero code changes. Point your agent&apos;s HTTP client at the
              MandateZ proxy and governance is automatic — policy enforcement,
              signed event logging, and trust scoring for every outbound call.
            </p>
          </div>
          <Tag variant="success">REACHABLE</Tag>
        </div>
      </header>

      {/* How it works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          How it works
        </h2>
        <Card variant="default">
          <CardContent className="px-6 py-6">
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
              <Tag>YOUR AGENT</Tag>
              <span className="text-text-muted">→</span>
              <Tag variant="info">MANDATEZ PROXY</Tag>
              <span className="text-text-muted">→</span>
              <Tag>TARGET API</Tag>
            </div>
            <ul className="mt-4 ml-2 space-y-1 border-l border-dashed border-border-default pl-4 font-mono text-[11px] uppercase tracking-wider text-text-muted">
              <li>↓ POLICY CHECK (ALLOW / BLOCK / FLAG)</li>
              <li>↓ SIGNED EVENT LOG (ED25519)</li>
              <li>↓ TRUST SCORE UPDATE</li>
              <li>↓ OVERSIGHT ALERT ON FLAGGED ACTION</li>
            </ul>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-text-secondary">
              Your agent makes its outbound call to MandateZ instead of
              directly to OpenAI, Anthropic, Stripe, or any other API.
              MandateZ evaluates the call against your configured policies. If
              allowed, the request is forwarded and the response is relayed
              back. Every call produces a signed{' '}
              <code className="font-mono text-text-primary">AgentEvent</code>{' '}
              in your dashboard.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Setup steps */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          Setup — 3 steps
        </h2>

        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Tag variant="info">STEP 01</Tag>
              <CardTitle className="text-base">
                Configure your HTTP client
              </CardTitle>
            </div>
            <CardDescription>
              Prefix your existing API calls with the MandateZ proxy URL and
              add three headers: agent ID, owner ID, target URL. Everything
              else stays identical.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CopyCodeBlock label="PYTHON" code={PYTHON_EXAMPLE} />
              <CopyCodeBlock label="NODE.JS" code={NODE_EXAMPLE} />
            </div>
            <CopyCodeBlock label="CURL" code={CURL_EXAMPLE} />
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Tag variant="info">STEP 02</Tag>
              <CardTitle className="text-base">
                Set policies in your dashboard
              </CardTitle>
            </div>
            <CardDescription>
              Define which action types and resource patterns the agent is
              allowed to hit. The proxy evaluates every call against these
              rules before forwarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/policies">Configure policies →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Tag variant="info">STEP 03</Tag>
              <CardTitle className="text-base">
                Watch events stream in real time
              </CardTitle>
            </div>
            <CardDescription>
              Every proxied call shows up in the live event feed — allowed,
              blocked, or flagged. Signatures are verifiable, and the trust
              score updates in the background.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/">Open the event feed →</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Configuration */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          Endpoint
        </h2>
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">Proxy base URL</CardTitle>
            <CardDescription>
              Point your HTTP client here. Auth is per-call via the{' '}
              <code className="font-mono text-text-primary">
                X-MandateZ-Agent-ID
              </code>{' '}
              and{' '}
              <code className="font-mono text-text-primary">
                X-MandateZ-Owner-ID
              </code>{' '}
              headers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CopyCodeBlock label="BASE URL" code={PROXY_BASE} />
          </CardContent>
        </Card>
      </section>

      {/* Supported targets */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          What gets governed
        </h2>
        <p className="max-w-3xl text-sm text-text-secondary">
          The proxy automatically maps each target URL to a resource string
          your policies can match. Well-known API hosts map to a short prefix;
          custom hosts fall back to the full hostname.
        </p>
        <Card variant="default" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-bg-subtle/40">
                <tr className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left font-medium">API</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Resource pattern
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Auto-detected
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {SUPPORTED_TARGETS.map((t) => (
                  <tr key={t.api} className="text-text-primary">
                    <td className="px-4 py-3">{t.api}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {t.pattern}
                    </td>
                    <td className="px-4 py-3">
                      <Tag variant="success">YES</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Privacy */}
      <Card variant="default" className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Privacy</CardTitle>
          <CardDescription>
            MandateZ Proxy does not store request or response bodies. Only the
            action type, resource, outcome, policy ID, HTTP method, status
            code, and timestamp are logged — never your prompts, API
            payloads, or upstream responses. Every logged event is
            Ed25519-signed using an escrowed key bound to your agent ID, so
            the audit trail is cryptographically verifiable without MandateZ
            having access to your workload data.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* CTA */}
      <div className="flex flex-wrap gap-3 border-t border-border-default pt-6">
        <Button variant="primary" asChild>
          <Link href="/">See live events →</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/policies">Configure policies</Link>
        </Button>
      </div>
    </div>
  );
}
