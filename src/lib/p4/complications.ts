/**
 * Complication detection — keyword triggers + AI classifier scaffolding.
 *
 * Keywords override AI classification: conservative bias toward escalation.
 * Multilingual coverage for en/hi/gu is mandatory per spec §7.1.
 */

export type ComplicationSeverity = 'normal' | 'minor_concern' | 'major_concern' | 'emergency';

interface KeywordRule {
  pattern: RegExp;
  severity: ComplicationSeverity;
  label: string;
}

const EN_EMERGENCY: KeywordRule[] = [
  { pattern: /\bchest\s*pain\b/i, severity: 'emergency', label: 'chest_pain' },
  { pattern: /\bheavy\s*bleeding\b|\bbleeding\s*a\s*lot\b|\bblood\s*loss\b/i, severity: 'emergency', label: 'heavy_bleeding' },
  { pattern: /\bcan'?t\s*breathe\b|\bshortness\s*of\s*breath\b|\bbreathless\b/i, severity: 'emergency', label: 'breathlessness' },
  { pattern: /\bunconscious\b|\bcollapsed\b|\bfainted\b/i, severity: 'emergency', label: 'collapse' },
  { pattern: /\breadmitted\b|\badmitted\s*again\b|\bemergency\s*room\b|\ber\b/i, severity: 'emergency', label: 'readmitted' },
];

const EN_MAJOR: KeywordRule[] = [
  { pattern: /\bhigh\s*fever\b|fever\s*(10[2-9]|1[1-9]\d)\b/i, severity: 'major_concern', label: 'high_fever' },
  { pattern: /\bsutures?\s*open\b|\bwound\s*open\b|\bstaples?\s*loose\b/i, severity: 'major_concern', label: 'wound_dehiscence' },
  { pattern: /\bvomiting\b|\bthrowing\s*up\b/i, severity: 'major_concern', label: 'vomiting' },
  { pattern: /\binfection\b|\bpus\b|\bfoul\s*smell\b/i, severity: 'major_concern', label: 'infection' },
  { pattern: /\bsevere\s*pain\b|\bunbearable\s*pain\b/i, severity: 'major_concern', label: 'severe_pain' },
];

const EN_MINOR: KeywordRule[] = [
  { pattern: /\bfever\b/i, severity: 'minor_concern', label: 'fever' },
  { pattern: /\bbleeding\b/i, severity: 'minor_concern', label: 'bleeding' },
  { pattern: /\bnausea\b/i, severity: 'minor_concern', label: 'nausea' },
  { pattern: /\bdizzy\b|\bdizziness\b/i, severity: 'minor_concern', label: 'dizziness' },
  { pattern: /\bheadache\b|\bmigraine\b/i, severity: 'minor_concern', label: 'headache' },
  { pattern: /\bdiscomfort\b|\buneasy\b/i, severity: 'minor_concern', label: 'discomfort' },
];

// Hindi (transliterated + devanagari). Flagging conservatively as minor unless
// combined with qualifier.
const HI_RULES: KeywordRule[] = [
  { pattern: /\bbukhar\b|बुखार/i, severity: 'minor_concern', label: 'fever_hi' },
  { pattern: /\btez\s*bukhar\b|तेज\s*बुखार/i, severity: 'major_concern', label: 'high_fever_hi' },
  { pattern: /\bkhoon\b|खून/i, severity: 'minor_concern', label: 'bleeding_hi' },
  { pattern: /\bdard\b|दर्द/i, severity: 'minor_concern', label: 'pain_hi' },
  { pattern: /\btakleef\b|तकलीफ/i, severity: 'minor_concern', label: 'discomfort_hi' },
  { pattern: /\bchest\s*me\s*dard\b|सीने\s*में\s*दर्द/i, severity: 'emergency', label: 'chest_pain_hi' },
];

// Gujarati (transliterated + script).
const GU_RULES: KeywordRule[] = [
  { pattern: /\btav\b|તાવ/i, severity: 'minor_concern', label: 'fever_gu' },
  { pattern: /\blohi\b|લોહી/i, severity: 'minor_concern', label: 'bleeding_gu' },
  { pattern: /\bdukhavo\b|દુખાવો/i, severity: 'minor_concern', label: 'pain_gu' },
  { pattern: /\bchaati\s*ma\s*dukhavo\b|છાતી\s*મા\s*દુખાવો/i, severity: 'emergency', label: 'chest_pain_gu' },
];

const ALL_RULES = [...EN_EMERGENCY, ...EN_MAJOR, ...EN_MINOR, ...HI_RULES, ...GU_RULES];

const SEVERITY_RANK: Record<ComplicationSeverity, number> = {
  normal: 0,
  minor_concern: 1,
  major_concern: 2,
  emergency: 3,
};

export interface KeywordMatchResult {
  severity: ComplicationSeverity;
  matchedLabels: string[];
}

export function scanKeywords(text: string): KeywordMatchResult {
  if (!text) return { severity: 'normal', matchedLabels: [] };
  let top: ComplicationSeverity = 'normal';
  const matched: string[] = [];
  for (const rule of ALL_RULES) {
    if (rule.pattern.test(text)) {
      matched.push(rule.label);
      if (SEVERITY_RANK[rule.severity] > SEVERITY_RANK[top]) top = rule.severity;
    }
  }
  return { severity: top, matchedLabels: matched };
}

export function slaSecondsFor(severity: ComplicationSeverity): number {
  switch (severity) {
    case 'emergency': return 15 * 60;
    case 'major_concern': return 4 * 60 * 60;
    case 'minor_concern': return 24 * 60 * 60;
    case 'normal': return 0;
  }
}

/**
 * Merge keyword result with AI classifier output.
 * Conservative: return the MORE severe of the two.
 */
export function mergeSeverity(
  keyword: ComplicationSeverity,
  ai: ComplicationSeverity | null,
): ComplicationSeverity {
  if (ai === null) return keyword;
  return SEVERITY_RANK[keyword] >= SEVERITY_RANK[ai] ? keyword : ai;
}
