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

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

/** Bir əməkdaşı təmsil edə biləcək bütün açarlar (id, "e12", email, ad-soyad). */
const aliasesOf = (e: Employee): string[] =>
  [String(e.id), `e${e.id}`, e.email, fullName(e)]
    .filter(Boolean)
    .map(v => String(v).trim().toLowerCase());

/** Kartın tətbiq olunduğu (assignee) əməkdaşlar. */
export const getCardAssigneeEmployees = (opts: { cardId?: number; cardName?: string }): Employee[] => {
  try {
    const cards = getSharedKpiCards();
    const card =
      (opts.cardId != null ? cards.find(c => c.numericId === opts.cardId) : undefined) ||
      (opts.cardName ? cards.find(c => c.name === opts.cardName) : undefined);
    if (!card) return [];
    const raw = (card.assigneeIds || []).map(v => String(v ?? "").trim().toLowerCase()).filter(Boolean);
    if (raw.length === 0) return [];
    const wanted = new Set(raw);
    return getEmployees().filter(e => aliasesOf(e).some(a => wanted.has(a)));
  } catch {
    return [];
  }
};

/** Toplu (bulk) təyinatlı kartlar üçün kaskad ağacı/yükü YARANMIR — yalnız fərdi kartlar kaskadlanır. */
export const isBulkAssignedCard = (opts: { cardId?: number; cardName?: string }): boolean => {
  try {
    const cards = getSharedKpiCards();
    const card =
      (opts.cardId != null ? cards.find(c => c.numericId === opts.cardId) : undefined) ||
      (opts.cardName ? cards.find(c => c.name === opts.cardName) : undefined);
    return !!card && (card as any).assignmentMode === "bulk";
  } catch {
    return false;
  }
};

/** Əməkdaşın ştat slotuna görə aid olduğu struktur vahidini tapır. */
const findUnitIdOfEmployee = (employeeId: number): number | null => {
  const walk = (list: any[]): number | null => {
    for (const n of list) {
      for (const p of n.positions || []) {
        for (const s of p.slots || []) {
          if (s.employeeId === employeeId) return n.id;
        }
      }
      const inChild = walk(n.children || []);
      if (inChild) return inChild;
    }
    return null;
  };
  return walk(getStructures());
};

/** Bir əməkdaşın öz struktur vahidi üzrə tabeliyindəki şəxslər. */
export const getSubordinatesOfEmployee = (employeeId?: number): Employee[] => {
  if (!employeeId) return [];
  try {
    const emp = getEmployees().find(e => e.id === employeeId);
    if (!emp) return [];
    // 1) Ştat slotuna görə (ən etibarlı), 2) structurePath mətninə görə fallback.
    let unitId = findUnitIdOfEmployee(employeeId);
    if (!unitId && emp.structurePath) {
      const walk = (list: any[], path: string[]): number | null => {
        for (const n of list) {
          const cur = [...path, n.name];
          if (cur.join(" › ") === emp.structurePath) return n.id;
          const inChild = walk(n.children || [], cur);
          if (inChild) return inChild;
        }
        return null;
      };
      unitId = walk(getStructures(), []);
    }
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
  if (isBulkAssignedCard({ cardId: opts.cardId, cardName: opts.cardName })) return [];
  const cardEmployees = getCardAssigneeEmployees({ cardId: opts.cardId, cardName: opts.cardName });
  if (cardEmployees.length === 0) return null;
  const subs = getSubordinatesOfEmployee(opts.setterEmployeeId);
  if (subs.length === 0) return [];
  const subIds = new Set(subs.map(s => s.id));
  return cardEmployees.filter(e => e.id !== opts.setterEmployeeId && subIds.has(e.id)).map(e => e.id);
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

  // Qayda: ROOT yalnız RƏHBƏR (star person) olan şəxslər üçün yaradılır —
  // rəhbər olmayan şəxs hədəfi növbəti səviyyəyə paylaya bilməz.
  let targets: Employee[] = assignees.filter(e => (e as any).isStarPerson);
  if (targets.length === 0 && payload.fallbackEmployeeId) {
    const fb = getEmployees().find(e => e.id === payload.fallbackEmployeeId);
    if (fb && (fb as any).isStarPerson) targets = [fb];
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
