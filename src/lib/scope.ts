// Role-aware visibility helpers used by HR / Manager / User panels so that each
// panel sees only the slice of data that belongs to it.
//
// Visibility is driven only by explicit permission codes (`kpi.view_all`,
// `kpi.view_team`, `kpi.view_own`, plus `employees.*` and `approvals.*`).

import type { AuthUser } from "@/contexts/AuthContext";
import {
  enrichedEmployees,
  getEmployeeIdForEmail,
  getEnrichedEmployee,
  getManagedEmployees,
  getStructuresLedBy,
  getTeamsLedBy,
  mockStructures,
  mockTeams,
  type EnrichedEmployee,
  type MockStructure,
  type MockTeam,
} from "@/data/mockExtras";
import { getIdentityAliases, matchesIdentity, resolveEmployeeIdForUser } from "./identity";
import type { SharedKpiCard } from "./kpiCardStore";
import type { ApprovalItem } from "./approvalsStore";


const has = (user: AuthUser | null, code: string) =>
  !!user && Array.isArray(user.permissions) && user.permissions.includes(code);

type Scope = "all" | "team" | "own" | "none";

const resolveScope = (user: AuthUser | null, module: "kpi" | "employees" | "approvals"): Scope => {
  if (!user) return "none";
  if (user.role === "SUPER_ADMIN") return "all";
  if (has(user, `${module}.view_all`)) return "all";
  if (has(user, `${module}.view_team`)) return "team";
  if (has(user, `${module}.view_own`)) return "own";
  return "none";
};

export const getCurrentEmployeeId = (user: AuthUser | null): string | null =>
  getEmployeeIdForEmail(user?.email);

export const getCurrentEmployee = (user: AuthUser | null): EnrichedEmployee | null =>
  getEnrichedEmployee(getCurrentEmployeeId(user));

// ---------- Employees ----------
export const getVisibleEmployees = (user: AuthUser | null): EnrichedEmployee[] => {
  const scope = resolveScope(user, "employees");
  if (scope === "none") return [];
  if (scope === "all") return enrichedEmployees;
  const meId = getCurrentEmployeeId(user);
  if (!meId) return [];
  if (scope === "team") return getManagedEmployees(meId);
  return enrichedEmployees.filter(e => e.id === meId);
};

// ---------- Structures ----------
export const getVisibleStructures = (user: AuthUser | null): MockStructure[] => {
  const scope = resolveScope(user, "employees");
  if (scope === "none") return [];
  if (scope === "all") return mockStructures;
  const meId = getCurrentEmployeeId(user);
  if (!meId) return [];
  if (scope === "team") {
    const own = getStructuresLedBy(meId);
    if (own.length > 0) return own;
    const me = getEnrichedEmployee(meId);
    return mockStructures.filter(s => s.id === me?.structureId);
  }
  const me = getEnrichedEmployee(meId);
  return mockStructures.filter(s => s.id === me?.structureId);
};

// ---------- Teams ----------
export const getVisibleTeams = (user: AuthUser | null): MockTeam[] => {
  const scope = resolveScope(user, "employees");
  if (scope === "none") return [];
  if (scope === "all") return mockTeams;
  const meId = getCurrentEmployeeId(user);
  if (!meId) return [];
  if (scope === "team") {
    const led = getTeamsLedBy(meId);
    if (led.length > 0) return led;
    return mockTeams.filter(t => t.memberIds.includes(meId));
  }
  return mockTeams.filter(t => t.memberIds.includes(meId));
};

// ---------- KPI cards ----------
export const getVisibleKpiCards = (
  user: AuthUser | null,
  all: SharedKpiCard[],
): SharedKpiCard[] => {
  const scope = resolveScope(user, "kpi");
  if (scope === "none") return [];
  if (scope === "all") return all;
  const meId = getCurrentEmployeeId(user);
  if (!meId) return [];
  if (scope === "team") {
    const managed = new Set(getManagedEmployees(meId).map(e => e.id));
    const ledTeamIds = new Set(getTeamsLedBy(meId).map(t => t.id));
    const ledStructureIds = new Set(getStructuresLedBy(meId).map(s => s.id));
    return all.filter(c =>
      c.ownerId === meId
      || c.evaluatorIds.includes(meId)
      || c.assigneeIds.some(a => managed.has(a))
      || c.teamIds.some(t => ledTeamIds.has(t))
      || c.structureIds.some(s => ledStructureIds.has(s)),
    );
  }
  return all.filter(c => c.assigneeIds.includes(meId) || c.ownerId === meId || c.evaluatorIds.includes(meId));
};

// ---------- Approvals ----------
// Təsdiq qutusu HƏMİŞƏ şəxsidir: sorğu yalnız onu yaradan və matris addımlarında
// adı keçən şəxslərə görünür. Uyğunlaşdırma id / "e{id}" / email / ad-soyad /
// auth UUID formatlarının hamısını əhatə edir ki, istənilən brauzer və cihazda
// eyni nəticə alınsın (icazə kodundan asılı olmadan).
export const getVisibleApprovals = (
  user: AuthUser | null,
  all: ApprovalItem[],
): ApprovalItem[] => {
  if (!user) return [];
  const aliases = getIdentityAliases(user);
  if (aliases.size === 0) return [];
  const belongsToMe = (a: ApprovalItem) =>
    (a.approverIds || []).some(id => matchesIdentity(aliases, id))
    || matchesIdentity(aliases, a.createdBy)
    || Object.keys(a.decisions || {}).some(id => matchesIdentity(aliases, id))
    || (a.stepsChain || []).some(step => (step || []).some(id => matchesIdentity(aliases, id)));
  return all.filter(belongsToMe);
};


