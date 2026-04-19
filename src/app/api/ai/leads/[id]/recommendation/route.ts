import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { generateRecommendationForLead } from '@/lib/ai/recommender/generate';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data } = await supabase
    .from('agent_recommendations')
    .select('id, action_code, action_label, rationale, confidence, urgency, status, expires_at, generated_at')
    .eq('lead_id', params.id)
    .in('status', ['pending', 'shown', 'accepted'])
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ recommendation: data });
}

const POST_SCHEMA = z.object({ force: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const result = await generateRecommendationForLead(params.id);
  if (!result.ok) return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.recId });
}

const PATCH_SCHEMA = z.object({
  rec_id: z.string().uuid(),
  status: z.enum(['shown', 'accepted', 'rejected']),
  outcome: z.string().max(240).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const parsed = PATCH_SCHEMA.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const svc = createServiceClient();
  const { error } = await svc
    .from('agent_recommendations')
    .update({
      status: parsed.data.status,
      shown_at: parsed.data.status === 'shown' ? new Date().toISOString() : undefined,
      acted_at:
        parsed.data.status === 'accepted' || parsed.data.status === 'rejected'
          ? new Date().toISOString()
          : undefined,
      outcome: parsed.data.outcome,
    })
    .eq('id', parsed.data.rec_id)
    .eq('lead_id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
