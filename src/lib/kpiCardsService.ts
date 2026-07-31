// KPI Cards cloud service — mirrors localStorage KPI card stores into Supabase
// and hydrates them from the DB on login. Follows the same pattern as
// `orgService.ts`: legacy synchronous stores keep working, this layer keeps
// the database authoritative.
//
// Covers:
//   • shared_kpi_cards_v1  (shared KPI card records + targets + history)
//   • kpi_card_status_v1   (status / matrix / rejection metadata by numeric id)
//   • kpi_card_meta_v1     (numeric card ↔ shared id bridge)

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  getSharedKpiCards, upsertSharedKpiCard,
  dedupeSharedKpiCards,
  type SharedKpiCard, type SharedKpiStatus, type ExecutionStatus,
} from "@/lib/kpiCardStore";
import { logAudit } from "@/lib/auditService";

const SHARED_KEY = "shared_kpi_cards_v1";
const STATUS_KEY = "kpi_card_status_v1";
const META_KEY   = "kpi_card_meta_v1";
const LEGACY_ROWS_KEY = "kpi_cards_v1";
const DRAFTS_KEY = "kpi_card_drafts_v1";
const EVT_SHARED = "shared-kpi-cards-updated";
const EVT_ALL    = "kpi-cards-updated";

const isDeletedStatus = (status: unknown) => status === "silindi" || status === "legv_olundu";

// ── Terminal status ledger ────────────────────────────────────────────────────
// "Silindi" / "Ləğv olunmuş" statusları terminaldır. Realtime rehydrate flush-dan
// əvvəl işlədikdə status köhnə dəyərə qayıtmasın deyə terminal statuslar lokal
// ledger-də saxlanılır və hydrate zamanı yenidən tətbiq olunur.
const TERMINAL_KEY = "kpi_terminal_status_v1";
type TerminalEntry = { status: string; reason?: string | null };
const readTerminalLedger = (): Record<string, TerminalEntry> => {
  try {
    const raw = localStorage.getItem(TERMINAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
};
const terminalKeys = (card: { id?: string; numericId?: number | null }) => {
  const keys: string[] = [];
  if (card.id) keys.push(`u:${String(card.id)}`);
  if (card.numericId != null) keys.push(`n:${String(card.numericId)}`);
  return keys;
};
const terminalFor = (card: { id?: string; numericId?: number | null }, ledger = readTerminalLedger()): TerminalEntry | undefined => {
  for (const k of terminalKeys(card)) {
    const hit = ledger[k];
    if (hit && isDeletedStatus(hit.status)) return hit;
  }
  return undefined;
};
export const recordTerminalStatus = (card: { id?: string; numericId?: number | null; status?: unknown; rejectedReason?: string | null }) => {
  if (!isDeletedStatus(card.status)) return;
  const ledger = readTerminalLedger();
  terminalKeys(card).forEach(k => { ledger[k] = { status: String(card.status), reason: card.rejectedReason ?? null }; });
  try { localStorage.setItem(TERMINAL_KEY, JSON.stringify(ledger)); } catch {}
};
/** Lokal snapshot-dakı bütün terminal statusları ledger-ə yazır. */
const captureTerminalStatuses = () => {
  try { getSharedKpiCards().forEach(c => recordTerminalStatus(c)); } catch {}
};

const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value ?? null)) as Json;

// ── local raw helpers (bypass the store's own events during hydration) ────────
const rawWrite = (key: string, value: unknown) =>
  localStorage.setItem(key, JSON.stringify(value));
const rawRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
};

const asPlainObject = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};

const hasPayload = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
};

const rangesToLimitSet = (ranges: unknown): Record<string, { min: number; max: number }> | undefined => {
  if (!Array.isArray(ranges)) return undefined;
  const out: Record<string, { min: number; max: number }> = {
    l1: { min: 0, max: 0 }, l2: { min: 0, max: 0 }, l3: { min: 0, max: 0 }, l4: { min: 0, max: 0 }, l5: { min: 0, max: 0 },
  };
  let touched = false;
  ranges.forEach((row: any) => {
    const score = Number(row?.score);
    const min = Number(row?.min);
    const max = Number(row?.max);
    if (!Number.isFinite(score) || score < 1 || score > 5 || !Number.isFinite(min) || !Number.isFinite(max)) return;
    out[`l${score}`] = { min, max };
    touched = true;
  });
  return touched ? out : undefined;
};

