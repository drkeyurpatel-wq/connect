import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { logPhiRead } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await logPhiRead({
    actorId: agent.userId,
    actorRole: agent.role,
    tableName: 'leads',
    rowId: lead.id,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  });

  const { data: activities } = await supabase
    .from('lead_activities')
    .select('*')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ lead, activities: activities ?? [] });
}

const PatchSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  alt_phone: z.string().optional(),
  email: z.string().email().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  chief_complaint: z.string().optional(),
  medical_notes: z.string().optional(),
  expected_value: z.number().optional(),
  centre_interest_id: z.string().uuid().optional(),
  specialty_interest_id: z.string().uuid().optional(),
  doctor_interest_id: z.string().uuid().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('leads')
    .update({ ...parsed.data, updated_by: agent.userId })
    .eq('id', params.id)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = createClient();
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: new Date().toISOString(), deleted_by: agent.userId })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
