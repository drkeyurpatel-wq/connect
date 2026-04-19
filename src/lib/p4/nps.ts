/**
 * NPS helpers — category derivation, rollup computation, feedback parsing.
 */

export type NpsCategory = 'detractor' | 'passive' | 'promoter';

export function npsCategory(score: number): NpsCategory {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

/**
 * Standard NPS computation: %promoters − %detractors, scaled to -100..100.
 */
export function npsScore(counts: { promoters: number; passives: number; detractors: number }): number | null {
  const total = counts.promoters + counts.passives + counts.detractors;
  if (total === 0) return null;
  return ((counts.promoters - counts.detractors) / total) * 100;
}

/**
 * Parse a WhatsApp reply like "8", "8/10", or "I'd rate 9 out of 10" into a
 * 0–10 score. Returns null if no unambiguous score is found.
 */
export function parseScoreFromReply(text: string): number | null {
  if (!text) return null;
  const cleaned = text.trim().toLowerCase();
  // Look for explicit 0-10 patterns first
  const slashMatch = cleaned.match(/\b(10|[0-9])\s*\/\s*10\b/);
  if (slashMatch) return parseInt(slashMatch[1], 10);
  const outOfMatch = cleaned.match(/\b(10|[0-9])\s*(out of|of)\s*10\b/);
  if (outOfMatch) return parseInt(outOfMatch[1], 10);
  // Look for standalone 0-10 — but only if the message is short (to avoid false positives)
  if (cleaned.length <= 3) {
    const standalone = cleaned.match(/^(10|[0-9])$/);
    if (standalone) return parseInt(standalone[1], 10);
  }
  // Look for "rating X" or "rate X"
  const rateMatch = cleaned.match(/\brat[ei]d?\s*(it|us)?\s*(10|[0-9])\b/);
  if (rateMatch) return parseInt(rateMatch[2], 10);
  return null;
}

export interface TopicExtraction {
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

const NEGATIVE_TOPIC_KEYWORDS: Record<string, RegExp> = {
  wait_time: /\b(wait|waiting|delay|slow|queue|long time)\b/i,
  billing: /\b(bill|billing|charge|expensive|overpriced|cost|refund)\b/i,
  food: /\b(food|meal|diet|tasteless)\b/i,
  staff_attitude: /\b(rude|staff|behav|attitude|unfriendly|impolite)\b/i,
  cleanliness: /\b(dirty|unclean|hygiene|smell|filthy)\b/i,
  communication: /\b(no information|didn.?t explain|unclear|confusing|no response)\b/i,
  clinical: /\b(pain|infection|complication|problem|side effect|worsened)\b/i,
};

const POSITIVE_KEYWORDS = /\b(great|excellent|amazing|wonderful|grateful|thank|satisfied|caring|good|smooth|comfortable)\b/i;
const NEGATIVE_KEYWORDS = /\b(bad|poor|terrible|worst|disappointed|unhappy|awful|horrible|waste)\b/i;

/**
 * Heuristic fallback when Claude classification is unavailable. The real
 * classifier replaces this. Keep simple + fast.
 */
export function heuristicTopicExtraction(text: string): TopicExtraction {
  if (!text) return { topics: [], sentiment: 'neutral' };
  const topics: string[] = [];
  for (const [topic, pattern] of Object.entries(NEGATIVE_TOPIC_KEYWORDS)) {
    if (pattern.test(text)) topics.push(topic);
  }
  const pos = POSITIVE_KEYWORDS.test(text);
  const neg = NEGATIVE_KEYWORDS.test(text);
  let sentiment: TopicExtraction['sentiment'] = 'neutral';
  if (pos && neg) sentiment = 'mixed';
  else if (pos) sentiment = 'positive';
  else if (neg || topics.length > 0) sentiment = 'negative';
  return { topics, sentiment };
}
