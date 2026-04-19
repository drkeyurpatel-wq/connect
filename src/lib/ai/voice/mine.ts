import { randomUUID } from 'crypto';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Voice pattern mining — v1 topic discovery from call activity summaries.
 *
 * This phase ships a structural skeleton: reads call_log activities from the
 * last 7 days, groups by metadata tag, persists clusters. Claude-powered
 * clustering over embeddings lands when we have production transcript volume
 * in P6 (see ai/voice/cluster-llm.ts).
 */
export async function mineVoicePatterns(): Promise<{ clusters: number }> {
  const svc = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: activities } = await svc
    .from('lead_activities')
    .select('metadata')
    .eq('activity_type', 'call_log')
    .gte('created_at', weekAgo)
    .limit(5000);

  if (!activities || activities.length === 0) return { clusters: 0 };

  const topics = new Map<string, { count: number; samples: string[] }>();
  for (const a of activities) {
    const meta = (a.metadata as { topic?: string; snippet?: string }) ?? {};
    if (!meta.topic) continue;
    const bucket = topics.get(meta.topic) ?? { count: 0, samples: [] };
    bucket.count++;
    if (meta.snippet && bucket.samples.length < 5) bucket.samples.push(meta.snippet);
    topics.set(meta.topic, bucket);
  }

  const runId = randomUUID();
  const rows = Array.from(topics.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([label, v]) => ({
      run_id: runId,
      cluster_label: label.slice(0, 80),
      kind: 'topic',
      size: v.count,
      sample_phrases: v.samples,
      centre_distribution: {},
      specialty_distribution: {},
      agent_distribution: {},
      first_seen_at: weekAgo,
      last_seen_at: new Date().toISOString(),
    }));

  if (rows.length === 0) return { clusters: 0 };
  const { error } = await svc.from('voice_pattern_clusters').insert(rows);
  if (error) throw new Error(`voice_insert_failed: ${error.message}`);
  return { clusters: rows.length };
}
