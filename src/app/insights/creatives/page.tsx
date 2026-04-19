import { redirect } from 'next/navigation';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

interface Variant {
  id: string;
  text: string;
  tone: string | null;
  compliance_notes: string | null;
  flagged: boolean;
}

interface Row {
  id: string;
  channel: string;
  language: string;
  tone: string | null;
  brief: string;
  variants: Variant[];
  compliance_flags: string[];
  generated_at: string;
}

export default async function CreativesPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');
  if (agent.role === 'agent') redirect('/');

  const supabase = createClient();
  const { data } = await supabase
    .from('ai_creatives_generated')
    .select('id, channel, language, tone, brief, variants, compliance_flags, generated_at')
    .order('generated_at', { ascending: false })
    .limit(25);

  const rows = (data ?? []) as unknown as Row[];

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">AI Creatives</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sonnet-generated variants with compliance guardrails. Human approval required before ship.
        </p>

        <div className="mt-6 space-y-4">
          {rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              No creatives generated yet. POST <code>/api/ai/creatives</code> to generate a batch.
            </div>
          )}
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600 dark:bg-slate-800">
                    {r.channel}
                  </span>
                  <span className="ml-2 text-xs uppercase text-slate-400">{r.language}</span>
                  {r.tone && <span className="ml-2 text-xs text-slate-500">· {r.tone}</span>}
                </div>
                <span className="text-xs text-slate-500">{new Date(r.generated_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm italic text-slate-600">“{r.brief.slice(0, 240)}”</p>
              {(r.compliance_flags ?? []).length > 0 && (
                <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  Flags: {r.compliance_flags.join(', ')}
                </div>
              )}
              <ul className="mt-3 space-y-2">
                {(r.variants ?? []).map((v) => (
                  <li
                    key={v.id}
                    className={`rounded border p-2 text-sm ${
                      v.flagged
                        ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="mr-2 font-mono text-xs text-slate-400">{v.id}</span>
                    {v.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
