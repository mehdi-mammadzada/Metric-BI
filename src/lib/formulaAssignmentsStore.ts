// Formula assignments — bir düsturun konkret şəxs/vəzifə/struktur/komandalara
// tətbiq edilməsini saxlayır. Hesablama modulunun əsas siyahısı buradan oxunur.

import { getFormulas, type Formula } from "./formulasStore";

export type FormulaTargetType = "sexs" | "vezife" | "struktur" | "komanda" | "butun_sirket";

export interface FormulaTargetRef {
  type: FormulaTargetType;
  id: string | number;
  name: string;
}

export interface FormulaAssignment {
  id: number;
  formulaId: number;
  formulaName: string;
  variables: string[];
  targetTypes: FormulaTargetType[];
  targets: FormulaTargetRef[];
  employeeIds: number[];
  status: "active" | "passive";
  assignedAt: string; // ISO
  updatedAt: string;  // ISO
}

const KEY = "kpi_formula_assignments_v1";

export const getAssignments = (): FormulaAssignment[] => {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* fallthrough */ }
  }
  return [];
};

export const saveAssignments = (list: FormulaAssignment[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("formula-assignments-updated"));
};

export const addAssignment = (a: Omit<FormulaAssignment, "id" | "assignedAt" | "updatedAt">) => {
  const list = getAssignments();
  const now = new Date().toISOString();
  const next: FormulaAssignment = { ...a, id: Date.now(), assignedAt: now, updatedAt: now };
  saveAssignments([next, ...list]);
  return next;
};

export const updateAssignment = (id: number, patch: Partial<FormulaAssignment>) => {
  const list = getAssignments().map(a =>
    a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
  );
  saveAssignments(list);
};

/** Yeni yaradılan düstur avtomatik siyahıya 0 əməkdaşla əlavə edilsin. */
export const ensureAssignmentForFormula = (formula: Formula) => {
  const list = getAssignments();
  if (list.some(a => a.formulaId === formula.id)) return;
  addAssignment({
    formulaId: formula.id,
    formulaName: formula.name,
    variables: formula.variables ?? [],
    targetTypes: [],
    targets: [],
    employeeIds: [],
    status: "active",
  });
};

/** Eyni düstur üçün mövcud sətri yenilə (əməkdaşları birləşdir), yoxdursa əlavə et. */
export const upsertAssignmentForFormula = (
  formula: Formula,
  data: {
    targetTypes: FormulaTargetType[];
    targets: FormulaTargetRef[];
    employeeIds: number[];
  }
) => {
  const list = getAssignments();
  const existing = list.find(a => a.formulaId === formula.id);
  const now = new Date().toISOString();
  if (existing) {
    const mergedEmp = Array.from(new Set([...existing.employeeIds, ...data.employeeIds]));
    const mergedTypes = Array.from(new Set([...existing.targetTypes, ...data.targetTypes])) as FormulaTargetType[];
    const key = (t: FormulaTargetRef) => `${t.type}:${t.id}`;
    const map = new Map<string, FormulaTargetRef>();
    [...existing.targets, ...data.targets].forEach(t => map.set(key(t), t));
    const next = list.map(a => a.id === existing.id
      ? { ...a, formulaName: formula.name, variables: formula.variables ?? a.variables, targetTypes: mergedTypes, targets: Array.from(map.values()), employeeIds: mergedEmp, updatedAt: now }
      : a);
    saveAssignments(next);
    return next.find(a => a.id === existing.id)!;
  }
  return addAssignment({
    formulaId: formula.id,
    formulaName: formula.name,
    variables: formula.variables ?? [],
    targetTypes: data.targetTypes,
    targets: data.targets,
    employeeIds: data.employeeIds,
    status: "active",
  });
};

export const deleteAssignment = (id: number) => {
  saveAssignments(getAssignments().filter(a => a.id !== id));
};

/** Formula silinərsə, aid təyinatları da təmizlə. */
export const syncWithFormulas = (formulas: Formula[]) => {
  const ids = new Set(formulas.map(f => f.id));
  const list = getAssignments().filter(a => ids.has(a.formulaId));
  if (list.length !== getAssignments().length) saveAssignments(list);
};
