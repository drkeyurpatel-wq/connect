import { NextResponse, type NextRequest } from 'next/server';
import { verifyCron } from '@/lib/ai/cron-auth';
import { runCampaignOptimization } from '@/lib/ai/campaign/optimize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const result = await runCampaignOptimization();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
