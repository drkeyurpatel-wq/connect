import { NextResponse, type NextRequest } from 'next/server';
import { verifyCron } from '@/lib/ai/cron-auth';
import {
  generateRecommendationForLead,
  pickLeadsNeedingRecommendation,
} from '@/lib/ai/recommender/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Every 30 min: refresh agent recommendations. Per spec §3.3 best-action-refresh.
 * Cap the batch size to stay within the 60s cron window and per-cron budget.
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const leadIds = await pickLeadsNeedingRecommendation(25);
  const results = await Promise.allSettled(leadIds.map((id) => generateRecommendationForLead(id)));
  const ok = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  const failed = results.length - ok;
  return NextResponse.json({ ok: true, requested: leadIds.length, succeeded: ok, failed });
}
