import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  if (payload.google_key !== process.env.GOOGLE_LEADS_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data: source } = await svc.from('lead_sources').select('id').eq('code', 'google_lead_ad').single();
  const { data: stage } = await svc.from('lead_stages').select('id').eq('code', 'new').single();
  if (!source || !stage) return NextResponse.json({ error: 'config_missing' }, { status: 500 });

  const nameParts = (payload.user_column_data?.find((c: { column_name: string; string_value: string }) => c.column_name === 'FULL_NAME')?.string_value ?? '').split(' ');
  const phone = payload.user_column_data?.find((c: { column_name: string; string_value: string }) => c.column_name === 'PHONE_NUMBER')?.string_value ?? '';
  const email = payload.user_column_data?.find((c: { column_name: string; string_value: string }) => c.column_name === 'EMAIL')?.string_value ?? null;

  await svc.from('leads').insert({
    first_name: nameParts[0] || 'Unknown',
    last_name: nameParts.slice(1).join(' ') || null,
    phone,
    email,
    source_id: source.id,
    stage_id: stage.id,
    utm_source: 'google',
    utm_campaign: payload.campaign_id ?? null,
  });

  return NextResponse.json({ ok: true });
}
