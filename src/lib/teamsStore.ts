// Shared store for teams (used in TeamsPage + KPI creation) and KPI periods
// (used in HR Settings table + KPI period dropdowns). Backed by localStorage so
// items created in one module are immediately visible in another.

export interface TeamMember {
  name: string;
  role: string;
  kpiScore: number;
  avatar: string;
}

export interface Team {
  id: number;
  name: string;
  leader: string;
  leaderAvatar: string;
  kpiResult: number;
  branch: string;
  activeKpi: number;
  completedKpi: number;
  totalKpi: number;
  members: TeamMember[];
  createdAt?: string; // ISO date
}

const TEAMS_KEY = "kpi_teams_v2";
const PERIODS_KEY = "kpi_periods_v1";

const initialTeams: Team[] = [];

export const getTeams = (): Team[] => {
  const saved = localStorage.getItem(TEAMS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as Team[];
    } catch {}
  }
  localStorage.setItem(TEAMS_KEY, JSON.stringify(initialTeams));
  return initialTeams;
};

export const saveTeams = (teams: Team[]) => {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  window.dispatchEvent(new Event("teams-updated"));
};

/** Replace the local team cache without re-broadcasting a "teams-updated"
 *  event. Used by the cloud hydrator so it doesn't loop back into itself. */
export const replaceTeamsSilent = (teams: Team[]) => {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  window.dispatchEvent(new Event("teams-hydrated"));
};

export const addTeam = (team: Team) => {
  const teams = getTeams();
  const next = [...teams, team];
  saveTeams(next);
  return next;
};

// ---------- KPI Periods ----------
export interface KpiPeriod {
  id: number;
  durationLabel: string; // e.g. "6 ay", "1 il"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

const initialPeriods: KpiPeriod[] = [];

export const getPeriods = (): KpiPeriod[] => {
  const saved = localStorage.getItem(PERIODS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  localStorage.setItem(PERIODS_KEY, JSON.stringify(initialPeriods));
  return initialPeriods;
};

export const savePeriods = (periods: KpiPeriod[]) => {
  localStorage.setItem(PERIODS_KEY, JSON.stringify(periods));
  window.dispatchEvent(new Event("periods-updated"));
};

export const addPeriod = (period: Omit<KpiPeriod, "id">) => {
  const periods = getPeriods();
  const next = [...periods, { ...period, id: Date.now() }];
  savePeriods(next);
  return next;
};

export const deletePeriod = (id: number) => {
  const next = getPeriods().filter((p) => p.id !== id);
  savePeriods(next);
  return next;
};

// Helper to compute month-difference label
export const computeDurationLabel = (startISO: string, endISO: string): string => {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  let months =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() >= s.getDate()) months += 0;
  if (months <= 0) {
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
    return `${days} gün`;
  }
  if (months % 12 === 0) return `${months / 12} il`;
  return `${months} ay`;
};

export const formatPeriodRange = (p: KpiPeriod): string => {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  };
  return `${fmt(p.startDate)} – ${fmt(p.endDate)}`;
};
