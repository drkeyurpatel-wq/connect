import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';

const Schema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  chief_complaint: z.string().optional(),
  specialty: z.string().optional(),
  centre: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.WEBSITE_FORM_API_KEY) {
    return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: source } = await svc.from('lead_sources').select('id').eq('code', 'website_form').single();
  const { data: stage } = await svc.from('lead_stages').select('id').eq('code', 'new').single();
  if (!source || !stage) return NextResponse.json({ error: 'config_missing' }, { status: 500 });

  const { data, error } = await svc
    .from('leads')
    .insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      chief_complaint: parsed.data.chief_complaint ?? null,
      utm_source: parsed.data.utm_source ?? null,
      utm_medium: parsed.data.utm_medium ?? null,
      utm_campaign: parsed.data.utm_campaign ?? null,
      utm_term: parsed.data.utm_term ?? null,
      utm_content: parsed.data.utm_content ?? null,
      source_id: source.id,
      stage_id: stage.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
