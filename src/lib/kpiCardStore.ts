// Central cross-panel KPI card registry. Mirrors KPI cards created via the wizard
// so that Manager / User panels can see (scoped) the same items HR sees.
// Persisted in localStorage + custom event for cross-tab/panel sync.

import { useEffect, useMemo, useState } from "react";
import type { CreateKpiWizardDraft } from "@/components/kpi/CreateKpiWizard";
import type { LimitSet, ScoreDescRow } from "@/lib/kpiSetStore";

export type SharedKpiStatus = "qaralama" | "natamam" | "tesdiq_gozlenilir" | "imtina" | "aktiv" | "silindi" | "legv_olundu";
// Hədəf icra statusu — sistem üzrə yalnız 3 status:
// icrada = İcrada · tamamlandi = Hədəfə çatıb · gecikme = Hədəfə çatmayıb
export type ExecutionStatus = "icrada" | "tamamlandi" | "gecikme";
export type SharedKpiAssignmentMode = "individual" | "bulk";

export interface SharedKpiCard {
  id: string;
  numericId?: number; // optional bridge to legacy KpiCardsPage rows
  name: string;
  ownerId: string;             // KPI sahibi (yaradan və ya "createdByEmployee")
  evaluatorIds: string[];      // qiymətləndiricilər (employee ids)
  assigneeIds: string[];       // hədəfin icra olunacağı şəxslər
  structureIds: string[];
  teamIds: string[];
  positionIds?: string[];
  assignmentMode: SharedKpiAssignmentMode; // Fərdi / Toplu — backend source of truth
  matrixId: string | null;     // seçilmiş təsdiqləmə matrisi
  status: SharedKpiStatus;
  rejectedReason?: string;
  startDate: string;
  endDate: string;
  frequency: string;
  scoringSystem: string;
  targets: {
    id: string; name: string; type: string; weight: number; scoreLimit: number;
    /** HR-in wizard-da yazdığı hədəf dəyəri (məs: "750000", "95%") */
    targetValue?: string;
    /** Vahid: AZN / USD / % / ədəd / bal ... */
    unit?: string;
    /** Bu hədəf cascadable-dırsa true */
    cascading?: boolean;
    /** self=Owner özü icra edir; other=Target-Setter təyin edir */
    createdBy?: "self" | "other";
    /** Target-Setter modunda: təyin edən şəxsin adı */
    assigner?: string;
    limits?: LimitSet;
    scoreDescriptions?: ScoreDescRow[];
    evaluator?: {
      type?: string | null;
      persons?: { name: string; weight: number }[];
      integrationName?: string;
      integrationWeight?: number;
      integrationFields?: string[];
    };
    ranges?: { id: string; min: string; max: string; score: string; weight?: string }[];
  }[];
  execution: Record<string, ExecutionStatus>; // assigneeId → status
  history: { ts: string; actor: string; action: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "shared_kpi_cards_v1";
const EVT = "shared-kpi-cards-updated";

const cardKey = (card: Pick<SharedKpiCard, "id" | "numericId" | "name" | "ownerId" | "startDate" | "endDate">) => {
  if (card.numericId != null) return `num:${card.numericId}`;
  const name = String(card.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `name:${name}::${card.ownerId || ""}::${card.startDate || ""}::${card.endDate || ""}`;
};

const betterCard = (a: SharedKpiCard, b: SharedKpiCard) => {
  const au = Date.parse(a.updatedAt || a.createdAt || "") || 0;
  const bu = Date.parse(b.updatedAt || b.createdAt || "") || 0;
  const aUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.id);
  const bUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id);
  if (aUuid !== bUuid) return aUuid ? a : b;
  return bu > au ? b : a;
};

const stableCardTime = (card: SharedKpiCard) => Date.parse(card.createdAt || "") || 0;

const stableCardId = (card: SharedKpiCard) => String(card.numericId ?? card.id ?? card.name ?? "");

const isDeletedSharedStatus = (status: SharedKpiStatus | undefined | null) =>
  status === "silindi" || status === "legv_olundu";

const stableCardSort = (a: SharedKpiCard, b: SharedKpiCard) => {
  const byCreated = stableCardTime(b) - stableCardTime(a);
  if (byCreated !== 0) return byCreated;
  return stableCardId(a).localeCompare(stableCardId(b), "az", { numeric: true });
};

export const inferSharedCardAssignmentMode = (card: Partial<SharedKpiCard>): SharedKpiAssignmentMode => {
  if (card.assignmentMode === "bulk" || card.assignmentMode === "individual") return card.assignmentMode;
  return (card.teamIds?.length ?? 0) > 0 || (card.structureIds?.length ?? 0) > 0 || (card.assigneeIds?.length ?? 0) > 1
    ? "bulk"
    : "individual";
};

const normalizeSharedKpiCard = (card: SharedKpiCard): SharedKpiCard => ({
  ...card,
  evaluatorIds: card.evaluatorIds ?? [],
  assigneeIds: card.assigneeIds ?? [],
  structureIds: card.structureIds ?? [],
  teamIds: card.teamIds ?? [],
  positionIds: card.positionIds ?? [],
  assignmentMode: inferSharedCardAssignmentMode(card),
  targets: card.targets ?? [],
  execution: card.execution ?? {},
  history: card.history ?? [],
});

export const dedupeSharedKpiCards = (rows: SharedKpiCard[]): SharedKpiCard[] => {
  const byId = new Map<string, SharedKpiCard>();
  rows.map(normalizeSharedKpiCard).forEach(row => byId.set(row.id, byId.has(row.id) ? betterCard(byId.get(row.id)!, row) : row));
  const byCard = new Map<string, SharedKpiCard>();
  Array.from(byId.values()).forEach(row => {
    const key = cardKey(row);
    byCard.set(key, byCard.has(key) ? betterCard(byCard.get(key)!, row) : row);
  });
  return Array.from(byCard.values()).sort(stableCardSort);
};

const load = (): SharedKpiCard[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const compact = dedupeSharedKpiCards(Array.isArray(parsed) ? parsed : []);
      if (Array.isArray(parsed) && compact.length !== parsed.length) localStorage.setItem(KEY, JSON.stringify(compact));
      return compact;
    }
  } catch {}
  const seed = seedCards();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
};

