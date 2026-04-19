/**
 * Loyalty card helpers — number generation, tier computation.
 */

export type LoyaltyTier = 'basic' | 'silver' | 'gold' | 'platinum';

export interface TierConfig {
  tier: LoyaltyTier;
  minRolling24mSpend: number;
}

// Mirrors the seeded loyalty_tier_config rows. Server code should prefer the
// DB values but this provides a safe fallback for tests + UI.
export const DEFAULT_TIER_CONFIG: TierConfig[] = [
  { tier: 'basic', minRolling24mSpend: 0 },
  { tier: 'silver', minRolling24mSpend: 50_000 },
  { tier: 'gold', minRolling24mSpend: 200_000 },
  { tier: 'platinum', minRolling24mSpend: 500_000 },
];

export function tierForSpend(spend: number, config: TierConfig[] = DEFAULT_TIER_CONFIG): LoyaltyTier {
  const sorted = [...config].sort((a, b) => b.minRolling24mSpend - a.minRolling24mSpend);
  for (const c of sorted) {
    if (spend >= c.minRolling24mSpend) return c.tier;
  }
  return 'basic';
}

/**
 * Card numbers look like HC-YYYY-NNNNNN. 6 digits gives us ~1M cards/year.
 * Collisions are resolved by the unique index; caller retries if needed.
 */
export function generateCardNumber(year = new Date().getFullYear()): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return `HC-${year}-${n.toString().padStart(6, '0')}`;
}

/**
 * Family card member cap. Spec §8.2: primary + up to 8 members.
 */
export const FAMILY_MEMBER_CAP = 8;
