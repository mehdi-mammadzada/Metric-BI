// Bonus modulunun əməkdaş siyahısı — real təşkilat məlumatı + qeyd olunmuş
// KPI nəticələri əsasında qurulur (mock yoxdur).

import { useMemo } from "react";
import { getEmployees } from "@/lib/orgStore";
import { calcCompletion, getSubKpis, isEvaluated } from "@/lib/kpiEvaluationStore";
import { useVisibleSharedKpiCards } from "@/lib/kpiCardStore";
import type { Employee } from "@/pages/BonusPage";

/** Nəticəsi olan əməkdaşlar üzrə bonus sətirləri. */
export const useBonusEmployees = (): Employee[] => {
  const cards = useVisibleSharedKpiCards();
  return useMemo(() => {
    const evaluatorOf = (empKey: string) => {
      const card = cards.find(c => (c.assigneeIds || []).some(id => String(id) === empKey));
      return card?.evaluatorIds?.[0] ? String(card.evaluatorIds[0]) : "Qiymətləndirən";
    };
    return getEmployees()
      .filter(e => e.active)
      .map(e => {
        const subs = [...getSubKpis(String(e.id)), ...getSubKpis(`e${e.id}`)].filter(isEvaluated);
        if (subs.length === 0) return null;
        const empKey = String(e.id);
        return {
          id: String(e.id),
          firstName: e.firstName,
          lastName: e.lastName,
          fatherName: e.fatherName,
          department: e.structurePath || "—",
          position: e.positionName || "—",
          baseSalary: e.salary || 0,
          targetBonusPct: 20,
          subKpis: subs.map(k => ({
            name: k.name,
            weight: k.weight,
            evaluator: evaluatorOf(empKey),
            score: Math.round(calcCompletion(k) * 10) / 10,
          })),
        } as Employee;
      })
      .filter((x): x is Employee => x !== null);
  }, [cards]);
};
