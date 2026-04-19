import { notFound, redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logPhiRead } from '@/lib/audit';
import { AppShell } from '@/components/AppShell';

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!lead) notFound();

  await logPhiRead({
    actorId: agent.userId,
    actorRole: agent.role,
    tableName: 'leads',
    rowId: lead.id,
  });

  const [{ data: activities }, { data: stages }] = await Promise.all([
    supabase.from('lead_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('lead_stages').select('id, name').order('stage_order'),
  ]);
  const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]));

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">
          {lead.first_name} {lead.last_name ?? ''}
        </h1>
        <div className="mt-1 text-sm text-slate-500 font-mono">{lead.phone}</div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">Activity timeline</h2>
            <ul className="flex flex-col gap-3">
              {(activities ?? []).map((a) => (
                <li key={a.id} className="rounded border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{a.activity_type}</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.content && <div className="mt-1 text-sm">{a.content}</div>}
                </li>
              ))}
              {(!activities || activities.length === 0) && (
                <li className="text-sm text-slate-500">No activity yet.</li>
              )}
            </ul>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Stage</dt><dd>{stageMap.get(lead.stage_id) ?? '—'}</dd>
              <dt className="text-slate-500">Priority</dt><dd className="capitalize">{lead.priority}</dd>
              <dt className="text-slate-500">Email</dt><dd className="truncate">{lead.email ?? '—'}</dd>
              <dt className="text-slate-500">UHID</dt><dd className="font-mono text-xs">{lead.hmis_patient_uhid ?? '—'}</dd>
              <dt className="text-slate-500">Created</dt><dd className="text-xs">{new Date(lead.created_at).toLocaleString()}</dd>
              <dt className="text-slate-500">SLA</dt><dd>{lead.first_response_at ? 'Responded' : 'Pending'}</dd>
            </dl>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
