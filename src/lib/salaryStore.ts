// Salary database store (localStorage demo)

export const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
] as const;
export type Month = typeof MONTHS[number];

export interface SalaryPeriod {
  id: number;
  month: Month;
  year: number;
  salary: number;          // base monthly salary (AZN)
  totalDays: number;       // ümumi gün sayı
  workedDays: number;      // gün sayı (faktiki)
}

export interface SalaryRecord {
  id: number;
  employeeId: number;
  employeeUuid?: string;
  operator: string;
  periods: SalaryPeriod[];
  createdAt: string;
}

const STORAGE = "kpi_salary_records_v3";

const buildPeriods = (baseId: number, salary: number, includeWorkedJitter = true): SalaryPeriod[] => {
  const periods: SalaryPeriod[] = [];
  const monthDays = [22, 20, 21, 22, 21, 21, 22, 22, 21, 22, 21, 22];
  let pid = baseId;
  for (const year of [2024, 2025, 2026]) {
    MONTHS.forEach((m, idx) => {
      // 2026: only up to current month (June = idx 5)
      if (year === 2026 && idx > 5) return;
      const td = monthDays[idx];
      const worked = includeWorkedJitter ? Math.max(td - (idx % 3), td - 2) : td;
      periods.push({ id: pid++, month: m, year, salary, totalDays: td, workedDays: worked });
    });
  }
  return periods;
};

const seed: SalaryRecord[] = [];


const load = (): SalaryRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const save = (list: SalaryRecord[]) => {
  localStorage.setItem(STORAGE, JSON.stringify(list));
  window.dispatchEvent(new Event("salary-updated"));
};

// Fire-and-forget immediate cloud flush so periods per-month persist
// across refresh / logout / another browser / another device.
const flushCloud = async () => {
  try {
    const m = await import("@/lib/payrollService");
    await m.flushPayrollToCloud?.();
  } catch { /* noop */ }
};

const persistRecordCloud = async (record: SalaryRecord) => {
  const m = await import("@/lib/payrollService");
  const persisted = await m.persistSalaryRecordToCloud?.(record);
  if (!persisted) await m.flushPayrollToCloud?.();
};

export const getRecords = (): SalaryRecord[] => load();

/**
 * Merge-oriented add: guarantees ONE record per employee. New periods with the
 * same (year, month) REPLACE existing ones — across all records for that
 * employee — so the table always shows the most recent value the user entered
 * for that month.
 */
export const addRecord = async (data: Omit<SalaryRecord, "id" | "createdAt">) => {
  const list = load();
  // Collapse any pre-existing records for the same employee into one bucket.
  const sameEmp = list.filter(r => r.employeeId === data.employeeId);
  const others = list.filter(r => r.employeeId !== data.employeeId);

  const key = (p: SalaryPeriod) => `${p.year}-${p.month}`;
  const incomingKeys = new Set(data.periods.map(key));

  const kept = sameEmp.flatMap(r => r.periods).filter(p => !incomingKeys.has(key(p)));
  const allPeriods = [...kept, ...data.periods];
  // Renumber period ids and sort chronologically.
  let pid = 1;
  const nextPeriods = allPeriods
    .sort((a, b) => a.year - b.year || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month))
    .map(p => ({ ...p, id: pid++ }));

  const base = sameEmp[0];
  const nextRecord: SalaryRecord = base
    ? { ...base, operator: data.operator || base.operator, periods: nextPeriods }
    : {
        id: (list.length ? Math.max(...list.map(r => r.id)) : 0) + 1,
        employeeId: data.employeeId,
        operator: data.operator,
        periods: nextPeriods,
        createdAt: new Date().toISOString(),
      };

  const next = [...others, nextRecord];
  save(next);
  await persistRecordCloud(nextRecord);
  return next;
};

export const removeRecord = (id: number) => {
  save(load().filter(r => r.id !== id));
  void flushCloud();
};

export const computePay = (p: SalaryPeriod): number => {
  if (!p.totalDays || p.totalDays <= 0) return 0;
  return Math.round((p.salary * p.workedDays) / p.totalDays);
};

