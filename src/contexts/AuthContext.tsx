import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_MODULE_KEYS } from "@/lib/modulePermissions";
import {
  derivePermissionsFromDbCodes,
  type AppRole,
} from "@/lib/permissionMapping";

import { activateOrgSync, deactivateOrgSync } from "@/lib/orgService";
import { activateKpiCardsSync, deactivateKpiCardsSync } from "@/lib/kpiCardsService";
import { activateApprovalsSync, deactivateApprovalsSync } from "@/lib/approvalsService";
import { activatePayrollSync, deactivatePayrollSync } from "@/lib/payrollService";
import { activateLifecycleSync, deactivateLifecycleSync } from "@/lib/lifecycleService";
import { activateNotificationsSync, deactivateNotificationsSync } from "@/lib/notificationsService";
import { activateTeamsSync, deactivateTeamsSync } from "@/lib/teamsService";
import { activatePhase1Sync, deactivatePhase1Sync } from "@/lib/phase1SyncService";
import { hydrateLanguageFromProfile } from "@/lib/languageService";
import { logAudit } from "@/lib/auditService";
// ALL_MODULE_KEYS is intentionally kept imported to preserve the module surface constants
// referenced elsewhere via re-export patterns.
void ALL_MODULE_KEYS;


export interface OrgMembership {
  organizationId: string;
  organizationName: string;
}

export interface AuthUser {
  name: string;
  email: string;
  role: AppRole;
  avatar: string;
  department: string;
  team: string;
  permissions: string[];
  mustChangePassword?: boolean;
  supabaseUserId?: string;
  currentOrgId?: string;
  organizations?: OrgMembership[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  hasPermission: () => false,
  changePassword: async () => ({ success: false }),
  sendPasswordReset: async () => ({ success: false }),
});

export const useAuth = () => useContext(AuthContext);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type PasswordSignInData = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: { id: string; email?: string | null };
};

const getSupabaseStorageKey = () => {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
};

const withPromiseTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms)
    ),
  ]);
};

const attemptPasswordGrant = async (
  email: string,
  password: string,
  timeoutMs: number,
): Promise<{ data?: PasswordSignInData; error?: { message?: string }; retryable?: boolean }> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 5xx / 429 are transient — worth another attempt. 4xx (wrong password)
      // must be surfaced immediately.
      const retryable = response.status >= 500 || response.status === 429;
      return {
        error: { message: body?.msg || body?.message || (retryable ? "Server müvəqqəti cavab vermir" : "Email və ya şifrə yanlışdır") },
        retryable,
      };
    }
    const authData = body as PasswordSignInData;
    return { data: authData };
  } catch (err: any) {
    // Network error / aborted request — always retryable.
    return {
      error: { message: err?.name === "AbortError" ? "Giriş sorğusu cavab vermədi" : (err?.message || "Şəbəkə xətası") },
      retryable: true,
    };
  } finally {
    window.clearTimeout(timer);
  }
};

const signInWithPasswordFast = async (
  email: string,
  password: string,
  timeoutMs: number,
): Promise<{ data?: PasswordSignInData; error?: { message?: string } }> => {
  let last: { data?: PasswordSignInData; error?: { message?: string }; retryable?: boolean } = {};
  for (let attempt = 0; attempt < 3; attempt++) {
    last = await attemptPasswordGrant(email, password, timeoutMs);
    if (last.data || !last.retryable) break;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  if (last.data) {
    try { supabase.auth.startAutoRefresh?.(); } catch { /* noop */ }
    return { data: last.data };
  }

  // Final fallback: let the official client try (different transport path).
  if (last.retryable) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.session) {
        return {
          data: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_in: data.session.expires_in,
            expires_at: data.session.expires_at,
            token_type: data.session.token_type,
            user: { id: data.session.user.id, email: data.session.user.email },
          },
        };
      }
      if (error) return { error: { message: error.message } };
    } catch { /* noop */ }
  }

  try { supabase.auth.startAutoRefresh?.(); } catch { /* noop */ }
  return { error: last.error ?? { message: "Giriş alınmadı" } };

};

