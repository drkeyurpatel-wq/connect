/**
 * Advocate referral program helpers.
 *
 * Compliance: §9.3 — rewards must be non-monetary, value-capped at ₹500.
 * No cash commissions to patient-advocates for healthcare referrals (India).
 */

import crypto from 'node:crypto';

export const REWARD_CAP_INR = 500;

export interface RewardOption {
  code: string;
  description: string;
  materialValueInr: number;
}

export const PERMITTED_REWARDS: RewardOption[] = [
  { code: 'free_checkup_basic', description: 'Free basic health checkup', materialValueInr: 499 },
  { code: 'priority_booking_1y', description: '1 year priority appointment booking', materialValueInr: 0 },
  { code: 'free_diet_consult', description: 'Free 30-min diet / lifestyle consult', materialValueInr: 300 },
  { code: 'wellness_session', description: 'Free group wellness education session', materialValueInr: 0 },
  { code: 'gift_health_kit', description: 'Health1-branded wellness kit', materialValueInr: 450 },
];

export function validateReward(opt: { materialValueInr: number; isCash?: boolean }): void {
  if (opt.isCash) {
    throw new Error('advocate_reward_cash_prohibited');
  }
  if (opt.materialValueInr > REWARD_CAP_INR) {
    throw new Error(`advocate_reward_exceeds_cap_${REWARD_CAP_INR}`);
  }
}

/**
 * Advocate referral code — URL-safe, 8 chars, ~47 bits entropy. Collision is
 * extremely unlikely before the unique index would catch it.
 */
export function generateReferralCode(): string {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
}
