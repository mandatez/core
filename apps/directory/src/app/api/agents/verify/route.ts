import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent_id');

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 });
  }

  if (!/^ag_[A-Za-z0-9_-]+$/.test(agentId)) {
    return NextResponse.json({ error: 'Invalid agent_id format' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, owner_id, name, public_key, created_at')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { verified: false, agent_id: agentId, error: 'Agent not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    verified: true,
    agent_id: agent.id,
    owner_id: agent.owner_id,
    name: agent.name,
    public_key: agent.public_key,
    registered_at: agent.created_at,
  });
}
