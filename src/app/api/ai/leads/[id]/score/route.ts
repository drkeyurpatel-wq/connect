import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scoreLeads } from '@/lib/ai/scoring/compute';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('lead_scores')
    .select('p2c, pltv, feature_contributions, computed_at, model_id, lead_score_models(code, version, approach)')
    .eq('lead_id', params.id)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ score: data });
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const scored = await scoreLeads([params.id]);
    return NextResponse.json({ ok: true, scored });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
