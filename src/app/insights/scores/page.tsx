import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface TopLeadRow {
  lead_id: string;
  p2c: number;
  pltv: number | null;
  computed_at: string;
  leads: { first_name: string; last_name: string | null; phone: string; stage_id: string } | null;
}

export default async function LeadScoresPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const { data } = await supabase
    .from('lead_scores')
    .select('lead_id, p2c, pltv, computed_at, leads(first_name, last_name, phone, stage_id)')
    .order('p2c', { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as TopLeadRow[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Top Leads by Probability-to-Convert</h1>
        <p className="mt-1 text-sm text-slate-500">
          Refreshed every 15 min. Sort by P2C (0–1). PLTV is 5-year ₹ expectation.
        </p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">Lead</th>
                <th className="px-4 py-2">P2C</th>
                <th className="px-4 py-2">PLTV (₹)</th>
                <th className="px-4 py-2">Scored</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No scored leads yet. The lead-score cron runs every 15 min.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.lead_id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2">
                    <a href={`/leads/${r.lead_id}`} className="font-medium text-brand hover:underline">
                      {r.leads?.first_name ?? '—'} {r.leads?.last_name ?? ''}
                    </a>
                    <div className="text-xs text-slate-500">{r.leads?.phone ?? ''}</div>
                  </td>
                  <td className="px-4 py-2 font-mono">{(r.p2c * 100).toFixed(1)}%</td>
                  <td className="px-4 py-2 font-mono">{r.pltv ? Math.round(r.pltv).toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(r.computed_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
