import { createServerClient } from '@/lib/supabase-server';

interface Agent {
  id: string;
  owner_id: string;
  name: string;
  public_key: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export const dynamic = 'force-dynamic';

export default async function DirectoryPage() {
  const supabase = createServerClient();
  const { data: agents, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Agent Directory</h2>
        <p className="text-gray-400 mt-1">
          Public registry of MandateZ-verified agents. Free to list, verified on-chain.
        </p>
      </div>

      {error ? (
        <div className="text-red-400 border border-red-800 rounded-lg p-4">
          Failed to load agents: {error.message}
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-gray-800 rounded-lg">
          <div className="w-16 h-16 rounded-full bg-blue-900/30 flex items-center justify-center mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-100">No agents listed yet</h3>
          <p className="text-gray-500 mt-2 mb-8">Be the first to register a MandateZ-verified agent.</p>
          <a
            href="https://mandatez.mintlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            Register Your Agent
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17l9.2-9.2M17 17V7H7"/>
            </svg>
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {(agents as Agent[]).map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      <div className="border-t border-gray-800 pt-6 mt-8">
        <h3 className="text-lg font-medium mb-2">Register an Agent</h3>
        <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
{`POST /api/agents/register
Content-Type: application/json

{
  "agent_id": "ag_...",
  "owner_id": "your_org_id",
  "name": "My Agent",
  "public_key": "base64-encoded-ed25519-public-key"
}`}
        </pre>
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const registered = new Date(agent.created_at).toLocaleDateString();
  const keyPreview = agent.public_key.slice(0, 16) + '...';

  return (
    <div className="border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-900/40 text-blue-300 text-sm font-bold">
            {agent.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-100">{agent.name}</span>
              <span className="text-xs px-2 py-0.5 rounded border bg-green-900/50 text-green-300 border-green-700 font-medium">
                verified
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 font-mono">{agent.id}</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>{agent.owner_id}</div>
          <div className="mt-0.5">Registered {registered}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-600">
        Public key: <span className="font-mono text-gray-500">{keyPreview}</span>
      </div>
    </div>
  );
}
