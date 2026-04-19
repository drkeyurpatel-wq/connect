import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

const UpsertSchema = z.object({
  lead_id: z.string().uuid(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'voice']),
  category: z.enum(['transactional', 'clinical_follow_up', 'marketing', 'reviews', 'loyalty', 'advocate']),
  opted_in: z.boolean(),
  source: z.enum(['agent', 'patient', 'webhook', 'import', 'default']).default('agent'),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  // Transactional messages cannot be opted out of — e.g. discharge summary,
  // appointment confirmations. Guard against accidental opt-out of these.
  if (parsed.data.category === 'transactional' && parsed.data.opted_in === false) {
    return NextResponse.json({ error: 'transactional_opt_out_not_allowed' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('patient_preferences')
    .upsert(
      {
        lead_id: parsed.data.lead_id,
        channel: parsed.data.channel,
        category: parsed.data.category,
        opted_in: parsed.data.opted_in,
        source: parsed.data.source,
        changed_at: new Date().toISOString(),
        changed_by: agent.userId,
      },
      { onConflict: 'lead_id,channel,category' },
    )
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id_required' }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('patient_preferences')
    .select('id, channel, category, opted_in, changed_at, source')
    .eq('lead_id', leadId)
    .order('changed_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ preferences: data });
}
