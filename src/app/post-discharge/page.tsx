import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function PostDischargePage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [{ data: active, count: activeCount }, { data: recent }, { data: flags, count: flagCount }] = await Promise.all([
    supabase
      .from('post_discharge_enrolments')
      .select('id, lead_id, discharge_event_id, journey_template_code, specialty_overlay, enrolled_at, next_step_at, current_step_code', { count: 'exact' })
      .is('completed_at', null)
      .order('enrolled_at', { ascending: false })
      .limit(20),
    supabase
      .from('discharge_events')
      .select('id, lead_id, uhid, patient_name, discharge_date, discharge_type, primary_specialty_code, centre_code')
      .gte('discharge_date', since)
      .order('discharge_date', { ascending: false })
      .limit(20),
    supabase
      .from('complication_flags')
      .select('id, lead_id, severity, status, flagged_at', { count: 'exact' })
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .order('flagged_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Post-Discharge Console</h1>
        <p className="mt-1 text-sm text-slate-500">
          Active journeys, recent discharges, and open clinical escalations.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card label="Active enrolments" value={activeCount ?? 0} />
          <Card label="Discharges (30d)" value={recent?.length ?? 0} />
          <Card label="Open complication flags" value={flagCount ?? 0} emphasis={(flagCount ?? 0) > 0} />
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Active enrolments</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Template</th>
                  <th className="px-4 py-2">Overlay</th>
                  <th className="px-4 py-2">Step</th>
                  <th className="px-4 py-2">Next at</th>
                </tr>
              </thead>
              <tbody>
                {(active ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <Link className="text-brand underline" href={`/leads/${e.lead_id}`}>{e.lead_id.slice(0, 8)}</Link>
                    </td>
                    <td className="px-4 py-2">{e.journey_template_code}</td>
                    <td className="px-4 py-2">{e.specialty_overlay ?? '—'}</td>
                    <td className="px-4 py-2">{e.current_step_code ?? '—'}</td>
                    <td className="px-4 py-2">{e.next_step_at ? new Date(e.next_step_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
                {(active ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No active enrolments. Discharge events from HMIS will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Recent discharges</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">UHID</th>
                  <th className="px-4 py-2">Patient</th>
                  <th className="px-4 py-2">Centre</th>
                  <th className="px-4 py-2">Specialty</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Discharged</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">{d.uhid}</td>
                    <td className="px-4 py-2">
                      {d.lead_id ? (
                        <Link className="text-brand underline" href={`/leads/${d.lead_id}`}>{d.patient_name ?? '—'}</Link>
                      ) : (
                        d.patient_name ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-2">{d.centre_code ?? '—'}</td>
                    <td className="px-4 py-2">{d.primary_specialty_code ?? '—'}</td>
                    <td className="px-4 py-2 capitalize">{d.discharge_type}</td>
                    <td className="px-4 py-2">{new Date(d.discharge_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(recent ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">No recent discharges.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Open complication flags</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Lead</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {(flags ?? []).map((f) => (
                  <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2">
                      <Link className="text-brand underline" href={`/leads/${f.lead_id}`}>{f.lead_id.slice(0, 8)}</Link>
                    </td>
                    <td className="px-4 py-2">
                      <SeverityPill severity={f.severity as string} />
                    </td>
                    <td className="px-4 py-2 capitalize">{f.status.replace('_', ' ')}</td>
                    <td className="px-4 py-2">{new Date(f.flagged_at).toLocaleString()}</td>
                  </tr>
                ))}
                {(flags ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No open flags.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Card({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-4 dark:bg-slate-900 ${emphasis ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${emphasis ? 'text-red-600 dark:text-red-400' : ''}`}>{value}</div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const classes: Record<string, string> = {
    emergency: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    major_concern: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    minor_concern: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${classes[severity] ?? classes.normal}`}>
      {severity.replace('_', ' ')}
    </span>
  );
}
