import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'h1-connect',
    phase: 'p1',
    ts: new Date().toISOString(),
    env: {
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}
