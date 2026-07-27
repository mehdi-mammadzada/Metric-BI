// Real-org adapter (was mock scaffolding).
// Phase 3 rewire: instead of hard-coded e1..e16 mock people, every helper below
// is derived from the DB-synced `orgStore` (Phase 1 keeps it in Supabase).
// The exported shapes are preserved so downstream consumers (scope layer,
// KPI approvals, evaluations, reports, ApprovalsPage, SharedKpiPanel …) keep
// working without churn.

import {
  getEmployees,
  getStructures,
  getStarHolderOfUnit,
  getSubordinatesOfStarHolder,
  type OrgEmployee,
  type OrgStructure,
} from "@/lib/orgStore";
import type { MockEmployee } from "./mockData";

// ── Public shape (unchanged) ──────────────────────────────────────────────────
export interface MockStructure {
  id: string;
  name: string;
  managerId: string;
}

export interface MockTeam {
  id: string;
  name: string;
  structureId: string;
  leaderId: string;
  memberIds: string[];
}

export interface EnrichedEmployee extends MockEmployee {
  managerId: string | null;
  structureId: string | null;
  teamIds: string[];
  isManager: boolean;
}

// ── Derivation from real orgStore ─────────────────────────────────────────────
const sid = (n: number) => String(n);

const empToMock = (e: OrgEmployee): MockEmployee => ({
  id: sid(e.id),
  fullName: `${e.firstName} ${e.lastName}`.trim(),
  department: (e.structurePath || "").split(" › ")[0] || "—",
  position: e.positionName || "—",
  email: e.email,
});

const collectSlotEmpIds = (node: OrgStructure): number[] => {
  const ids = new Set<number>();
  const walk = (n: OrgStructure) => {
    for (const p of n.positions) for (const s of p.slots) if (s.employeeId != null) ids.add(s.employeeId);
    n.children.forEach(walk);
  };
  walk(node);
  return [...ids];
};

const buildAll = () => {
  const emps = getEmployees();
  const roots = getStructures();

  const structures: MockStructure[] = [];
  const teams: MockTeam[] = [];
  const managerById: Record<string, string | null> = {};
  const memberships: Record<string, string[]> = {}; // empId → team ids
  const structureOf: Record<string, string | null> = {}; // empId → structure id

  for (const root of roots) {
    const rootLeader = getStarHolderOfUnit(root.id);
    const structureId = sid(root.id);
    structures.push({
      id: structureId,
      name: root.name,
      managerId: rootLeader ? sid(rootLeader.id) : "",
    });
    // Every employee under this root belongs to this structure by default.
    for (const eid of collectSlotEmpIds(root)) {
      structureOf[sid(eid)] = structureId;
      managerById[sid(eid)] = rootLeader && rootLeader.id !== eid ? sid(rootLeader.id) : null;
    }
    // Children (şöbə) → teams.
    for (const child of root.children) {
      const leader = getStarHolderOfUnit(child.id);
      const teamId = sid(child.id);
      const memberIds = collectSlotEmpIds(child).map(sid);
      teams.push({
        id: teamId,
        name: child.name,
        structureId,
        leaderId: leader ? sid(leader.id) : "",
        memberIds,
      });
      for (const m of memberIds) {
        (memberships[m] ||= []).push(teamId);
        // Child leaders act as the direct manager for their team members.
        if (leader && sid(leader.id) !== m) managerById[m] = sid(leader.id);
      }
    }
  }

  const leaderIds = new Set<string>([
    ...structures.map(s => s.managerId),
    ...teams.map(t => t.leaderId),
  ].filter(Boolean));

  const enriched: EnrichedEmployee[] = emps.map(e => {
    const idStr = sid(e.id);
    return {
      ...empToMock(e),
      managerId: managerById[idStr] ?? null,
      structureId: structureOf[idStr] ?? null,
      teamIds: memberships[idStr] ?? [],
      isManager: leaderIds.has(idStr) || !!e.isStarPerson,
    };
  });

  return { enriched, structures, teams };
};

// ── Live snapshot (rebuilt on org changes) ────────────────────────────────────
let snapshot = buildAll();
if (typeof window !== "undefined") {
  window.addEventListener("org-updated", () => { snapshot = buildAll(); });
}
const refresh = () => (snapshot = buildAll());

