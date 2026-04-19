import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

export async function GET() {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const sinceIso = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data, error } = await supabase
    .from('leads')
    .select('id, created_at, first_response_at, sla_breached, assigned_agent_id')
    .gte('created_at', sinceIso)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const total = rows.length;
  const responded = rows.filter((r) => r.first_response_at).length;
  const breached = rows.filter((r) => r.sla_breached).length;

  return NextResponse.json({
    window: '7d',
    total,
    responded,
    breached,
    breach_rate: total ? breached / total : 0,
    response_rate: total ? responded / total : 0,
  });
}
