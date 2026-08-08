// Maps Supabase RBAC permission codes → the module-level permission keys
// used throughout the UI (RouteGuard, Sidebar, hasPermission).

import { ALL_MODULE_KEYS } from "@/lib/modulePermissions";

// Every UI module key mapped to the DB permission codes that unlock it.
const MODULE_KEY_TO_DB_CODES: Record<string, string[]> = {
  home: ["home.view"],
  organization: ["org_structure.view", "employees.view"],
  kpi: ["kpi.view"],
  kpi_scores: ["kpi.view", "kpi.evaluate"],
  goal_tracking: ["kpi.view"],
  kpi_lifecycle: ["lifecycle.view"],
  cascading: ["cascading.view"],
  teams: ["teams.view"],
  evaluation: ["evaluations.view", "evaluation_360.view", "evaluation_cycles.view"],
  approvals: ["approval_requests.view", "approvals.view"],
  matrix: ["matrix.view", "approval_matrices.view"],
  reporting: ["reports.view"],
  whistleblower: ["whistleblower.view"],
  bonus: ["bonus.view"],
  formulas: ["formulas.view"],
  salary: ["salary.view"],
  integrations: ["integrations.view"],
  settings: ["settings.view"],
  audit: ["audit.view"],
};

// Extra non-module UI keys used across the app.
const EXTRA_KEY_TO_DB_CODES: Record<string, string[]> = {
  kpi_own: ["kpi.view"],
  kpi_team: ["kpi.view"],
  teams_compare: ["teams.view"],
  teams_all: ["teams.view", "teams.manage"],
  admin_users: ["users.manage", "users.view", "users.invite"],
};

const ALL_KEY_TO_DB_CODES = { ...MODULE_KEY_TO_DB_CODES, ...EXTRA_KEY_TO_DB_CODES };

// Rol təyin olunmamış (user_roles boş) təşkilat üzvləri üçün minimum işlək
// səth — əks halda hesaba giriş etdikdən sonra boş/qadağan ekran görünür.
export const BASELINE_USER_UI_PERMISSIONS = [
  "home",
  "kpi",
  "kpi_own",
  "kpi_team",
  "evaluation",
  "approvals",
  "teams",
  "teams_compare",
  "reporting",
  "whistleblower",
  "settings",
];

export const derivePermissionsFromDbCodes = (dbCodes: string[]): string[] => {
  if (!dbCodes || dbCodes.length === 0) return [...BASELINE_USER_UI_PERMISSIONS];
  const set = new Set<string>(dbCodes);
  const uiKeys: string[] = [];
  for (const [uiKey, needed] of Object.entries(ALL_KEY_TO_DB_CODES)) {
    if (needed.some(code => set.has(code))) uiKeys.push(uiKey);
  }
  // Return both the raw codes (for future fine-grained checks) and the UI keys.
  return Array.from(new Set([...dbCodes, ...uiKeys]));
};

export type AppRole = "HR" | "USER" | "SUPER_ADMIN" | "MANAGER";

export const deriveRoleFromDbCodes = (
  dbCodes: string[],
  isPlatformSuperAdmin: boolean,
): AppRole => {
  if (isPlatformSuperAdmin) return "SUPER_ADMIN";
  const set = new Set(dbCodes);
  if (set.has("users.manage") || set.has("roles.manage") || set.has("settings.manage")) return "HR";
  if (set.has("kpi.approve") || set.has("approval_requests.action") || set.has("teams.manage")) return "MANAGER";
  return "USER";
};

export const HR_FULL_UI_PERMISSIONS = [
  ...ALL_MODULE_KEYS,
  "kpi_own",
  "kpi_team",
  "teams_compare",
  "teams_all",
  "home.ai_assistant",
];

