import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  run_id: string;
  cluster_label: string;
  kind: string;
  size: number;
  sample_phrases: string[];
  first_seen_at: string | null;
  last_seen_at: string | null;
}

export default async function VoicePatternsPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('voice_pattern_clusters')
    .select('id, run_id, cluster_label, kind, size, sample_phrases, first_seen_at, last_seen_at')
    .order('size', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Call Topics &amp; Objections</h1>
        <p className="mt-1 text-sm text-slate-500">Weekly mining across call transcripts.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              No clusters yet. Run <code>/api/cron/voice-pattern-mining</code>.
            </div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{r.cluster_label}</h3>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600 dark:bg-slate-800">
                  {r.kind}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {r.size} mentions · {r.first_seen_at?.slice(0, 10)} → {r.last_seen_at?.slice(0, 10)}
              </div>
              {(r.sample_phrases ?? []).length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  {r.sample_phrases.slice(0, 3).map((p, i) => (
                    <li key={i} className="truncate">“{p}”</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
