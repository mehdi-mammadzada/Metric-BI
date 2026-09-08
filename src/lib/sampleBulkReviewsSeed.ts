// Toplu (bulk) KPI kartları üçün nümunə reviewlar.
// Real məlumatlara toxunmur: yalnız review-u olmayan toplu kartlara,
// hər kart üçün bir dəfə, nümunə xarakterli reviewlar əlavə edilir.

import { useEffect } from "react";
import { getEmployees } from "@/lib/orgStore";
import { useVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import {
  getLifecycle,
  appendReviewToCard,
  setReviewOutcome,
  type ReviewOutcomeStatus,
} from "@/lib/kpiLifecycleStore";

const FLAG = "sample_bulk_reviews_seeded_v1";

/** Maksimum nə qədər toplu kart üçün nümunə review yaradılsın. */
const MAX_CARDS = 6;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return iso(d);
};

/** Hər kart üçün 3 nümunə review: keçmiş (Keçirildi), cari (İcrada), gələcək (Planlaşdırılıb). */
const REVIEW_PLAN: {
  name: string;
  period: string;
  startOffset: number;
  endOffset: number;
  outcome?: { status: ReviewOutcomeStatus; comment: string };
}[] = [
  {
    name: "Review #1",
    period: "Rüblük",
    startOffset: -75,
    endOffset: -68,
    outcome: {
      status: "held",
      comment: "Nümunə: toplu KPI üzrə dövr nəticələri müzakirə olundu, hədəflər təsdiqləndi.",
    },
  },
  {
    name: "Review #2",
    period: "Rüblük",
    startOffset: -5,
    endOffset: 9,
  },
  {
    name: "Review #3",
    period: "Rüblük",
    startOffset: 35,
    endOffset: 42,
  },
];

const seedCard = (card: SharedKpiCard, reviewerNames: string[]): boolean => {
  const numericId = card.numericId;
  if (!numericId) return false;

  // Əsas qayda: kartda artıq review varsa heç vaxt yenisi yaradılmır.
  const existing = getLifecycle(numericId);
  if (existing && (existing.reviews || []).length > 0) {
    localStorage.setItem(`${FLAG}:${numericId}`, "1");
    localStorage.setItem(`${FLAG}:${card.id}`, "1");
    return false;
  }

  // Həm numericId, həm də kart id-si üzrə flag yoxlanılır (id dəyişsə də təkrar yaranmasın).
  if (
    localStorage.getItem(`${FLAG}:${numericId}`) ||
    localStorage.getItem(`${FLAG}:${card.id}`)
  ) {
    return false;
  }

  const meta = {
    startDate: card.startDate,
    endDate: card.endDate,
    frequency: (card as any).frequency,
  };
  const participantIds = (card.assigneeIds || []).map(String);

  REVIEW_PLAN.forEach(plan => {
    const created = appendReviewToCard(numericId, card.name, meta, {
      start: shift(plan.startOffset),
      end: shift(plan.endOffset),
      period: plan.period,
      participantIds,
      reviewerNames,
    });
    // Review adını yaz (appendReviewToCard adı saxlamır) və nəticəni qeyd et.
    if (plan.outcome) {
      setReviewOutcome(numericId, card.name, meta, created.id, {
        status: plan.outcome.status,
        comment: plan.outcome.comment,
        by: reviewerNames[0] || "Sistem",
      });
    }
  });

  localStorage.setItem(`${FLAG}:${numericId}`, "1");
  localStorage.setItem(`${FLAG}:${card.id}`, "1");
  return true;
};

/** Bir sessiya ərzində eyni kart üçün təkrar cəhdləri dayandırır. */
const seededInSession = new Set<string>();

/** Toplu KPI kartları üçün nümunə reviewlar yaradır. */
export const ensureSampleBulkReviews = (cards: SharedKpiCard[]) => {
  try {
    const employees = getEmployees().filter(e => e.active);
    if (employees.length === 0) return;

    const nameOf = (id: string | number) => {
      const n = Number(String(id).replace(/^e/, ""));
      const emp = employees.find(e => e.id === n);
      return emp ? `${emp.firstName} ${emp.lastName}` : null;
    };

    const bulkCards = cards.filter(
      c => c.assignmentMode === "bulk" && (c.assigneeIds || []).length > 0,
    );

    let seeded = 0;
    for (const card of bulkCards) {
      if (seeded >= MAX_CARDS) return;
      const reviewerNames = ((card.evaluatorIds && card.evaluatorIds.length
        ? card.evaluatorIds
        : (card.assigneeIds || []).slice(0, 1)) as (string | number)[])
        .map(nameOf)
        .filter((n): n is string => !!n)
        .slice(0, 2);
      const sessionKey = String(card.numericId ?? card.id);
      if (seededInSession.has(sessionKey)) continue;
      seededInSession.add(sessionKey);
      if (seedCard(card, reviewerNames)) seeded += 1;
    }
  } catch {
    // sessiz — nümunə data kritik deyil
  }
};

/** KPI izlənməsi modulunda çağırılır. */
export const useSampleBulkReviewsSeed = () => {
  const cards = useVisibleSharedKpiCards();
  useEffect(() => { ensureSampleBulkReviews(cards); }, [cards]);
};
