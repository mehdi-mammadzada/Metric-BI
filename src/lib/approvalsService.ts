// Approvals & Matrices cloud service — mirrors localStorage-backed stores
// (approval matrices, deletion matrices, cascade matrices, approval queue)
// into Supabase, hydrating on login and flushing on local changes.

import { supabase } from "@/integrations/supabase/client";


const APPROVAL_KEY = "kpi_approval_matrices_v3";
const DELETION_KEY = "kpi_deletion_matrices_v3";
const CASCADE_KEY = "cascade_matrices_v2";
const QUEUE_KEY = "kpi_approval_queue_v2";

const MATRIX_EVT = "matrix:updated";
const CASCADE_EVT = "cascade-matrix-updated";
const QUEUE_EVT = "kpi-approval-queue-updated";

const readLocal = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
};

const isSeedQueueRow = (row: any) => typeof row?.id === "string" && row.id.startsWith("ap-seed-");

const decisionTime = (row: any) => {
  const decisionTimes = Object.values(row?.decisions || {})
    .map((d: any) => Date.parse(d?.at || "") || 0);
  return Math.max(
    Date.parse(row?.updatedAt || row?.updated_at || "") || 0,
    Date.parse(row?.createdAt || row?.created_at || "") || 0,
    ...decisionTimes,
  );
};

