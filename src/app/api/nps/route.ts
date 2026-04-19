import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { heuristicTopicExtraction, npsCategory } from '@/lib/p4/nps';

const CreateNpsSchema = z.object({
  lead_id: z.string().uuid(),
  score: z.number().int().min(0).max(10),
  open_feedback: z.string().max(2000).optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'voice', 'web']).default('whatsapp'),
  would_refer: z.boolean().optional(),
  discharge_event_id: z.string().uuid().optional(),
  enrolment_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateNpsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, centre_interest_id, specialty_interest_id, doctor_interest_id')
    .eq('id', parsed.data.lead_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });

  const feedback = parsed.data.open_feedback;
  const { sentiment, topics } = feedback
    ? heuristicTopicExtraction(feedback)
    : { sentiment: null, topics: [] as string[] };

  const { data, error } = await supabase
    .from('nps_responses')
    .insert({
      lead_id: parsed.data.lead_id,
      discharge_event_id: parsed.data.discharge_event_id ?? null,
      enrolment_id: parsed.data.enrolment_id ?? null,
      centre_id: lead.centre_interest_id,
      primary_doctor_id: lead.doctor_interest_id,
      specialty_id: lead.specialty_interest_id,
      score: parsed.data.score,
      category: npsCategory(parsed.data.score),
      open_feedback: feedback ?? null,
      feedback_sentiment: sentiment,
      feedback_topics: topics,
      would_refer: parsed.data.would_refer ?? null,
      channel: parsed.data.channel,
      responded_at: new Date().toISOString(),
    })
    .select('id, category')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, category: data.category }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');
  const centreId = searchParams.get('centre_id');
  const category = searchParams.get('category');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const supabase = createClient();
  let query = supabase
    .from('nps_responses')
    .select('id, lead_id, score, category, open_feedback, feedback_sentiment, feedback_topics, centre_id, primary_doctor_id, specialty_id, responded_at', { count: 'exact' })
    .order('responded_at', { ascending: false })
    .limit(limit);

  if (leadId) query = query.eq('lead_id', leadId);
  if (centreId) query = query.eq('centre_id', centreId);
  if (category) query = query.eq('category', category);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ responses: data, total: count ?? 0 });
}
