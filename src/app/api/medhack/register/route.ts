import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

const schema = z.object({
  team_name: z.string().min(2).max(80),
  track: z.enum(['HMIS', 'HRMS', 'VPMS', 'LIMS', 'Patient Portal', 'Open']),
  open_track_problem: z.enum([
    'Insurance End-to-End',
    'Discharge Optimizer',
    'Patient Journey & Outcomes',
  ]).optional().nullable(),
  lead_name: z.string().min(2).max(100),
  lead_email: z.string().email(),
  lead_phone: z.string().min(10).max(15),
  lead_role: z.string().min(2).max(100),
  lead_github: z.string().max(100).optional().nullable(),
  lead_linkedin: z.string().max(200).optional().nullable(),
  member2_name: z.string().min(2).max(100),
  member2_email: z.string().email(),
  member2_role: z.string().min(2).max(100),
  member2_github: z.string().max(100).optional().nullable(),
  member3_name: z.string().min(2).max(100),
  member3_email: z.string().email(),
  member3_role: z.string().min(2).max(100),
  member3_github: z.string().max(100).optional().nullable(),
  why_us: z.string().min(20).max(2000),
  stack_experience: z.string().min(2).max(500),
  portfolio_url: z.string().url().optional().nullable().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate: Open track must have problem; others must not
    if (data.track === 'Open' && !data.open_track_problem) {
      return NextResponse.json(
        { error: 'Open track requires a problem statement selection.' },
        { status: 400 }
      );
    }
    if (data.track !== 'Open' && data.open_track_problem) {
      data.open_track_problem = null;
    }

    // Clean empty portfolio_url
    if (!data.portfolio_url) data.portfolio_url = null;

    const supabase = createServiceClient();

    // Duplicate check on lead email
    const { data: existing } = await supabase
      .from('medhack_registrations')
      .select('id')
      .eq('lead_email', data.lead_email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A registration already exists for this email address.' },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('medhack_registrations').insert(data);

    if (error) {
      console.error('[medhack/register] insert error:', error);
      return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[medhack/register] unexpected:', err);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