// Runtime proxies so consumers using `enrichedEmployees.find(...)` always see
// the latest DB-synced data (orgStore rehydrates from Supabase on login).
const arrayProxy = <T,>(pick: () => T[]): T[] => new Proxy([] as unknown as T[], {
  get(_t, prop, recv) {
    const current = pick();
    const v = (current as any)[prop];
    return typeof v === "function" ? v.bind(current) : v;
  },
  has(_t, p) { return p in pick(); },
  ownKeys() { return Reflect.ownKeys(pick()); },
  getOwnPropertyDescriptor(_t, p) { return Object.getOwnPropertyDescriptor(pick(), p); },
});

export const enrichedEmployees = arrayProxy<EnrichedEmployee>(() => snapshot.enriched);
export const mockStructures    = arrayProxy<MockStructure>(() => snapshot.structures);
export const mockTeams         = arrayProxy<MockTeam>(() => snapshot.teams);

// ── Helpers (unchanged signatures) ────────────────────────────────────────────
export const getEmployeeIdForEmail = (email?: string | null): string | null => {
  if (!email) return null;
  const target = email.trim().toLowerCase();
  const hit = getEmployees().find(e => (e.email || "").toLowerCase() === target);
  return hit ? sid(hit.id) : null;
};

export const getEnrichedEmployee = (id: string | null | undefined): EnrichedEmployee | null => {
  if (!id) return null;
  const key = String(id).replace(/^e/i, "");
  return snapshot.enriched.find(e => e.id === String(id) || e.id === key) ?? null;
};

/**
 * Human-readable name for any employee reference (local numeric id, "e<id>",
 * email or a plain name). Never renders a raw numeric id back to the user.
 */
export const getEmployeeDisplayName = (
  ref: string | null | undefined,
  fallback = "Naməlum əməkdaş",
): string => {
  const raw = String(ref ?? "").trim();
  if (!raw) return fallback;
  const hit = getEnrichedEmployee(raw);
  if (hit?.fullName) return hit.fullName;
  const lower = raw.toLowerCase();
  const byEmail = snapshot.enriched.find(e => (e.email || "").toLowerCase() === lower);
  if (byEmail?.fullName) return byEmail.fullName;
  // Looks like an internal id (numeric / uuid) → don't show it raw.
  if (/^e?\d+$/i.test(raw) || /^[0-9a-f-]{20,}$/i.test(raw)) return fallback;
  return raw;
};


export const getStructureById = (id?: string | null): MockStructure | null =>
  id ? snapshot.structures.find(s => s.id === id) ?? null : null;

export const getTeamById = (id?: string | null): MockTeam | null =>
  id ? snapshot.teams.find(t => t.id === id) ?? null : null;

export const getTeamsLedBy = (employeeId: string): MockTeam[] =>
  snapshot.teams.filter(t => t.leaderId === employeeId);

export const getStructuresLedBy = (employeeId: string): MockStructure[] =>
  snapshot.structures.filter(s => s.managerId === employeeId);

export const getDirectReports = (employeeId: string): EnrichedEmployee[] =>
  snapshot.enriched.filter(e => e.managerId === employeeId);

/** Manager visibility: direct reports + team members + subordinates from org tree. */
export const getManagedEmployees = (employeeId: string): EnrichedEmployee[] => {
  refresh(); // make sure we react to any pending toggles
  const ids = new Set<string>([employeeId]);
  getDirectReports(employeeId).forEach(e => ids.add(e.id));
  getTeamsLedBy(employeeId).forEach(t => t.memberIds.forEach(m => ids.add(m)));
  // Include full subordinate tree from real orgStore (structure-based).
  const numericMe = Number(employeeId);
  if (!Number.isNaN(numericMe)) {
    for (const s of getStructuresLedBy(employeeId)) {
      const unitId = Number(s.id);
      if (!Number.isNaN(unitId)) {
        for (const sub of getSubordinatesOfStarHolder(numericMe, unitId)) ids.add(sid(sub.id));
      }
    }
  }
  return snapshot.enriched.filter(e => ids.has(e.id));
};

/** Kept for backwards compat — some legacy code imports this map directly. */
export const employeeManagerId: Record<string, string | null> = new Proxy({}, {
  get(_t, prop: string) {
    return snapshot.enriched.find(e => e.id === prop)?.managerId ?? null;
  },
}) as Record<string, string | null>;

/** Legacy email→id alias table (no longer authoritative — real lookup uses orgStore). */
export const EMAIL_TO_EMPLOYEE_ID: Record<string, string> = new Proxy({}, {
  get(_t, prop: string) {
    return getEmployeeIdForEmail(prop);
  },
}) as Record<string, string>;
