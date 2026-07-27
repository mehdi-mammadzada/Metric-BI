// Shared store for calculation formulas + their variable book.
// Used by the standalone "Hesablama Düsturları" module.

export interface FormulaVariable {
  id: number;
  short: string; // e.g. CS
  name: string; // e.g. Cari Satış
  description: string;
  source: string; // integration system name (e.g. CHR, CRM Sistemi)
}

export interface Formula {
  id: number;
  name: string;
  formula: string;
  description: string;
  kpiName?: string; // backward compat (free-text label)
  kpiTypes?: string[]; // deprecated — hidden in UI
  variables: string[]; // variable shorts referenced
}

const FORMULAS_KEY = "kpi_formulas_v4";
const VARIABLES_KEY = "kpi_formula_variables_v4";

const initialVariables: FormulaVariable[] = [];

const initialFormulas: Formula[] = [];

export const getVariables = (): FormulaVariable[] => {
  const saved = localStorage.getItem(VARIABLES_KEY);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  localStorage.setItem(VARIABLES_KEY, JSON.stringify(initialVariables));
  return initialVariables;
};

export const saveVariables = (vars: FormulaVariable[]) => {
  localStorage.setItem(VARIABLES_KEY, JSON.stringify(vars));
  window.dispatchEvent(new Event("formulas-updated"));
};

export const getFormulas = (): Formula[] => {
  const saved = localStorage.getItem(FORMULAS_KEY);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  localStorage.setItem(FORMULAS_KEY, JSON.stringify(initialFormulas));
  return initialFormulas;
};

export const saveFormulas = (f: Formula[]) => {
  localStorage.setItem(FORMULAS_KEY, JSON.stringify(f));
  window.dispatchEvent(new Event("formulas-updated"));
};
