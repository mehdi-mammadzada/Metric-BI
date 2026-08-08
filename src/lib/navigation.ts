type NavigationUser = {
  role: string;
  permissions: string[];
};

const hasAny = (permissions: string[], codes: string[]) => codes.some(code => permissions.includes(code));

export const getDefaultPath = (user: NavigationUser | null): string | null => {
  if (!user) return "/login";
  if (user.role === "SUPER_ADMIN") return "/super-admin";

  const p = user.permissions ?? [];

  if (user.role === "HR") {
    if (p.includes("home")) return "/hr";
    if (p.includes("kpi")) return "/kpi-kartlari";
    if (p.includes("kpi_scores")) return "/kpi-qiymetleri";
    if (p.includes("goal_tracking")) return "/hedef-tayin-izleme";
    if (p.includes("kpi_lifecycle")) return "/kpi-lifecycle";
    if (p.includes("cascading")) return "/cascading";
    if (p.includes("approvals")) return "/sistem-tesdiq";
    if (p.includes("matrix")) return "/tesdiqleme-matrisi";
    if (p.includes("reporting")) return "/hesabat";
    if (p.includes("teams")) return "/komandalar";
    if (p.includes("formulas")) return "/hesablama-dusturlari";
    if (p.includes("integrations")) return "/inteqrasiyalar";
    if (p.includes("organization")) return "/teskilati-struktur";
    if (p.includes("salary")) return "/emekhaqqi-bazasi";
    if (p.includes("bonus")) return "/bonus";
    if (p.includes("evaluation")) return "/qiymetlendirme";
    if (p.includes("whistleblower")) return "/whistleblower";
    if (p.includes("settings")) return "/ayarlar";
    if (p.includes("admin_users")) return "/dahvetler";
    if (p.includes("audit")) return "/audit-jurnali";
  }

  if (user.role === "MANAGER") {
    if (hasAny(p, ["teams", "approvals", "kpi", "goal_tracking", "kpi_scores", "bonus", "reporting"])) return "/manager";
    if (p.includes("home")) return "/user";
    if (p.includes("settings")) return "/manager/ayarlar";
    if (p.includes("whistleblower")) return "/manager/whistleblower";
  }

  if (p.includes("home")) return "/user";
  if (p.includes("kpi")) return "/user/kpi-kartlari";
  if (p.includes("approvals")) return "/user/sistem-tesdiq";
  if (p.includes("reporting")) return "/user/hesabat";
  if (p.includes("teams") || p.includes("teams_compare")) return "/user/komandalar";
  if (p.includes("evaluation")) return "/user/qiymetlendirme";
  if (p.includes("whistleblower")) return "/user/whistleblower";
  if (p.includes("settings")) return "/user/ayarlar";

  if (p.includes("kpi_scores")) return "/kpi-qiymetleri";
  if (p.includes("goal_tracking")) return "/hedef-tayin-izleme";
  if (p.includes("kpi_lifecycle")) return "/kpi-lifecycle";
  if (p.includes("cascading")) return "/cascading";
  if (p.includes("matrix")) return "/tesdiqleme-matrisi";
  if (p.includes("formulas")) return "/hesablama-dusturlari";
  if (p.includes("salary")) return "/emekhaqqi-bazasi";
  if (p.includes("bonus")) return "/bonus";
  if (p.includes("organization")) return "/teskilati-struktur";
  if (p.includes("integrations")) return "/inteqrasiyalar";
  if (p.includes("admin_users")) return "/dahvetler";
  if (p.includes("audit")) return "/audit-jurnali";

  // Fallback — heç bir icazə tapılmasa da istifadəçi boş (ağ) ekranda qalmır.
  if (user.role === "HR") return "/hr";
  if (user.role === "MANAGER") return "/manager";
  return "/user";
};