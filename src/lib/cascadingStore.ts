// Cascading store — paylaşıla bilən hədəf-ların komandaya bölünməsi.
// Hər entry KpiSetEntry-yə bağlanır (entryId). Distribution = işçilərə pay.
// Limitlər istifadəçi tərəfindən manual təyin olunur (auto-suggest YOXDUR).
import { useEffect, useState } from "react";
import type { LimitSet, LimitTier } from "@/lib/kpiSetStore";

export interface CascadeSlice {
  id: string;
  assigneeName: string;
  target: string;
  limits: LimitSet;
}

export interface CascadeAssignment {
  id: string;
  /** KpiSetEntry.id */
  entryId: string;
  cardName: string;
  subKpiName: string;
  parentTarget: string;
  unit: string;
  /** seçilmiş cascade matrisi */
  matrixId?: string;
  matrixName?: string;
  slices: CascadeSlice[];
  status: "draft" | "submitted";
  updatedAt: number;
}

const KEY = "cascade_assignments_v2";
const EVT = "cascade-assignments-updated";

export const emptyLimits = (): LimitSet => ({
  l1: { min: 0, max: 0 },
  l2: { min: 0, max: 0 },
  l3: { min: 0, max: 0 },
  l4: { min: 0, max: 0 },
  l5: { min: 0, max: 0 },
});

const seed: CascadeAssignment[] = [];

const load = (): CascadeAssignment[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
};

const persist = (rows: CascadeAssignment[]) => {
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(EVT));
};

export const getAssignments = (): CascadeAssignment[] => load();

export const getAssignmentByEntry = (entryId: string): CascadeAssignment | undefined =>
  load().find(a => a.entryId === entryId);

export const upsertAssignment = (a: Omit<CascadeAssignment, "id" | "updatedAt"> & { id?: string }) => {
  const list = load();
  const idx = a.id ? list.findIndex(x => x.id === a.id) : list.findIndex(x => x.entryId === a.entryId);
  const value: CascadeAssignment = {
    ...a,
    id: a.id || (idx >= 0 ? list[idx].id : crypto.randomUUID()),
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = value;
  else list.push(value);
  persist(list);
  return value;
};

export const buildSliceFor = (assigneeName: string): CascadeSlice => ({
  id: crypto.randomUUID(),
  assigneeName,
  target: "",
  limits: emptyLimits(),
});

export const useCascadeAssignments = (): CascadeAssignment[] => {
  const [rows, setRows] = useState<CascadeAssignment[]>(() => load());
  useEffect(() => {
    const h = () => setRows(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return rows;
};
