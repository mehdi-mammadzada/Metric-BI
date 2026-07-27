// Phase 1 cloud sync — mirrors the remaining localStorage business stores
// (teams, salaries, salary uploads, formulas, formula assignments, catalogs,
// dropdown catalogs, deletion requests) to Supabase using JSON-payload rows.
//
// Follows the same write-through pattern as approvalsService.ts:
//   - Hydrate: on login, pull cloud rows and overwrite the local cache.
//   - Flush:   on any local change (via a store's custom event), debounce
//              and push the whole payload back to cloud.
//
// This keeps the existing synchronous store APIs working (localStorage as
// cache) while making cloud the source of truth across devices/sessions.

import { supabase } from "@/integrations/supabase/client";

// ── Local <-> Cloud key map ─────────────────────────────────────────────────
// One entry per synced store. Each store dispatches `event` when it mutates.
interface StoreMirror {
  localKey: string;
  cloudKey: string;                 // catalog_key column value
  event: string;                    // window event dispatched on mutation
  table: "org_catalogs";            // generic JSON payload table
}

const STORES: StoreMirror[] = [
  { localKey: "kpi_periods_v1",              cloudKey: "periods",              event: "teams:updated",                       table: "org_catalogs" },
  { localKey: "kpi_formulas_v4",             cloudKey: "formulas",             event: "formulas:updated",                    table: "org_catalogs" },
  { localKey: "kpi_formula_variables_v4",    cloudKey: "formula_variables",    event: "formulas:updated",                    table: "org_catalogs" },
  { localKey: "kpi_formula_assignments_v1",  cloudKey: "formula_assignments",  event: "formula-assignments-updated",         table: "org_catalogs" },
  { localKey: "kpi_catalog_v2",              cloudKey: "catalog",              event: "catalog:updated",                     table: "org_catalogs" },
  { localKey: "kpi_dropdown_catalog_v1",     cloudKey: "dropdown_catalog",     event: "dropdown-catalog:updated",            table: "org_catalogs" },
  { localKey: "kpi_deletion_requests_v1",    cloudKey: "deletion_requests",    event: "kpi-deletion-requests-updated",       table: "org_catalogs" },
  { localKey: "kpi_deleted_ids_v1",          cloudKey: "deleted_kpi_ids",      event: "kpi-deletion-requests-updated",       table: "org_catalogs" },
  // Phase 2 — evaluation domain
  { localKey: "peer_reviews_v1",             cloudKey: "peer_reviews",         event: "peer-reviews:updated",                table: "org_catalogs" },
  { localKey: "competency_matrices_v1",      cloudKey: "competency_matrices",  event: "competency-matrices:updated",         table: "org_catalogs" },
  { localKey: "kpi_eval_scales_v2",          cloudKey: "eval_scales",          event: "eval-config-updated",                 table: "org_catalogs" },
  { localKey: "evaluation_surveys_v1",       cloudKey: "evaluation_surveys",   event: "surveys-updated",                     table: "org_catalogs" },
  // Phase 3 — governance domain
  { localKey: "wb_reports_v1",               cloudKey: "wb_reports",           event: "wb:updated",                          table: "org_catalogs" },
  { localKey: "kpi_operations_log_v1",       cloudKey: "operations_log",       event: "operations:updated",                  table: "org_catalogs" },
  { localKey: "cascade_tree_nodes_v4",       cloudKey: "cascade_tree",         event: "cascade-tree-updated",                table: "org_catalogs" },
  { localKey: "cascade_assignments_v2",      cloudKey: "cascade_assignments",  event: "cascade-assignments-updated",         table: "org_catalogs" },
  { localKey: "manual_peer_assignments_v1",  cloudKey: "manual_peer_assignments", event: "manual-assignments-updated",       table: "org_catalogs" },
  // Phase 5 — remaining stores sweep
  { localKey: "kpi_set_entries_v6",          cloudKey: "kpi_set_entries",      event: "kpi-set-updated",                     table: "org_catalogs" },
  { localKey: "kpi_hr_admin_accounts_v1",    cloudKey: "hr_admin_accounts",    event: "hr-admins-updated",                   table: "org_catalogs" },
  { localKey: "kpi_roles_v1",                cloudKey: "roles_catalog",        event: "kpi-roles-updated",                   table: "org_catalogs" },
  { localKey: "manager_cascade_load_v1",     cloudKey: "manager_cascade_load", event: "manager-cascade-load-updated",        table: "org_catalogs" },
  { localKey: "kpi_companies_v1",            cloudKey: "companies",            event: "companies-updated",                   table: "org_catalogs" },
  { localKey: "user_kpi_subkpis_v3",         cloudKey: "user_kpi_subkpis",     event: "user-kpi-subkpis-updated",            table: "org_catalogs" },
  { localKey: "kpi_eval_season_open_v1",     cloudKey: "season_open",          event: "season-updated",                      table: "org_catalogs" },
  // Struktur tipləri / vəzifə / meyar kataloqları (catalogStore.ts)
  { localKey: "kpi_catalog_struct_types_v1", cloudKey: "catalog_struct_types", event: "catalog-updated",                     table: "org_catalogs" },
  { localKey: "kpi_catalog_positions_v1",    cloudKey: "catalog_positions",    event: "catalog-updated",                     table: "org_catalogs" },
  { localKey: "kpi_catalog_criteria_v1",     cloudKey: "catalog_criteria",     event: "catalog-updated",                     table: "org_catalogs" },
];

