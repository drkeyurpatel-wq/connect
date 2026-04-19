import type { NextRequest } from 'next/server';

/**
 * Cron endpoints are hit by Vercel Cron (or manual curl with CRON_SECRET).
 * Returns true if the request carries the right bearer token.
 */
export function verifyCron(req: NextRequest): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return header === `Bearer ${expected}`;
}
