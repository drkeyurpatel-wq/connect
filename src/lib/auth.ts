import { createClient } from '@/lib/supabase/server';

export type AgentRole = 'admin' | 'manager' | 'agent';

export interface AgentContext {
  userId: string;
  email: string;
  fullName: string;
  role: AgentRole;
  centreAccess: string[];
}

/**
 * Loads the current agent (auth.users row joined to public.agents).
 * Returns null if unauthenticated or not provisioned in public.agents.
 */
export async function getCurrentAgent(): Promise<AgentContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('agents')
    .select('id, email, full_name, role, centre_access, active')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data || !data.active) return null;

  return {
    userId: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as AgentRole,
    centreAccess: data.centre_access ?? [],
  };
}

