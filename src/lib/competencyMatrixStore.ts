// Competency Matrix (Səriştə Matrisi) store — localStorage backed.
import { useEffect, useState } from "react";

export type CompetencyStatus = "aktiv" | "qaralama" | "passiv";

export interface CompetencyQuestion {
  id: string;
  text: string;
  weight: number; // 0-100
}

export interface CompetencyAnswer {
  id: string;
  label: string;
  score: number;
}

export interface CompetencyMatrix {
  id: string;
  name: string;
  positions: string[];
  description?: string;
  questions: CompetencyQuestion[];
  answers: CompetencyAnswer[];
  status: CompetencyStatus;
  usedKpiCount?: number;
  createdAt: string;
  updatedAt: string;
}

const KEY = "competency_matrices_v1";
const EVT = "competency-matrices-updated";

const seed: CompetencyMatrix[] = [];

const load = (): CompetencyMatrix[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
};

const save = (list: CompetencyMatrix[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

export const getCompetencyMatrices = (): CompetencyMatrix[] => load();

export const upsertCompetencyMatrix = (
  m: Omit<CompetencyMatrix, "id" | "createdAt" | "updatedAt"> & { id?: string }
): CompetencyMatrix => {
  const list = load();
  const now = new Date().toISOString();
  if (m.id) {
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...m, id: list[idx].id, updatedAt: now } as CompetencyMatrix;
      save(list);
      return list[idx];
    }
  }
  const next: CompetencyMatrix = {
    ...m,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(next);
  save(list);
  return next;
};

export const deleteCompetencyMatrix = (id: string) => save(load().filter(x => x.id !== id));

export const duplicateCompetencyMatrix = (id: string) => {
  const list = load();
  const src = list.find(x => x.id === id);
  if (!src) return;
  const copy: CompetencyMatrix = {
    ...src,
    id: crypto.randomUUID(),
    name: `${src.name} (kopya)`,
    status: "qaralama",
    usedKpiCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  list.unshift(copy);
  save(list);
};

export const archiveCompetencyMatrix = (id: string) => {
  const list = load().map(x => x.id === id ? { ...x, status: "passiv" as CompetencyStatus, updatedAt: new Date().toISOString() } : x);
  save(list);
};

export const useCompetencyMatrices = (): CompetencyMatrix[] => {
  const [rows, setRows] = useState<CompetencyMatrix[]>(() => load());
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
