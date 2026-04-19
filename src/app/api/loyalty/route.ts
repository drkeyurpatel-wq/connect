import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { generateCardNumber, tierForSpend } from '@/lib/p4/loyalty';

const CreateCardSchema = z.object({
  primary_lead_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { data: existing } = await supabase
    .from('loyalty_cards')
    .select('id, card_number')
    .eq('primary_lead_id', parsed.data.primary_lead_id)
    .eq('active', true)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id, card_number: existing.card_number, existed: true });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const card_number = generateCardNumber();
    const { data, error } = await supabase
      .from('loyalty_cards')
      .insert({ primary_lead_id: parsed.data.primary_lead_id, card_number, tier: 'basic' })
      .select('id, card_number')
      .single();
    if (!error && data) {
      await supabase
        .from('leads')
        .update({ primary_loyalty_card_id: data.id })
        .eq('id', parsed.data.primary_lead_id);
      return NextResponse.json({ id: data.id, card_number: data.card_number }, { status: 201 });
    }
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'card_number_collision' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');
  const cardNumber = searchParams.get('card_number');
  const tier = searchParams.get('tier');

  const supabase = createClient();
  let query = supabase
    .from('loyalty_cards')
    .select('id, card_number, primary_lead_id, tier, lifetime_visits, lifetime_spend, rolling_24m_spend, lifetime_savings, tier_achieved_at, active, activated_at', { count: 'exact' })
    .order('activated_at', { ascending: false })
    .limit(50);

  if (leadId) query = query.eq('primary_lead_id', leadId);
  if (cardNumber) query = query.eq('card_number', cardNumber);
  if (tier) query = query.eq('tier', tier);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cards: data, total: count ?? 0 });
}

const LoyaltyTxnSchema = z.object({
  loyalty_card_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  txn_type: z.enum(['visit', 'spend', 'savings', 'reward_grant', 'reward_redeem', 'adjustment']),
  amount: z.number().default(0),
  description: z.string().max(500).optional(),
  hmis_reference_id: z.string().max(200).optional(),
});

export async function PUT(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = LoyaltyTxnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createClient();
  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, lifetime_visits, lifetime_spend, rolling_24m_spend, lifetime_savings, tier')
    .eq('id', parsed.data.loyalty_card_id)
    .maybeSingle();
  if (!card) return NextResponse.json({ error: 'card_not_found' }, { status: 404 });

  const { error: txnErr } = await supabase.from('loyalty_transactions').insert({
    loyalty_card_id: parsed.data.loyalty_card_id,
    lead_id: parsed.data.lead_id ?? null,
    txn_type: parsed.data.txn_type,
    amount: parsed.data.amount,
    description: parsed.data.description ?? null,
    hmis_reference_id: parsed.data.hmis_reference_id ?? null,
    created_by: agent.userId,
  });
  if (txnErr) return NextResponse.json({ error: txnErr.message }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (parsed.data.txn_type === 'visit') {
    update.lifetime_visits = card.lifetime_visits + 1;
  } else if (parsed.data.txn_type === 'spend') {
    update.lifetime_spend = Number(card.lifetime_spend) + parsed.data.amount;
    update.rolling_24m_spend = Number(card.rolling_24m_spend) + parsed.data.amount;
  } else if (parsed.data.txn_type === 'savings') {
    update.lifetime_savings = Number(card.lifetime_savings) + parsed.data.amount;
  }

  if ('rolling_24m_spend' in update) {
    const newTier = tierForSpend(update.rolling_24m_spend as number);
    if (newTier !== card.tier) {
      update.tier = newTier;
      update.tier_achieved_at = new Date().toISOString();
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: updErr } = await supabase
      .from('loyalty_cards')
      .update(update)
      .eq('id', parsed.data.loyalty_card_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier: update.tier ?? card.tier });
}