const unitFromDraftTarget = (target: any): string => {
  if (target?.type === "Məbləğ") return target?.currency || "AZN";
  if (target?.type === "Faiz") return "%";
  return target?.unit || "";
};

const evaluatorFromDraftTarget = (target: any): SharedKpiCard["targets"][number]["evaluator"] => {
  if (!Array.isArray(target?.evaluators) || target.evaluators.length === 0) return undefined;
  return {
    type: "person",
    persons: target.evaluators.map((e: any) => ({ name: e?.name || "", weight: Number(e?.weight) || 0 })),
  };
};

const targetsFromDraft = (draft: any): SharedKpiCard["targets"] => {
  if (!Array.isArray(draft?.targets)) return [];
  return draft.targets
    .map((target: any, index: number) => {
      const name = String(target?.name || `Hədəf ${index + 1}`).trim();
      if (!name) return null;
      const limits = hasPayload(target?.limits) ? target.limits : rangesToLimitSet(target?.ranges);
      return {
        id: String(target?.id || `target-${index + 1}`),
        name,
        type: target?.type ?? "",
        weight: Number(target?.weight ?? 0),
        scoreLimit: Number(target?.scoreLimit ?? 0),
        targetValue: String(target?.targetValue ?? ""),
        unit: unitFromDraftTarget(target),
        cascading: !!target?.cascading,
        createdBy: target?.createdBy === "other" ? "other" : "self",
        assigner: target?.assigner || undefined,
        limits,
        scoreDescriptions: Array.isArray(target?.scoreDescriptions) ? target.scoreDescriptions.map((s: any) => ({
          score: Number(s?.score) || 0,
          description: s?.description || "",
          timeStart: s?.timeStart,
          timeEnd: s?.timeEnd,
          isMinBonus: !!s?.isMinBonus,
        })) : [],
        evaluator: evaluatorFromDraftTarget(target),
        ranges: Array.isArray(target?.ranges) ? target.ranges : [],
      };
    })
    .filter((target): target is SharedKpiCard["targets"][number] => !!target);
};

/** Eyni hədəfin (ad və ya id üzrə) təkrarlanmasının qarşısını alır — ən zəngin sətir saxlanılır. */
const targetRichness = (t: SharedKpiCard["targets"][number]) =>
  (t.targetValue ? 1 : 0) + (t.limits ? 1 : 0) + (t.scoreDescriptions?.length ? 1 : 0) + (t.ranges?.length ? 1 : 0);

const dedupeTargets = (targets: SharedKpiCard["targets"]): SharedKpiCard["targets"] => {
  const byKey = new Map<string, SharedKpiCard["targets"][number]>();
  targets.forEach(t => {
    const key = String(t.name || "").trim().toLowerCase() || String(t.id);
    const prev = byKey.get(key);
    if (!prev || targetRichness(t) > targetRichness(prev)) byKey.set(key, t);
  });
  return Array.from(byKey.values());
};

const mergeTargetsWithDraft = (targets: SharedKpiCard["targets"], draft: any): SharedKpiCard["targets"] => {
  const draftTargets = dedupeTargets(targetsFromDraft(draft));
  if (draftTargets.length === 0) return dedupeTargets(targets);
  if (targets.length === 0) return draftTargets;
  // DB hədəfləri həqiqi mənbədir — draft yalnız boş sahələri doldurur, YENİ sətir yaratmır.
  return dedupeTargets(targets).map((target, index) => {
    const draftTarget = draftTargets.find(t => t.id === target.id) || draftTargets.find(t => t.name.trim().toLowerCase() === target.name.trim().toLowerCase()) || draftTargets[index];
    if (!draftTarget) return target;
    return {
      ...target,
      targetValue: target.targetValue || draftTarget.targetValue,
      unit: target.unit || draftTarget.unit,
      limits: target.limits || draftTarget.limits,
      scoreDescriptions: target.scoreDescriptions?.length ? target.scoreDescriptions : draftTarget.scoreDescriptions,
      evaluator: target.evaluator || draftTarget.evaluator,
      ranges: target.ranges?.length ? target.ranges : draftTarget.ranges,
    };
  });
};

/** Bir hidratasiya sessiyasında eyni kart üçün təkrar bərpa insert-i olmasın. */
const repairedCardIds = new Set<string>();