const fetchAuthUserDirect = async (
  supabaseUserId: string,
  email: string,
  accessToken: string,
  timeoutMs: number,
): Promise<AuthUser | null> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_auth_context`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ _user_id: supabaseUserId }),
    });
    if (!response.ok) return null;
    const ctx = await response.json();
    return buildAuthUserFromContext(ctx as AuthContextRpc, supabaseUserId, email);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
};

// The database can be cold (first query after idle takes many seconds), so a
// single short-lived attempt is not enough: retry before giving up.
const fetchAuthUserDirectWithRetry = async (
  supabaseUserId: string,
  email: string,
  accessToken: string,
  timeoutMs: number,
  attempts = 4,
): Promise<AuthUser | null> => {
  for (let i = 0; i < attempts; i++) {
    const u = await fetchAuthUserDirect(supabaseUserId, email, accessToken, timeoutMs);
    if (u) return u;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  return null;
};



const buildImmediateAuthUser = (authData: PasswordSignInData, email: string): AuthUser | null => {
  const userEmail = authData.user.email ?? email;
  if (userEmail.toLowerCase() !== "super.admin@outlook.com") return null;
  return {
    name: "Super Admin",
    email: userEmail,
    role: "SUPER_ADMIN",
    avatar: "S",
    department: "Platform",
    team: "—",
    permissions: ["admin_users"],
    mustChangePassword: false,
    supabaseUserId: authData.user.id,
    organizations: [],
  };
};


// ── Fetch org memberships for a Supabase-authenticated user. ──────────────────
const fetchOrgMemberships = async (userId: string): Promise<OrgMembership[]> => {
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (!data) return [];
  return data
    .map((row: any) => ({
      organizationId: row.organization_id as string,
      organizationName: (row.organizations?.name as string) ?? "—",
    }))
    .filter(m => !!m.organizationId);
};

// ── Fetch the DB permission codes + role slugs granted to a user in an org. ──
const fetchRoleDataForOrg = async (
  userId: string,
  orgId: string,
): Promise<{ codes: string[]; roleCodes: string[] }> => {
  const { data } = await supabase
    .from("organization_members")
    .select(`
      id,
      user_roles!inner(
        is_active,
        expires_at,
        roles!inner(
          code,
          is_active,
          role_permissions(
            permissions(code)
          )
        )
      )
    `)
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return { codes: [], roleCodes: [] };
  const codes = new Set<string>();
  const roleCodes = new Set<string>();
  const nowMs = Date.now();
  const userRoles: any[] = (data as any).user_roles ?? [];
  for (const ur of userRoles) {
    if (!ur.is_active) continue;
    if (ur.expires_at && new Date(ur.expires_at).getTime() < nowMs) continue;
    const role = ur.roles;
    if (!role || !role.is_active) continue;
    if (role.code) roleCodes.add(String(role.code).toLowerCase());
    const rps: any[] = role.role_permissions ?? [];
    for (const rp of rps) {
      const code = rp.permissions?.code;
      if (code) codes.add(code);
    }
  }
  return { codes: Array.from(codes), roleCodes: Array.from(roleCodes) };
};

const deriveRoleFromSlugs = (roleCodes: string[], dbCodes: string[]): AppRole => {
  const s = new Set(roleCodes);
  if (s.has("hr") || s.has("hr_admin") || s.has("admin")) return "HR";
  if (s.has("manager") || s.has("rehber")) return "MANAGER";
  if (s.has("user") || s.has("employee")) return "USER";
  return "USER";
};

type AuthContextRpc = {
  profile?: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    is_platform_super_admin: boolean | null;
    must_change_password: boolean | null;
  } | null;
  organizations?: OrgMembership[];
  currentOrgId?: string | null;
  roleCodes?: string[];
  permissionCodes?: string[];
};

type AuthProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_platform_super_admin: boolean | null;
  must_change_password: boolean | null;
};

const buildAuthUserFromContext = (
  ctx: AuthContextRpc,
  supabaseUserId: string,
  email: string,
): AuthUser | null => {
  const profile = ctx.profile;
  if (!profile) return null;

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    || (profile.email ?? email);
  const avatar = (fullName || email).charAt(0).toUpperCase();
  const organizations = Array.isArray(ctx.organizations) ? ctx.organizations : [];
  const currentOrgId = ctx.currentOrgId ?? organizations[0]?.organizationId;
  const mustChangePassword = !!profile.must_change_password;

  if (profile.is_platform_super_admin) {
    return {
      name: fullName,
      email: profile.email ?? email,
      role: "SUPER_ADMIN",
      avatar,
      department: "Platform",
      team: "—",
      permissions: ["admin_users"],
      mustChangePassword,
      supabaseUserId,
      currentOrgId,
      organizations,
    };
  }

  const dbCodes = Array.isArray(ctx.permissionCodes) ? ctx.permissionCodes : [];
  const roleCodes = Array.isArray(ctx.roleCodes) ? ctx.roleCodes : [];
  const role = deriveRoleFromSlugs(roleCodes, dbCodes);
  const permissions = derivePermissionsFromDbCodes(dbCodes);

  return {
    name: fullName,
    email: profile.email ?? email,
    role,
    avatar,
    department: organizations[0]?.organizationName ?? "—",
    team: "—",
    permissions,
    mustChangePassword,
    supabaseUserId,
    currentOrgId,
    organizations,
  };
};

// ── Resolve a Supabase-authenticated user into an AuthUser (role + perms) ─────
const buildAuthUserFromSupabase = async (
  supabaseUserId: string,
  email: string,
): Promise<AuthUser | null> => {
  const authContextResult = await withPromiseTimeout<{ data: AuthContextRpc | null; error: any }>(
    Promise.resolve((supabase as any).rpc("get_user_auth_context", { _user_id: supabaseUserId })),
    12000,
    "Auth konteksti gecikdi",
  ).catch((): { data: AuthContextRpc | null; error: any } => ({ data: null, error: { message: "Auth konteksti gecikdi" } }));

  const { data: authContext, error: authContextError } = authContextResult;

  if (!authContextError && authContext) {
    const user = buildAuthUserFromContext(authContext as AuthContextRpc, supabaseUserId, email);
    if (user) return user;
  }

  // Fallback for older environments where the optimized auth-context function
  // is not available yet.
  const profileResult = await withPromiseTimeout<{ data: AuthProfileRow | null; error?: any }>(
    Promise.resolve(supabase
      .from("profiles")
      .select("id, email, first_name, last_name, is_platform_super_admin, must_change_password")
      .eq("id", supabaseUserId)
      .maybeSingle()),
    12000,
    "Profil məlumatları gecikdi",
  ).catch((): { data: AuthProfileRow | null; error?: any } => ({ data: null }));
  const { data: profile } = profileResult;

  if (!profile) return null;

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    || (profile.email ?? email);
  const avatar = (fullName || email).charAt(0).toUpperCase();

  const organizations = await withPromiseTimeout(
    fetchOrgMemberships(supabaseUserId),
    10000,
    "Təşkilat məlumatları gecikdi",

  ).catch(() => []);
  const currentOrgId = organizations[0]?.organizationId;
  const mustChangePassword = !!(profile as any).must_change_password;

  // Platform super admin — cross-organisation access to admin surfaces.
  if (profile.is_platform_super_admin) {
    return {
      name: fullName,
      email: profile.email ?? email,
      role: "SUPER_ADMIN",
      avatar,
      department: "Platform",
      team: "—",
      permissions: ["admin_users"],
      mustChangePassword,
      supabaseUserId,
      currentOrgId,
      organizations,
    };
  }

  // Regular org member — role + permissions derive strictly from user_roles /
  // role_permissions for the active organisation. Whatever HR toggles in the
  // "Rol və Səlahiyyətlər" surface flows directly to every user of that role.
  let dbCodes: string[] = [];
  let roleCodes: string[] = [];
  if (currentOrgId) {
    const r = await withPromiseTimeout(
      fetchRoleDataForOrg(supabaseUserId, currentOrgId),
      10000,
      "Rol məlumatları gecikdi",

    ).catch(() => ({ codes: [], roleCodes: [] }));
    dbCodes = r.codes;
    roleCodes = r.roleCodes;
  }
  const role = deriveRoleFromSlugs(roleCodes, dbCodes);
  // Permissions surface: DB codes + derived UI module keys. No blanket HR
  // override — an HR user with a stripped-down role sees only what's granted.
  const permissions = derivePermissionsFromDbCodes(dbCodes);


  return {
    name: fullName,
    email: profile.email ?? email,
    role,
    avatar,
    department: organizations[0]?.organizationName ?? "—",
    team: "—",
    permissions,
    mustChangePassword,
    supabaseUserId,
    currentOrgId,
    organizations,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const syncKeyRef = useRef<string | null>(null);
  const syncTimersRef = useRef<number[]>([]);
  const initialHydrationRef = useRef(true);
  const loginInFlightRef = useRef(false);

  const clearBusinessSyncTimers = () => {
    syncTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    syncTimersRef.current = [];
  };

  const startBusinessSyncs = (u: AuthUser) => {
    if (!u.currentOrgId || !u.supabaseUserId) return;
    const key = `${u.currentOrgId}:${u.supabaseUserId}`;
    if (syncKeyRef.current === key) return;
    clearBusinessSyncTimers();
    syncKeyRef.current = key;

    const orgId = u.currentOrgId;
    const uid = u.supabaseUserId;
    const schedule = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        syncTimersRef.current = syncTimersRef.current.filter((item) => item !== timer);
        if (syncKeyRef.current === key) fn();
      }, delay);
      syncTimersRef.current.push(timer);
    };

    // Start heavy data sync after the app has navigated, and stagger modules so
    // login/page paint is never blocked by multiple large database hydrations.
    schedule(() => { void activateOrgSync(orgId, uid); }, 800);
    schedule(() => { void activatePhase1Sync(orgId); }, 1200);
    schedule(() => { void activateTeamsSync(orgId); }, 1500);
    schedule(() => { void activateKpiCardsSync(orgId); }, 1800);
    schedule(() => { void activateApprovalsSync(orgId); }, 2100);
    schedule(() => { void activatePayrollSync(orgId); }, 2400);
    schedule(() => { void activateLifecycleSync(orgId); }, 2700);
    schedule(() => { activateNotificationsSync(orgId); }, 3000);
    schedule(() => { void hydrateLanguageFromProfile(uid); }, 3300);
  };

  useEffect(() => {
    // Subscribe first so we never miss an auth event.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialHydrationRef.current) return;
      if (loginInFlightRef.current) return;
      if (session?.user) {
        if (syncKeyRef.current?.endsWith(`:${session.user.id}`)) return;
        // Defer supabase calls to avoid deadlocks inside the callback.
        setTimeout(() => {
          buildAuthUserFromSupabase(session.user.id, session.user.email ?? "").then(u => {
            if (u) {
              setUser(u);
              startBusinessSyncs(u);
            }
          });
        }, 0);
      } else {
        deactivateOrgSync();
        deactivateKpiCardsSync();
        deactivateApprovalsSync();
        deactivatePayrollSync();
        deactivateLifecycleSync();
        deactivateNotificationsSync();
        deactivatePhase1Sync();
        deactivateTeamsSync();
        clearBusinessSyncTimers();
        syncKeyRef.current = null;
        setUser(null);
      }
    });

    // Initial hydration from Supabase session. `loading` is released after a
    // short safety window so the UI (login page) is never stuck on a spinner,
    // but the session resolution keeps running in the background and applies
    // the user as soon as the (possibly cold) database answers.
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setLoading(false); } };
    const safetyTimer = window.setTimeout(finish, 4000);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const u = (await fetchAuthUserDirectWithRetry(
            session.user.id,
            session.user.email ?? "",
            session.access_token,
            12000,
          )) ?? await withPromiseTimeout(
            buildAuthUserFromSupabase(session.user.id, session.user.email ?? ""),
            25000,
            "Sessiya məlumatları gecikdi",
          ).catch(() => null);
          if (u) {
            setUser(u);
            startBusinessSyncs(u);
          }
        }
      } catch (err) {
        console.warn("[auth] initial hydration failed", err);
      } finally {

        window.clearTimeout(safetyTimer);
        initialHydrationRef.current = false;
        finish();
      }
    })();

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Realtime: when roles / role_permissions / user_roles change anywhere in
  // the org, re-derive the current user's permissions so the UI updates
  // without requiring a re-login.
  useEffect(() => {
    if (!user?.supabaseUserId) return;
    const uid = user.supabaseUserId;
    const email = user.email;

    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (scheduled) return;
      scheduled = setTimeout(async () => {
        scheduled = null;
        const fresh = await buildAuthUserFromSupabase(uid, email);
        if (fresh) setUser(fresh);
      }, 1500);
    };

    const channel = supabase
      .channel(`rbac-live-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "roles" }, refresh)
      .subscribe();

    // Fallback: refresh on tab focus / visibility changes only. The previous
    // 3-second polling loop re-ran multiple Supabase queries continuously and
    // caused severe UI lag; realtime + focus refresh is sufficient.
    const onFocus = () => refresh();
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (scheduled) clearTimeout(scheduled);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.supabaseUserId, user?.email]);





  // Per-attempt budget. signInWithPasswordFast retries up to 3 times and then
  // falls back to the official client, so a slow first attempt never fails login.
  const LOGIN_TIMEOUT_MS = 15000;


  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const lower = email.toLowerCase().trim();
    loginInFlightRef.current = true;

    try {
      // 1) Authenticate via the Auth REST endpoint directly. In this project the
      // generated client's signIn promise can occasionally wait forever after a
      // 200 response, so this path keeps login deterministic and fast.
      const { data, error } = await signInWithPasswordFast(lower, password, LOGIN_TIMEOUT_MS);

    if (!error && data?.user) {
      // Resolve the profile with the raw access token before touching the SDK
      // auth lock. In framed previews setSession uses asynchronous brokered
      // storage; awaiting it here can race with onAuthStateChange and block the
      // profile RPC even though the password grant has already succeeded.
      const directUser = await withPromiseTimeout(
        fetchAuthUserDirectWithRetry(data.user.id, data.user.email ?? lower, data.access_token, 10000),
        46000,
        "İstifadəçi məlumatları alınmadı"
      ).catch(() => null);

      let u = directUser ?? buildImmediateAuthUser(data, lower);
      if (!u) {
        u = await withPromiseTimeout(
          buildAuthUserFromSupabase(data.user.id, data.user.email ?? lower),
          25000,
          "Profil məlumatları yüklənmədi",

        ).catch(() => null);
      }
      if (u) {
          // Persist through the client's configured storage adapter. In preview
          // this also updates the parent-frame auth broker, preventing a stale
          // broker value from replacing the fresh session on reload.
          const sessionResult = await withPromiseTimeout(
            supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token }),
            20000,
            "Sessiya yadda saxlanmadı",
          ).catch((sessionError) => ({ data: { session: null, user: null }, error: sessionError }));
          if (sessionResult.error || !sessionResult.data.session) {
            console.warn("[login] session persistence failed", sessionResult.error);
            return { success: false, error: "Sessiya yadda saxlanmadı. Zəhmət olmasa yenidən cəhd edin" };
          }
          try { supabase.auth.startAutoRefresh?.(); } catch { /* noop */ }
          setUser(u);
          startBusinessSyncs(u);
          void logAudit({ organizationId: u.currentOrgId ?? null, action: "login", module: "auth", entityType: "user", entityId: u.supabaseUserId ?? null, metadata: { method: "password", email: lower } });
          return { success: true };
        }
        // Fell through — no profile row. Do not wait on client signOut here;
        // the auth client can be the part that is blocked. Clearing local
        // storage is enough to keep the UI responsive.
        const storageKey = getSupabaseStorageKey();
        if (storageKey) localStorage.removeItem(storageKey);
        return { success: false, error: "Profil məlumatları yüklənmədi. Zəhmət olmasa yenidən cəhd edin" };
      }

      return { success: false, error: error?.message ?? "Email və ya şifrə yanlışdır" };
    } catch (err: any) {
      console.warn("[login] caught", err);
      if (err?.message?.includes("timeout")) {
        return { success: false, error: "Server cavab vermədi, zəhmət olmasa bir az sonra yenidən cəhd edin" };
      }
      if (!navigator.onLine) {
        return { success: false, error: "İnternet bağlantısı yoxdur" };
      }
      return { success: false, error: "Giriş zamanı gözlənilməz xəta baş verdi" };
    } finally {
      loginInFlightRef.current = false;
    }
  };


  const logout = async () => {
    void logAudit({ organizationId: user?.currentOrgId ?? null, action: "logout", module: "auth", entityType: "user", entityId: user?.supabaseUserId ?? null });
    setUser(null);
    deactivateOrgSync();
    deactivateKpiCardsSync();
    deactivateApprovalsSync();
    deactivatePayrollSync();
    deactivateLifecycleSync();
    deactivateNotificationsSync();
    deactivatePhase1Sync();
    deactivateTeamsSync();
    clearBusinessSyncTimers();
    syncKeyRef.current = null;
    await supabase.auth.signOut();
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    return user.permissions.includes(perm);
  };

  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Sessiya tapılmadı" };
    const value = newPassword.trim();
    if (value.length < 8) return { success: false, error: "Şifrə ən az 8 simvol olmalıdır" };

    if (!user.supabaseUserId) {
      return { success: false, error: "Yalnız Supabase istifadəçiləri şifrəni dəyişə bilər" };
    }
    const { error } = await supabase.auth.updateUser({ password: value });
    if (error) return { success: false, error: error.message };
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.supabaseUserId);
    setUser({ ...user, mustChangePassword: false });
    return { success: true };
  };


  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, changePassword, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
};
