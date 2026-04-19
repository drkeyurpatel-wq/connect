import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { generateCreatives } from '@/lib/ai/creatives/generate';

export const runtime = 'nodejs';

const SCHEMA = z.object({
  channel: z.enum(['whatsapp', 'meta_ad', 'google_ad', 'email', 'sms', 'journey']),
  language: z.string().min(2).max(12),
  tone: z.string().max(40).optional(),
  brief: z.string().min(4).max(2000),
  count: z.number().int().min(1).max(10),
  campaign_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const result = await generateCreatives({ ...parsed.data, campaignId: parsed.data.campaign_id, agentId: agent.userId });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: result.id, variants: result.variants, flags: result.flags }, { status: 201 });
}

export async function GET() {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('ai_creatives_generated')
    .select('id, channel, language, tone, brief, variants, compliance_flags, generated_at, linked_campaign_id')
    .order('generated_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