const draftForCard = (drafts: Record<string, any>, card: { legacy_numeric_id?: number | string | null; name?: string | null }) => {
  if (card.legacy_numeric_id != null) {
    const raw = String(card.legacy_numeric_id);
    const numeric = String(Number(card.legacy_numeric_id));
    if (drafts[raw]) return drafts[raw];
    if (drafts[numeric]) return drafts[numeric];
  }
  const name = String(card.name || "").trim().toLowerCase();
  if (!name) return undefined;
  return Object.values(drafts).find((draft: any) => String(draft?.name || "").trim().toLowerCase() === name);
};

const dbTargetPayload = (orgId: string, cardId: string, target: SharedKpiCard["targets"][number], index: number) => ({
  organization_id: orgId,
  kpi_card_id: cardId,
  legacy_id: target.id,
  name: target.name,
  type: target.type ?? null,
  weight: target.weight ?? 0,
  score_limit: target.scoreLimit ?? null,
  target_value: target.targetValue ?? null,
  unit: target.unit ?? null,
  cascading: !!target.cascading,
  created_by_mode: target.createdBy ?? null,
  assigner: target.assigner ?? null,
  limits: asJson(target.limits ?? {}),
  score_descriptions: asJson(target.scoreDescriptions ?? []),
  evaluator: asJson(target.evaluator ?? null),
  ranges: asJson(target.ranges ?? []),
  sort_order: index,
});

const replaceLocalKpiCache = (shared: SharedKpiCard[] = [], status: Record<number, any> = {}, meta: any[] = []) => {
  suppressFlush = true;
  rawWrite(SHARED_KEY, shared);
  rawWrite(STATUS_KEY, status);
  rawWrite(META_KEY, meta);
  rawWrite(LEGACY_ROWS_KEY, []);
  window.dispatchEvent(new Event(EVT_SHARED));
  window.dispatchEvent(new Event(EVT_ALL));
  suppressFlush = false;
};

