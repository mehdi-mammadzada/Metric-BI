// Companies registry managed by Super Admin.
// Each company has a name, logo (data URL) and one admin account (HR role).
// Admin accounts are mirrored into hrAdminStore so login works as before.
//
// SECURITY: Admin passwords are NEVER persisted here. They are shown to the
// super admin exactly once at creation / reset time, then stored only as a
// hash in passwordStore. There is no way to retrieve the plaintext later.

import { useEffect, useState } from "react";
import {
  createHrAdmin,
  deleteHrAdmin,
  getHrAdmins,
  setHrAdminMustChangePassword,
} from "@/lib/hrAdminStore";
import { setPasswordForEmail } from "@/lib/passwordStore";
import { ALL_MODULE_KEYS } from "@/lib/modulePermissions";

export interface CompanyAdmin {
  hrAdminId: string;
  name: string;
  email: string;
  // NOTE: never populated from stored data — the plaintext password is only
  // returned in-memory from createCompany / updateCompanyAdminPassword.
}

export interface Company {
  id: string;
  name: string;
  logo: string; // data URL or empty
  admin: CompanyAdmin;
  createdAt: number;
}

const KEY = "kpi_companies_v1";
const SEED_FLAG = "kpi_companies_seeded_v1";
const EVT = "companies-updated";

const load = (): Company[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const persist = (list: Company[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

const slugify = (s: string) =>
  s.toLowerCase()
    .replace(/ə/g, "e").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20) || "company";

export const generateStrongPassword = (length = 14): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const sym = "!@#$%^&*";
  const all = upper + lower + digits + sym;
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    sym[arr[3] % sym.length],
  ];
  for (let i = 4; i < length; i++) out.push(all[arr[i] % all.length]);
  // shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = arr[i % arr.length] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
};

export const buildAdminEmail = (companyName: string): string => {
  const base = `admin@${slugify(companyName)}.kpi.az`;
  const existing = new Set(load().map(c => c.admin.email));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`admin${i}@${slugify(companyName)}.kpi.az`)) i++;
  return `admin${i}@${slugify(companyName)}.kpi.az`;
};

export const createCompany = (
  name: string,
  logo: string,
  adminName: string,
  adminEmail?: string,
  adminPassword?: string,
): { ok: boolean; error?: string; company?: Company; plaintextPassword?: string } => {
  const n = name.trim();
  if (!n) return { ok: false, error: "Şirkət adını daxil edin" };
  if (!adminName.trim()) return { ok: false, error: "Admin adını daxil edin" };
  const email = (adminEmail && adminEmail.trim()) || buildAdminEmail(n);
  const password = (adminPassword && adminPassword.trim()) || generateStrongPassword();

  const res = createHrAdmin(adminName.trim(), email, password, [...ALL_MODULE_KEYS]);
  if (!res.ok || !res.account) return { ok: false, error: res.error || "Admin yaradılmadı" };

  const company: Company = {
    id: crypto.randomUUID(),
    name: n,
    logo,
    admin: { hrAdminId: res.account.id, name: adminName.trim(), email },
    createdAt: Date.now(),
  };
  persist([...load(), company]);
  return { ok: true, company, plaintextPassword: password };
};

export const updateCompanyAdminPassword = (id: string, password: string) => {
  const c = load().find(x => x.id === id);
  if (!c) return;
  setPasswordForEmail(c.admin.email, password);
  // Force the admin to reset the temporary password on next login.
  setHrAdminMustChangePassword(c.admin.hrAdminId, true);
};

// A company can only be deleted when its admin has not yet activated the
// workspace. As soon as the admin logs in we assume they may have created
// users / departments / teams / positions / KPI cards that would be
// orphaned by a deletion, so the operation is blocked.
export const checkCompanyDependencies = (
  c: Company,
): { ok: boolean; reason?: string } => {
  const hr = getHrAdmins().find(a => a.id === c.admin.hrAdminId);
  if (hr?.lastLoginAt) {
    const when = new Date(hr.lastLoginAt).toLocaleDateString("az-AZ");
    return {
      ok: false,
      reason: `Bu şirkətin admini (${c.admin.email}) sistemə daxil olub (${when}). Silinmədən əvvəl bu şirkətə aid istifadəçilər, şöbələr, komandalar, vəzifələr və KPI kartları silinməlidir.`,
    };
  }
  return { ok: true };
};

export const deleteCompany = (id: string): { ok: boolean; error?: string } => {
  const list = load();
  const c = list.find(x => x.id === id);
  if (!c) return { ok: false, error: "Şirkət tapılmadı" };
  const dep = checkCompanyDependencies(c);
  if (!dep.ok) return { ok: false, error: dep.reason };
  try { deleteHrAdmin(c.admin.hrAdminId); } catch {}
  persist(list.filter(x => x.id !== id));
  return { ok: true };
};

export const useCompanies = (): Company[] => {
  const [list, setList] = useState<Company[]>(() => load());
  useEffect(() => {
    const refresh = () => setList(load());
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
};

export const makeFallbackLogo = (initials: string, color: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${color}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="48" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const ensureCompanySeed = () => {
  // Sample company seeding disabled.
};
