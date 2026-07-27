// Central cross-panel KPI card registry. Mirrors KPI cards created via the wizard
// so that Manager / User panels can see (scoped) the same items HR sees.
// Persisted in localStorage + custom event for cross-tab/panel sync.

import { useEffect, useState } from "react";
import type { CreateKpiWizardDraft } from "@/components/kpi/CreateKpiWizard";

export type SharedKpiStatus = "qaralama" | "natamam" | "tesdiq_gozlenilir" | "imtina" | "aktiv" | "silindi" | "legv_olundu";
// Hədəf icra statusu — sistem üzrə yalnız 3 status:
// icrada = İcrada · tamamlandi = Hədəfə çatıb · gecikme = Hədəfə çatmayıb
export type ExecutionStatus = "icrada" | "tamamlandi" | "gecikme";

export interface SharedKpiCard {
  id: string;
  numericId?: number; // optional bridge to legacy KpiCardsPage rows
  name: string;
  ownerId: string;             // KPI sahibi (yaradan və ya "createdByEmployee")
  evaluatorIds: string[];      // qiymətləndiricilər (employee ids)
  assigneeIds: string[];       // hədəfin icra olunacağı şəxslər
  structureIds: string[];
  teamIds: string[];
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

const stableCardSort = (a: SharedKpiCard, b: SharedKpiCard) => {
  const byCreated = stableCardTime(b) - stableCardTime(a);
  if (byCreated !== 0) return byCreated;
  return stableCardId(a).localeCompare(stableCardId(b), "az", { numeric: true });
};

export const dedupeSharedKpiCards = (rows: SharedKpiCard[]): SharedKpiCard[] => {
  const byId = new Map<string, SharedKpiCard>();
  rows.forEach(row => byId.set(row.id, byId.has(row.id) ? betterCard(byId.get(row.id)!, row) : row));
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

export const setKpiStatus = (id: string, status: SharedKpiStatus, actor: string, note?: string) => {
  const list = load();
  const idx = list.findIndex(c => c.id === id || (c.numericId != null && (`kpi-${c.numericId}` === id || String(c.numericId) === id)));
  if (idx < 0) return;
  list[idx] = {
    ...list[idx],
    status,
    rejectedReason: status === "imtina" ? note : list[idx].rejectedReason,
    history: [...list[idx].history, { ts: new Date().toISOString(), actor, action: `status:${status}`, note }],
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

/** Convert a wizard draft into a shared KPI card snapshot. */
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
  matrixId: meta.matrixId,
  status: meta.status,
  startDate: d.startDate || "",
  endDate: d.endDate || "",
  frequency: d.frequency,
  scoringSystem: d.scoringSystem,
  targets: d.targets.map((t: any) => ({
    id: t.id, name: t.name, type: t.type, weight: t.weight, scoreLimit: t.scoreLimit,
    targetValue: t.targetValue ?? "",
    unit: t.type === "Məbləğ" ? (t.currency || "AZN") : t.type === "Faiz" ? "%" : (t.unit || ""),
    cascading: !!t.cascading,
    createdBy: t.createdBy,
    assigner: t.assigner,
  })),
  execution: {},
  history: [{ ts: new Date().toISOString(), actor: meta.ownerId, action: `created:${meta.status}` }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ---------- React hook ----------
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

