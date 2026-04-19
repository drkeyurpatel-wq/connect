import { createServiceClient } from '@/lib/supabase/service';
import type { ChurnRiskBand } from '../types';

/**
 * Daily churn prediction for registered patients. Uses inter-visit expectations
 * per specialty (days) — overridable in specialty metadata in future phases.
 *
 * v1 is a rule-based score. v2 will swap in a supervised model; the row shape
 * stays identical, so downstream UI is stable.
 */
const SPECIALTY_REVISIT_DAYS: Record<string, number> = {
  cardiology: 90,
  orthopedics: 120,
  oncology: 30,
  general_medicine: 180,
  dermatology: 365,
  default: 180,
};

export async function predictChurn(): Promise<{ scored: number; flagged: number }> {
  const svc = createServiceClient();

  const { data: leads } = await svc
    .from('leads')
    .select(
      'id, hmis_patient_uhid, specialty_interest_id, centre_interest_id, updated_at, specialties:specialty_interest_id(code)',
    )
    .not('hmis_patient_uhid', 'is', null)
    .is('deleted_at', null)
    .limit(5000);

  if (!leads || leads.length === 0) return { scored: 0, flagged: 0 };

  const { data: recentAppts } = await svc
    .from('hmis_appointment_sync')
    .select('lead_id, appointment_at')
    .in(
      'lead_id',
      leads.map((l) => l.id),
    )
    .order('appointment_at', { ascending: false });

  const lastApptByLead = new Map<string, string>();
  for (const appt of recentAppts ?? []) {
    if (!lastApptByLead.has(appt.lead_id)) {
      lastApptByLead.set(appt.lead_id, appt.appointment_at);
    }
  }

  const now = Date.now();
  const rows = leads.map((lead) => {
    const specialtyCode =
      (lead as unknown as { specialties?: { code?: string } | null }).specialties?.code ?? null;
    const expected = (specialtyCode && SPECIALTY_REVISIT_DAYS[specialtyCode]) || SPECIALTY_REVISIT_DAYS.default;
    const lastAppt = lastApptByLead.get(lead.id);
    const daysSinceLast = lastAppt
      ? Math.floor((now - new Date(lastAppt).getTime()) / (24 * 3600 * 1000))
      : Math.floor((now - new Date(lead.updated_at).getTime()) / (24 * 3600 * 1000));
    const ratio = daysSinceLast / expected;
    const rawRisk = Math.max(0, Math.min(1, (ratio - 1) / 2));
    const risk = Math.round(rawRisk * 1000) / 1000;
    const band = bandFor(risk);

    const reasons: string[] = [];
    if (ratio >= 2) reasons.push(`no_visit_in_${daysSinceLast}_days`);
    if (!lastAppt) reasons.push('no_appointment_recorded');
    if (ratio >= 1 && ratio < 2) reasons.push('visit_interval_slightly_overdue');

    return {
      lead_id: lead.id,
      hmis_patient_uhid: lead.hmis_patient_uhid,
      risk_score: risk,
      risk_band: band,
      top_reasons: reasons,
      suggested_intervention: suggestIntervention(band, specialtyCode),
      specialty_id: lead.specialty_interest_id,
      computed_at: new Date().toISOString(),
    };
  });

  await svc
    .from('churn_predictions')
    .update({ superseded_at: new Date().toISOString() })
    .is('superseded_at', null)
    .in(
      'lead_id',
      leads.map((l) => l.id),
    );

  const { error } = await svc.from('churn_predictions').insert(rows);
  if (error) throw new Error(`churn_insert_failed: ${error.message}`);

  const flagged = rows.filter((r) => r.risk_band === 'high' || r.risk_band === 'critical').length;
  return { scored: rows.length, flagged };
}

function bandFor(risk: number): ChurnRiskBand {
  if (risk >= 0.75) return 'critical';
  if (risk >= 0.5) return 'high';
  if (risk >= 0.25) return 'medium';
  return 'low';
}

function suggestIntervention(band: ChurnRiskBand, specialty: string | null): string {
  if (band === 'critical') {
    return specialty === 'cardiology' || specialty === 'oncology'
      ? 'Priority clinical outreach call within 24h'
      : 'BD manager outreach call this week';
  }
  if (band === 'high') return 'WhatsApp check-in + book follow-up';
  if (band === 'medium') return 'Include in next journey cadence';
  return 'No action — monitor';
}
