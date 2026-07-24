// KPI Lifecycle + Templates cloud service.
// Hydrates from Supabase into localStorage-backed stores, and flushes
// local edits back on change events (kpi-lifecycle-updated / kpi-lifecycle-templates-updated).

import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditService";

const LIFECYCLE_KEY = "kpi_lifecycle_v2";
const TEMPLATES_KEY = "kpi_lifecycle_templates_v2";
const LIFECYCLE_EVT = "kpi-lifecycle-updated";
const TEMPLATES_EVT = "kpi-lifecycle-templates-updated";

const readLocal = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
};

const newer = (a: any, b: any) => {
  const at = Date.parse(a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || "") || 0;
  const bt = Date.parse(b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || "") || 0;
  return bt > at ? b : a;
};

const mergeBy = <T extends Record<string, any>>(localRows: T[], cloudRows: T[], keyOf: (row: T) => string): T[] => {
  const map = new Map<string, T>();
  localRows.forEach(row => map.set(keyOf(row), row));
  cloudRows.forEach(row => {
    const key = keyOf(row);
    map.set(key, map.has(key) ? newer(map.get(key), row) : row);
  });
  return Array.from(map.values());
};

// ── HYDRATE ─────────────────────────────────────────────────────────────────
export const hydrateLifecycleFromCloud = async (orgId: string): Promise<void> => {
  const [lcRes, tplRes] = await Promise.all([
    supabase.from("kpi_lifecycles").select("*").eq("organization_id", orgId),
    supabase.from("lifecycle_templates").select("*").eq("organization_id", orgId),
  ]);

  if (!lcRes.error && lcRes.data) {
    const localLifecycles = readLocal<any[]>(LIFECYCLE_KEY, []);
    const cloudLifecycles = lcRes.data.map(r => ({
      cardId: Number(r.card_local_id),
      cardName: r.card_name,
      assignment: r.assignment ?? undefined,
      evaluation: r.evaluation ?? undefined,
      bonus: r.bonus ?? undefined,
      reviews: r.reviews ?? [],
      updatedAt: r.updated_at,
    }));
    writeLocal(
      LIFECYCLE_KEY,
      mergeBy(localLifecycles, cloudLifecycles, row => String(row.cardId))
        .sort((a, b) => String(a.cardName || "").localeCompare(String(b.cardName || ""))),
    );
  }
  if (!tplRes.error && tplRes.data) {
    const localTemplates = readLocal<any[]>(TEMPLATES_KEY, []);
    const cloudTemplates = tplRes.data.map(r => ({
      id: r.local_id,
      name: r.name,
      description: r.description ?? undefined,
      data: r.data ?? {},
      isSystem: r.is_system,
      active: r.active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    writeLocal(TEMPLATES_KEY, mergeBy(localTemplates, cloudTemplates, row => String(row.id)));
  }

  window.dispatchEvent(new Event(LIFECYCLE_EVT));
  window.dispatchEvent(new Event(TEMPLATES_EVT));
};

// ── FLUSH ───────────────────────────────────────────────────────────────────
let currentOrgId: string | null = null;
let flushTimer: number | null = null;
let suppressFlush = false;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let rehydrateTimer: number | null = null;
let onFocusHandler: (() => void) | null = null;

const scheduleFlush = () => {
  if (suppressFlush || !currentOrgId) return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => { flushTimer = null; void flushLifecycleToCloud(); }, 500);
};

const scheduleRehydrate = () => {
  if (!currentOrgId) return;
  if (rehydrateTimer) window.clearTimeout(rehydrateTimer);
  rehydrateTimer = window.setTimeout(() => {
    rehydrateTimer = null;
    if (!currentOrgId) return;
    suppressFlush = true;
    void hydrateLifecycleFromCloud(currentOrgId).finally(() => { suppressFlush = false; });
  }, 400);
};

export const flushLifecycleToCloud = async () => {
  const orgId = currentOrgId;
  if (!orgId) return;

  const lifecycles = readLocal<any[]>(LIFECYCLE_KEY, []);
  const templates = readLocal<any[]>(TEMPLATES_KEY, []);

  await Promise.all([
    lifecycles.length ? supabase.from("kpi_lifecycles").upsert(
      lifecycles.map(l => ({
        organization_id: orgId,
        card_local_id: String(l.cardId),
        card_name: l.cardName ?? "",
        assignment: l.assignment ?? null,
        evaluation: l.evaluation ?? null,
        bonus: l.bonus ?? null,
        reviews: l.reviews ?? [],
      })),
      { onConflict: "organization_id,card_local_id" },
    ) : Promise.resolve(),
    templates.length ? supabase.from("lifecycle_templates").upsert(
      templates.map(t => ({
        organization_id: orgId,
        local_id: t.id,
        name: t.name,
        description: t.description ?? null,
        data: t.data ?? {},
        is_system: !!t.isSystem,
        active: t.active !== false,
      })),
      { onConflict: "organization_id,local_id" },
    ) : Promise.resolve(),
  ]);

  void logAudit({
    organizationId: orgId,
    action: "sync",
    module: "lifecycle",
    metadata: { lifecycles: lifecycles.length, templates: templates.length },
  });
};

// ── LIFECYCLE ───────────────────────────────────────────────────────────────
export const activateLifecycleSync = async (orgId: string) => {
  if (currentOrgId === orgId) return;
  currentOrgId = orgId;
  suppressFlush = true;
  await hydrateLifecycleFromCloud(orgId);
  suppressFlush = false;
  window.addEventListener(LIFECYCLE_EVT, scheduleFlush);
  window.addEventListener(TEMPLATES_EVT, scheduleFlush);
  await flushLifecycleToCloud();

  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`lifecycle-live-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "kpi_lifecycles", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "lifecycle_templates", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .subscribe();

  onFocusHandler = () => scheduleRehydrate();
  window.addEventListener("focus", onFocusHandler);
};

export const deactivateLifecycleSync = () => {
  currentOrgId = null;
  window.removeEventListener(LIFECYCLE_EVT, scheduleFlush);
  window.removeEventListener(TEMPLATES_EVT, scheduleFlush);
  if (flushTimer) { window.clearTimeout(flushTimer); flushTimer = null; }
  if (rehydrateTimer) { window.clearTimeout(rehydrateTimer); rehydrateTimer = null; }
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (onFocusHandler) { window.removeEventListener("focus", onFocusHandler); onFocusHandler = null; }
};
