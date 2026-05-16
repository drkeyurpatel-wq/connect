import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

function checkPasscode(req: NextRequest) {
  const provided = req.headers.get('x-admin-passcode') ||
    req.nextUrl.searchParams.get('passcode');
  return provided === process.env.MEDHACK_ADMIN_PASSCODE;
}

export async function GET(req: NextRequest) {
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('medhack_registrations')
    .select(
      'id, created_at, team_name, track, open_track_problem, status,' +
      'lead_name, lead_email, lead_phone, lead_role, lead_github, lead_linkedin,' +
      'member2_name, member2_email, member2_role, member2_github,' +
      'member3_name, member3_email, member3_role, member3_github,' +
      'why_us, stack_experience, portfolio_url,' +
      'admin_notes, nda_signed, slot_number'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[medhack/admin] fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch registrations.' }, { status: 500 });
  }

  return NextResponse.json({ data });
}
