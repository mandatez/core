import { createServerClient } from '@/lib/supabase-server';

interface Policy {
  id: string;
  owner_id: string;
  name: string;
  rules: PolicyRule[];
  created_at: string;
}

interface PolicyRule {
  id: string;
  action_types: string[];
  resource_pattern: string;
  effect: string;
}

const EFFECT_STYLES: Record<string, { label: string; style: string }> = {
  block: { label: 'Blocked', style: 'bg-red-900/50 text-red-300 border-red-700' },
  flag: { label: 'Flagged', style: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  allow: { label: 'Allowed', style: 'bg-green-900/50 text-green-300 border-green-700' },
};

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const supabase = createServerClient();
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Your Rules</h2>
        <p className="text-gray-400 mt-1">
          These rules control what your AI assistants can and can't do.
        </p>
      </div>

      {error ? (
        <div className="text-red-400 border border-red-800 rounded-lg p-4">
          Failed to load rules: {error.message}
        </div>
      ) : !policies || policies.length === 0 ? (
        <div className="text-center py-12 border border-gray-800 rounded-lg space-y-3">
          <p className="text-gray-500">No rules set yet.</p>
          <p className="text-sm text-gray-600">
            Rules let you block, flag, or allow specific actions. Set them up via the SDK.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(policies as Policy[]).map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}

function PolicyCard({ policy }: { policy: Policy }) {
  return (
    <div className="border border-gray-800 rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-100">{policy.name}</h3>
        <span className="text-xs text-gray-600 font-mono">{policy.id}</span>
      </div>
      <div className="space-y-2">
        {policy.rules.map((rule) => {
          const effect = EFFECT_STYLES[rule.effect] ?? { label: rule.effect, style: 'bg-gray-800 text-gray-300 border-gray-700' };
          return (
            <div key={rule.id} className="flex items-center gap-3 text-sm">
              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${effect.style}`}>
                {effect.label}
              </span>
              <span className="text-gray-300">
                {rule.action_types.join(', ')}
              </span>
              <span className="text-gray-600">on</span>
              <span className="font-mono text-gray-400">{rule.resource_pattern}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
