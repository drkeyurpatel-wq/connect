import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAgent } from '@/lib/auth';

const Schema = z.object({
  to_stage_code: z.string().min(1),
  reason: z.string().optional(),
  lost_reason_code: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, stage_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: toStage } = await supabase
    .from('lead_stages')
    .select('id, is_lost')
    .eq('code', parsed.data.to_stage_code)
    .maybeSingle();
  if (!toStage) return NextResponse.json({ error: 'stage_not_found' }, { status: 400 });

  let lostReasonId: string | null = null;
  if (toStage.is_lost) {
    if (!parsed.data.lost_reason_code) {
      return NextResponse.json({ error: 'lost_reason_required' }, { status: 400 });
    }
    const { data: lr } = await supabase
      .from('lost_reasons')
      .select('id')
      .eq('code', parsed.data.lost_reason_code)
      .maybeSingle();
    if (!lr) return NextResponse.json({ error: 'lost_reason_not_found' }, { status: 400 });
    lostReasonId = lr.id;
  }

  const svc = createServiceClient();

  const { error: updErr } = await svc
    .from('leads')
    .update({
      stage_id: toStage.id,
      lost_reason_id: lostReasonId,
      updated_by: agent.userId,
    })
    .eq('id', lead.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await svc.from('lead_stage_history').insert({
    lead_id: lead.id,
    from_stage_id: lead.stage_id,
    to_stage_id: toStage.id,
    changed_by: agent.userId,
    reason: parsed.data.reason ?? null,
  });

  await svc.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'stage_change',
    content: parsed.data.reason ?? null,
    metadata: { to_stage_code: parsed.data.to_stage_code },
    created_by: agent.userId,
  });

  return NextResponse.json({ ok: true });
}
