/**
 * Feature extraction for the v1 lead scoring model.
 *
 * Deliberately simple — a weighted additive scorecard. Spec §4.3 calls v1
 * "rules + heuristics + Claude classifier"; we ship the rules half first and
 * leave hooks for Claude intent classification (see scoring/claude.ts).
 */

export interface LeadRow {
  id: string;
  source_id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  email: string | null;
  chief_complaint: string | null;
  centre_interest_id: string | null;
  specialty_interest_id: string | null;
  created_at: string;
}

export interface SourceRow {
  id: string;
  code: string;
}

export interface WhatsAppRow {
  direction: 'in' | 'out';
  created_at: string;
}

export interface FeatureSet {
  contributions: Record<string, number>;
  sum: number;
}

export function extractFeatures(params: {
  lead: LeadRow;
  source: SourceRow | null;
  whatsappMessages: WhatsAppRow[];
  weights: Record<string, number>;
}): FeatureSet {
  const { lead, source, whatsappMessages, weights } = params;
  const c: Record<string, number> = {};

  if (source) {
    const key = `source.${source.code}`;
    if (weights[key] !== undefined) c[key] = weights[key];
  }

  const priorityKey = `priority.${lead.priority}`;
  if (weights[priorityKey] !== undefined) c[priorityKey] = weights[priorityKey];

  if (lead.email && weights['has_email']) c['has_email'] = weights['has_email'];
  if (lead.chief_complaint && weights['has_complaint']) c['has_complaint'] = weights['has_complaint'];
  if (lead.centre_interest_id && weights['has_centre_interest']) {
    c['has_centre_interest'] = weights['has_centre_interest'];
  }
  if (lead.specialty_interest_id && weights['has_specialty_interest']) {
    c['has_specialty_interest'] = weights['has_specialty_interest'];
  }

  const hasInboundReply = whatsappMessages.some((m) => m.direction === 'in');
  if (hasInboundReply && weights['whatsapp_in_reply']) {
    c['whatsapp_in_reply'] = weights['whatsapp_in_reply'];
  }

  const sum = Object.values(c).reduce((acc, v) => acc + v, 0);
  return { contributions: c, sum };
}

/**
 * Squash the unbounded sum into 0..1 with a logistic. Keep steady-state scores
 * in a useful dynamic range — avoid everything pegged at 0 or 1.
 */
export function toProbability(sum: number, bias = -0.4): number {
  const x = sum + bias;
  const p = 1 / (1 + Math.exp(-3 * x));
  return Math.round(p * 10_000) / 10_000;
}

/**
 * Expected lifetime revenue per specialty (very rough prior, refined later in P6
 * from production data). ₹.
 */
const SPECIALTY_LTV_PRIOR: Record<string, number> = {
  cardiology: 180_000,
  orthopedics: 220_000,
  oncology: 450_000,
  general_medicine: 40_000,
  dermatology: 18_000,
  default: 60_000,
};

export function estimatePltv(p2c: number, specialtyCode: string | null): number {
  const base = (specialtyCode && SPECIALTY_LTV_PRIOR[specialtyCode]) || SPECIALTY_LTV_PRIOR.default;
  return Math.round(base * p2c);
}
