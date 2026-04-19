import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAgent } from '@/lib/auth';

const Schema = z.object({
  template_name: z.string().min(1),
  variables: z.record(z.string()).optional(),
});

/**
 * Sends a templated WhatsApp message via AiSensy.
 * AiSensy credentials live in AISENSY_API_KEY. Template must be pre-approved.
 */
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
    .select('id, phone, first_name')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const apiKey = process.env.AISENSY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'aisensy_not_configured' }, { status: 503 });

  const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      campaignName: parsed.data.template_name,
      destination: lead.phone,
      userName: lead.first_name,
      templateParams: Object.values(parsed.data.variables ?? {}),
    }),
  });

  const payload = await res.json().catch(() => ({}));

  const svc = createServiceClient();
  await svc.from('whatsapp_messages').insert({
    lead_id: lead.id,
    direction: 'out',
    phone: lead.phone,
    aisensy_message_id: payload?.messageId ?? null,
    body: parsed.data.template_name,
    status: res.ok ? 'sent' : 'failed',
    raw_payload: payload,
    sent_at: res.ok ? new Date().toISOString() : null,
  });

  await svc.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'whatsapp_out',
    content: `Template: ${parsed.data.template_name}`,
    metadata: { template: parsed.data.template_name, variables: parsed.data.variables ?? {} },
    created_by: agent.userId,
  });

  if (!res.ok) return NextResponse.json({ error: 'aisensy_failed', payload }, { status: 502 });
  return NextResponse.json({ ok: true, aisensy: payload });
}
