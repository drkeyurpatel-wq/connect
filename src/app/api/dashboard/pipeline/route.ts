import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

export async function GET() {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('stage_id')
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.stage_id, (counts.get(row.stage_id) ?? 0) + 1);
  }

  const { data: stages } = await supabase
    .from('lead_stages')
    .select('id, code, name, stage_order')
    .eq('active', true)
    .order('stage_order', { ascending: true });

  const pipeline = (stages ?? []).map((s) => ({
    stage_id: s.id,
    code: s.code,
    name: s.name,
    count: counts.get(s.id) ?? 0,
  }));

  return NextResponse.json({ pipeline, total: data?.length ?? 0 });
}