// ── HYDRATE ─────────────────────────────────────────────────────────────────
export const hydrateApprovalsFromCloud = async (orgId: string): Promise<void> => {
  const [amRes, dmRes, cmRes, aqRes] = await Promise.all([
    supabase.from("approval_matrices").select("*").eq("organization_id", orgId),
    supabase.from("deletion_matrices").select("*").eq("organization_id", orgId),
    supabase.from("cascade_matrices").select("*").eq("organization_id", orgId),
    supabase.from("approval_queue").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);

  if (!amRes.error && amRes.data) {
    writeLocal(APPROVAL_KEY, amRes.data.map(r => ({
      id: r.local_id,
      name: r.name,
      mode: r.mode ?? undefined,
      steps: r.steps ?? [],
      updatedAt: r.updated_at,
    })));
  }
  if (!dmRes.error && dmRes.data) {
    writeLocal(DELETION_KEY, dmRes.data.map(r => ({
      id: r.local_id,
      name: r.name,
      mode: r.mode ?? undefined,
      approver: r.approver ?? null,
      minApprovals: r.min_approvals ?? undefined,
      updatedAt: r.updated_at,
    })));
  }
  if (!cmRes.error && cmRes.data) {
    writeLocal(CASCADE_KEY, cmRes.data.map(r => ({
      id: r.local_id,
      name: r.name,
      scopeType: r.scope_type,
      scopeName: r.scope_name,
      sharedPersons: r.shared_persons ?? [],
      updatedAt: r.updated_at,
    })));
  }
  if (!aqRes.error && aqRes.data) {
    const cloudQueue = aqRes.data.map(r => ({
      id: r.local_id,
      kpiCardId: r.kpi_card_local_id,
      kpiName: r.kpi_name,
      matrixId: r.matrix_local_id ?? "",
      approverIds: r.approver_ids ?? [],
      decisions: r.decisions ?? {},
      status: r.status,
      stepsChain: r.steps_chain ?? undefined,
      currentStep: r.current_step ?? undefined,
      createdBy: r.created_by ?? "",
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    writeLocal(QUEUE_KEY, cloudQueue.sort((a, b) => decisionTime(b) - decisionTime(a)));
  }

  // Notify UI hooks to re-read. Suppress flush during rehydrate to avoid loop.
  suppressFlush = true;
  window.dispatchEvent(new Event(MATRIX_EVT));
  window.dispatchEvent(new Event(CASCADE_EVT));
  window.dispatchEvent(new Event(QUEUE_EVT));
  suppressFlush = false;
};

// ── FLUSH ───────────────────────────────────────────────────────────────────
let currentOrgId: string | null = null;
let flushTimer: number | null = null;
let suppressFlush = false;

const scheduleFlush = () => {
  if (suppressFlush || !currentOrgId) return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => { flushTimer = null; void flushApprovalsToCloud(); }, 500);
};

export const flushApprovalsToCloud = async () => {
  const orgId = currentOrgId;
  if (!orgId) return;

  const approvals = readLocal<any[]>(APPROVAL_KEY, []);
  const deletions = readLocal<any[]>(DELETION_KEY, []);
  const cascades = readLocal<any[]>(CASCADE_KEY, []);
  const queue = readLocal<any[]>(QUEUE_KEY, []).filter(row => !isSeedQueueRow(row));

  await Promise.all([
    approvals.length ? supabase.from("approval_matrices").upsert(
      approvals.map(m => ({
        organization_id: orgId,
        local_id: m.id,
        name: m.name,
        mode: m.mode ?? null,
        steps: m.steps ?? [],
      })),
      { onConflict: "organization_id,local_id" },
    ) : Promise.resolve(),
    deletions.length ? supabase.from("deletion_matrices").upsert(
      deletions.map(m => ({
        organization_id: orgId,
        local_id: m.id,
        name: m.name,
        mode: m.mode ?? null,
        approver: m.approver ?? null,
        min_approvals: m.minApprovals ?? null,
      })),
      { onConflict: "organization_id,local_id" },
    ) : Promise.resolve(),
    cascades.length ? supabase.from("cascade_matrices").upsert(
      cascades.map(m => ({
        organization_id: orgId,
        local_id: m.id,
        name: m.name,
        scope_type: m.scopeType,
        scope_name: m.scopeName,
        shared_persons: m.sharedPersons ?? [],
      })),
      { onConflict: "organization_id,local_id" },
    ) : Promise.resolve(),
    queue.length ? supabase.from("approval_queue").upsert(
      queue.map(a => ({
        organization_id: orgId,
        local_id: a.id,
        kpi_card_local_id: a.kpiCardId,
        kpi_name: a.kpiName,
        matrix_local_id: a.matrixId || null,
        approver_ids: a.approverIds ?? [],
        decisions: a.decisions ?? {},
        status: a.status ?? "pending",
        steps_chain: a.stepsChain ?? null,
        current_step: a.currentStep ?? null,
        created_by: a.createdBy ?? null,
        created_at: a.createdAt ?? new Date().toISOString(),
        updated_at: a.updatedAt ?? new Date().toISOString(),
      })),
      { onConflict: "organization_id,local_id" },
    ) : Promise.resolve(),
  ]);
};

// ── LIFECYCLE ───────────────────────────────────────────────────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let rehydrateTimer: number | null = null;
let onFocusHandler: (() => void) | null = null;

const scheduleRehydrate = () => {
  if (!currentOrgId) return;
  if (rehydrateTimer) window.clearTimeout(rehydrateTimer);
  rehydrateTimer = window.setTimeout(() => {
    rehydrateTimer = null;
    if (currentOrgId) void hydrateApprovalsFromCloud(currentOrgId);
  }, 400);
};

export const activateApprovalsSync = async (orgId: string) => {
  if (currentOrgId === orgId) return;
  currentOrgId = orgId;
  suppressFlush = true;
  writeLocal(APPROVAL_KEY, []);
  writeLocal(DELETION_KEY, []);
  writeLocal(CASCADE_KEY, []);
  writeLocal(QUEUE_KEY, []);
  suppressFlush = false;
  await hydrateApprovalsFromCloud(orgId);
  window.addEventListener(MATRIX_EVT, scheduleFlush);
  window.addEventListener(CASCADE_EVT, scheduleFlush);
  window.addEventListener(QUEUE_EVT, scheduleFlush);

  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`approvals-live-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "approval_queue", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "approval_matrices", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "deletion_matrices", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "cascade_matrices", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .subscribe();

  onFocusHandler = () => scheduleRehydrate();
  window.addEventListener("focus", onFocusHandler);
};

export const deactivateApprovalsSync = () => {
  currentOrgId = null;
  window.removeEventListener(MATRIX_EVT, scheduleFlush);
  window.removeEventListener(CASCADE_EVT, scheduleFlush);
  window.removeEventListener(QUEUE_EVT, scheduleFlush);
  if (flushTimer) { window.clearTimeout(flushTimer); flushTimer = null; }
  if (rehydrateTimer) { window.clearTimeout(rehydrateTimer); rehydrateTimer = null; }
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (onFocusHandler) { window.removeEventListener("focus", onFocusHandler); onFocusHandler = null; }
};

/** Aktiv təşkilat id-si (approval yazıları üçün). */
export const getApprovalsOrgId = (): string | null => currentOrgId;

/** Bir approval sətrini DƏRHAL backend-ə yazır. true = uğurlu. */
export const persistApprovalRowToCloud = async (a: {
  id: string;
  kpiCardId: string;
  kpiName: string;
  matrixId?: string;
  approverIds?: string[];
  decisions?: Record<string, unknown>;
  status?: string;
  stepsChain?: string[][];
  currentStep?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}): Promise<boolean> => {
  if (!currentOrgId) return false;
  const payload = {
    organization_id: currentOrgId,
    local_id: a.id,
    kpi_card_local_id: a.kpiCardId,
    kpi_name: a.kpiName,
    matrix_local_id: a.matrixId || null,
    approver_ids: a.approverIds ?? [],
    decisions: a.decisions ?? {},
    status: a.status ?? "pending",
    steps_chain: (a.stepsChain as unknown as any) ?? null,
    current_step: a.currentStep ?? null,
    created_by: a.createdBy ?? null,
    created_at: a.createdAt ?? new Date().toISOString(),
    updated_at: a.updatedAt ?? new Date().toISOString(),
  } as any;

  const hasDecision = Object.values(a.decisions ?? {}).some((d: any) => d?.decision && d.decision !== "pending");
  if (hasDecision || a.status !== "pending") {
    const { data, error } = await supabase
      .from("approval_queue")
      .update(payload)
      .eq("organization_id", currentOrgId)
      .eq("local_id", a.id)
      .select("local_id")
      .maybeSingle();
    if (!error && data) return true;
    if (error) {
      console.error("[approvals] decision update failed", error);
      return false;
    }
  }

  const { error } = await supabase.from("approval_queue").upsert(payload, { onConflict: "organization_id,local_id" });
  if (error) {
    console.error("[approvals] persist failed", error);
    return false;
  }
  return true;
};
