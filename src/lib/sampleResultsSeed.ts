// Nümunə (demo) nəticələr — hər təşkilatda YALNIZ 1 əməkdaş üçün
// KPI nəticələri və bonus hesablaması görünsün deyə minimal sample data.
// Real məlumatlara toxunmur: yalnız həmin əməkdaş/kart üzrə heç bir
// qiymətləndirmə yoxdursa əlavə edilir və bir dəfə işləyir.

import { useEffect } from "react";
import { getEmployees, type OrgEmployee } from "@/lib/orgStore";
import { useVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { getSubKpis, isEvaluated, upsertSubKpis, type SubKpi } from "@/lib/kpiEvaluationStore";

const FLAG = "sample_results_seeded_v1";

const FALLBACK_TARGETS = [
  { name: "Satış planının icrası", target: 100, unit: "%", weight: 40, pct: 104 },
  { name: "Müştəri məmnuniyyəti", target: 90, unit: "%", weight: 35, pct: 96 },
  { name: "Hesabatların vaxtında təqdimi", target: 12, unit: "ədəd", weight: 25, pct: 100 },
];

const seededKey = (orgKey: string) => `${FLAG}:${orgKey}`;

const parseNum = (v?: string): number | null => {
  if (!v) return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Kart + əməkdaş cütü üçün nümunə qiymətləndirmələr yaradır. */
export const ensureSampleResults = (cards: SharedKpiCard[]) => {
  try {
    const employees = getEmployees().filter(e => e.active);
    if (employees.length === 0 || cards.length === 0) return;

    const byId = new Map<string, OrgEmployee>();
    employees.forEach(e => { byId.set(String(e.id), e); byId.set(`e${e.id}`, e); });

    // İlk uyğun kart + onun ilk əməkdaşı
    let card: SharedKpiCard | null = null;
    let emp: OrgEmployee | null = null;
    let assigneeKey = "";
    for (const c of cards) {
      const hit = (c.assigneeIds || []).find(id => byId.has(String(id)));
      if (hit) { card = c; emp = byId.get(String(hit))!; assigneeKey = String(hit); break; }
    }
    if (!card || !emp) return;

    const orgKey = `${card.id}:${assigneeKey}`;
    if (localStorage.getItem(seededKey(orgKey))) return;

    // Bu əməkdaşın həmin kartı üzrə real qiymət varsa — toxunma
    const existing = getSubKpis(assigneeKey).filter(
      k => (k.cardId === card!.id || k.cardId === card!.name) && isEvaluated(k),
    );
    if (existing.length > 0) {
      localStorage.setItem(seededKey(orgKey), "1");
      return;
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
            pct: fb.pct,
          };
        })
      : FALLBACK_TARGETS;

    const period = `${card.startDate || ""} – ${card.endDate || ""}`.trim();
    const rows: SubKpi[] = source.map((t, i) => {
      const actual = Math.round(t.target * (t.pct / 100) * 100) / 100;
      const score = t.pct >= 100 ? 5 : t.pct >= 90 ? 4 : t.pct >= 75 ? 3 : 2;
      return {
        id: `sample:${card!.id}:${assigneeKey}:${i}`,
        assigneeId: assigneeKey,
        cardId: card!.id,
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
  } catch {
    // sessiz — nümunə data kritik deyil
  }
};

/** Nəticə/bonus modullarında çağırılır. */
export const useSampleResultsSeed = () => {
  const cards = useVisibleSharedKpiCards();
  useEffect(() => { ensureSampleResults(cards); }, [cards]);
};
