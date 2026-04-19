import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { npsScore } from '@/lib/p4/nps';

export const dynamic = 'force-dynamic';

export default async function NpsPage({ searchParams }: { searchParams: { window?: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const windowDays = Math.min(Number(searchParams.window) || 90, 365);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();

  const supabase = createClient();
  const { data: rows } = await supabase
    .from('nps_responses')
    .select('score, category, feedback_topics, responded_at, centre_id')
    .gte('responded_at', since);

  const data = rows ?? [];
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  const topics = new Map<string, number>();

  for (const r of data) {
    if (r.category === 'promoter') promoters += 1;
    else if (r.category === 'passive') passives += 1;
    else detractors += 1;
    if (r.category === 'detractor' && r.feedback_topics) {
      for (const t of r.feedback_topics as string[]) {
        topics.set(t, (topics.get(t) ?? 0) + 1);
      }
    }
  }

  const score = npsScore({ promoters, passives, detractors });
  const total = promoters + passives + detractors;
  const detractorTopics = Array.from(topics.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">NPS Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">Rolling {windowDays}-day window. {total} responses.</p>
          </div>
          <div className="flex gap-2 text-xs">
            {[30, 90, 365].map((w) => (
              <Link
                key={w}
                href={`/nps?window=${w}`}
                className={`rounded border px-3 py-1 ${w === windowDays ? 'border-brand bg-brand text-white' : 'border-slate-300'}`}
              >
                {w}d
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <ScoreCard label="NPS" value={score === null ? '—' : score.toFixed(0)} accent />
          <ScoreCard label="Promoters" value={promoters} subtitle={pct(promoters, total)} />
          <ScoreCard label="Passives" value={passives} subtitle={pct(passives, total)} />
          <ScoreCard label="Detractors" value={detractors} subtitle={pct(detractors, total)} />
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Top detractor topics</h2>
          {detractorTopics.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No detractor topics surfaced in this window.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {detractorTopics.map((t) => (
                <li key={t.topic} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="capitalize">{t.topic.replace('_', ' ')}</span>
                  <span className="text-slate-500">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Target NPS ≥ 60 (spec §6.3 — world-class benchmark for hospitals).
        </p>
      </div>
    </AppShell>
  );
}

function ScoreCard({ label, value, subtitle, accent }: { label: string; value: number | string; subtitle?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-4 dark:bg-slate-900 ${accent ? 'border-brand/50' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(0)}%`;
}