const save = (list: SharedKpiCard[]) => {
  localStorage.setItem(KEY, JSON.stringify(dedupeSharedKpiCards(list)));
  window.dispatchEvent(new Event(EVT));
};

export const getSharedKpiCards = (): SharedKpiCard[] => load();

/** Terminal statuslar — bu kartlar YALNIZ "KPI Kartları" modulunda görünür. */
export const TERMINAL_CARD_STATUSES = new Set<SharedKpiStatus>(["silindi", "legv_olundu", "imtina"]);

export const isTerminalCardStatus = (status?: SharedKpiStatus | string | null): boolean =>
  TERMINAL_CARD_STATUSES.has(String(status || "") as SharedKpiStatus);

/** Digər bütün modullar üçün kart siyahısı (silinmiş/ləğv olunmuş/imtina xaric). */
export const getVisibleSharedKpiCards = (): SharedKpiCard[] =>
  load().filter(c => !isTerminalCardStatus(c.status));

export const upsertSharedKpiCard = (card: SharedKpiCard) => {
  const list = load();
  const key = cardKey(card);
  const idx = list.findIndex(c => c.id === card.id || cardKey(c) === key);
  if (idx >= 0) {
    const existing = list[idx];
    const existingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing.id);
    const incomingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(card.id);
    list[idx] = {
      ...existing,
      ...card,
      // Kart artıq backend UUID-si alıbsa, sonrakı edit zamanı legacy `kpi-123`
      // id-si ilə əvəzlənməsin; əks halda hər flush yeni DB sətri yaradır.
      id: existingUuid && !incomingUuid ? existing.id : card.id,
      createdAt: existing.createdAt || card.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  else list.unshift({ ...card, createdAt: card.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  save(list);
};

/**
 * Rəhbərin təyin etdiyi hədəf məlumatını kartın əsas hədəf snapshot-ına yazır.
 * Beləliklə ad, növ, vahid, çəki və BSC məlumatları yalnız müvəqqəti KPI Set
 * keşində qalmır; refresh və başqa cihazlarda da kartla birlikdə hidrat olunur.
 */
export const applyAssignedTargetToSharedCard = (
  numericCardId: number,
  subKpiId: number,
  patch: {
    name?: string;
    type?: string;
    targetValue?: string;
    unit?: string;
    weight?: number;
    limits?: LimitSet;
    scoreDescriptions?: ScoreDescRow[];
    cascading?: boolean;
  },
) => {
  const list = load();
  const cardIndex = list.findIndex(card => card.numericId === numericCardId);
  if (cardIndex < 0) return;
  const card = list[cardIndex];
  const targetIndex = card.targets.findIndex((target, index) =>
    String(target.id) === String(subKpiId) || index + 1 === Number(subKpiId)
  );
  if (targetIndex < 0) return;

  const targets = card.targets.map((target, index) => index === targetIndex ? {
    ...target,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.targetValue !== undefined ? { targetValue: patch.targetValue } : {}),
    ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
    ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
    ...(patch.limits !== undefined ? { limits: patch.limits } : {}),
    ...(patch.scoreDescriptions !== undefined ? { scoreDescriptions: patch.scoreDescriptions } : {}),
    ...(patch.cascading !== undefined ? { cascading: patch.cascading } : {}),
  } : target);

  list[cardIndex] = { ...card, targets, updatedAt: new Date().toISOString() };
  save(list);
};

/** Kopyalanmış kart: istifadəçi özü təsdiqə göndərməyincə avtomatik "aktiv" ola bilməz. */
export const isCopyLockedCard = (card: Pick<SharedKpiCard, "history">): boolean => {
  const h = card.history ?? [];
  const copied = h.some(e => String(e.action || "").startsWith("copied"));
  if (!copied) return false;
  const submitted = h.some(e => {
    const a = String(e.action || "");
    return a === "status:tesdiq_gozlenilir" || a === "submitted" || (a.startsWith("status:") && e.actor && e.actor !== "system" && a !== "status:natamam");
  });
  return !submitted;
};

export const setKpiStatus = (id: string, status: SharedKpiStatus, actor: string, note?: string) => {
  const list = load();
  const idx = list.findIndex(c => c.id === id || (c.numericId != null && (`kpi-${c.numericId}` === id || String(c.numericId) === id)));
  if (idx < 0) return;
  if (isDeletedSharedStatus(list[idx].status) && !isDeletedSharedStatus(status)) return;
  // Kopya kartlar sistem tərəfindən avtomatik aktivləşdirilməməlidir.
  if (status === "aktiv" && actor === "system" && isCopyLockedCard(list[idx])) return;

  list[idx] = {
    ...list[idx],
    status,
    rejectedReason: status === "imtina" ? note : list[idx].rejectedReason,
    history: [...list[idx].history, { ts: new Date().toISOString(), actor, action: `status:${status}`, note }],
    updatedAt: new Date().toISOString(),
  };
  save(list);
};

/** Statusu dəyişmədən kartın tarixçəsinə qeyd əlavə edir (backend-ə də sinxronlaşır). */
export const appendKpiHistory = (id: string, actor: string, action: string, note?: string) => {
  const list = load();
  const idx = list.findIndex(c => c.id === id || (c.numericId != null && (`kpi-${c.numericId}` === id || String(c.numericId) === id)));
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    history: [...list[idx].history, { ts: new Date().toISOString(), actor, action, note }],
    updatedAt: new Date().toISOString(),
  };
  save(list);
};


export const updateExecution = (id: string, assigneeId: string, status: ExecutionStatus, actor: string) => {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    execution: { ...list[idx].execution, [assigneeId]: status },
    history: [...list[idx].history, { ts: new Date().toISOString(), actor, action: `execution:${assigneeId}=${status}` }],
    updatedAt: new Date().toISOString(),
  };
  save(list);
};