const readLocal = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
};
const writeLocal = (key: string, value: unknown) => {
  try {
    const next = JSON.stringify(value);
    if (localStorage.getItem(key) !== next) localStorage.setItem(key, next);
  } catch { /* noop */ }
};

const normalizeKpiSetEntries = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  const norm = (v: unknown) => String(v ?? "").split(" — ")[0].trim().toLowerCase().replace(/\s+/g, " ");
  const keyOf = (row: any) => `${row?.cardId}::${norm(row?.assigneeName) || row?.assigneeId || ""}`;
  const map = new Map<string, any>();
  value.forEach((row: any) => {
    const key = keyOf(row);
    const prev = map.get(key);
    if (!prev || (prev.status !== "completed" && row?.status === "completed") || Number(row?.updatedAt || 0) > Number(prev?.updatedAt || 0)) {
      map.set(key, row);
    }
  });
  return Array.from(map.values()).sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));
};

const normalizeCascadeTree = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const keyOf = (row: any) => `${row?.parentId || "root"}::${norm(row?.cardName)}::${norm(row?.goalName)}::${row?.assigneeId ?? norm(row?.assigneeName)}`;
  const map = new Map<string, any>();
  value.forEach((row: any) => {
    const key = keyOf(row);
    const prev = map.get(key);
    if (!prev || Number(row?.updatedAt || row?.createdAt || 0) > Number(prev?.updatedAt || prev?.createdAt || 0)) map.set(key, row);
  });
  return Array.from(map.values()).sort((a, b) => Number(b?.updatedAt || b?.createdAt || 0) - Number(a?.updatedAt || a?.createdAt || 0));
};

const normalizeStoreValue = (localKey: string, value: unknown): unknown => {
  if (localKey === "kpi_set_entries_v6") return normalizeKpiSetEntries(value);
  if (localKey === "cascade_tree_nodes_v4") return normalizeCascadeTree(value);
  return value;
};

let suppressFlush = false;
const lastWrittenJson = new Map<string, string>();

// ── Hydrate ─────────────────────────────────────────────────────────────────
export const hydratePhase1FromCloud = async (orgId: string): Promise<void> => {
  const cloudKeys = STORES.map(s => s.cloudKey);
  const { data, error } = await supabase
    .from("org_catalogs")
    .select("catalog_key, entries")
    .eq("organization_id", orgId)
    .in("catalog_key", cloudKeys);
  if (error || !data) return;

  const byKey = new Map<string, unknown>(data.map(r => [r.catalog_key as string, r.entries]));
  const touchedEvents = new Set<string>();
  suppressFlush = true;
  try {
    for (const store of STORES) {
      const val = byKey.get(store.cloudKey);
      if (val !== undefined && val !== null) {
        const normalized = normalizeStoreValue(store.localKey, val);
        writeLocal(store.localKey, normalized);
        lastWrittenJson.set(store.localKey, JSON.stringify(normalized));
        touchedEvents.add(store.event);
      }
    }
  } finally {
    suppressFlush = false;
  }
  // Notify UI hooks so they re-read their stores.
  touchedEvents.forEach(evt => window.dispatchEvent(new Event(evt)));
};

// ── Flush ───────────────────────────────────────────────────────────────────
let currentOrgId: string | null = null;
const flushTimers = new Map<string, number>();

