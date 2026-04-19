import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAgent } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

const SCHEMA = z.object({
  lead_id: z.string().uuid().optional(),
  call_ref: z.string().max(120).optional(),
  event_kind: z.enum([
    'sentiment_sample',
    'suggestion_shown',
    'suggestion_used',
    'suggestion_ignored',
    'compliance_alert',
    'post_call_note',
  ]),
  sentiment: z.number().min(-1).max(1).optional(),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const svc = createServiceClient();
  const { error } = await svc.from('call_coaching_events').insert({
    lead_id: parsed.data.lead_id,
    agent_id: agent.userId,
    call_ref: parsed.data.call_ref,
    event_kind: parsed.data.event_kind,
    sentiment: parsed.data.sentiment,
    payload: parsed.data.payload ?? {},
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const callRef = searchParams.get('call_ref');
  const leadId = searchParams.get('lead_id');

  const svc = createServiceClient();
  let query = svc
    .from('call_coaching_events')
    .select('id, lead_id, agent_id, call_ref, event_kind, sentiment, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (callRef) query = query.eq('call_ref', callRef);
  if (leadId) query = query.eq('lead_id', leadId);
  if (agent.role === 'agent') query = query.eq('agent_id', agent.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
