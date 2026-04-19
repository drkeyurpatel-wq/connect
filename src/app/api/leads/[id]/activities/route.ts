import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

const Schema = z.object({
  activity_type: z.enum(['note', 'call_log', 'clinical_note']),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('lead_activities')
    .insert({
      lead_id: params.id,
      activity_type: parsed.data.activity_type,
      content: parsed.data.content,
      metadata: parsed.data.metadata ?? {},
      created_by: agent.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // First-response SLA: on first agent-initiated activity, mark first_response_at.
  await supabase
    .from('leads')
    .update({ first_response_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('first_response_at', null);

  return NextResponse.json({ id: data.id }, { status: 201 });
}
