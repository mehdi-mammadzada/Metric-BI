// Nümunə (demo) nəticələr — hər təşkilatda hesabatların formalaşması üçün
// nəticəsi olan KPI-lar yaradılır. Real məlumatlara toxunmur: yalnız həmin
// əməkdaş/kart cütü üzrə heç bir qiymətləndirmə yoxdursa əlavə edilir və
// hər cüt üçün bir dəfə işləyir.

import { useEffect } from "react";
import { getEmployees, type OrgEmployee } from "@/lib/orgStore";
import { useVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { getSubKpis, isEvaluated, upsertSubKpis, type SubKpi } from "@/lib/kpiEvaluationStore";

const FLAG = "sample_results_seeded_v1";

/** Maksimum nə qədər kart/əməkdaş cütü üçün nümunə nəticə yaradılsın. */
const MAX_PAIRS = 8;

const FALLBACK_TARGETS = [
  { name: "Satış planının icrası", target: 100, unit: "%", weight: 40, pct: 104 },
  { name: "Müştəri məmnuniyyəti", target: 90, unit: "%", weight: 35, pct: 96 },
  { name: "Hesabatların vaxtında təqdimi", target: 12, unit: "ədəd", weight: 25, pct: 100 },
];

// Cütlər üzrə fərqli icra faizləri — hesabat qrafikləri canlı görünsün.
const PCT_PROFILES = [
  [104, 96, 100],
  [92, 88, 95],
  [78, 84, 90],
  [110, 102, 98],
  [67, 74, 82],
  [98, 93, 105],
  [85, 91, 79],
  [72, 100, 88],
];

const seededKey = (orgKey: string) => `${FLAG}:${orgKey}`;

const parseNum = (v?: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const seedPair = (
  card: SharedKpiCard,
  assigneeKey: string,
  pcts: number[],
): boolean => {
  const orgKey = `${card.id}:${assigneeKey}`;
  if (localStorage.getItem(seededKey(orgKey))) return false;

  // Bu əməkdaşın həmin kartı üzrə real qiymət varsa — toxunma
  const existing = getSubKpis(assigneeKey).filter(
    k => (k.cardId === card.id || k.cardId === card.name) && isEvaluated(k),
  );
  if (existing.length > 0) {
    localStorage.setItem(seededKey(orgKey), "1");
    return false;
  }

  const cardTargets = (card.targets || []).slice(0, 3);
  const source = cardTargets.length > 0
    ? cardTargets.map((t, i) => {
        const fb = FALLBACK_TARGETS[i] ?? FALLBACK_TARGETS[0];
        return {
          name: t.name || fb.name,
          target: parseNum(t.targetValue) ?? fb.target,
          unit: t.unit || fb.unit,
          weight: Number(t.weight) || fb.weight,
          pct: pcts[i] ?? fb.pct,
        };
      })
    : FALLBACK_TARGETS.map((fb, i) => ({ ...fb, pct: pcts[i] ?? fb.pct }));

  const period = `${card.startDate || ""} – ${card.endDate || ""}`.trim();
  const rows: SubKpi[] = source.map((t, i) => {
    const actual = Math.round(t.target * (t.pct / 100) * 100) / 100;
    const score = t.pct >= 100 ? 5 : t.pct >= 90 ? 4 : t.pct >= 75 ? 3 : 2;
    return {
      id: `sample:${card.id}:${assigneeKey}:${i}`,
      assigneeId: assigneeKey,
      cardId: card.id,
      name: t.name,
      description: "Nümunə xarakterli nəticə",
      target: t.target,
      actual,
      unit: t.unit,
      weight: t.weight,
      period,
      evaluatedScore: score,
      selfComment: "Nümunə: dövr üzrə nəticə qeyd edilib.",
      submittedAt: Date.now(),
    };
  });

  upsertSubKpis(rows);
  localStorage.setItem(seededKey(orgKey), "1");
  return true;
};

/** Kart + əməkdaş cütləri üçün nümunə qiymətləndirmələr yaradır. */
export const ensureSampleResults = (cards: SharedKpiCard[]) => {
  try {
    const employees = getEmployees().filter(e => e.active);
    if (employees.length === 0 || cards.length === 0) return;

    const byId = new Map<string, OrgEmployee>();
    employees.forEach(e => { byId.set(String(e.id), e); byId.set(`e${e.id}`, e); });

    let pairIndex = 0;
    for (const card of cards) {
      const assignees = (card.assigneeIds || []).filter(id => byId.has(String(id)));
      for (const assigneeId of assignees) {
        if (pairIndex >= MAX_PAIRS) return;
        const pcts = PCT_PROFILES[pairIndex % PCT_PROFILES.length];
        seedPair(card, String(assigneeId), pcts);
        pairIndex += 1;
      }
    }
  } catch {
    // sessiz — nümunə data kritik deyil
  }
};

/** Nəticə / bonus / hesabat modullarında çağırılır. */
export const useSampleResultsSeed = () => {
  const cards = useVisibleSharedKpiCards();
  useEffect(() => { ensureSampleResults(cards); }, [cards]);
};
