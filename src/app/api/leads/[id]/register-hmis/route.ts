import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAgent } from '@/lib/auth';

/**
 * Trigger HMIS patient creation for a lead. Idempotency key = lead UUID.
 * Spec §9 risk #1: HMIS-side `/api/patients/create-from-crm` must dedupe on phone+DOB.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, alt_phone, email, dob, gender, address, pincode, centre_interest_id, hmis_patient_uhid')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (lead.hmis_patient_uhid) {
    return NextResponse.json({ ok: true, uhid: lead.hmis_patient_uhid, note: 'already_registered' });
  }

  const base = process.env.HMIS_API_BASE_URL;
  const key = process.env.HMIS_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ error: 'hmis_not_configured' }, { status: 503 });
  }

  const svc = createServiceClient();
  const { data: syncRow } = await svc
    .from('hmis_patient_sync')
    .insert({ lead_id: lead.id, idempotency_key: lead.id, status: 'pending' })
    .select('id')
    .single();

  const res = await fetch(`${base.replace(/\/$/, '')}/api/patients/create-from-crm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': lead.id,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(lead),
  });

  const payload = await res.json().catch(() => ({}));

  if (syncRow) {
    await svc.from('hmis_patient_sync').update({
      status: res.ok ? 'success' : 'failed',
      hmis_patient_uhid: payload?.uhid ?? null,
      response_payload: payload,
      error_message: res.ok ? null : (payload?.error ?? `HTTP ${res.status}`),
      attempt_count: 1,
      last_attempted_at: new Date().toISOString(),
      synced_at: res.ok ? new Date().toISOString() : null,
    }).eq('id', syncRow.id);
  }

  if (res.ok && payload?.uhid) {
    await svc.from('leads').update({
      hmis_patient_uhid: payload.uhid,
      hmis_registered_at: new Date().toISOString(),
      updated_by: agent.userId,
    }).eq('id', lead.id);

    await svc.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'hmis_sync',
      content: `HMIS UHID ${payload.uhid}`,
      metadata: { uhid: payload.uhid },
      created_by: agent.userId,
    });
  }

  if (!res.ok) return NextResponse.json({ error: 'hmis_failed', payload }, { status: 502 });
  return NextResponse.json({ ok: true, uhid: payload.uhid });
}
