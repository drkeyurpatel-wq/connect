import { NextResponse, type NextRequest } from 'next/server';
import { verifyCron } from '@/lib/ai/cron-auth';
import { predictChurn } from '@/lib/ai/churn/predict';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Daily 03:00 — see spec §3.3 churn-predict-daily.
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const result = await predictChurn();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
