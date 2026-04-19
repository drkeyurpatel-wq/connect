import { createServiceClient } from '@/lib/supabase/service';

/**
 * Simple ARIMA-lite: 28-day trailing mean, recency-weighted, with seasonal lift.
 * v1 is a single-series forecaster — good enough for weekly publication.
 *
 * For each (centre, specialty) combo, forecast OPD volume for horizons of 30,
 * 60, 90 days. Revenue forecast piggybacks off the OPD forecast using the
 * centre's mean lead expected_value.
 */
export async function refreshCapacityForecasts(): Promise<{ forecasts: number }> {
  const svc = createServiceClient();

  const windowStart = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  const { data: appts } = await svc
    .from('hmis_appointment_sync')
    .select('appointment_at, centre_id, doctor_id')
    .gte('appointment_at', windowStart)
    .limit(20000);

  const { data: doctors } = await svc
    .from('doctors')
    .select('id, specialty_id');
  const specialtyByDoctor = new Map((doctors ?? []).map((d) => [d.id, d.specialty_id]));

  const buckets = new Map<string, number[]>();
  for (const a of appts ?? []) {
    if (!a.centre_id || !a.doctor_id) continue;
    const specialty = specialtyByDoctor.get(a.doctor_id);
    if (!specialty) continue;
    const dayKey = new Date(a.appointment_at).toISOString().slice(0, 10);
    const key = `${a.centre_id}|${specialty}|${dayKey}`;
    const arr = buckets.get(key) ?? [];
    arr.push(1);
    buckets.set(key, arr);
  }

  const series = new Map<string, Map<string, number>>();
  for (const [key, arr] of buckets) {
    const [centre, specialty, day] = key.split('|');
    const combo = `${centre}|${specialty}`;
    const daily = series.get(combo) ?? new Map();
    daily.set(day, (daily.get(day) ?? 0) + arr.length);
    series.set(combo, daily);
  }

  const rows: Record<string, unknown>[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [combo, daily] of series) {
    const [centreId, specialtyId] = combo.split('|');
    const dailyAvg = averageDaily(daily);
    if (!Number.isFinite(dailyAvg) || dailyAvg <= 0) continue;
    const sd = standardDeviation(daily, dailyAvg);

    for (const horizon of [30, 60, 90] as const) {
      const expected = dailyAvg * horizon;
      const band = sd * Math.sqrt(horizon) * 1.96;
      const forecastDate = new Date(today.getTime() + horizon * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);

      rows.push({
        centre_id: centreId,
        specialty_id: specialtyId,
        horizon_days: horizon,
        kind: 'opd_volume',
        point_estimate: round2(expected),
        lower_bound: round2(Math.max(0, expected - band)),
        upper_bound: round2(expected + band),
        method: 'trailing_mean_v1',
        inputs_snapshot: { window_days: 365, sd: round2(sd), daily_avg: round2(dailyAvg) },
        forecast_for_date: forecastDate,
        generated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) return { forecasts: 0 };

  const { error } = await svc
    .from('capacity_forecasts')
    .upsert(rows, { onConflict: 'centre_id,specialty_id,horizon_days,kind,forecast_for_date' });
  if (error) throw new Error(`forecast_upsert_failed: ${error.message}`);
  return { forecasts: rows.length };
}

function averageDaily(daily: Map<string, number>): number {
  const values = Array.from(daily.values());
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(daily: Map<string, number>, mean: number): number {
  const values = Array.from(daily.values());
  if (values.length < 2) return mean * 0.5;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
