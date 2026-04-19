import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { FAMILY_MEMBER_CAP } from '@/lib/p4/loyalty';

const AddSchema = z.object({
  loyalty_card_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  full_name: z.string().min(1),
  phone: z.string().min(6).optional(),
  relation: z.enum(['self', 'spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'other']),
  dob: z.string().date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  const { count } = await supabase
    .from('family_members')
    .select('id', { count: 'exact', head: true })
    .eq('loyalty_card_id', parsed.data.loyalty_card_id)
    .is('removed_at', null);

  if ((count ?? 0) >= FAMILY_MEMBER_CAP) {
    return NextResponse.json({ error: 'family_cap_reached', cap: FAMILY_MEMBER_CAP }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('family_members')
    .insert({
      loyalty_card_id: parsed.data.loyalty_card_id,
      lead_id: parsed.data.lead_id ?? null,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      relation: parsed.data.relation,
      dob: parsed.data.dob ?? null,
      gender: parsed.data.gender ?? null,
      added_by: agent.userId,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get('loyalty_card_id');
  if (!cardId) return NextResponse.json({ error: 'loyalty_card_id_required' }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('family_members')
    .select('id, loyalty_card_id, lead_id, full_name, phone, relation, dob, gender, added_at')
    .eq('loyalty_card_id', cardId)
    .is('removed_at', null)
    .order('added_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}

export async function DELETE(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('id');
  if (!memberId) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const supabase = createClient();
  const { error } = await supabase
    .from('family_members')
    .update({ removed_at: new Date().toISOString(), removed_by: agent.userId })
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
