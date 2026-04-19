import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

const PatchSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'cancelled']).optional(),
  assigned_doctor_id: z.string().uuid().nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
  first_contact_at: z.string().datetime().optional(),
  outcome: z.enum(['home_care', 'opd_visit', 'er_admitted', 'referred_elsewhere', 'no_issue', 'lost_to_followup']).optional(),
  outcome_notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === 'resolved') {
    update.resolved_at = new Date().toISOString();
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('complication_flags')
    .update(update)
    .eq('id', params.id)
    .select('id, status, severity, first_contact_at, resolved_at, outcome')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (parsed.data.status === 'resolved') {
    await supabase
      .from('clinical_escalation_sla')
      .update({ resolved_at: new Date().toISOString() })
      .eq('complication_flag_id', params.id)
      .is('resolved_at', null);
  }
  if (parsed.data.first_contact_at && parsed.data.status && parsed.data.status !== 'open') {
    await supabase
      .from('clinical_escalation_sla')
      .update({ acknowledged_at: parsed.data.first_contact_at })
      .eq('complication_flag_id', params.id)
      .is('acknowledged_at', null);
  }

  return NextResponse.json(data);
}
