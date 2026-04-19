import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentAgent } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function LoyaltyPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect('/login');

  const supabase = createClient();
  const [{ data: cards, count }, { data: tierConfig }] = await Promise.all([
    supabase
      .from('loyalty_cards')
      .select('id, card_number, primary_lead_id, tier, lifetime_visits, lifetime_spend, rolling_24m_spend, lifetime_savings, activated_at, active', { count: 'exact' })
      .eq('active', true)
      .order('activated_at', { ascending: false })
      .limit(50),
    supabase
      .from('loyalty_tier_config')
      .select('tier, min_rolling_24m_spend, discount_pct, priority_booking, free_annual_checkup, description')
      .order('min_rolling_24m_spend', { ascending: true }),
  ]);

  return (
    <AppShell agent={agent}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Loyalty + Family Cards</h1>
        <p className="mt-1 text-sm text-slate-500">
          {count ?? 0} active cards. Tiers are derived from rolling 24-month spend.
        </p>

        <section className="mt-6">
          <h2 className="text-lg font-semibold">Tier configuration</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Min 24m spend (₹)</th>
                  <th className="px-4 py-2">Discount</th>
                  <th className="px-4 py-2">Priority booking</th>
                  <th className="px-4 py-2">Free annual</th>
                  <th className="px-4 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {(tierConfig ?? []).map((t) => (
                  <tr key={t.tier} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-medium capitalize">{t.tier}</td>
                    <td className="px-4 py-2">{inr(Number(t.min_rolling_24m_spend))}</td>
                    <td className="px-4 py-2">{Number(t.discount_pct)}%</td>
                    <td className="px-4 py-2">{t.priority_booking ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2">{t.free_annual_checkup ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2 text-slate-500">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Recent cards</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Card</th>
                  <th className="px-4 py-2">Tier</th>
                  <th className="px-4 py-2">Visits</th>
                  <th className="px-4 py-2">Lifetime spend</th>
                  <th className="px-4 py-2">Rolling 24m</th>
                  <th className="px-4 py-2">Primary lead</th>
                </tr>
              </thead>
              <tbody>
                {(cards ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs">{c.card_number}</td>
                    <td className="px-4 py-2 capitalize">{c.tier}</td>
                    <td className="px-4 py-2">{c.lifetime_visits}</td>
                    <td className="px-4 py-2">{inr(Number(c.lifetime_spend))}</td>
                    <td className="px-4 py-2">{inr(Number(c.rolling_24m_spend))}</td>
                    <td className="px-4 py-2">
                      <Link className="text-brand underline" href={`/leads/${c.primary_lead_id}`}>
                        {c.primary_lead_id.slice(0, 8)}
                      </Link>
                    </td>
                  </tr>
                ))}
                {(cards ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No loyalty cards yet. Cards auto-create on first IPD admission.
                    </td>
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

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}
