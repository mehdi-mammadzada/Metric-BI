import { supabase } from "@/integrations/supabase/client";

export interface AuditLogRow {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  previous_values: unknown | null;
  new_values: unknown | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LogAuditInput {
  organizationId?: string | null;
  action: string;                    // e.g. "create", "update", "delete", "invite"
  module: string;                    // e.g. "invitations", "kpi_cards", "org_structure"
  entityType?: string | null;
  entityId?: string | null;
  previousValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Write a single audit log row for the currently authenticated user.
 * Silent failure — audit logging must never break the calling flow.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    // High-frequency background mirror jobs used to write an audit row on every
    // debounce cycle, saturating the backend and slowing auth/page loads. Audit
    // real user actions only; sync bookkeeping is intentionally skipped.
    if (input.action === "sync") return;

    const { data } = await supabase.auth.getSession();
    const actorId = data.session?.user?.id;
    if (!actorId) return;

    await supabase.from("audit_logs").insert({
      organization_id: input.organizationId ?? null,
      actor_user_id: actorId,
      action: input.action,
      module: input.module,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ? String(input.entityId) : null,
      previous_values: (input.previousValues ?? null) as never,
      new_values: (input.newValues ?? null) as never,
      metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    /* swallow — audit is best-effort */
  }
}

export interface ListAuditParams {
  organizationId: string;
  module?: string;
  action?: string;
  limit?: number;
}

export async function listAuditLogs(params: ListAuditParams): Promise<AuditLogRow[]> {
  let q = supabase
    .from("audit_logs")
    .select("*")
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 200);
  if (params.module) q = q.eq("module", params.module);
  if (params.action) q = q.eq("action", params.action);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}
