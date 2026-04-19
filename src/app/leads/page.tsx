import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export default async function LeadsPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const { data: leads } = await supabase
    .from('leads')
    .select('id, first_name, last_name, phone, stage_id, priority, created_at, sla_breached')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: stages } = await supabase
    .from('lead_stages').select('id, name').order('stage_order');
  const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]));

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Lead Inbox</h1>
          <Link href="/leads/new" className="rounded bg-brand px-3 py-2 text-sm font-medium text-brand-fg">
            New lead
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">SLA</th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2">
                    <Link href={`/leads/${l.id}`} className="text-brand hover:underline">
                      {l.first_name} {l.last_name ?? ''}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{l.phone}</td>
                  <td className="px-4 py-2">{stageMap.get(l.stage_id) ?? '—'}</td>
                  <td className="px-4 py-2 capitalize">{l.priority}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    {l.sla_breached ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">Breached</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!leads || leads.length === 0) && (
                <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No leads yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
