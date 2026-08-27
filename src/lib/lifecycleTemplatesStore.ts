// Lifecycle şablonları — KPI Lifecycle planlarını şablon kimi yadda saxlayıb yenidən tətbiq etmək üçün.
import { useEffect, useState } from "react";
import type { CardLifecycle, LifecycleStage, LifecycleReview } from "./kpiLifecycleStore";

export interface StageOffset { startOffset: number; endOffset: number }
export interface ReviewOffset extends StageOffset { id: string; period?: string }

export interface LifecycleTemplateOffsets {
  assignment?: StageOffset;
  evaluation?: StageOffset;
  bonus?: StageOffset;
  reviews?: ReviewOffset[];
}

export interface LifecycleTemplateData {
  assignment?: LifecycleStage;
  evaluation?: LifecycleStage;
  bonus?: LifecycleStage;
  reviews: LifecycleReview[];
  /** Marker for dynamic date computation (e.g. "monthly-standard") */
  dynamic?: string;
  /** Nisbi vaxt aralıqları — KPI başlanğıc tarixinə əsasən (gün). */
  offsets?: LifecycleTemplateOffsets;
}

export interface LifecycleTemplate {
  id: string;
  name: string;
  description?: string;
  data: LifecycleTemplateData;
  createdAt: string;
  isSystem?: boolean;
  active: boolean;
}

const KEY = "kpi_lifecycle_templates_v2";
const LEGACY_KEY = "kpi_lifecycle_templates_v1";
const EVT = "kpi-lifecycle-templates-updated";


const load = (): LifecycleTemplate[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LifecycleTemplate[];
      // Sistem tərəfindən yaradılmış şablonlar göstərilmir/silinir.
      const filtered = parsed.filter(t => !t.isSystem);
      if (filtered.length !== parsed.length) {
        persist(filtered);
      }
      return filtered;
    }
    // Migrate legacy
    let legacy: LifecycleTemplate[] = [];
    try {
      const lraw = localStorage.getItem(LEGACY_KEY);
        if (lraw) {
          const parsed = JSON.parse(lraw);
          if (Array.isArray(parsed)) {
            legacy = parsed
              .filter((t: any) => !t.isSystem)
              .map((t: any) => ({
                ...t,
                active: t.active ?? true,
                isSystem: false,
              }));
          }
        }

    } catch {}
    localStorage.setItem(KEY, JSON.stringify(legacy));
    return legacy;
  } catch {
    return [];
  }
};


