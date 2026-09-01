// İstifadəçinin KPI kartı (bir ədəd) daxilində ona təyin olunmuş hədəf-lar.
// Hər hədəf: ad, hədəf, faktiki, ölçü vahidi, çəki, status (qiymətləndirilib / gözləyir),
// və əlavə qiymətləndirmə sahələri (çətinliklər, dəstəkləyici sübut, növbəti dövr planı).

import { useEffect, useState } from "react";

export interface SubKpi {
  id: string;
  assigneeId: string;       // employee id (e.g. e4 = MOCK_USER_ID)
  cardId: string;           // valideyn KPI kartı
  name: string;
  description: string;
  target: number;
  actual?: number;          // hələ qeyd edilməyibsə undefined
  unit: string;
  weight: number;           // kart daxilində çəki (%)
  period: string;
  // Qiymətləndirmə nəticəsi:
  evaluatedScore?: number;  // 0..5
  selfComment?: string;
  challenges?: string;      // qarşılaşılan çətinliklər
  evidence?: string;        // dəstəkləyici qeyd / link
  nextPlan?: string;        // növbəti dövr üçün tədbir planı
  submittedAt?: number;
}

export interface KpiCardInfo {
  id: string;
  assigneeId: string;
  name: string;
  period: string;
}

const KEY = "user_kpi_subkpis_v3";
const EVT = "user-kpi-subkpis-updated";

export const USER_KPI_CARD: KpiCardInfo = {
  id: "",
  assigneeId: "",
  name: "",
  period: "",
};

export const MANAGER_KPI_CARDS: KpiCardInfo[] = [];

export const getKpiCardsFor = (assigneeId: string): KpiCardInfo[] => {
  const byCard = new Map<string, KpiCardInfo>();
  load().filter(k => k.assigneeId === assigneeId).forEach(k => {
    if (!byCard.has(k.cardId)) byCard.set(k.cardId, { id: k.cardId, assigneeId, name: k.cardId, period: k.period });
  });
  return Array.from(byCard.values());
};

const SEED: SubKpi[] = [];

const load = (): SubKpi[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
};

const persist = (rows: SubKpi[]) => {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVT));
};

/** Bütün qiymətləndirmə sətirləri (hesabatlar üçün). */
export const getAllSubKpis = (): SubKpi[] => load();

export const getSubKpis = (assigneeId: string): SubKpi[] =>
  load().filter(k => k.assigneeId === assigneeId);

/** Verilmiş sətirləri id-ə görə əlavə edir / əvəzləyir. */
export const upsertSubKpis = (rows: SubKpi[]) => {
  if (rows.length === 0) return;
  const list = load();
  const map = new Map(list.map(k => [k.id, k]));
  rows.forEach(r => map.set(r.id, { ...map.get(r.id), ...r }));
  persist(Array.from(map.values()));
};


export const saveSubKpiEvaluation = (
  id: string,
  patch: Partial<Pick<SubKpi, "evaluatedScore" | "actual" | "selfComment" | "challenges" | "evidence" | "nextPlan">>,
  base?: SubKpi,
) => {
  const list = load();
  const idx = list.findIndex(k => k.id === id);
  if (idx === -1) {
    // Sətir hələ anbarda yoxdursa (növbədən gələn hədəf) — əlavə et.
    if (!base) return;
    const { ...clean } = base;
    persist([...list, { ...clean, id, ...patch, submittedAt: Date.now() }]);
    return;
  }
  persist(list.map(k => (k.id === id ? { ...k, ...patch, submittedAt: Date.now() } : k)));
};

export const useAllSubKpis = (): SubKpi[] => {
  const [list, setList] = useState<SubKpi[]>(() => load());
  useEffect(() => {
    const refresh = () => setList(load());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
};

export const useSubKpis = (assigneeId: string): SubKpi[] => {

  const [list, setList] = useState<SubKpi[]>(() => getSubKpis(assigneeId));
  useEffect(() => {
    const refresh = () => setList(getSubKpis(assigneeId));
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [assigneeId]);
  return list;
};

/** Yerinə yetirmə faizi (0–100+). actual yoxdursa 0 qaytarır. */
export const calcCompletion = (k: SubKpi): number => {
  if (k.actual === undefined || k.target <= 0) return 0;
  const lowerBetter = /saat|gün|day|hour/i.test(k.unit);
  const pct = lowerBetter ? (k.target / Math.max(1, k.actual)) * 100 : (k.actual / k.target) * 100;
  return Math.max(0, pct);
};

/** Faizdən 0–5 bala konvertasiya (avtomatik təklif). */
export const completionToScore = (pct: number): number => {
  if (pct >= 100) return 5;
  if (pct >= 90) return 4;
  if (pct >= 75) return 3;
  if (pct >= 60) return 2;
  if (pct >= 40) return 1;
  return 0;
};

export const isEvaluated = (k: SubKpi) => k.evaluatedScore !== undefined;
