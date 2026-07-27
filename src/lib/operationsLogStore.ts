// Operations registry — KPI cards approved/deleted log.
export interface OperationLogEntry {
  id: string;
  kpiName: string;
  team: string;
  period: string; // e.g. "01.01.2025 – 31.03.2025"
  status: "approved" | "deleted";
  at: string;
}

const KEY = "kpi_operations_log_v1";

export const getOperationsLog = (): OperationLogEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const seed: OperationLogEntry[] = [];
    localStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
};

export const addOperationLog = (entry: Omit<OperationLogEntry, "id" | "at">) => {
  const list = getOperationsLog();
  list.unshift({ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("operations:updated"));
};
