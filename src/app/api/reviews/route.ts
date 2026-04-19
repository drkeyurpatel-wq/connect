import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

const MIN_NPS_FOR_REVIEW_ASK = 8;

const SolicitSchema = z.object({
  lead_id: z.string().uuid(),
  channel: z.enum(['google', 'practo', 'justdial', 'mouthshut', 'other']),
  deep_link: z.string().url(),
  discharge_event_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = SolicitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  // Spec §10.3 — never solicit reviews from detractors. Check the latest NPS.
  const { data: latestNps } = await supabase
    .from('nps_responses')
    .select('score')
    .eq('lead_id', parsed.data.lead_id)
    .order('responded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const npsScoreAtAsk = latestNps?.score ?? null;
  const guardPassed = npsScoreAtAsk === null || npsScoreAtAsk >= MIN_NPS_FOR_REVIEW_ASK;
  if (!guardPassed) {
    return NextResponse.json(
      { error: 'detractor_review_blocked', min_score: MIN_NPS_FOR_REVIEW_ASK, actual: npsScoreAtAsk },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('review_solicitations')
    .insert({
      lead_id: parsed.data.lead_id,
      discharge_event_id: parsed.data.discharge_event_id ?? null,
      channel: parsed.data.channel,
      deep_link: parsed.data.deep_link,
      nps_score_at_ask: npsScoreAtAsk,
      min_nps_guard_passed: true,
    })
    .select('id, sent_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, sent_at: data.sent_at }, { status: 201 });
}

const CaptureSchema = z.object({
  lead_id: z.string().uuid(),
  solicitation_id: z.string().uuid().optional(),
  channel: z.enum(['google', 'practo', 'justdial', 'mouthshut', 'other']),
  review_url: z.string().url().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  snippet: z.string().max(2000).optional(),
  source: z.enum(['manual', 'deep_link', 'api']).default('manual'),
});

export async function PUT(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CaptureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('review_captures')
    .insert({
      lead_id: parsed.data.lead_id,
      solicitation_id: parsed.data.solicitation_id ?? null,
      channel: parsed.data.channel,
      review_url: parsed.data.review_url ?? null,
      rating: parsed.data.rating ?? null,
      snippet: parsed.data.snippet ?? null,
      source: parsed.data.source,
      captured_by: agent.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (parsed.data.solicitation_id) {
    await supabase
      .from('review_solicitations')
      .update({ status: 'submitted' })
      .eq('id', parsed.data.solicitation_id);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  const supabase = createClient();
  let q = supabase
    .from('review_solicitations')
    .select('id, lead_id, channel, deep_link, status, sent_at, clicked_at, nps_score_at_ask')
    .order('sent_at', { ascending: false })
    .limit(100);
  if (leadId) q = q.eq('lead_id', leadId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ solicitations: data });
}
