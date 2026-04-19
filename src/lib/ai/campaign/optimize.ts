import { createServiceClient } from '@/lib/supabase/service';

/**
 * Weekly auto-optimization pass. v1 detects WhatsApp template winners by
 * delivered+read rate and proposes auto-pause for the weaker variant. Budget
 * reallocation + send-time optimization land in P5 week 4+.
 *
 * All decisions logged with approval_required = true so a manager must green-
 * light anything material. Spec §9.2 safety rails.
 */
export async function runCampaignOptimization(): Promise<{ decisions: number }> {
  const svc = createServiceClient();
  const windowStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: messages } = await svc
    .from('whatsapp_messages')
    .select('template_id, status, read_at, delivered_at, created_at')
    .gte('created_at', windowStart)
    .not('template_id', 'is', null)
    .limit(20000);
  if (!messages || messages.length === 0) return { decisions: 0 };

  const stats = new Map<string, { sent: number; delivered: number; read: number }>();
  for (const m of messages) {
    const key = m.template_id as string;
    const s = stats.get(key) ?? { sent: 0, delivered: 0, read: 0 };
    s.sent++;
    if (m.delivered_at) s.delivered++;
    if (m.read_at) s.read++;
    stats.set(key, s);
  }

  const viableTemplates = Array.from(stats.entries()).filter(([, s]) => s.sent >= 100);
  if (viableTemplates.length < 2) return { decisions: 0 };

  viableTemplates.sort((a, b) => readRate(b[1]) - readRate(a[1]));
  const [winner, runnerUp] = viableTemplates;
  const winnerRate = readRate(winner[1]);
  const runnerRate = readRate(runnerUp[1]);
  if (winnerRate - runnerRate < 0.05) return { decisions: 0 };

  const { error } = await svc.from('campaign_optimizations').insert({
    kind: 'ab_variant_winner',
    decision: {
      winner_template_id: winner[0],
      runner_up_template_id: runnerUp[0],
      winner_read_rate: round3(winnerRate),
      runner_up_read_rate: round3(runnerRate),
      sample_size: winner[1].sent + runnerUp[1].sent,
    },
    rationale: `Winner beats runner-up by ${round3(winnerRate - runnerRate)} read rate over ${
      winner[1].sent + runnerUp[1].sent
    } sends.`,
    confidence: Math.min(0.99, 0.5 + (winnerRate - runnerRate) * 5),
    auto_applied: false,
    approval_required: true,
  });

  if (error) throw new Error(`opt_insert_failed: ${error.message}`);
  return { decisions: 1 };
}

function readRate(s: { sent: number; read: number }): number {
  return s.sent === 0 ? 0 : s.read / s.sent;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
