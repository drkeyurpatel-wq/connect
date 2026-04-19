import { NextResponse, type NextRequest } from 'next/server';
import { verifyCron } from '@/lib/ai/cron-auth';
import { pickLeadsNeedingScore, scoreLeads } from '@/lib/ai/scoring/compute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every 15 min: score new + stale leads. See P5 §3.3 lead-score-compute.
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const leadIds = await pickLeadsNeedingScore(200);
    const scored = await scoreLeads(leadIds);
    return NextResponse.json({ ok: true, scored });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
