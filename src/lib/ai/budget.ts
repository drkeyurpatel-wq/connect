import { createServiceClient } from '@/lib/supabase/service';

/**
 * Budget enforcement for AI calls. Returns whether the call may proceed.
 * Reads daily + monthly spend for the given purpose, compares against ai_budget_caps.
 */
export async function checkBudget(purpose: string): Promise<{
  allowed: boolean;
  reason?: string;
  dailySpent?: number;
  monthlySpent?: number;
}> {
  const svc = createServiceClient();

  const { data: cap } = await svc
    .from('ai_budget_caps')
    .select('daily_cap_inr, monthly_cap_inr, hard_stop, active')
    .eq('purpose', purpose)
    .maybeSingle();

  if (!cap || !cap.active) return { allowed: true };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: dayRows }, { data: monthRows }] = await Promise.all([
    svc
      .from('ai_inference_log')
      .select('cost_inr')
      .eq('purpose', purpose)
      .eq('status', 'ok')
      .gte('created_at', startOfDay.toISOString()),
    svc
      .from('ai_inference_log')
      .select('cost_inr')
      .eq('purpose', purpose)
      .eq('status', 'ok')
      .gte('created_at', startOfMonth.toISOString()),
  ]);

  const sum = (rows: { cost_inr: number | null }[] | null) =>
    (rows ?? []).reduce((acc, r) => acc + (Number(r.cost_inr) || 0), 0);

  const dailySpent = sum(dayRows);
  const monthlySpent = sum(monthRows);

  if (cap.hard_stop && dailySpent >= cap.daily_cap_inr) {
    return { allowed: false, reason: 'daily_cap_hit', dailySpent, monthlySpent };
  }
  if (cap.hard_stop && monthlySpent >= cap.monthly_cap_inr) {
    return { allowed: false, reason: 'monthly_cap_hit', dailySpent, monthlySpent };
  }
  return { allowed: true, dailySpent, monthlySpent };
}
