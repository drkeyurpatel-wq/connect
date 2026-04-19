import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyHmac } from '@/lib/webhook-verify';
import { pickJourneyTemplate } from '@/lib/p4/journey-templates';

/**
 * HMIS → CRM webhook: appointment_confirmed, admitted, discharged.
 *
 * P4 adds full discharge event processing. Discharge payload (spec §4.1):
 *   {
 *     event_type: 'discharged',
 *     uhid, hmis_admission_id, hmis_patient_id,
 *     centre_code, admission_date, discharge_date, length_of_stay_days,
 *     primary_doctor_hmis_id, primary_specialty_code,
 *     follow_up_doctor_hmis_id,
 *     procedures: [...], diagnoses_icd10: [...],
 *     discharge_type, discharge_summary_url,
 *     patient_phone, patient_name, patient_language
 *   }
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.HMIS_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (!verifyHmac(raw, req.headers.get('x-hmis-signature'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const svc = createServiceClient();
  const eventType = (payload.event_type ?? payload.event) as string | undefined;

  if (eventType === 'discharged') {
    return handleDischarge(svc, payload);
  }

  return handleAppointmentEvent(svc, payload, eventType);
}

async function handleAppointmentEvent(
  svc: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
  eventType: string | undefined,
) {
  const leadId = (payload.leadId ?? payload.lead_id ?? null) as string | null;
  if (!leadId) return NextResponse.json({ ok: true, skipped: 'no_lead_id' });

  const apptPatch: Record<string, unknown> = {
    lead_id: leadId,
    hmis_appointment_id: payload.appointmentId ?? payload.hmis_appointment_id,
    hmis_patient_uhid: payload.uhid ?? null,
    appointment_at: payload.appointmentAt ?? payload.at,
    raw_payload: payload,
  };

  if (eventType === 'admitted') {
    apptPatch.admission_id = payload.admissionId ?? null;
    apptPatch.admitted_at = payload.at;
    apptPatch.status = 'admitted';
  } else if (eventType === 'appointment_confirmed') {
    apptPatch.status = 'confirmed';
  }

  await svc.from('hmis_appointment_sync').upsert(apptPatch, { onConflict: 'hmis_appointment_id' });

  const nextStageCode =
    eventType === 'admitted' ? 'admitted' :
    eventType === 'appointment_confirmed' ? 'appointment_booked' :
    null;

  if (nextStageCode) {
    await applyStageTransition(svc, leadId, nextStageCode, `HMIS event: ${eventType}`, payload);
  }

  return NextResponse.json({ ok: true });
}

async function handleDischarge(
  svc: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>,
) {
  const uhid = payload.uhid as string | undefined;
  const centreCode = payload.centre_code as string | undefined;
  const dischargeDate = payload.discharge_date as string | undefined;
  const dischargeType = (payload.discharge_type as string | undefined) ?? 'recovered';

  if (!uhid || !dischargeDate) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 });
  }

  const { data: centre } = centreCode
    ? await svc.from('centres').select('id').eq('code', centreCode).maybeSingle()
    : { data: null as { id: string } | null };

  const { data: specialty } = payload.primary_specialty_code
    ? await svc
        .from('specialties')
        .select('id')
        .eq('code', payload.primary_specialty_code as string)
        .maybeSingle()
    : { data: null as { id: string } | null };

  const { data: primaryDoctor } = payload.primary_doctor_hmis_id
    ? await svc
        .from('doctors')
        .select('id')
        .eq('hmis_doctor_id', payload.primary_doctor_hmis_id as string)
        .maybeSingle()
    : { data: null as { id: string } | null };

  const { data: followUpDoctor } = payload.follow_up_doctor_hmis_id
    ? await svc
        .from('doctors')
        .select('id')
        .eq('hmis_doctor_id', payload.follow_up_doctor_hmis_id as string)
        .maybeSingle()
    : { data: null as { id: string } | null };

  // Match lead by uhid or phone, else create a patient-only lead.
  const phone = (payload.patient_phone as string | undefined) ?? null;
  let { data: lead } = await svc
    .from('leads')
    .select('id, stage_id, is_patient, language_pref')
    .eq('hmis_patient_uhid', uhid)
    .maybeSingle();

  if (!lead && phone) {
    const { data: byPhone } = await svc
      .from('leads')
      .select('id, stage_id, is_patient, language_pref')
      .eq('phone', phone)
      .is('deleted_at', null)
      .maybeSingle();
    lead = byPhone;
  }

  if (!lead) {
    const [firstName, ...rest] = ((payload.patient_name as string | undefined) ?? 'Patient').split(' ');
    const { data: source } = await svc.from('lead_sources').select('id').eq('code', 'other').maybeSingle();
    const { data: stage } = await svc.from('lead_stages').select('id').eq('code', 'admitted').maybeSingle();
    if (!source || !stage) {
      return NextResponse.json({ error: 'seed_missing' }, { status: 500 });
    }
    const { data: inserted, error: insErr } = await svc
      .from('leads')
      .insert({
        first_name: firstName || 'Patient',
        last_name: rest.join(' ') || null,
        phone: phone ?? 'unknown',
        source_id: source.id,
        stage_id: stage.id,
        centre_interest_id: centre?.id ?? null,
        specialty_interest_id: specialty?.id ?? null,
        doctor_interest_id: primaryDoctor?.id ?? null,
        hmis_patient_uhid: uhid,
        hmis_registered_at: new Date().toISOString(),
        is_patient: true,
        language_pref: (payload.patient_language as string | undefined) ?? null,
      })
      .select('id, stage_id, is_patient, language_pref')
      .single();
    if (insErr || !inserted) {
      return NextResponse.json({ error: 'lead_create_failed', detail: insErr?.message }, { status: 500 });
    }
    lead = inserted;
  } else if (!lead.is_patient) {
    await svc
      .from('leads')
      .update({
        is_patient: true,
        hmis_patient_uhid: uhid,
        language_pref: lead.language_pref ?? ((payload.patient_language as string | undefined) ?? null),
      })
      .eq('id', lead.id);
  }

  const { data: dischargeRow, error: dischErr } = await svc
    .from('discharge_events')
    .upsert(
      {
        lead_id: lead.id,
        uhid,
        hmis_admission_id: payload.hmis_admission_id ?? null,
        hmis_patient_id: payload.hmis_patient_id ?? null,
        centre_id: centre?.id ?? null,
        centre_code: centreCode ?? null,
        admission_date: payload.admission_date ?? null,
        discharge_date: dischargeDate,
        length_of_stay_days: payload.length_of_stay_days ?? null,
        primary_doctor_id: primaryDoctor?.id ?? null,
        primary_doctor_hmis_id: payload.primary_doctor_hmis_id ?? null,
        follow_up_doctor_id: followUpDoctor?.id ?? null,
        follow_up_doctor_hmis_id: payload.follow_up_doctor_hmis_id ?? null,
        primary_specialty_id: specialty?.id ?? null,
        primary_specialty_code: payload.primary_specialty_code ?? null,
        procedures: payload.procedures ?? [],
        diagnoses_icd10: payload.diagnoses_icd10 ?? [],
        discharge_type: dischargeType,
        discharge_summary_url: payload.discharge_summary_url ?? null,
        patient_name: payload.patient_name ?? null,
        patient_phone: phone,
        patient_language: payload.patient_language ?? null,
        raw_payload: payload,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'centre_code,hmis_admission_id', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (dischErr) {
    return NextResponse.json({ error: 'discharge_upsert_failed', detail: dischErr.message }, { status: 500 });
  }

  // Move lead stage → converted / admitted (discharged).
  await applyStageTransition(svc, lead.id, 'converted', 'HMIS discharge', payload);

  // Expired discharges → no journey enrolment; log activity + condolence workflow elsewhere.
  if (dischargeType === 'expired') {
    await svc
      .from('discharge_events')
      .update({ skipped_reason: 'expired_discharge_bereavement_branch' })
      .eq('id', dischargeRow.id);
    await svc.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'system',
      content: 'Post-discharge journey skipped: discharge_type=expired (bereavement branch)',
      metadata: { discharge_event_id: dischargeRow.id },
    });
    return NextResponse.json({ ok: true, enrolled: false, reason: 'expired' });
  }

  const template = pickJourneyTemplate({
    specialtyCode: (payload.primary_specialty_code as string | undefined) ?? null,
    procedures: (payload.procedures as string[] | undefined) ?? null,
    dischargeType,
  });

  if (!template) {
    await svc
      .from('discharge_events')
      .update({ skipped_reason: 'no_template_matched' })
      .eq('id', dischargeRow.id);
    return NextResponse.json({ ok: true, enrolled: false, reason: 'no_template' });
  }

  const firstStep = template.steps[0];
  const nextStepAt = new Date(
    new Date(dischargeDate).getTime() +
      firstStep.offsetDays * 86_400_000 +
      (firstStep.offsetHours ?? 0) * 3_600_000,
  );

  const { error: enrolErr } = await svc.from('post_discharge_enrolments').upsert(
    {
      lead_id: lead.id,
      discharge_event_id: dischargeRow.id,
      journey_template_code: template.template,
      specialty_overlay: template.overlay,
      next_step_at: nextStepAt.toISOString(),
      current_step_code: firstStep.code,
    },
    { onConflict: 'discharge_event_id' },
  );

  if (enrolErr) {
    return NextResponse.json({ error: 'enrolment_failed', detail: enrolErr.message }, { status: 500 });
  }

  await svc.from('lead_activities').insert({
    lead_id: lead.id,
    activity_type: 'system',
    content: `Enrolled in post-discharge journey: ${template.template}${template.overlay ? ` + ${template.overlay} overlay` : ''}`,
    metadata: {
      discharge_event_id: dischargeRow.id,
      template: template.template,
      overlay: template.overlay,
      step_count: template.steps.length,
    },
  });

  return NextResponse.json({
    ok: true,
    enrolled: true,
    discharge_event_id: dischargeRow.id,
    template: template.template,
    overlay: template.overlay,
    steps: template.steps.length,
  });
}

async function applyStageTransition(
  svc: ReturnType<typeof createServiceClient>,
  leadId: string,
  targetStageCode: string,
  reason: string,
  payload: Record<string, unknown>,
) {
  const { data: stage } = await svc.from('lead_stages').select('id').eq('code', targetStageCode).maybeSingle();
  if (!stage) return;
  const { data: lead } = await svc.from('leads').select('id, stage_id').eq('id', leadId).maybeSingle();
  if (!lead || lead.stage_id === stage.id) return;
  await svc.from('leads').update({ stage_id: stage.id }).eq('id', leadId);
  await svc.from('lead_stage_history').insert({
    lead_id: leadId,
    from_stage_id: lead.stage_id,
    to_stage_id: stage.id,
    reason,
  });
  await svc.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: 'hmis_sync',
    content: reason,
    metadata: payload,
  });
}
