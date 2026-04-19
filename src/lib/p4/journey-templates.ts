/**
 * Post-discharge journey templates — default + specialty overlays.
 *
 * Journey steps are offsets in days from discharge. The journey engine (P2)
 * wakes up every 5 min (discharge-journey-trigger cron) and enqueues the
 * next step when now() >= enrolled_at + step.offsetDays.
 */

export type JourneyStepKind =
  | 'welcome'
  | 'checkin'
  | 'nps'
  | 'followup_offer'
  | 'review_ask'
  | 'advocate_ask'
  | 'annual_reminder'
  | 'specialty_reminder';

export interface JourneyStep {
  code: string;
  offsetDays: number;
  offsetHours?: number;
  kind: JourneyStepKind;
  templateName: string;
  quietHours?: boolean;
}

export interface JourneyTemplate {
  code: string;
  name: string;
  appliesTo: 'default' | 'cardiac' | 'ortho' | 'oncology';
  steps: JourneyStep[];
}

export const DEFAULT_JOURNEY: JourneyTemplate = {
  code: 'pd_default_v1',
  name: 'Post-discharge default (non-surgical)',
  appliesTo: 'default',
  steps: [
    { code: 'day0_welcome', offsetDays: 0, offsetHours: 1, kind: 'welcome', templateName: 'pd_welcome_home' },
    { code: 'day2_checkin', offsetDays: 2, kind: 'checkin', templateName: 'pd_day2_wellness', quietHours: true },
    { code: 'day7_followup', offsetDays: 7, kind: 'followup_offer', templateName: 'pd_day7_followup', quietHours: true },
    { code: 'day7_review_ask', offsetDays: 7, kind: 'review_ask', templateName: 'pd_review_ask', quietHours: true },
    { code: 'day14_nps', offsetDays: 14, kind: 'nps', templateName: 'pd_nps_invite', quietHours: true },
    { code: 'day16_advocate', offsetDays: 16, kind: 'advocate_ask', templateName: 'pd_advocate_ask', quietHours: true },
    { code: 'day30_followup', offsetDays: 30, kind: 'followup_offer', templateName: 'pd_day30_followup', quietHours: true },
    { code: 'day90_checkin', offsetDays: 90, kind: 'checkin', templateName: 'pd_day90_checkin', quietHours: true },
    { code: 'day365_reminder', offsetDays: 365, kind: 'annual_reminder', templateName: 'pd_annual_reminder', quietHours: true },
  ],
};

export const CARDIAC_OVERLAY: JourneyStep[] = [
  { code: 'cardiac_day5_echo', offsetDays: 5, kind: 'specialty_reminder', templateName: 'pd_cardiac_day5_echo', quietHours: true },
  { code: 'cardiac_day10_suture', offsetDays: 10, kind: 'specialty_reminder', templateName: 'pd_cardiac_day10_suture', quietHours: true },
  { code: 'cardiac_day30_echo', offsetDays: 30, kind: 'specialty_reminder', templateName: 'pd_cardiac_day30_echo', quietHours: true },
  { code: 'cardiac_day45_rehab', offsetDays: 45, kind: 'specialty_reminder', templateName: 'pd_cardiac_day45_rehab', quietHours: true },
  { code: 'cardiac_day90_opd', offsetDays: 90, kind: 'specialty_reminder', templateName: 'pd_cardiac_day90_opd', quietHours: true },
];

export const ORTHO_OVERLAY: JourneyStep[] = [
  { code: 'ortho_day3_physio', offsetDays: 3, kind: 'specialty_reminder', templateName: 'pd_ortho_day3_physio', quietHours: true },
  { code: 'ortho_day14_xray', offsetDays: 14, kind: 'specialty_reminder', templateName: 'pd_ortho_day14_xray', quietHours: true },
  { code: 'ortho_day45_opd', offsetDays: 45, kind: 'specialty_reminder', templateName: 'pd_ortho_day45_opd', quietHours: true },
  { code: 'ortho_day90_functional', offsetDays: 90, kind: 'specialty_reminder', templateName: 'pd_ortho_day90_functional', quietHours: true },
];

export const ONCOLOGY_OVERLAY: JourneyStep[] = [
  { code: 'onc_day7_gentle', offsetDays: 7, kind: 'checkin', templateName: 'pd_onc_day7_gentle', quietHours: true },
  { code: 'onc_cycle_reminder', offsetDays: 21, kind: 'specialty_reminder', templateName: 'pd_onc_cycle_reminder', quietHours: true },
];

const CARDIAC_SPECIALTIES = new Set(['cardiology', 'cardiac_surgery', 'cts', 'cvts']);
const CARDIAC_PROCEDURES = ['cabg', 'valve', 'angioplasty', 'pci', 'stent', 'bypass'];
const ORTHO_SPECIALTIES = new Set(['orthopedics', 'orthopaedics', 'ortho', 'joint_replacement', 'spine']);
const ORTHO_PROCEDURES = ['tkr', 'thr', 'acl', 'knee replacement', 'hip replacement', 'spine', 'discectomy'];
const ONC_SPECIALTIES = new Set(['oncology', 'medical_oncology', 'surgical_oncology', 'radiation_oncology', 'haemato_oncology']);

export function pickJourneyTemplate(input: {
  specialtyCode?: string | null;
  procedures?: string[] | null;
  dischargeType: string;
}): { template: string; overlay: string | null; steps: JourneyStep[] } | null {
  if (input.dischargeType === 'expired') return null;

  const specialty = (input.specialtyCode || '').toLowerCase();
  const procedures = (input.procedures || []).map((p) => p.toLowerCase());

  let overlay: string | null = null;
  let overlaySteps: JourneyStep[] = [];

  if (ONC_SPECIALTIES.has(specialty)) {
    overlay = 'oncology';
    overlaySteps = ONCOLOGY_OVERLAY;
  } else if (
    CARDIAC_SPECIALTIES.has(specialty) ||
    procedures.some((p) => CARDIAC_PROCEDURES.some((cp) => p.includes(cp)))
  ) {
    overlay = 'cardiac';
    overlaySteps = CARDIAC_OVERLAY;
  } else if (
    ORTHO_SPECIALTIES.has(specialty) ||
    procedures.some((p) => ORTHO_PROCEDURES.some((op) => p.includes(op)))
  ) {
    overlay = 'ortho';
    overlaySteps = ORTHO_OVERLAY;
  }

  const merged = [...DEFAULT_JOURNEY.steps, ...overlaySteps].sort((a, b) => {
    const aKey = a.offsetDays * 24 + (a.offsetHours ?? 0);
    const bKey = b.offsetDays * 24 + (b.offsetHours ?? 0);
    return aKey - bKey;
  });

  return {
    template: DEFAULT_JOURNEY.code,
    overlay,
    steps: merged,
  };
}
