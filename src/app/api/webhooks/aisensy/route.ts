import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyHmac } from '@/lib/webhook-verify';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.AISENSY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (!verifyHmac(raw, req.headers.get('x-aisensy-signature'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  const svc = createServiceClient();

  // AiSensy may send inbound messages OR delivery/read status updates.
  const direction = payload.direction === 'in' ? 'in' : 'out';
  const phone: string | undefined = payload.mobile ?? payload.from ?? payload.to;
  if (!phone) return NextResponse.json({ ok: true, skipped: 'no_phone' });

  const { data: lead } = await svc
    .from('leads')
    .select('id')
    .eq('phone', phone)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await svc.from('whatsapp_messages').insert({
    lead_id: lead?.id ?? null,
    direction,
    phone,
    aisensy_message_id: payload.messageId ?? null,
    body: payload.text ?? payload.message ?? null,
    status: payload.status ?? null,
    raw_payload: payload,
    sent_at: payload.sentAt ?? null,
    delivered_at: payload.deliveredAt ?? null,
    read_at: payload.readAt ?? null,
  });

  if (direction === 'in' && lead) {
    await svc.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'whatsapp_in',
      content: payload.text ?? payload.message ?? null,
      metadata: { messageId: payload.messageId ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}
