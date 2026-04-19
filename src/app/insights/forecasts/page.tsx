import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  centre_id: string | null;
  specialty_id: string | null;
  horizon_days: number;
  kind: string;
  point_estimate: number;
  lower_bound: number | null;
  upper_bound: number | null;
  forecast_for_date: string;
  method: string;
  generated_at: string;
  centres: { name: string } | null;
  specialties: { name: string } | null;
}

export default async function ForecastsPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('capacity_forecasts')
    .select('id, centre_id, specialty_id, horizon_days, kind, point_estimate, lower_bound, upper_bound, forecast_for_date, method, generated_at, centres(name), specialties(name)')
    .order('forecast_for_date', { ascending: true })
    .limit(200);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Capacity Forecasts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Weekly Sunday refresh. OPD volume per centre × specialty × horizon.
        </p>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2">Centre</th>
                <th className="px-4 py-2">Specialty</th>
                <th className="px-4 py-2">Horizon</th>
                <th className="px-4 py-2">Point</th>
                <th className="px-4 py-2">Range</th>
                <th className="px-4 py-2">For</th>
                <th className="px-4 py-2">Method</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No forecasts yet. Run <code>/api/cron/capacity-forecast</code>.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-2">{r.centres?.name ?? '—'}</td>
                  <td className="px-4 py-2">{r.specialties?.name ?? '—'}</td>
                  <td className="px-4 py-2 font-mono">{r.horizon_days}d</td>
                  <td className="px-4 py-2 font-mono">{Math.round(r.point_estimate).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    {r.lower_bound != null ? Math.round(r.lower_bound) : '—'}–
                    {r.upper_bound != null ? Math.round(r.upper_bound) : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">{r.forecast_for_date}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
