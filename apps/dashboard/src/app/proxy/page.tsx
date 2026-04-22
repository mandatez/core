import Link from 'next/link';

export const metadata = {
  title: 'MandateZ Proxy Mode — Zero-Code Governance',
  description:
    'Route your agent\'s outbound API calls through MandateZ and enforce policy at the network layer. No SDK install required.',
};

const PROXY_BASE = 'https://core-dashboard-black.vercel.app/api/proxy';

const SUPPORTED_TARGETS = [
  { api: 'OpenAI', pattern: 'openai/v1/*', autoDetected: true },
  { api: 'Anthropic', pattern: 'anthropic/v1/*', autoDetected: true },
  { api: 'Stripe', pattern: 'stripe/*', autoDetected: true },
  { api: 'Supabase', pattern: 'supabase/*', autoDetected: true },
  { api: 'Slack', pattern: 'slack/*', autoDetected: true },
  { api: 'GitHub', pattern: 'github/*', autoDetected: true },
  { api: 'Twilio / SendGrid / Resend', pattern: 'twilio/* · sendgrid/* · resend/*', autoDetected: true },
  { api: 'Vercel', pattern: 'vercel/*', autoDetected: true },
  { api: 'Custom domain', pattern: 'your-domain.com/*', autoDetected: true },
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

export default function ProxyPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">MandateZ Proxy Mode</h1>
        <p className="text-lg text-gray-400 max-w-3xl leading-relaxed">
          Zero code changes. Point your agent&apos;s HTTP client at the MandateZ proxy and
          governance is automatic — policy enforcement, signed event logging, and trust scoring
          for every outbound call.
        </p>
      </header>

      {/* Section A — How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How it works</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-8 font-mono text-sm overflow-x-auto">
          <div className="flex flex-wrap items-center gap-3 text-gray-300">
            <span className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2">Your Agent</span>
            <span className="text-gray-500">→</span>
            <span className="rounded-md border border-blue-800 bg-blue-950/40 px-3 py-2 text-blue-300">MandateZ Proxy</span>
            <span className="text-gray-500">→</span>
            <span className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2">Target API</span>
          </div>
          <div className="ml-[7.5rem] mt-2 border-l border-dashed border-gray-700 pl-4 text-gray-400 space-y-1 text-xs leading-relaxed">
            <div>↓ Policy check (allow / block / flag)</div>
            <div>↓ Signed event log (Ed25519)</div>
            <div>↓ Trust score update</div>
            <div>↓ Oversight alert on flagged action</div>
          </div>
        </div>
        <p className="text-sm text-gray-400 max-w-3xl">
          Your agent makes its outbound call to MandateZ instead of directly to OpenAI, Anthropic,
          Stripe, or any other API. MandateZ evaluates the call against your configured policies.
          If allowed, the request is forwarded to the real target and the response is relayed back.
          Every call produces a signed <code className="text-gray-300">AgentEvent</code> in your
          dashboard.
        </p>
      </section>

      {/* Section B — Setup */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Setup — 3 steps</h2>

        {/* Step 1 */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-200">
            Step 1 — Configure your HTTP client
          </h3>
          <p className="text-sm text-gray-400">
            Prefix your existing API calls with the MandateZ proxy URL and add three headers:
            the agent ID, your owner ID, and the real target URL. Everything else — auth
            headers, body, method — stays identical.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Python</div>
              <pre className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs overflow-x-auto leading-relaxed">
                <code>{PYTHON_EXAMPLE}</code>
              </pre>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Node.js</div>
              <pre className="rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs overflow-x-auto leading-relaxed">
                <code>{NODE_EXAMPLE}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-gray-200">
            Step 2 — Set policies in your dashboard
          </h3>
          <p className="text-sm text-gray-400">
            Define which action types and resource patterns the agent is allowed to hit. The
            proxy evaluates every call against these rules before forwarding.{' '}
            <Link href="/reports" className="text-blue-400 hover:text-blue-300">
              Open Reports to manage policies →
            </Link>
          </p>
        </div>

        {/* Step 3 */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-gray-200">
            Step 3 — Watch events stream in real time
          </h3>
          <p className="text-sm text-gray-400">
            Every proxied call shows up in the live event feed — allowed, blocked, or flagged.
            Signatures are verifiable, and the trust score updates in the background.{' '}
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Open the event feed →
            </Link>
          </p>
        </div>
      </section>

      {/* Section C — What Gets Governed */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">What gets governed</h2>
        <p className="text-sm text-gray-400 max-w-3xl">
          The proxy automatically maps each target URL to a resource string your policies can
          match. Well-known API hosts map to a short prefix; custom hosts fall back to the full
          hostname.
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-medium">API</th>
                <th className="text-left px-4 py-3 font-medium">Resource pattern</th>
                <th className="text-left px-4 py-3 font-medium">Auto-detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {SUPPORTED_TARGETS.map((t) => (
                <tr key={t.api} className="text-gray-300">
                  <td className="px-4 py-3">{t.api}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{t.pattern}</td>
                  <td className="px-4 py-3 text-emerald-400">
                    {t.autoDetected ? '✓' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section D — Privacy */}
      <section className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/40 p-6 max-w-3xl">
        <h2 className="text-base font-semibold text-gray-200">Privacy</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          MandateZ Proxy does not store request or response bodies. Only the action type, resource,
          outcome, policy ID, HTTP method, status code, and timestamp are logged — never your
          prompts, API payloads, or upstream responses. Every logged event is Ed25519-signed
          using an escrowed key bound to your agent ID, so the audit trail is
          cryptographically verifiable without MandateZ having access to your workload data.
        </p>
      </section>

      {/* CTA */}
      <div className="flex flex-wrap gap-3 pt-4">
        <Link
          href="/"
          className="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
        >
          See live events →
        </Link>
        <Link
          href="/reports"
          className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:border-gray-500 hover:text-gray-100 transition-colors"
        >
          Configure policies
        </Link>
      </div>
    </div>
  );
}
