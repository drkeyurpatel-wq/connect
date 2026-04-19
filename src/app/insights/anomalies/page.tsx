import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  observed_value: number | null;
  expected_value: number | null;
  z_score: number | null;
  window_start: string | null;
  window_end: string | null;
  details: Record<string, unknown>;
  reviewed_at: string | null;
  reviewer_verdict: string | null;
  created_at: string;
}

const SEV_STYLE: Record<Row['severity'], string> = {
  info: 'bg-slate-100 text-slate-600',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
};

export default async function AnomaliesPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role !== 'admin') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('anomaly_findings')
    .select('id, kind, severity, metric, observed_value, expected_value, z_score, window_start, window_end, details, reviewed_at, reviewer_verdict, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Anomaly Findings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daily 04:00 scan. Manual review required — no auto-action.
        </p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">Detected</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Metric</th>
                <th className="px-4 py-2">Observed / Expected</th>
                <th className="px-4 py-2">Z</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No anomalies in the current window.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-xs">{r.kind}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${SEV_STYLE[r.severity]}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{r.metric}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {r.observed_value ?? '—'} / {r.expected_value ?? '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.z_score != null ? r.z_score.toFixed(2) : '—'}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.reviewed_at ? (r.reviewer_verdict ?? 'reviewed') : 'open'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
