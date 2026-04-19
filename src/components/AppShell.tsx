import Link from 'next/link';
import type { AgentContext } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'manager', 'agent'] },
  { href: '/leads', label: 'Leads', roles: ['admin', 'manager', 'agent'] },
  { href: '/pipeline', label: 'Pipeline', roles: ['admin', 'manager', 'agent'] },
  { href: '/my-tasks', label: 'My Tasks', roles: ['admin', 'manager', 'agent'] },
  { href: '/reports/agents', label: 'Agent Perf', roles: ['admin', 'manager'] },
  { href: '/reports/sla', label: 'SLA', roles: ['admin', 'manager'] },
  { href: '/reports/funnel', label: 'Funnel', roles: ['admin', 'manager'] },
  { href: '/insights/scores', label: 'Lead Scores', roles: ['admin', 'manager', 'agent'] },
  { href: '/insights/churn', label: 'Churn Risk', roles: ['admin', 'manager'] },
  { href: '/insights/feedback', label: 'Feedback', roles: ['admin', 'manager'] },
  { href: '/insights/forecasts', label: 'Forecasts', roles: ['admin', 'manager'] },
  { href: '/insights/voice-patterns', label: 'Voice Patterns', roles: ['admin', 'manager'] },
  { href: '/insights/anomalies', label: 'Anomalies', roles: ['admin'] },
  { href: '/insights/creatives', label: 'AI Creatives', roles: ['admin', 'manager'] },
  { href: '/settings/stages', label: 'Stages', roles: ['admin'] },
  { href: '/settings/agents', label: 'Agents', roles: ['admin'] },
  { href: '/audit', label: 'Audit', roles: ['admin'] },
];

export function AppShell({ agent, children }: { agent: AgentContext; children: React.ReactNode }) {
  const items = NAV.filter((n) => n.roles.includes(agent.role));
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 font-semibold dark:border-slate-800">
          <span className="inline-block h-6 w-6 rounded bg-brand" aria-hidden />
          H1 Connect
        </div>
        <nav className="flex flex-col gap-1 p-2 text-sm">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="rounded px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 text-xs text-slate-500">
          <div>{agent.fullName}</div>
          <div className="capitalize">{agent.role}</div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
