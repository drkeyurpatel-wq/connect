import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  lead_id: string;
  risk_score: number;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  top_reasons: string[];
  suggested_intervention: string | null;
  computed_at: string;
  leads: { first_name: string; last_name: string | null; phone: string } | null;
}

const BAND_STYLE: Record<Row['risk_band'], string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
};

export default async function ChurnPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('churn_predictions')
    .select('id, lead_id, risk_score, risk_band, top_reasons, suggested_intervention, computed_at, leads(first_name, last_name, phone)')
    .is('superseded_at', null)
    .in('risk_band', ['high', 'critical', 'medium'])
    .order('risk_score', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Patients at Risk of Churning</h1>
        <p className="mt-1 text-sm text-slate-500">Daily 03:00 refresh. Top 50 by risk. Top 20 get emailed digest.</p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">Patient</th>
                <th className="px-4 py-2">Risk</th>
                <th className="px-4 py-2">Band</th>
                <th className="px-4 py-2">Top reasons</th>
                <th className="px-4 py-2">Suggested</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No churn predictions yet — run <code>/api/cron/churn-predict</code>.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <a href={`/leads/${r.lead_id}`} className="font-medium text-brand hover:underline">
                      {r.leads?.first_name ?? '—'} {r.leads?.last_name ?? ''}
                    </a>
                    <div className="text-xs text-slate-500">{r.leads?.phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-2 font-mono">{(r.risk_score * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${BAND_STYLE[r.risk_band]}`}>
                      {r.risk_band}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{(r.top_reasons ?? []).join(', ') || '—'}</td>
                  <td className="px-4 py-2 text-xs">{r.suggested_intervention ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