const scheduleFlush = (localKey?: string) => {
  if (suppressFlush || !currentOrgId) return;
  const key = localKey ?? "*";
  const existing = flushTimers.get(key);
  if (existing) window.clearTimeout(existing);
  const t = window.setTimeout(() => {
    flushTimers.delete(key);
    void flushPhase1ToCloud(key === "*" ? undefined : key);
  }, 1200);
  flushTimers.set(key, t);
};

export const flushPhase1ToCloud = async (localKey?: string) => {
  const orgId = currentOrgId;
  if (!orgId) return;
  type Row = { organization_id: string; catalog_key: string; entries: unknown };
  const stores = localKey ? STORES.filter(s => s.localKey === localKey) : STORES;
  const rows: Row[] = [];
  const changedKeys: string[] = [];
  for (const s of stores) {
    const rawEntries = readLocal<unknown>(s.localKey, null);
    const entries = normalizeStoreValue(s.localKey, rawEntries);
    if (entries === null || entries === undefined) continue;
    const json = JSON.stringify(entries);
    if (lastWrittenJson.get(s.localKey) === json) continue;
    rows.push({ organization_id: orgId, catalog_key: s.cloudKey, entries });
    changedKeys.push(s.localKey);
  }
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("org_catalogs")
    .upsert(rows as never, { onConflict: "organization_id,catalog_key" });
  if (error) return;
  changedKeys.forEach((key, index) => lastWrittenJson.set(key, JSON.stringify(rows[index].entries)));
};

// ── Lifecycle ───────────────────────────────────────────────────────────────
const trackedLocalKeys = new Set(STORES.map(s => s.localKey));
let originalSetItem: ((key: string, value: string) => void) | null = null;
let originalRemoveItem: ((key: string) => void) | null = null;

const installStoragePatch = () => {
  if (originalSetItem) return;
  originalSetItem = Storage.prototype.setItem;
  originalRemoveItem = Storage.prototype.removeItem;
  const setItem = originalSetItem;
  const removeItem = originalRemoveItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    const prev = this === window.localStorage ? this.getItem(key) : null;
    setItem.call(this, key, value);
    if (this === window.localStorage && trackedLocalKeys.has(key) && prev !== value) scheduleFlush(key);
  };
  Storage.prototype.removeItem = function (key: string) {
    removeItem.call(this, key);
    if (this === window.localStorage && trackedLocalKeys.has(key)) scheduleFlush(key);
  };
};

const uninstallStoragePatch = () => {
  if (originalSetItem) { Storage.prototype.setItem = originalSetItem; originalSetItem = null; }
  if (originalRemoveItem) { Storage.prototype.removeItem = originalRemoveItem; originalRemoveItem = null; }
};

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let rehydrateTimer: number | null = null;
let refreshInterval: number | null = null;
let onFocusHandler: (() => void) | null = null;

const scheduleRehydrate = () => {
  if (!currentOrgId) return;
  if (rehydrateTimer) window.clearTimeout(rehydrateTimer);
  rehydrateTimer = window.setTimeout(() => {
    rehydrateTimer = null;
    if (currentOrgId) void hydratePhase1FromCloud(currentOrgId);
  }, 500);
};

export const activatePhase1Sync = async (orgId: string) => {
  if (currentOrgId === orgId) return;
  currentOrgId = orgId;
  // Purge any stale local seed for tracked keys BEFORE hydrating.
  // This prevents a fresh browser from later flushing a demo seed back to the
  // cloud (which would overwrite the real data other browsers wrote).
  suppressFlush = true;
  try {
    for (const s of STORES) {
      try { localStorage.removeItem(s.localKey); } catch { /* noop */ }
      lastWrittenJson.delete(s.localKey);
    }
  } finally {
    suppressFlush = false;
  }
  await hydratePhase1FromCloud(orgId);
  installStoragePatch();

  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`catalogs-live-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "org_catalogs", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .subscribe();

  onFocusHandler = () => scheduleRehydrate();
  window.addEventListener("focus", onFocusHandler);
  if (refreshInterval) window.clearInterval(refreshInterval);
  refreshInterval = window.setInterval(scheduleRehydrate, 120000);
};


export const deactivatePhase1Sync = () => {
  currentOrgId = null;
  uninstallStoragePatch();
  flushTimers.forEach(t => window.clearTimeout(t));
  flushTimers.clear();
  if (rehydrateTimer) { window.clearTimeout(rehydrateTimer); rehydrateTimer = null; }
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (onFocusHandler) { window.removeEventListener("focus", onFocusHandler); onFocusHandler = null; }
  if (refreshInterval) { window.clearInterval(refreshInterval); refreshInterval = null; }
};
