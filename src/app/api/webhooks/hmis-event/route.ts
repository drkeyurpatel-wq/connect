import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyHmac } from '@/lib/webhook-verify';

/**
 * HMIS → CRM: appointment confirmed, admitted, discharged.
 * Payload shape (from HMIS side, to be finalised):
 * { event: 'appointment_confirmed'|'admitted'|'discharged',
 *   appointmentId, uhid, leadId?, doctorId?, centreId?, at: ISO8601 }
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.HMIS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (!verifyHmac(raw, req.headers.get('x-hmis-signature'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  const svc = createServiceClient();

  const leadId = payload.leadId ?? null;
  if (!leadId) return NextResponse.json({ ok: true, skipped: 'no_lead_id' });

  const apptPatch: Record<string, unknown> = {
    lead_id: leadId,
    hmis_appointment_id: payload.appointmentId,
    hmis_patient_uhid: payload.uhid ?? null,
    appointment_at: payload.appointmentAt ?? payload.at,
    raw_payload: payload,
  };

  if (payload.event === 'admitted') {
    apptPatch.admission_id = payload.admissionId ?? null;
    apptPatch.admitted_at = payload.at;
    apptPatch.status = 'admitted';
  } else if (payload.event === 'discharged') {
    apptPatch.discharged_at = payload.at;
    apptPatch.status = 'discharged';
  } else if (payload.event === 'appointment_confirmed') {
    apptPatch.status = 'confirmed';
  }

  await svc.from('hmis_appointment_sync').upsert(apptPatch, { onConflict: 'hmis_appointment_id' });

  const nextStageCode =
    payload.event === 'admitted' ? 'admitted' :
    payload.event === 'discharged' ? 'converted' :
    payload.event === 'appointment_confirmed' ? 'appointment_booked' :
    null;

  if (nextStageCode) {
    const { data: stage } = await svc.from('lead_stages').select('id').eq('code', nextStageCode).single();
    if (stage) {
      const { data: lead } = await svc.from('leads').select('id, stage_id').eq('id', leadId).maybeSingle();
      if (lead && lead.stage_id !== stage.id) {
        await svc.from('leads').update({ stage_id: stage.id }).eq('id', leadId);
        await svc.from('lead_stage_history').insert({
          lead_id: leadId,
          from_stage_id: lead.stage_id,
          to_stage_id: stage.id,
          reason: `HMIS event: ${payload.event}`,
        });
        await svc.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'hmis_sync',
          content: `HMIS event: ${payload.event}`,
          metadata: payload,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
