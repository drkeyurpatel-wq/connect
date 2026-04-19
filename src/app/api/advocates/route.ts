import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { generateReferralCode, validateReward } from '@/lib/p4/advocate';

const CreateReferralSchema = z.object({
  advocate_lead_id: z.string().uuid(),
  referee_phone: z.string().min(6).optional(),
  referee_name: z.string().max(200).optional(),
  channel: z.string().max(50).optional(),
  utm_campaign: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateReferralSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referral_code = generateReferralCode();
    const { data, error } = await supabase
      .from('advocate_referrals')
      .insert({
        advocate_lead_id: parsed.data.advocate_lead_id,
        referral_code,
        referee_phone: parsed.data.referee_phone ?? null,
        referee_name: parsed.data.referee_name ?? null,
        channel: parsed.data.channel ?? null,
        utm_campaign: parsed.data.utm_campaign ?? null,
      })
      .select('id, referral_code')
      .single();
    if (!error && data) return NextResponse.json({ id: data.id, referral_code: data.referral_code }, { status: 201 });
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'referral_code_collision' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const advocateLeadId = searchParams.get('advocate_lead_id');
  const status = searchParams.get('status');

  const supabase = createClient();
  let query = supabase
    .from('advocate_referrals')
    .select('id, advocate_lead_id, referral_code, referee_lead_id, referee_phone, referee_name, status, shared_at, clicked_at, lead_created_at, converted_at, channel')
    .order('shared_at', { ascending: false })
    .limit(100);
  if (advocateLeadId) query = query.eq('advocate_lead_id', advocateLeadId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referrals: data });
}

const RewardSchema = z.object({
  advocate_lead_id: z.string().uuid(),
  referral_id: z.string().uuid().optional(),
  reward_code: z.string().min(1),
  reward_description: z.string().min(1).max(500),
  material_value_inr: z.number().min(0),
});

export async function PUT(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = RewardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    validateReward({ materialValueInr: parsed.data.material_value_inr, isCash: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('advocate_rewards')
    .insert({
      advocate_lead_id: parsed.data.advocate_lead_id,
      referral_id: parsed.data.referral_id ?? null,
      reward_code: parsed.data.reward_code,
      reward_description: parsed.data.reward_description,
      material_value_inr: parsed.data.material_value_inr,
      granted_by: agent.userId,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
