import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';
import { npsScore } from '@/lib/p4/nps';

/**
 * Dashboard NPS aggregates. Manager+ only.
 *
 * Query params:
 *   - window_days: rolling window (default 90)
 *   - centre_id: filter
 *   - specialty_id: filter
 *   - doctor_id: filter
 */
export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (agent.role === 'agent') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const windowDays = Math.min(Number(searchParams.get('window_days')) || 90, 365);
  const centreId = searchParams.get('centre_id');
  const specialtyId = searchParams.get('specialty_id');
  const doctorId = searchParams.get('doctor_id');

  const supabase = createClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  let query = supabase
    .from('nps_responses')
    .select('score, category, feedback_topics, responded_at')
    .gte('responded_at', since);
  if (centreId) query = query.eq('centre_id', centreId);
  if (specialtyId) query = query.eq('specialty_id', specialtyId);
  if (doctorId) query = query.eq('primary_doctor_id', doctorId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  const topics = new Map<string, number>();

  for (const r of rows) {
    if (r.category === 'promoter') promoters += 1;
    else if (r.category === 'passive') passives += 1;
    else detractors += 1;
    if (r.category === 'detractor' && r.feedback_topics) {
      for (const t of r.feedback_topics as string[]) {
        topics.set(t, (topics.get(t) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({
    window_days: windowDays,
    responses: rows.length,
    promoters,
    passives,
    detractors,
    nps_score: npsScore({ promoters, passives, detractors }),
    detractor_topics: Array.from(topics.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  });
}
