// HR (Admin) hesabları üçün sistem modullarının səlahiyyət açarları.
// Super Admin bu açarlar əsasında HR (Admin)-lərə giriş verir / geri alır.

export interface ModulePerm {
  key: string;
  label: string;
  path: string;
}

export const MODULE_PERMS: ModulePerm[] = [
  { key: "home", label: "Əsas Səhifə", path: "/hr" },
  { key: "organization", label: "Təşkilat", path: "/teskilati-struktur" },
  { key: "kpi", label: "KPI Kartları", path: "/kpi-kartlari" },
  { key: "kpi_scores", label: "KPI Nəticələri", path: "/kpi-qiymetleri" },
  
  { key: "goal_tracking", label: "Kaskadlanmış hədəflərin izlənməsi", path: "/hedef-tayin-izleme" },
  { key: "kpi_lifecycle", label: "KPI lifecycle izlənilmələri", path: "/kpi-lifecycle" },
  { key: "cascading", label: "Cascading", path: "/cascading" },

  { key: "teams", label: "Komandalar", path: "/komandalar" },
  { key: "evaluation", label: "Qiymətləndirmə", path: "/qiymetlendirme" },
  { key: "approvals", label: "Sistem Təsdiqləri", path: "/sistem-tesdiq" },
  { key: "matrix", label: "Təsdiqləmə Matrisi", path: "/tesdiqleme-matrisi" },
  { key: "reporting", label: "Hesabatlar", path: "/hesabat" },
  { key: "whistleblower", label: "Anonim Bildiriş", path: "/whistleblower" },
  { key: "bonus", label: "Bonuslar", path: "/bonus" },
  { key: "formulas", label: "Hesablama Düsturları", path: "/hesablama-dusturlari" },
  { key: "salary", label: "Əməkhaqqı Bazası", path: "/emekhaqqi-bazasi" },
  { key: "integrations", label: "İnteqrasiyalar", path: "/inteqrasiyalar" },
  { key: "settings", label: "Sazlamalar", path: "/ayarlar" },
];

export const ALL_MODULE_KEYS: string[] = MODULE_PERMS.map(m => m.key);
