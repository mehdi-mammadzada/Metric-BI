// Vahid şəxsiyyət (identity) uyğunlaşdırması.
// Təsdiq matrisləri, KPI kartları və s. təsdiqçiləri müxtəlif formatlarda saxlaya bilir:
// rəqəm ID ("12"), "e12", email, ad-soyad və ya auth user UUID.
// Bu helper istifadəçi üçün bütün mümkün alias-ları toplayır ki, hansı brauzer/cihazdan
// giriş edilməsindən asılı olmayaraq eyni şəxs tanınsın.

import type { AuthUser } from "@/contexts/AuthContext";
import { enrichedEmployees, getEmployeeIdForEmail, getEnrichedEmployee } from "@/data/mockExtras";

export const normalizeAlias = (v: unknown): string =>
  String(v ?? "").trim().toLowerCase();

/** İstifadəçinin əməkdaş qeydini email → ad-soyad → auth adı ardıcıllığı ilə tapır. */
export const resolveEmployeeIdForUser = (user: AuthUser | null): string | null => {
  if (!user) return null;
  const byEmail = getEmployeeIdForEmail(user.email);
  if (byEmail) return byEmail;
  const name = normalizeAlias(user.name);
  if (name) {
    const hit = enrichedEmployees.find(e => normalizeAlias(e.fullName) === name);
    if (hit) return hit.id;
  }
  return null;
};

/** İstifadəçini təmsil edən bütün alias-lar (hamısı kiçik hərflə normallaşdırılıb). */
export const getIdentityAliases = (user: AuthUser | null): Set<string> => {
  const aliases = new Set<string>();
  const add = (v: unknown) => {
    const n = normalizeAlias(v);
    if (n) aliases.add(n);
  };

  if (!user) return aliases;
  add(user.email);
  add(user.name);
  add(user.supabaseUserId);

  const empId = resolveEmployeeIdForUser(user);
  if (empId) {
    add(empId);
    add(empId.startsWith("e") ? empId.slice(1) : `e${empId}`);
    const emp = getEnrichedEmployee(empId);
    if (emp) {
      add(emp.fullName);
      add(emp.email);
    }
  }
  return aliases;
};

/** Verilmiş referens (id/email/ad) istifadəçiyə aiddirmi? */
export const matchesIdentity = (aliases: Set<string>, ref: unknown): boolean => {
  const n = normalizeAlias(ref);
  return !!n && aliases.has(n);
};

/** Siyahıdan istifadəçiyə aid olan konkret təsdiqçi id-sini qaytarır. */
export const findMyRef = (aliases: Set<string>, refs: readonly string[]): string | null =>
  refs.find(r => matchesIdentity(aliases, r)) ?? null;
