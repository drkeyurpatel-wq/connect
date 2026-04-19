import { NextResponse, type NextRequest } from 'next/server';
import { verifyCron } from '@/lib/ai/cron-auth';
import { scanAnomalies } from '@/lib/ai/anomaly/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily 04:00 — spec §3.3 anomaly-scan.
 */
export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const result = await scanAnomalies();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
