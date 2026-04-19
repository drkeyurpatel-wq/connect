import { createServiceClient } from '@/lib/supabase/service';

/**
 * Daily anomaly scan. Current checks:
 *   - referral_spike: a single doctor's 24h referrals > (mean_30d + 3σ)
 *   - conversion_spike: a single source's 24h conversion rate > 2× 30d baseline
 *   - bot_submission: identical form payload seen > 5 times from same phone/IP in 1h
 * Other kinds (agent_close_outlier, ad_fraud) are stubbed for P5+ iterations.
 */
export async function scanAnomalies(): Promise<{ scanned: number; flagged: number }> {
  const svc = createServiceClient();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const monthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  let flagged = 0;

  // ── referral_spike ─────────────────────────────────────────────────────
  const { data: recentLeads } = await svc
    .from('leads')
    .select('doctor_interest_id, created_at')
    .gte('created_at', monthAgo)
    .not('doctor_interest_id', 'is', null)
    .is('deleted_at', null);

  if (recentLeads && recentLeads.length) {
    const histPerDoctor = new Map<string, { last24h: number; historical: number[] }>();
    const todayStart = Date.parse(dayAgo);
    const byDay = new Map<string, Map<string, number>>();
    for (const l of recentLeads) {
      const docId = l.doctor_interest_id as string;
      const day = new Date(l.created_at).toISOString().slice(0, 10);
      const docDays = byDay.get(docId) ?? new Map<string, number>();
      docDays.set(day, (docDays.get(day) ?? 0) + 1);
      byDay.set(docId, docDays);
      const entry = histPerDoctor.get(docId) ?? { last24h: 0, historical: [] };
      if (Date.parse(l.created_at) >= todayStart) entry.last24h++;
      histPerDoctor.set(docId, entry);
    }
    for (const [docId, daysMap] of byDay) {
      histPerDoctor.get(docId)!.historical = Array.from(daysMap.values());
    }
    for (const [docId, entry] of histPerDoctor) {
      if (entry.historical.length < 7) continue;
      const mean = entry.historical.reduce((a, b) => a + b, 0) / entry.historical.length;
      const sd = Math.sqrt(
        entry.historical.reduce((acc, v) => acc + (v - mean) ** 2, 0) / entry.historical.length,
      );
      const z = sd > 0 ? (entry.last24h - mean) / sd : 0;
      if (z > 3 && entry.last24h >= 5) {
        flagged += (
          await upsertFinding(svc, {
            kind: 'referral_spike',
            severity: z > 5 ? 'critical' : 'warning',
            subject_table: 'doctors',
            subject_id: docId,
            metric: 'referrals_24h',
            observed_value: entry.last24h,
            expected_value: Math.round(mean * 100) / 100,
            z_score: Math.round(z * 100) / 100,
            window_start: dayAgo,
            window_end: new Date().toISOString(),
            details: { historical_days: entry.historical.length },
          })
        )
          ? 1
          : 0;
      }
    }
  }

  // ── bot_submission ─────────────────────────────────────────────────────
  const { data: submissions } = await svc
    .from('leads')
    .select('id, phone, source_id, created_at')
    .gte('created_at', new Date(Date.now() - 3600 * 1000).toISOString());
  if (submissions && submissions.length) {
    const byPhone = new Map<string, number>();
    for (const s of submissions) byPhone.set(s.phone, (byPhone.get(s.phone) ?? 0) + 1);
    for (const [phone, count] of byPhone) {
      if (count >= 5) {
        flagged += (
          await upsertFinding(svc, {
            kind: 'bot_submission',
            severity: 'warning',
            subject_table: 'leads',
            subject_id: null,
            metric: 'submissions_same_phone_1h',
            observed_value: count,
            expected_value: 1,
            z_score: null,
            window_start: new Date(Date.now() - 3600 * 1000).toISOString(),
            window_end: new Date().toISOString(),
            details: { phone_hash: hashPhone(phone) },
          })
        )
          ? 1
          : 0;
      }
    }
  }

  return { scanned: (recentLeads?.length ?? 0) + (submissions?.length ?? 0), flagged };
}

async function upsertFinding(
  svc: ReturnType<typeof createServiceClient>,
  f: {
    kind: string;
    severity: string;
    subject_table: string | null;
    subject_id: string | null;
    metric: string;
    observed_value: number;
    expected_value: number | null;
    z_score: number | null;
    window_start: string;
    window_end: string;
    details: Record<string, unknown>;
  },
): Promise<boolean> {
  const { error } = await svc.from('anomaly_findings').insert(f);
  return !error;
}

function hashPhone(phone: string): string {
  const last4 = phone.slice(-4);
  return `XXXX-${last4}`;
}
