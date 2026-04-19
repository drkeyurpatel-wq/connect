import { createServiceClient } from '@/lib/supabase/service';

/**
 * Log a PHI/PII read. DB triggers handle insert/update/delete audit automatically;
 * this helper is for explicit select_phi events (ECC v4 Rule 8).
 */
export async function logPhiRead(params: {
  actorId: string | null;
  actorRole: string | null;
  tableName: string;
  rowId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const svc = createServiceClient();
  await svc.from('audit_log').insert({
    table_name: params.tableName,
    row_id: params.rowId,
    action: 'select_phi',
    actor_id: params.actorId,
    actor_role: params.actorRole,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });
}
