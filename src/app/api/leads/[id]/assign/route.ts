import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAgent } from '@/lib/auth';

const Schema = z.object({
  to_agent_id: z.string().uuid(),
  reason: z.string().optional(),
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
    .select('id, assigned_agent_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const svc = createServiceClient();
  const { error } = await svc
    .from('leads')
    .update({ assigned_agent_id: parsed.data.to_agent_id, updated_by: agent.userId })
    .eq('id', lead.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from('lead_assignments').insert({
    lead_id: lead.id,
    from_agent_id: lead.assigned_agent_id,
    to_agent_id: parsed.data.to_agent_id,
    assigned_by: agent.userId,
    reason: parsed.data.reason ?? null,
  });

  await svc.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'assignment_change',
    metadata: { from: lead.assigned_agent_id, to: parsed.data.to_agent_id },
    created_by: agent.userId,
  });

  return NextResponse.json({ ok: true });
}
