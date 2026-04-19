import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyMetaSignature } from '@/lib/webhook-verify';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.META_LEADS_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'verify_failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_LEADS_APP_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  const svc = createServiceClient();
  const { data: source } = await svc.from('lead_sources').select('id').eq('code', 'meta_lead_ad').single();
  const { data: stage } = await svc.from('lead_stages').select('id').eq('code', 'new').single();
  if (!source || !stage) return NextResponse.json({ error: 'config_missing' }, { status: 500 });

  const entries = payload.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const fields = Object.fromEntries((v.field_data ?? []).map((f: { name: string; values: string[] }) => [f.name, f.values?.[0]]));
      await svc.from('leads').insert({
        first_name: fields.full_name?.split(' ')[0] ?? fields.first_name ?? 'Unknown',
        last_name: fields.full_name?.split(' ').slice(1).join(' ') || fields.last_name || null,
        phone: fields.phone_number ?? fields.phone ?? '',
        email: fields.email ?? null,
        source_id: source.id,
        stage_id: stage.id,
        utm_source: 'meta',
        utm_campaign: v.ad_id ?? null,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
