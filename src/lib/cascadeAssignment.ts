// Kaskadlama təyinat qaydaları — həm HR (KPI kartları), həm də Rəhbər
// ("Məsul olduğum kartlar") modulunda EYNİ məntiq işləsin deyə mərkəzləşdirilib.
//
// Qaydalar:
//  1) Cascade Load bölüşdürülmədən "kaskadlana bilən" hədəf təyin edilirsə,
//     Kaskad İzləmədə ROOT təyin edən rəhbərin adına yox, KARTIN TƏTBİQ OLUNDUĞU
//     əməkdaşların adına yaranır (o əməkdaşlar özləri rəhbərdirsə).
//  2) Cascade Load bölüşdürülərkən rəhbər yalnız HƏM tabeliyində olan,
//     HƏM DƏ bu kartın tətbiq olunduğu əməkdaşları görür.

import { getEmployees, getStructures, getSubordinatesOfStarHolder } from "@/lib/orgStore";
import { getSharedKpiCards } from "@/lib/kpiCardStore";
import { createRoot, findRootByGoal } from "@/lib/cascadeTreeStore";

type Employee = ReturnType<typeof getEmployees>[number];

const normId = (raw: string | number): number =>
  Number(String(raw ?? "").replace(/^e/i, "")) || 0;

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

/** Kartın tətbiq olunduğu (assignee) əməkdaşlar. */
export const getCardAssigneeEmployees = (opts: { cardId?: number; cardName?: string }): Employee[] => {
  try {
    const cards = getSharedKpiCards();
    const card =
      (opts.cardId != null ? cards.find(c => c.numericId === opts.cardId) : undefined) ||
      (opts.cardName ? cards.find(c => c.name === opts.cardName) : undefined);
    if (!card) return [];
    const ids = new Set((card.assigneeIds || []).map(normId).filter(Boolean));
    return getEmployees().filter(e => ids.has(e.id));
  } catch {
    return [];
  }
};

/** Bir əməkdaşın öz struktur vahidi üzrə tabeliyindəki şəxslər. */
export const getSubordinatesOfEmployee = (employeeId?: number): Employee[] => {
  if (!employeeId) return [];
  try {
    const emp = getEmployees().find(e => e.id === employeeId);
    if (!emp) return [];
    const walk = (list: any[], path: string[]): number | null => {
      for (const n of list) {
        const cur = [...path, n.name];
        if (cur.join(" › ") === emp.structurePath) return n.id;
        const inChild = walk(n.children || [], cur);
        if (inChild) return inChild;
      }
      return null;
    };
    const unitId = walk(getStructures(), []);
    if (!unitId) return [];
    return getSubordinatesOfStarHolder(employeeId, unitId) as Employee[];
  } catch {
    return [];
  }
};

/**
 * Qayda 3: Cascade Load yalnız HƏM təyinedicinin tabeliyində olan, HƏM DƏ
 * kartın tətbiq olunduğu əməkdaşlara paylana bilər.
 * Kartın assignee-si tapılmasa (köhnə data) — məhdudiyyət tətbiq olunmur.
 */
export const getCascadeCandidateIds = (opts: {
  setterEmployeeId?: number;
  cardId?: number;
  cardName?: string;
}): number[] | null => {
  const cardEmployees = getCardAssigneeEmployees({ cardId: opts.cardId, cardName: opts.cardName });
  if (cardEmployees.length === 0) return null;
  const subs = getSubordinatesOfEmployee(opts.setterEmployeeId);
  if (subs.length === 0) return [];
  const subIds = new Set(subs.map(s => s.id));
  return cardEmployees.filter(e => subIds.has(e.id)).map(e => e.id);
};

/** Rəhbər bu hədəfi ümumiyyətlə kaskadlaya bilərmi? */
export const canCascadeTarget = (opts: {
  setterEmployeeId?: number;
  cardId?: number;
  cardName?: string;
}): boolean => {
  const ids = getCascadeCandidateIds(opts);
  return ids === null ? true : ids.length > 0;
};

/**
 * Qayda 2: Cascade Load bölüşdürülmədən yaradılan "kaskadlana bilən" hədəf üçün
 * ROOT-lar kartın tətbiq olunduğu RƏHBƏR əməkdaşların adına yaranır.
 * Heç bir assignee rəhbər deyilsə, bütün assignee-lər üçün root yaranır
 * (izləmə itməsin deyə). Təyinedicinin özü root kimi yaradılmır.
 */
export const createRootsForCardAssignees = (payload: {
  cardId?: number;
  cardName: string;
  goalName: string;
  unit: string;
  limit: number;
  setterEmployeeId?: number;
  /** Fallback: kart tapılmasa bu şəxs üçün root yaradılsın */
  fallbackEmployeeId?: number;
}): number => {
  const assignees = getCardAssigneeEmployees({ cardId: payload.cardId, cardName: payload.cardName })
    .filter(e => !payload.setterEmployeeId || e.id !== payload.setterEmployeeId);

  let targets: Employee[] = assignees.filter(e => (e as any).isStarPerson);
  if (targets.length === 0) targets = assignees;
  if (targets.length === 0 && payload.fallbackEmployeeId) {
    const fb = getEmployees().find(e => e.id === payload.fallbackEmployeeId);
    if (fb) targets = [fb];
  }
  if (targets.length === 0) return 0;

  let created = 0;
  targets.forEach(emp => {
    if (findRootByGoal(payload.cardName, payload.goalName, emp.id)) return;
    createRoot({
      cardName: payload.cardName,
      goalName: payload.goalName,
      unit: payload.unit,
      assigneeId: emp.id,
      assigneeName: fullName(emp),
      positionName: emp.positionName,
      limit: Number(payload.limit) || 0,
    });
    created += 1;
  });
  return created;
};
