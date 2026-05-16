import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

function checkPasscode(req: NextRequest) {
  const provided = req.headers.get('x-admin-passcode') ||
    req.nextUrl.searchParams.get('passcode');
  return provided === process.env.MEDHACK_ADMIN_PASSCODE;
}

const patchSchema = z.object({
  status: z.enum(['pending', 'shortlisted', 'accepted', 'rejected', 'waitlisted']).optional(),
  admin_notes: z.string().max(2000).optional(),
  nda_signed: z.boolean().optional(),
  slot_number: z.number().int().min(1).max(10).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!checkPasscode(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('medhack_registrations')
    .update(parsed.data)
    .eq('id', params.id);

  if (error) {
    console.error('[medhack/admin/patch] error:', error);
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
