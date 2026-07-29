// Vahid vəzifə mənbəyi (single source of truth).
// Bütün modullar (Təsdiqləmə Matrisi, Silinmə Matrisi, KPI kartı yaradılması və s.)
// vəzifələri yalnız buradan almalıdır — ayrıca/statik siyahı saxlanılmamalıdır.

import { useEffect, useState } from "react";
import { getPositions } from "./catalogStore";
import { getStructures, getEmployees, type OrgStructure } from "./orgStore";

const collect = (list: OrgStructure[], out: Set<string>) => {
  for (const n of list) {
    for (const p of n.positions) if (p.name) out.add(p.name.trim());
    if (n.children.length) collect(n.children, out);
  }
};

/** Əməkdaş adları vəzifə siyahısında görünməməlidir */
const employeeNameSet = (): Set<string> => {
  const set = new Set<string>();
  try {
    for (const e of getEmployees()) {
      const full = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim().toLowerCase();
      if (full) set.add(full);
      const rev = `${e.lastName ?? ""} ${e.firstName ?? ""}`.trim().toLowerCase();
      if (rev) set.add(rev);
    }
  } catch {}
  return set;
};

const normalize = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

const looksLikeEmployeeLabel = (position: string, names: Set<string>): boolean => {
  const value = normalize(position);
  if (!value) return false;
  if (names.has(value)) return true;

  const withoutParentheses = normalize(value.replace(/\s*\([^)]*\)\s*$/, ""));
  if (names.has(withoutParentheses)) return true;

  const beforeDash = normalize(value.split(/\s+[—–-]\s+/)[0] || "");
  return names.has(beforeDash);
};

/** Kataloqdakı vəzifələr + təşkilat strukturunda faktiki istifadə olunanlar */
export const getAllPositions = (): string[] => {
  const set = new Set<string>();
  try {
    getPositions().forEach(p => { const v = String(p || "").trim(); if (v) set.add(v); });
  } catch {}
  try {
    collect(getStructures(), set);
  } catch {}
  const names = employeeNameSet();
  return Array.from(set)
    .filter(p => !looksLikeEmployeeLabel(p, names))
    .sort((a, b) => a.localeCompare(b, "az"));
};


/** Reaktiv hook — kataloq və ya struktur dəyişdikdə avtomatik yenilənir */
export const usePositions = (): string[] => {
  const [list, setList] = useState<string[]>(() => getAllPositions());

  useEffect(() => {
    const refresh = () => setList(getAllPositions());
    const events = ["catalog-updated", "org-updated", "storage", "focus"];
    events.forEach(e => window.addEventListener(e, refresh));
    return () => events.forEach(e => window.removeEventListener(e, refresh));
  }, []);

  return list;
};
