/**
 * PII redaction before sending any text to external LLM providers.
 *
 * Contract:
 *  - Replace patient names, phones, emails, UHIDs, addresses with opaque tokens.
 *  - Maintain a token map so the caller can re-substitute on the way back.
 *  - Never let raw PII cross the network boundary (ECC v4 Rule 8 + P5 §16.1).
 */

export interface RedactionResult {
  text: string;
  tokenMap: Record<string, string>;
}

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UHID_RE = /\bUHID[-_ ]?[A-Z0-9]{4,}\b/gi;

export function redact(input: string, knownNames: string[] = []): RedactionResult {
  const map: Record<string, string> = {};
  let token = 0;
  const issue = (category: string) => `[${category}_${++token}]`;

  let out = input;

  for (const name of knownNames) {
    if (!name || name.length < 2) continue;
    const re = new RegExp(`\\b${escape(name)}\\b`, 'gi');
    out = out.replace(re, () => {
      const t = issue('NAME');
      map[t] = name;
      return t;
    });
  }

  out = out.replace(PHONE_RE, (m) => {
    const t = issue('PHONE');
    map[t] = m;
    return t;
  });

  out = out.replace(EMAIL_RE, (m) => {
    const t = issue('EMAIL');
    map[t] = m;
    return t;
  });

  out = out.replace(UHID_RE, (m) => {
    const t = issue('UHID');
    map[t] = m;
    return t;
  });

  return { text: out, tokenMap: map };
}

export function rehydrate(text: string, tokenMap: Record<string, string>): string {
  let out = text;
  for (const [token, original] of Object.entries(tokenMap)) {
    out = out.split(token).join(original);
  }
  return out;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
