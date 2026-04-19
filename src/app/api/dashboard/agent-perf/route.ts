import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

export async function GET() {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = createClient();
  const sinceIso = new Date(Date.now() - 30 * 86400_000).toISOString();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('assigned_agent_id, sla_breached, first_response_at, stage_id')
    .gte('created_at', sinceIso)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: wonStages } = await supabase
    .from('lead_stages').select('id').eq('is_won', true);
  const wonIds = new Set((wonStages ?? []).map((s) => s.id));

  const byAgent = new Map<string, { assigned: number; responded: number; breached: number; won: number }>();
  for (const l of leads ?? []) {
    if (!l.assigned_agent_id) continue;
    const cur = byAgent.get(l.assigned_agent_id) ?? { assigned: 0, responded: 0, breached: 0, won: 0 };
    cur.assigned += 1;
    if (l.first_response_at) cur.responded += 1;
    if (l.sla_breached) cur.breached += 1;
    if (wonIds.has(l.stage_id)) cur.won += 1;
    byAgent.set(l.assigned_agent_id, cur);
  }

  const agentIds = Array.from(byAgent.keys());
  const { data: agentRows } = await supabase
    .from('agents').select('id, full_name, email').in('id', agentIds.length ? agentIds : ['00000000-0000-0000-0000-000000000000']);

  const perf = (agentRows ?? []).map((a) => ({
    agent_id: a.id,
    full_name: a.full_name,
    email: a.email,
    ...byAgent.get(a.id)!,
  }));

  return NextResponse.json({ window: '30d', perf });
}
