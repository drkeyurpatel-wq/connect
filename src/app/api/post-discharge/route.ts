import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAgent } from '@/lib/auth';

/**
 * Post-discharge enrolments — used for the agent-facing post-discharge console
 * and the background cron worker. Agents see enrolments they own; managers see
 * centre-scoped.
 */
export async function GET(req: NextRequest) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const windowDays = Math.min(Number(searchParams.get('window_days')) || 30, 365);
  const leadId = searchParams.get('lead_id');
  const includeCompleted = searchParams.get('include_completed') === 'true';

  const supabase = createClient();
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  let query = supabase
    .from('post_discharge_enrolments')
    .select('id, lead_id, discharge_event_id, journey_template_code, specialty_overlay, enrolled_at, next_step_at, current_step_code, day_2_checkin_status, day_7_checkin_status, day_14_nps_status, day_30_followup_status, day_90_checkin_status, completed_at')
    .gte('enrolled_at', since)
    .order('enrolled_at', { ascending: false })
    .limit(100);
  if (!includeCompleted) query = query.is('completed_at', null);
  if (leadId) query = query.eq('lead_id', leadId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enrolments: data });
}