// ── HYDRATE ───────────────────────────────────────────────────────────────────
export const hydrateKpiCardsFromCloud = async (orgId: string): Promise<void> => {
  const [cardsRes, targetsRes, historyRes, draftsRes] = await Promise.all([
    supabase.from("kpi_cards").select("*").eq("organization_id", orgId),
    supabase.from("kpi_card_targets").select("*").eq("organization_id", orgId).order("sort_order"),
    supabase.from("kpi_card_history").select("*").eq("organization_id", orgId).order("occurred_at"),
    supabase.from("org_catalogs").select("entries").eq("organization_id", orgId).eq("catalog_key", "kpi_card_drafts").maybeSingle(),
  ]);

  const cards = cardsRes.data ?? [];
  const targets = targetsRes.data ?? [];
  const history = historyRes.data ?? [];
  const cloudDrafts = asPlainObject((draftsRes.data as any)?.entries);
  const localDrafts = rawRead<Record<string, any>>(DRAFTS_KEY, {});
  const drafts = { ...localDrafts, ...cloudDrafts };

  // Empty backend means empty organization. Never bootstrap a new org from
  // browser/localStorage cache, otherwise old data leaks into freshly-created orgs.
  if (cards.length === 0) {
    replaceLocalKpiCache();
    return;
  }

  const targetsByCard = new Map<string, any[]>();
  for (const t of targets) {
    const arr = targetsByCard.get(t.kpi_card_id) ?? [];
    arr.push(t);
    targetsByCard.set(t.kpi_card_id, arr);
  }
  const historyByCard = new Map<string, any[]>();
  for (const h of history) {
    const arr = historyByCard.get(h.kpi_card_id) ?? [];
    arr.push(h);
    historyByCard.set(h.kpi_card_id, arr);
  }

  // Rebuild shared KPI card records.
  const shared: SharedKpiCard[] = dedupeSharedKpiCards(cards.map((c: any) => {
    const draft = draftForCard(drafts, c);
    const dbTargets: SharedKpiCard["targets"] = (targetsByCard.get(c.id) ?? []).map((t: any) => ({
      id: t.legacy_id ?? t.id,
      name: t.name,
      type: t.type ?? "",
      weight: Number(t.weight ?? 0),
      scoreLimit: Number(t.score_limit ?? 0),
      targetValue: t.target_value ?? "",
      unit: t.unit ?? "",
      cascading: !!t.cascading,
      createdBy: t.created_by_mode ?? undefined,
      assigner: t.assigner ?? undefined,
      limits: hasPayload(t.limits) ? t.limits : undefined,
      scoreDescriptions: Array.isArray(t.score_descriptions) ? t.score_descriptions : [],
      evaluator: t.evaluator ?? undefined,
      ranges: Array.isArray(t.ranges) ? t.ranges : [],
    }));
    return {
      id: c.id as string,
      numericId: c.legacy_numeric_id ?? undefined,
      name: c.name,
      ownerId: c.owner_employee_id ?? "",
      evaluatorIds: c.evaluator_ids ?? [],
      assigneeIds: c.assignee_ids ?? [],
      structureIds: c.structure_ids ?? [],
      teamIds: c.team_ids ?? [],
      positionIds: c.position_ids ?? [],
      assignmentMode: c.assignment_mode === "bulk" ? "bulk" : "individual",
      matrixId: c.matrix_id ?? null,
      status: (c.status as SharedKpiStatus) ?? "natamam",
      rejectedReason: c.rejected_reason ?? undefined,
      startDate: c.start_date ?? "",
      endDate: c.end_date ?? "",
      frequency: c.frequency ?? "",
      scoringSystem: c.scoring_system ?? "",
      targets: mergeTargetsWithDraft(dbTargets, draft),
      execution: (c.execution ?? {}) as Record<string, ExecutionStatus>,
      history: (historyByCard.get(c.id) ?? []).map((h: any) => ({
        ts: h.occurred_at,
        actor: h.actor ?? "",
        action: h.action,
        note: h.note ?? undefined,
      })),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }));

  const missingTargetRepairs = cards
    .filter((c: any) => (targetsByCard.get(c.id) ?? []).length === 0 && !repairedCardIds.has(String(c.id)))
    .flatMap((c: any) => {
      const rows = dedupeTargets(targetsFromDraft(draftForCard(drafts, c)));
      if (!rows.length) return [];
      repairedCardIds.add(String(c.id));
      return rows.map((target, index) => dbTargetPayload(orgId, c.id as string, target, index));
    });
  if (missingTargetRepairs.length > 0) {
    await supabase.from("kpi_card_targets").insert(missingTargetRepairs as never);
  }


  // Rebuild status + meta caches from card rows.
  const status: Record<number, any> = {};
  const meta: any[] = [];
  for (const c of cards) {
    if (c.legacy_numeric_id != null) {
      status[c.legacy_numeric_id] = {
        card_id: c.legacy_numeric_id,
        status: c.status,
        use_matrix: !!c.use_matrix,
        submitted_for_approval: !!c.submitted_for_approval,
        rejected_by: c.rejected_by ?? null,
        rejected_at: c.rejected_at ?? null,
        rejection_reason: c.rejected_reason ?? null,
        assignees: c.assignees ?? [],
        updated_at: c.updated_at,
      };
      meta.push({
        cardId: c.legacy_numeric_id,
        stringId: c.id,
        name: c.name,
        matrixId: c.matrix_id ?? null,
        ownerId: c.owner_employee_id ?? "",
        assigneeIds: c.assignee_ids ?? [],
        createdAt: Date.parse(c.created_at) || Date.now(),
      positionIds: c.position_ids ?? [],
      });
    }
  }

  replaceLocalKpiCache(shared, status, meta);
};

// ── SEED cloud from current local snapshot ────────────────────────────────────
const seedCloudFromLocal = async (orgId: string) => {
  const shared = getSharedKpiCards();
  const status = rawRead<Record<number, any>>(STATUS_KEY, {});
  const meta = rawRead<any[]>(META_KEY, []);
  const metaByCardId = new Map<number, any>();
  meta.forEach(m => metaByCardId.set(m.cardId, m));

  for (const c of shared) {
    const numeric = c.numericId ?? null;
    const s = numeric != null ? status[numeric] : undefined;
    const insertRes = await supabase.from("kpi_cards").insert({
      organization_id: orgId,
      legacy_numeric_id: numeric,
      name: c.name,
      owner_employee_id: c.ownerId || null,
      matrix_id: c.matrixId ?? null,
      status: c.status,
      rejected_reason: c.rejectedReason ?? s?.rejection_reason ?? null,
      rejected_by: s?.rejected_by ?? null,
      rejected_at: s?.rejected_at ?? null,
      use_matrix: !!s?.use_matrix,
      submitted_for_approval: !!s?.submitted_for_approval,
      start_date: c.startDate || null,
      end_date: c.endDate || null,
      frequency: c.frequency || null,
      scoring_system: c.scoringSystem || null,
      evaluator_ids: c.evaluatorIds,
      assignee_ids: c.assigneeIds,
      structure_ids: c.structureIds,
      team_ids: c.teamIds,
      position_ids: c.positionIds ?? [],
      assignment_mode: c.assignmentMode,
      execution: c.execution ?? {},
      assignees: s?.assignees ?? [],
    }).select("id").single();
    if (insertRes.error || !insertRes.data) { console.warn("seed kpi card failed", insertRes.error); continue; }
    const cardId = insertRes.data.id as string;

    // Update the shared card id to the new UUID so future flushes stay stable.
    upsertSharedKpiCard({ ...c, id: cardId });

    if (c.targets.length) {
      await supabase.from("kpi_card_targets").insert(c.targets.map((t, i) => dbTargetPayload(orgId, cardId, t, i)) as never);
    }
    if (c.history.length) {
      await supabase.from("kpi_card_history").insert(
        c.history.map(h => ({
          organization_id: orgId,
          kpi_card_id: cardId,
          actor: h.actor,
          action: h.action,
          note: h.note ?? null,
          occurred_at: h.ts,
        })),
      );
    }
  }
};

// ── FLUSH local → cloud (upsert everything visible in the local snapshot) ─────
let suppressFlush = false;
let flushTimer: number | null = null;
let currentOrgId: string | null = null;

const scheduleFlush = () => {
  if (suppressFlush || !currentOrgId) return;
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => { flushTimer = null; void flushLocalKpiCardsToCloud(); }, 500);
};

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const flushLocalKpiCardsToCloud = async () => {
  const orgId = currentOrgId;
  if (!orgId) return;
  const shared = getSharedKpiCards();
  const status = rawRead<Record<number, any>>(STATUS_KEY, {});
  const drafts = rawRead<Record<string, any>>(DRAFTS_KEY, {});
  const existingModesRes = await supabase
    .from("kpi_cards")
    .select("id, legacy_numeric_id, assignment_mode, status")
    .eq("organization_id", orgId);
  const modeByUuid = new Map<string, "individual" | "bulk">();
  const modeByNumeric = new Map<number, "individual" | "bulk">();
  const statusByUuid = new Map<string, SharedKpiStatus>();
  const statusByNumeric = new Map<number, SharedKpiStatus>();
  (existingModesRes.data ?? []).forEach((row: any) => {
    const mode = row.assignment_mode === "bulk" ? "bulk" : "individual";
    if (row.id) modeByUuid.set(String(row.id), mode);
    if (row.legacy_numeric_id != null) modeByNumeric.set(Number(row.legacy_numeric_id), mode);
    if (row.id && isDeletedStatus(row.status)) statusByUuid.set(String(row.id), row.status as SharedKpiStatus);
    if (row.legacy_numeric_id != null && isDeletedStatus(row.status)) statusByNumeric.set(Number(row.legacy_numeric_id), row.status as SharedKpiStatus);
  });

  for (const c of shared) {
    const numeric = c.numericId ?? null;
    const s = numeric != null ? status[numeric] : undefined;
    const persistedMode = (numeric != null ? modeByNumeric.get(Number(numeric)) : undefined) ?? modeByUuid.get(c.id);
    const assignmentMode = persistedMode ?? (c.assignmentMode === "bulk" ? "bulk" : "individual");
    const terminalStatus = [
      numeric != null ? statusByNumeric.get(Number(numeric)) : undefined,
      statusByUuid.get(c.id),
      s?.status,
      c.status,
    ].find(isDeletedStatus) as SharedKpiStatus | undefined;
    const effectiveStatus = terminalStatus ?? c.status;
    if (terminalStatus && c.status !== terminalStatus) {
      upsertSharedKpiCard({ ...c, status: terminalStatus });
    }
    const payload: any = {
      organization_id: orgId,
      legacy_numeric_id: numeric,
      name: c.name,
      owner_employee_id: c.ownerId || null,
      matrix_id: c.matrixId ?? null,
      status: effectiveStatus,
      rejected_reason: c.rejectedReason ?? s?.rejection_reason ?? null,
      rejected_by: s?.rejected_by ?? null,
      rejected_at: s?.rejected_at ?? null,
      use_matrix: !!s?.use_matrix,
      submitted_for_approval: !!s?.submitted_for_approval,
      start_date: c.startDate || null,
      end_date: c.endDate || null,
      frequency: c.frequency || null,
      scoring_system: c.scoringSystem || null,
      evaluator_ids: c.evaluatorIds,
      assignee_ids: c.assigneeIds,
      structure_ids: c.structureIds,
      team_ids: c.teamIds,
      position_ids: c.positionIds ?? [],
      assignment_mode: assignmentMode,
      execution: c.execution ?? {},
      assignees: s?.assignees ?? [],
    };

    let cardUuid: string | null = null;
    if (numeric != null) {
      const upsert = await supabase
        .from("kpi_cards")
        .upsert(payload, { onConflict: "organization_id,legacy_numeric_id" })
        .select("id")
        .single();
      if (upsert.data) {
        cardUuid = upsert.data.id as string;
        if (c.id !== cardUuid) upsertSharedKpiCard({ ...c, id: cardUuid });
      }
    } else if (isUuid(c.id)) {
      const upd = await supabase.from("kpi_cards").update(payload).eq("id", c.id).select("id").maybeSingle();
      if (upd.data) cardUuid = upd.data.id as string;
      else {
        const ins = await supabase.from("kpi_cards").insert({ ...payload, id: c.id }).select("id").single();
        if (ins.data) cardUuid = ins.data.id as string;
      }
    } else {
      const ins = await supabase.from("kpi_cards").insert(payload).select("id").single();
      if (ins.data) {
        cardUuid = ins.data.id as string;
        upsertSharedKpiCard({ ...c, id: cardUuid });
      }
    }
    if (!cardUuid) continue;

    // Replace-in-place for targets only when we have a non-empty authoritative target list.
    // Never let a stale empty local cache erase BSC targets from the backend.
    const targetsToPersist = mergeTargetsWithDraft(c.targets, draftForCard(drafts, { legacy_numeric_id: numeric, name: c.name }));
    if (targetsToPersist.length) {
      await supabase.from("kpi_card_targets").delete().eq("kpi_card_id", cardUuid);
      await supabase.from("kpi_card_targets").insert(targetsToPersist.map((t, i) => dbTargetPayload(orgId, cardUuid, t, i)) as never);
    }
    await supabase.from("kpi_card_history").delete().eq("kpi_card_id", cardUuid);
    if (c.history.length) {
      await supabase.from("kpi_card_history").insert(
        c.history.map(h => ({
          organization_id: orgId,
          kpi_card_id: cardUuid,
          actor: h.actor,
          action: h.action,
          note: h.note ?? null,
          occurred_at: h.ts,
        })),
      );
    }
  }
  void logAudit({
    organizationId: orgId,
    action: "sync",
    module: "kpi_cards",
    metadata: { cards: shared.length },
  });
};

