import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage');
  const assigned = searchParams.get('assigned');
  const centre = searchParams.get('centre');
  const q = searchParams.get('q');
  const limit = Math.min(Number(searchParams.get('limit')) || LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
  const offset = Number(searchParams.get('offset')) || 0;

  const supabase = createClient();
  let query = supabase
    .from('leads')
    .select('id, first_name, last_name, phone, stage_id, assigned_agent_id, centre_interest_id, priority, created_at, first_response_at, sla_breached', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage) query = query.eq('stage_id', stage);
  if (assigned) query = query.eq('assigned_agent_id', assigned);
  if (centre) query = query.eq('centre_interest_id', centre);
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data, total: count ?? 0, limit, offset });
}

const CreateLeadSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  phone: z.string().min(6),
  alt_phone: z.string().optional(),
  email: z.string().email().optional(),
  source_code: z.string().min(1),
  centre_interest_id: z.string().uuid().optional(),
  specialty_interest_id: z.string().uuid().optional(),
  doctor_interest_id: z.string().uuid().optional(),
  chief_complaint: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  const [{ data: source }, { data: stage }] = await Promise.all([
    supabase.from('lead_sources').select('id').eq('code', parsed.data.source_code).single(),
    supabase.from('lead_stages').select('id').eq('code', 'new').single(),
  ]);
  if (!source || !stage) {
    return NextResponse.json({ error: 'source_or_stage_not_found' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...parsed.data,
      source_id: source.id,
      stage_id: stage.id,
      created_by: agent.userId,
      updated_by: agent.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