export const deleteSharedKpiCard = (id: string) => save(load().filter(c => c.id !== id));

const rangesToLimitSet = (ranges?: { min: string; max: string; score: string }[]): LimitSet | undefined => {
  if (!ranges || ranges.length === 0) return undefined;
  const zero = { min: 0, max: 0 };
  const out: LimitSet = { l1: { ...zero }, l2: { ...zero }, l3: { ...zero }, l4: { ...zero }, l5: { ...zero } };
  let touched = false;
  ranges.forEach(r => {
    const score = Number(r.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) return;
    out[`l${score}` as keyof LimitSet] = { min: Number(r.min) || 0, max: Number(r.max) || 0 };
    touched = true;
  });
  return touched ? out : undefined;
};

/** Convert a wizard draft into a shared KPI card snapshot. */
const AUTO_UNIT_BY_TYPE: Record<string, string> = {
  "Say": "ədəd", "Faiz": "%", "Nisbət": "əmsal",
  "İcra": "bal", "Səriştə": "bal", "Fərdi İnkişaf": "bal",
  "Boolean": "bəli/xeyr", "Zaman": "gün",
};

export const buildSharedCardFromDraft = (
  d: CreateKpiWizardDraft,
  meta: {
    id?: string;
    numericId?: number;
    ownerId: string;
    status: SharedKpiStatus;
    matrixId: string | null;
    assigneeIds?: string[];
    teamIds?: string[];
    structureIds?: string[];
    positionIds?: string[];
  },
): SharedKpiCard => ({
  id: meta.id || crypto.randomUUID(),
  numericId: meta.numericId,
  name: d.name || "Adsız KPI",
  ownerId: meta.ownerId,
  evaluatorIds: Array.from(new Set(d.targets.flatMap((t: any) => (
    Array.isArray(t.evaluators) && t.evaluators.length
      ? t.evaluators.map((e: any) => e.name)
      : [t.evaluator]
  )).filter(Boolean))),
  assigneeIds: meta.assigneeIds && meta.assigneeIds.length > 0
    ? meta.assigneeIds
    : Array.from(new Set(d.targets.map(t => t.assigner).filter(Boolean))),
  structureIds: meta.structureIds || [],
  teamIds: meta.teamIds || [],
  positionIds: meta.positionIds || [],
  assignmentMode: d.mode === "bulk" ? "bulk" : "individual",
  matrixId: meta.matrixId,
  status: meta.status,
  startDate: d.startDate || "",
  endDate: d.endDate || "",
  frequency: d.frequency,
  scoringSystem: d.scoringSystem,
  targets: d.targets.map((t: any) => ({
    id: t.id, name: t.name, type: t.type, weight: t.weight, scoreLimit: t.scoreLimit,
    targetValue: t.targetValue ?? "",
    unit: t.type === "Məbləğ" ? (t.currency || "AZN") : (AUTO_UNIT_BY_TYPE[t.type] ?? (t.unit || "")),
    cascading: !!t.cascading,
    createdBy: t.createdBy,
    assigner: t.assigner,
    limits: t.limits ?? rangesToLimitSet(t.ranges),
    scoreDescriptions: Array.isArray(t.scoreDescriptions)
      ? t.scoreDescriptions.map((s: any) => ({
        score: Number(s.score) || 0,
        description: s.description || "",
        timeStart: s.timeStart,
        timeEnd: s.timeEnd,
        isMinBonus: !!s.isMinBonus,
      }))
      : [],
    evaluator: Array.isArray(t.evaluators) && t.evaluators.length
      ? { type: "person", persons: t.evaluators.map((e: any) => ({ name: e.name, weight: Number(e.weight) || 0 })) }
      : undefined,
    ranges: Array.isArray(t.ranges) ? t.ranges : [],
  })),
  execution: {},
  history: [{ ts: new Date().toISOString(), actor: meta.ownerId, action: `created:${meta.status}` }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ---------- React hook ----------
/** Reaktiv siyahı — terminal statuslu kartlar daxil edilmir. */
export const useVisibleSharedKpiCards = (): SharedKpiCard[] => {
  const rows = useSharedKpiCards();
  return useMemo(() => rows.filter(c => !isTerminalCardStatus(c.status)), [rows]);
};

export const useSharedKpiCards = (): SharedKpiCard[] => {
  const [rows, setRows] = useState<SharedKpiCard[]>(() => load());
  useEffect(() => {
    const h = () => setRows(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return rows;
};

// ---------- Seed (a handful of cross-panel demo cards) ----------
function seedCards(): SharedKpiCard[] {
  return [];
}

