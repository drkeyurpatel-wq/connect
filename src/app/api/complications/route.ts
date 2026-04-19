import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { mergeSeverity, scanKeywords, slaSecondsFor } from '@/lib/p4/complications';

const CreateFlagSchema = z.object({
  lead_id: z.string().uuid(),
  symptom_text: z.string().min(1),
  source: z.enum(['keyword', 'ai_classifier', 'agent', 'patient_self_report']).default('agent'),
  ai_label: z.enum(['normal', 'minor_concern', 'major_concern', 'emergency']).optional(),
  ai_confidence: z.number().min(0).max(1).optional(),
  ai_model: z.string().optional(),
  discharge_event_id: z.string().uuid().optional(),
  enrolment_id: z.string().uuid().optional(),
  whatsapp_message_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateFlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const keyword = scanKeywords(parsed.data.symptom_text);
  const aiSeverity = parsed.data.ai_label ?? null;
  const severity = mergeSeverity(keyword.severity, aiSeverity);

  if (severity === 'normal') {
    return NextResponse.json({ severity, flagged: false });
  }

  const supabase = createClient();
  const now = new Date();
  const slaSecs = slaSecondsFor(severity);
  const targetAt = new Date(now.getTime() + slaSecs * 1000);

  const { data: flag, error } = await supabase
    .from('complication_flags')
    .insert({
      lead_id: parsed.data.lead_id,
      discharge_event_id: parsed.data.discharge_event_id ?? null,
      enrolment_id: parsed.data.enrolment_id ?? null,
      source: parsed.data.source,
      severity,
      symptom_text: parsed.data.symptom_text,
      keywords_matched: keyword.matchedLabels,
      classifier_label: aiSeverity,
      classifier_confidence: parsed.data.ai_confidence ?? null,
      classifier_model: parsed.data.ai_model ?? null,
      whatsapp_message_id: parsed.data.whatsapp_message_id ?? null,
    })
    .select('id, severity, status, flagged_at')
    .single();

  if (error || !flag) return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });

  const { error: slaErr } = await supabase.from('clinical_escalation_sla').insert({
    complication_flag_id: flag.id,
    severity,
    target_secs: slaSecs,
    started_at: now.toISOString(),
    target_at: targetAt.toISOString(),
  });
  if (slaErr) return NextResponse.json({ error: slaErr.message }, { status: 500 });

  return NextResponse.json({ flagged: true, ...flag, target_at: targetAt.toISOString() }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');
  const leadId = searchParams.get('lead_id');
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

  const supabase = createClient();
  let query = supabase
    .from('complication_flags')
    .select('id, lead_id, severity, status, source, symptom_text, keywords_matched, flagged_at, assigned_doctor_id, assigned_agent_id, first_contact_at, resolved_at, outcome', { count: 'exact' })
    .order('flagged_at', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);
  if (leadId) query = query.eq('lead_id', leadId);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ flags: data, total: count ?? 0 });
}
