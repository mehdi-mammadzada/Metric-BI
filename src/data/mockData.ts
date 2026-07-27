// Mock data for evaluation module (Qiymətləndirmə)
import { getEmployees as getLiveOrgEmployees } from "@/lib/orgStore";


export interface MockEmployee {
  id: string;
  fullName: string;
  department: string;
  position: string;
  email: string;
}

// Demo static staff removed — new tenants must start completely empty.
const demoStaticEmployees: MockEmployee[] = [];

// Pulled from orgStore lazily so any employee created via the Təşkilat module
// (and synced to the DB) automatically appears in evaluator / peer / matrix
// dropdowns across the app.
const buildLiveEmployees = (): MockEmployee[] => {
  try {
    const emps = getLiveOrgEmployees();
    return emps.map((e) => ({
      id: String(e.id),
      fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || (e.email ?? "—"),
      department: (e.structurePath || "").split(" › ")[0] || "—",
      position: e.positionName || "—",
      email: e.email || "",
    }));
  } catch {
    return [];
  }
};

const currentEmployees = (): MockEmployee[] => {
  const live = buildLiveEmployees();
  const seen = new Set(live.map(l => l.id));
  const demo = demoStaticEmployees.filter(d => !seen.has(d.id));
  return [...live, ...demo];
};

// Live proxy so every array read reflects the current DB-synced employee list.
export const mockEmployees: MockEmployee[] = new Proxy([] as MockEmployee[], {
  get(_t, prop) {
    const c = currentEmployees();
    const v: any = (c as any)[prop];
    return typeof v === "function" ? v.bind(c) : v;
  },
  has(_t, p) { return p in currentEmployees(); },
  ownKeys() { return Reflect.ownKeys(currentEmployees()); },
  getOwnPropertyDescriptor(_t, p) { return Object.getOwnPropertyDescriptor(currentEmployees(), p); },
}) as MockEmployee[];

export const getInitials = (fullName: string) =>
  fullName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const EVALUATION_CATEGORIES = [
  { key: "technical", label: "Texniki Bacarıqlar" },
  { key: "teamwork", label: "Komanda İşi" },
  { key: "communication", label: "Kommunikasiya" },
  { key: "timeliness", label: "Vaxtında İcra" },
  { key: "innovation", label: "İnnovasiya" },
] as const;

export type CategoryKey = (typeof EVALUATION_CATEGORIES)[number]["key"];

// Deterministic string hash → seed
const hashString = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 233280 || 1;
};

// LCG seeded shuffle
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * For a given cycle, deterministically assign 2 same-department peers to each reviewer.
 * Department must have >= 3 active employees.
 */
export const buildPeerAssignments = (
  cycleId: string
): Record<string, MockEmployee[]> => {
  const byDept: Record<string, MockEmployee[]> = {};
  mockEmployees.forEach((e) => {
    (byDept[e.department] ||= []).push(e);
  });

  const assignments: Record<string, MockEmployee[]> = {};
  for (const reviewer of mockEmployees) {
    const peers = byDept[reviewer.department].filter((p) => p.id !== reviewer.id);
    if (peers.length < 2) {
      assignments[reviewer.id] = [];
      continue;
    }
    const seed = hashString(`${cycleId}-${reviewer.department}-${reviewer.id}`);
    assignments[reviewer.id] = seededShuffle(peers, seed).slice(0, 2);
  }
  return assignments;
};

// Default cycle id (could be tied to period in real impl)
export const CURRENT_CYCLE_ID = "2026-H1";

// Mock current logged-in users for peer-evaluation flow
// HR profile is treated as a separate employee from the USER profile.
export const MOCK_HR_USER_ID = "e1";   // Aysel Məmmədova — İnsan Resursları
export const MOCK_USER_ID = "e4";      // Elvin Quliyev — Satış

// Backwards-compat (legacy import)
export const MOCK_CURRENT_USER_ID = MOCK_USER_ID;
