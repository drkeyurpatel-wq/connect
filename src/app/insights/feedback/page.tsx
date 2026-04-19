import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  source: string;
  topic: string;
  sub_topic: string | null;
  sentiment: number | null;
  severity: 'info' | 'minor' | 'major' | 'critical';
  suggested_owner: string | null;
  created_at: string;
  resolved_at: string | null;
}

const SEVERITY_STYLE: Record<Row['severity'], string> = {
  info: 'bg-slate-100 text-slate-600',
  minor: 'bg-blue-100 text-blue-700',
  major: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
};

export default async function FeedbackPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('feedback_classifications')
    .select('id, source, topic, sub_topic, sentiment, severity, suggested_owner, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Classified Feedback</h1>
        <p className="mt-1 text-sm text-slate-500">Auto-tagged by Claude Haiku. Resolution SLA tracked.</p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Sentiment</th>
                <th className="px-4 py-2">Owner</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No feedback classified yet.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{r.source}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium capitalize">{r.topic}</div>
                    {r.sub_topic && <div className="text-xs text-slate-500">{r.sub_topic}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLE[r.severity]}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.sentiment?.toFixed(2) ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">{r.suggested_owner ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">{r.resolved_at ? 'Resolved' : 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