// ── Realtime / cross-browser sync ─────────────────────────────────────────────
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let rehydrateTimer: number | null = null;
let onFocusHandler: (() => void) | null = null;

const scheduleRehydrate = () => {
  if (!currentOrgId) return;
  if (rehydrateTimer) window.clearTimeout(rehydrateTimer);
  rehydrateTimer = window.setTimeout(() => {
    rehydrateTimer = null;
    if (currentOrgId) void hydrateKpiCardsFromCloud(currentOrgId);
  }, 400);
};

// ── Attach to auth lifecycle ──────────────────────────────────────────────────
export const activateKpiCardsSync = async (orgId: string) => {
  if (currentOrgId === orgId) return;
  currentOrgId = orgId;
  replaceLocalKpiCache();
  await hydrateKpiCardsFromCloud(orgId);
  window.addEventListener(EVT_SHARED, scheduleFlush);
  window.addEventListener(EVT_ALL, scheduleFlush);

  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`kpi-cards-live-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "kpi_cards", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "kpi_card_targets", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .on("postgres_changes", { event: "*", schema: "public", table: "kpi_card_history", filter: `organization_id=eq.${orgId}` }, scheduleRehydrate)
    .subscribe();

  onFocusHandler = () => scheduleRehydrate();
  window.addEventListener("focus", onFocusHandler);
};

export const deactivateKpiCardsSync = () => {
  currentOrgId = null;
  window.removeEventListener(EVT_SHARED, scheduleFlush);
  window.removeEventListener(EVT_ALL, scheduleFlush);
  if (flushTimer) { window.clearTimeout(flushTimer); flushTimer = null; }
  if (rehydrateTimer) { window.clearTimeout(rehydrateTimer); rehydrateTimer = null; }
  if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (onFocusHandler) { window.removeEventListener("focus", onFocusHandler); onFocusHandler = null; }
};
