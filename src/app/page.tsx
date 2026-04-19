import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export default async function DashboardPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const [{ count: totalLeads }, { data: pipeline }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('lead_stages').select('id, name, stage_order').order('stage_order'),
  ]);

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome, {agent.fullName}.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500">Total open leads</div>
            <div className="mt-1 text-3xl font-semibold">{totalLeads ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500">Active stages</div>
            <div className="mt-1 text-3xl font-semibold">{pipeline?.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500">Your role</div>
            <div className="mt-1 text-3xl font-semibold capitalize">{agent.role}</div>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Week 1 scaffold — full widgets land in Week 4 per spec §6.
        </p>
      </div>
    </AppShell>
  );
}
