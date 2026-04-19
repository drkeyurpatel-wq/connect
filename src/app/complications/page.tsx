import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function ComplicationsPage({ searchParams }: { searchParams: { severity?: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  let q = supabase
    .from('complication_flags')
    .select('id, lead_id, severity, status, source, symptom_text, flagged_at, first_contact_at, resolved_at, outcome, assigned_doctor_id')
    .order('flagged_at', { ascending: false })
    .limit(100);
  if (searchParams.severity) q = q.eq('severity', searchParams.severity);

  const { data } = await q;

  const open = (data ?? []).filter((f) => f.status !== 'resolved' && f.status !== 'cancelled');
  const closed = (data ?? []).filter((f) => f.status === 'resolved' || f.status === 'cancelled');

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Complication Flags</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clinical escalations routed from post-discharge journeys. SLAs: emergency 15m · major 4h · minor 24h.
        </p>

        <div className="mt-4 flex gap-2 text-xs">
          {['', 'emergency', 'major_concern', 'minor_concern'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/complications?severity=${s}` : '/complications'}
              className={`rounded border px-3 py-1 capitalize ${searchParams.severity === s ? 'border-brand bg-brand text-white' : 'border-slate-300'}`}
            >
              {s ? s.replace('_', ' ') : 'all'}
            </Link>
          ))}
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Open ({open.length})</h2>
          <FlagTable flags={open} emphasis />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Closed ({closed.length})</h2>
          <FlagTable flags={closed} />
        </section>
      </div>
    </AppShell>
  );
}

type Flag = {
  id: string;
  lead_id: string;
  severity: string;
  status: string;
  source: string;
  symptom_text: string | null;
  flagged_at: string;
  first_contact_at: string | null;
  resolved_at: string | null;
  outcome: string | null;
};

function FlagTable({ flags, emphasis }: { flags: Flag[]; emphasis?: boolean }) {
  return (
    <div className={`mt-3 overflow-x-auto rounded-lg border bg-white dark:bg-slate-900 ${emphasis ? 'border-red-200 dark:border-red-900' : 'border-slate-200 dark:border-slate-800'}`}>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
          <tr>
            <th className="px-4 py-2">Lead</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Source</th>
            <th className="px-4 py-2">Symptoms</th>
            <th className="px-4 py-2">Flagged</th>
            <th className="px-4 py-2">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {flags.map((f) => (
            <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2">
                <Link className="text-brand underline" href={`/leads/${f.lead_id}`}>{f.lead_id.slice(0, 8)}</Link>
              </td>
              <td className="px-4 py-2 capitalize">{f.severity.replace('_', ' ')}</td>
              <td className="px-4 py-2 capitalize">{f.status.replace('_', ' ')}</td>
              <td className="px-4 py-2 capitalize">{f.source.replace('_', ' ')}</td>
              <td className="px-4 py-2 max-w-xs truncate" title={f.symptom_text ?? ''}>{f.symptom_text ?? '—'}</td>
              <td className="px-4 py-2">{new Date(f.flagged_at).toLocaleString()}</td>
              <td className="px-4 py-2 capitalize">{f.outcome?.replace('_', ' ') ?? '—'}</td>
            </tr>
          ))}
          {flags.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-500">None.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