const persist = (list: LifecycleTemplate[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const getLifecycleTemplates = (): LifecycleTemplate[] => load();

export const addLifecycleTemplate = (
  t: Omit<LifecycleTemplate, "id" | "createdAt" | "active"> & { active?: boolean },
) => {
  const list = load();
  const entry: LifecycleTemplate = {
    ...t,
    active: t.active ?? true,
    id: `tpl-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  persist([entry, ...list]);
  return entry;
};

export const updateLifecycleTemplate = (
  id: string,
  patch: Partial<Omit<LifecycleTemplate, "id" | "createdAt">>,
) => {
  const list = load().map(t => (t.id === id ? { ...t, ...patch } : t));
  persist(list);
};

export const toggleLifecycleTemplateActive = (id: string) => {
  const list = load().map(t => (t.id === id ? { ...t, active: !t.active } : t));
  persist(list);
};

export const deleteLifecycleTemplate = (id: string) => {
  const list = load();
  persist(list.filter(t => t.id !== id));
};


export const useLifecycleTemplates = (): LifecycleTemplate[] => {
  const [list, setList] = useState<LifecycleTemplate[]>(() => load());
  useEffect(() => {
    const r = () => setList(load());
    window.addEventListener(EVT, r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener(EVT, r);
      window.removeEventListener("storage", r);
    };
  }, []);
  return list;
};

// ---- Dynamic date computation ----
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const addDays = (d: Date, days: number): Date => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
};
const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0);

/**
 * Standart aylıq KPI Lifecycle tarix hesablaması.
 * createdAtISO — KPI-ın yaradıldığı tarix (YYYY-MM-DD).
 */
export const computeStandardMonthlyLifecycle = (
  createdAtISO: string,
): Omit<CardLifecycle, "cardId" | "cardName" | "updatedAt"> => {
  const created = createdAtISO ? parseISO(createdAtISO) : new Date();
  const monthEnd = endOfMonth(created);

  const assignStart = created;
  const assignEnd = addDays(created, 2);

  const reviewStart = addDays(assignEnd, 1);
  const reviewEnd = addDays(reviewStart, 5);

  const evalStart = addDays(monthEnd, -5);
  const evalEnd = addDays(monthEnd, -2);

  const bonusStart = addDays(evalEnd, 1);
  const bonusEnd = monthEnd;

  return {
    assignment: { period: "Aylıq", start: toISO(assignStart), end: toISO(assignEnd) },
    evaluation: { period: "Aylıq", start: toISO(evalStart), end: toISO(evalEnd) },
    bonus: { period: "Aylıq", start: toISO(bonusStart), end: toISO(bonusEnd) },
    reviews: [{ id: "r-standard", period: "Aylıq", start: toISO(reviewStart), end: toISO(reviewEnd) }],
  };
};

const daysBetween = (baseISO: string, targetISO: string): number =>
  Math.round((parseISO(targetISO).getTime() - parseISO(baseISO).getTime()) / 86400000);

/**
 * Lifecycle datasından KPI başlanğıc tarixinə (assignment.start) əsasən nisbi
 * ofsetlər (gün) hesablayır. Base yoxdursa undefined qaytarır.
 */
export const buildTemplateOffsets = (
  data: Pick<LifecycleTemplateData, "assignment" | "evaluation" | "bonus" | "reviews">,
): LifecycleTemplateOffsets | undefined => {
  const base = data.assignment?.start;
  if (!base) return undefined;
  const off = (s?: LifecycleStage): StageOffset | undefined =>
    s?.start && s?.end
      ? { startOffset: daysBetween(base, s.start), endOffset: daysBetween(base, s.end) }
      : undefined;
  return {
    assignment: off(data.assignment),
    evaluation: off(data.evaluation),
    bonus: off(data.bonus),
    reviews: (data.reviews || [])
      .filter(r => r.start && r.end)
      .map(r => ({
        id: r.id,
        period: r.period,
        startOffset: daysBetween(base, r.start),
        endOffset: daysBetween(base, r.end),
      })),
  };
};

/**
 * Şablonu KPI başlanğıc tarixinə tətbiq edərək CardLifecycle datası qaytarır.
 * — dynamic="monthly-standard" olsa, hesablama yolu ilə tarixlər tərtib olunur.
 * — offsets sahəsi varsa, KPI startDate + offset günlərlə hər mərhələ hesablanır.
 * — əks halda, şablonun orijinal (absolut) tarixləri istifadə olunur.
 */
export const resolveTemplateLifecycle = (
  tpl: LifecycleTemplate,
  startDateISO: string,
): Omit<CardLifecycle, "cardId" | "cardName" | "updatedAt"> => {
  if (tpl.data.dynamic === "monthly-standard") {
    return computeStandardMonthlyLifecycle(startDateISO);
  }
  const off = tpl.data.offsets;
  if (off && startDateISO) {
    const base = parseISO(startDateISO);
    const apply = (o: StageOffset | undefined, period: string) =>
      o ? { period, start: toISO(addDays(base, o.startOffset)), end: toISO(addDays(base, o.endOffset)) } : undefined;
    return {
      assignment: apply(off.assignment, tpl.data.assignment?.period ?? "Aylıq"),
      evaluation: apply(off.evaluation, tpl.data.evaluation?.period ?? "Aylıq"),
      bonus: apply(off.bonus, tpl.data.bonus?.period ?? "Aylıq"),
      reviews: (off.reviews || []).map(r => ({
        id: r.id,
        period: r.period || "Aylıq",
        start: toISO(addDays(base, r.startOffset)),
        end: toISO(addDays(base, r.endOffset)),
      })),
    };
  }
  const { dynamic: _d, offsets: _o, ...rest } = tpl.data;
  return rest;
};

export const STANDARD_MONTHLY_TEMPLATE_ID = STANDARD_ID;
