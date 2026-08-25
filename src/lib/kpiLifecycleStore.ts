// KPI Lifecycle saxlama — hər KPI kartı üçün planlama mərhələləri.
// localStorage-də saxlanılır, dəyişiklikləri "kpi-lifecycle-updated" eventi ilə bildirir.

import { useEffect, useState } from "react";

export interface LifecycleStage {
  period: string; // dropdown catalog dəyəri (statik) və ya "Digər"
  /** period === "Digər" olduqda kpi_periods kataloqundan seçilmiş dövrün id-si */
  customPeriodId?: number;
  /** "Digər" seçildikdə göstərilən etiket (məs. "6 ay (16.06.2026 — 16.12.2026)") */
  customPeriodLabel?: string;
  start: string;  // YYYY-MM-DD
  end: string;    // YYYY-MM-DD
}

export type ReviewOutcomeStatus = "held" | "deferred" | "in_progress" | "missed";

export interface LifecycleReview extends LifecycleStage {
  id: string;
  /** İstifadəçi tərəfindən qeyd olunan nəticə. Boş olarsa status tarixdən hesablanır. */
  outcomeStatus?: ReviewOutcomeStatus;
  /** Nəticə şərhi — "Təxirə salındı" və "Keçirilmədi" üçün məcburidir. */
  outcomeComment?: string;
  /** Nəticənin qeyd olunma tarixi (ISO). */
  outcomeAt?: string;
  /** Nəticəni qeyd edən şəxsin adı. */
  outcomeBy?: string;
  /** Review üçün seçilmiş iştirakçı əməkdaş id-ləri (Təşkilat modulundan). */
  participantIds?: string[];
  /** KPI kartı yaradılarkən verilmiş review adı (məs. "Review #1"). */
  name?: string;
  /** Köhnə kartlardan gələn tək review keçirən şəxs adı. */
  reviewerName?: string;
  /** KPI kartı yaradılarkən seçilmiş review-u keçirəcək şəxs(lər)in adları. */
  reviewerNames?: string[];
}


export interface CardLifecycle {
  cardId: number;
  cardName: string;
  assignment?: LifecycleStage;
  evaluation?: LifecycleStage;
  bonus?: LifecycleStage;
  reviews: LifecycleReview[];
  updatedAt: string;
}

const KEY = "kpi_lifecycle_v2";
const EVT = "kpi-lifecycle-updated";

const SEED: CardLifecycle[] = [];

const load = (): CardLifecycle[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CardLifecycle[];
  } catch {}
  return [];
};

const persist = (list: CardLifecycle[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const getAllLifecycles = (): CardLifecycle[] => load();

export const getLifecycle = (cardId: number): CardLifecycle | undefined =>
  load().find(l => l.cardId === cardId);

/**
 * Kartın öz startDate/endDate/frequency-sinə əsasən lifecycle qaytarır.
 * Real yazılmış lifecycle varsa onu, yoxdursa avtomatik doldurulmuş nümunə qaytarır.
 * Qaralama statuslu kartlarda istifadə edilməməlidir.
 */
export const getLifecycleWithFallback = (
  cardId: number,
  cardName: string,
  meta?: { startDate?: string; endDate?: string; frequency?: string },
): CardLifecycle => {
  const existing = getLifecycle(cardId);
  if (existing) return existing;
  const start = meta?.startDate || "";
  const end = meta?.endDate || "";
  const period = meta?.frequency || "Aylıq";
  return {
    cardId,
    cardName,
    assignment: { period, start, end: start || end },
    evaluation: { period, start: end, end },
    bonus: { period, start: end, end },
    reviews: [],
    updatedAt: new Date().toISOString(),
  };
};


export const setCardLifecycle = (
  cardId: number,
  cardName: string,
  data: Omit<CardLifecycle, "cardId" | "cardName" | "updatedAt">,
) => {
  const list = load();
  const entry: CardLifecycle = {
    cardId,
    cardName,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const next = list.some(l => l.cardId === cardId)
    ? list.map(l => (l.cardId === cardId ? entry : l))
    : [...list, entry];
  persist(next);
};

export const removeCardLifecycle = (cardId: number) => {
  persist(load().filter(l => l.cardId !== cardId));
};

export const useKpiLifecycles = (): CardLifecycle[] => {
  const [list, setList] = useState<CardLifecycle[]>(() => load());
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

export const emptyLifecycleDraft = (): Omit<CardLifecycle, "cardId" | "cardName" | "updatedAt"> => ({
  assignment: undefined,
  evaluation: undefined,
  bonus: undefined,
  reviews: [],
});

export const formatStagePeriod = (s?: LifecycleStage): string => {
  if (!s) return "—";
  if (s.period === "Digər" && s.customPeriodLabel) return s.customPeriodLabel;
  return s.period || "—";
};

type CardMeta = { startDate?: string; endDate?: string; frequency?: string };

/**
 * Kartın lifecycle-ına yeni review əlavə edir. Əgər lifecycle yoxdursa,
 * fallback-dan yaradır. "Yeni Review yarat" axını üçün istifadə olunur.
 */
export const appendReviewToCard = (
  cardId: number,
  cardName: string,
  meta: CardMeta | undefined,
  review: { start: string; end: string; period?: string; participantIds?: string[]; reviewerNames?: string[] },
): LifecycleReview => {
  const base = getLifecycle(cardId) || getLifecycleWithFallback(cardId, cardName, meta);
  const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const newReview: LifecycleReview = {
    id,
    period: review.period || "Xüsusi",
    start: review.start,
    end: review.end,
    participantIds: review.participantIds,
    reviewerNames: review.reviewerNames,
  };
  const nextReviews = [...(base.reviews || []), newReview].sort((a, b) =>
    (a.start || "").localeCompare(b.start || ""),
  );
  setCardLifecycle(cardId, cardName, {
    assignment: base.assignment,
    evaluation: base.evaluation,
    bonus: base.bonus,
    reviews: nextReviews,
  });
  return newReview;
};

/**
 * Mövcud review-un nəticəsini qeyd edir (Keçirildi / Təxirə salındı) və şərh əlavə edir.
 */
export const setReviewOutcome = (
  cardId: number,
  cardName: string,
  meta: CardMeta | undefined,
  reviewId: string,
  outcome: { status: ReviewOutcomeStatus; comment: string; by?: string },
) => {
  const base = getLifecycle(cardId) || getLifecycleWithFallback(cardId, cardName, meta);
  const nextReviews = (base.reviews || []).map(r =>
    r.id === reviewId
      ? {
          ...r,
          outcomeStatus: outcome.status,
          outcomeComment: outcome.comment,
          outcomeAt: new Date().toISOString(),
          outcomeBy: outcome.by,
        }
      : r,
  );
  setCardLifecycle(cardId, cardName, {
    assignment: base.assignment,
    evaluation: base.evaluation,
    bonus: base.bonus,
    reviews: nextReviews,
  });
};

export type ReviewComputedStatus = "held" | "deferred" | "missed" | "in_progress" | "pending";

/** Review-un final statusunu hesablayır. outcomeStatus varsa onu, yoxdursa tarixdən çıxarır. */
export const computeReviewStatus = (r: LifecycleReview): ReviewComputedStatus => {
  if (r.outcomeStatus === "held") return "held";
  if (r.outcomeStatus === "deferred") return "deferred";
  if (r.outcomeStatus === "missed") return "missed";
  if (r.outcomeStatus === "in_progress") return "in_progress";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = r.start ? new Date(r.start) : null;
  const end = r.end ? new Date(r.end) : null;
  if (end && today > end) return "missed";
  if (start && today < start) return "pending";
  return "in_progress";
};

