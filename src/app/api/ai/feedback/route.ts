import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { classifyFeedback } from '@/lib/ai/feedback/classify';

export const runtime = 'nodejs';

const SCHEMA = z.object({
  source: z.enum(['nps_open_text', 'complaint', 'review', 'whatsapp_reply', 'email', 'other']),
  source_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  centre_id: z.string().uuid().optional(),
  text: z.string().min(1).max(4000),
  known_names: z.array(z.string().max(120)).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await classifyFeedback({
    source: parsed.data.source,
    sourceId: parsed.data.source_id,
    leadId: parsed.data.lead_id,
    centreId: parsed.data.centre_id,
    text: parsed.data.text,
    knownNames: parsed.data.known_names,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.classificationId }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity');
  const open = searchParams.get('open');

  const supabase = createClient();
  let query = supabase
    .from('feedback_classifications')
    .select('id, source, topic, sub_topic, sentiment, severity, suggested_owner, created_at, resolved_at, lead_id, centre_id')
    .order('created_at', { ascending: false })
    .limit(100);

  if (severity) query = query.eq('severity', severity);
  if (open === 'true') query = query.is('resolved_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
