// Sistem üçün standart açılan siyahıların (dropdown) kataloqları.
// localStorage-də saxlanılır. Hər kataloqun stabil id-si, adı və dəyər siyahısı var.
// Bu kataloqlar bütün KPI modullarındakı dropdownları idarə edir.

import { useEffect, useState } from "react";

// Strukturlaşdırılmış sətirlər (rich rows) üçün tiplər
export interface TargetTypeRow {
  id: string;
  name: string;          // Hədəf Tipi adı
  structure: string;     // Aid Olduğu Struktur (mətn)
  calcTypes: string[];   // Hesablama Tipi (çoxlu)
  active: boolean;
}
export interface KpiKindRow {
  id: string;
  name: string;          // KPI Növü
  category: string;      // Aid Olduğu Kateqoriya
  units: string[];       // Ölçü Vahidi (çoxlu)
  active: boolean;
}
export interface SubKpiRow {
  id: string;
  name: string;          // Hədəf adı
  parent: string;        // Aid Olduğu KPI / Hədəf
  units: string[];       // Ölçü Vahidi (çoxlu)
  weight: number;        // Çəki (%)
  active: boolean;
}

export type CatalogSchema = "target_types" | "kpi_kinds" | "sub_kpis" | "kpi_periods";
export type CatalogRow = TargetTypeRow | KpiKindRow | SubKpiRow;

export interface DropdownCatalog {
  id: string;
  name: string;
  values: string[];
  /** Sistem kataloqu — silmək olmaz, sadəcə dəyərlərini redaktə etmək olar */
  system?: boolean;
  /** Strukturlaşdırılmış kataloq tipi — varsa, rich rows istifadə edilir */
  schema?: CatalogSchema;
  /** Strukturlaşdırılmış sətirlər (schema təyin olunmuşdursa) */
  rows?: CatalogRow[];
}

const KEY = "kpi_dropdown_catalogs_v6";

const RAW_SEED: DropdownCatalog[] = [

// New tenants start with empty catalogs — only the catalog definitions remain.
const SEED: DropdownCatalog[] = RAW_SEED.map(c => ({ ...c, rows: [], values: [] }));
  // Hədəf Tipləri (strukturlaşdırılmış)
  {
    id: "kpi_types",
    name: "Hədəf Tipləri",
    system: true,
    schema: "target_types",
    rows: [
      { id: "tt1", name: "Absolut Hədəf (məs: Aylıq Satış)", structure: "Satış Departamenti (Bakı Branch)", calcTypes: ["Valyuta (AZN)", "Qiymət"], active: true },
      { id: "tt2", name: "Faiz Hədəfi (məs: Sifarişlərin Çatdırılması)", structure: "Logistika Şöbəsi", calcTypes: ["Faiz (%)"], active: true },
      { id: "tt3", name: "Trend Hədəfi (məs: Müştəri Şikayətlərinin Azaldılması)", structure: "Müştəri Xidmətləri", calcTypes: ["Zaman (Gün)"], active: true },
      { id: "tt4", name: "Benchmark Hədəfi (məs: Sənaye Standartı Üzrə Məmnuniyyət)", structure: "Keyfiyyətə Nəzarət", calcTypes: ["Boolean (Hə/Yox)"], active: true },
      { id: "tt5", name: "Say Hədəfi (məs: Yeni Müştəri Sayı)", structure: "Marketinq", calcTypes: ["Qiymət"], active: true },
      { id: "tt6", name: "Fərdi inkişaf (məs: Təlim Modulları)", structure: "HR Departamenti", calcTypes: ["Qiymət"], active: true },
      { id: "tt7", name: "360 qiymətləndirmə (məs: Performans Rəyi)", structure: "HR Departamenti", calcTypes: ["Faiz (%)"], active: true },
    ],
    values: [],
  },

  // KPI Növləri (strukturlaşdırılmış)
  {
    id: "kpi_kinds",
    name: "KPI Növləri",
    system: true,
    schema: "kpi_kinds",
    rows: [
      { id: "kk1", name: "Kəmiyyət KPI-ları (Ölçülə bilən)", category: "Maliyyə KPI ları", units: ["Valyuta", "Qiymət"], active: true },
      { id: "kk2", name: "Keyfiyyət KPI-ları", category: "Müştəri KPI ları", units: ["Faiz"], active: true },
      { id: "kk3", name: "Vaxt KPI-ları", category: "Əməliyyat KPI ları", units: ["Gün/Saat", "Nisbət"], active: true },
    ],
    values: [],
  },

  // Hədəf (strukturlaşdırılmış)
  {
    id: "sub_kpis",
    name: "Hədəf",
    system: true,
    schema: "sub_kpis",
    rows: [
      { id: "sk1", name: "Online Satış", parent: "Aylıq Satış Hədəfi", units: ["Valyuta (AZN)"], weight: 40, active: true },
      { id: "sk2", name: "Mağaza Satışı", parent: "Aylıq Satış Hədəfi", units: ["Valyuta (AZN)"], weight: 60, active: true },
      { id: "sk3", name: "Sosial Media Müştəriləri", parent: "Müştəri Əldə Etmə", units: ["Qiymət"], weight: 35, active: true },
      { id: "sk4", name: "Referral Müştərilər", parent: "Müştəri Əldə Etmə", units: ["Qiymət"], weight: 30, active: true },
      { id: "sk5", name: "Reklam Kampaniyası", parent: "Müştəri Əldə Etmə", units: ["Valyuta (AZN)", "Qiymət"], weight: 35, active: true },
    ],
    values: [],
  },

  // KPI Dövrü — virtual (teamsStore.getPeriods)
  {
    id: "kpi_periods",
    name: "KPI Dövrü",
    system: true,
    schema: "kpi_periods",
    values: [],
  },

  // Sadə (string-list) sistem kataloqları
  { id: "kpi_categories", name: "KPI Kateqoriyaları", system: true, values: [
    "Maliyyə KPI ları", "Müştəri KPI ları", "Əməliyyat KPI ları", "İnkişaf KPI ları",
  ]},
  { id: "calc_units", name: "Hesablama Vahidləri", system: true, values: [
    "Valyuta (AZN)", "Faiz (%)", "Zaman (Gün)", "Boolean (Hə/Yox)", "Qiymət", "Nisbət",
  ]},
  { id: "sub_kpi_units", name: "Hədəf Növləri", system: true, values: [
    "Məbləğ", "Say", "İcra", "Səriştə", "Fərdi İnkişaf", "Faiz", "Nisbət", "Boolean", "Zaman",
  ]},
  { id: "frequencies", name: "Dövr", system: true, values: [
    "Aylıq", "Rüblük", "6 Aylıq", "İllik", "Custom",
  ]},
  { id: "kpi_lifecycle_periods", name: "KPI Lifecycle Dövrləri", system: true, values: [
    "Günlük", "Həftəlik", "Aylıq", "Rüblük", "Yarımillik", "İllik",
  ]},
  { id: "kpi_statuses", name: "KPI Kartı Statusları", system: true, values: [
    "Qaralama", "Natamam", "Təsdiq gözlənilir", "İmtina", "Aktiv", "Qiymətləndirmə", "Tamamlanıb", "Silindi",
  ]},
  { id: "kpi_zones", name: "KPI Zonaları", system: true, values: [
    "Yaşıl Zona", "Sarı Zona", "Qırmızı Zona",
  ]},
  { id: "whistleblower_statuses", name: "Anonim Bildiriş Statusları", system: true, values: [
    "Yeni", "Araşdırılır", "Həll olundu",
  ]},
  { id: "evaluation_statuses", name: "Qiymətləndirmə Statusları", system: true, values: [
    "Tamamlanıb", "Gözləyir",
  ]},
  { id: "integration_systems", name: "İnteqrasiya Sistemləri", system: true, values: [
    "CRM Sistemi", "CHR", "Microsoft 365", "SIEM Platform",
  ]},
  { id: "evaluator_types", name: "Qiymətləndirici seçimi", system: true, values: [
    "Komandadaxili", "Konkret şəxs", "Özü", "İnteqrasiya",
  ]},
  { id: "whistleblower_categories", name: "Bildiriş Kateqoriyaları", system: true, values: [
    "Korrupsiya", "Saxtakarlıq", "Mobbing / Təzyiq", "Diskriminasiya",
    "Təhlükəsizlik pozuntusu", "Etik qayda pozuntusu", "Digər",
  ]},
  { id: "scoring_systems", name: "Qiymətləndirmə Bal Sistemi", system: true, values: [
    "1-3 Bal Sistemi", "1-5 Bal Sistemi", "1-10 Bal Sistemi", "Faiz (0-100)",
  ]},
];

// Strukturlaşdırılmış kataloqlarda values array-ı rows.name-dən avtomatik sinxronlaşdırılır
const syncValues = (cat: DropdownCatalog): DropdownCatalog => {
  if (cat.schema && cat.schema !== "kpi_periods" && cat.rows) {
    return { ...cat, values: cat.rows.filter(r => (r as any).active !== false).map(r => r.name) };
  }
  return cat;
};

// Bu kataloqlar Məlumat Cədvəli tabından tam çıxarılıb (istifadəçi tələbi).
// Fallback dəyərləri hər zaman kodda `useCatalogValues(id, fallback)` vasitəsilə təmin edilir.
export const REMOVED_CATALOG_IDS = new Set<string>([
  "kpi_types",
  "kpi_kinds",
  "sub_kpis",
  "kpi_periods",
  "kpi_categories",
  "calc_units",
  "kpi_lifecycle_periods",
  "kpi_zones",
  "integration_systems",
  "approver_roles",
  "notification_channels",
  "kpi_card_types",
]);

const load = (): DropdownCatalog[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: DropdownCatalog[] = JSON.parse(raw);
      const cleaned = parsed.filter(c => !REMOVED_CATALOG_IDS.has(c.id));
      const ids = new Set(cleaned.map(c => c.id));
      const missing = SEED.filter(s => !ids.has(s.id) && !REMOVED_CATALOG_IDS.has(s.id));
      const merged = missing.length === 0 ? cleaned : [...cleaned, ...missing];
      const synced = merged.map(syncValues);
      if (missing.length > 0 || cleaned.length !== parsed.length) {
        localStorage.setItem(KEY, JSON.stringify(synced));
      }
      return synced;
    }
  } catch {}
  const seeded = SEED.filter(s => !REMOVED_CATALOG_IDS.has(s.id)).map(syncValues);
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
};

const persist = (list: DropdownCatalog[]) => {
  const synced = list.map(syncValues);
  localStorage.setItem(KEY, JSON.stringify(synced));
  window.dispatchEvent(new Event("dropdown-catalogs-updated"));
};

export const getDropdownCatalogs = (): DropdownCatalog[] => load();

/** Müəyyən kataloqun dəyərlərini qaytarır. Tapılmazsa, fallback istifadə edilir. */
export const getCatalogValues = (id: string, fallback: string[] = []): string[] => {
  const cat = load().find(c => c.id === id);
  return cat ? cat.values : fallback;
};

/** React-də canlı dinləyən hook — kataloq dəyişdikdə komponenti yeniləyir. */
export const useCatalogValues = (id: string, fallback: string[] = []): string[] => {
  const [values, setValues] = useState<string[]>(() => getCatalogValues(id, fallback));
  useEffect(() => {
    const refresh = () => setValues(getCatalogValues(id, fallback));
    window.addEventListener("dropdown-catalogs-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("dropdown-catalogs-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return values;
};

export const addDropdownCatalog = (name: string): DropdownCatalog | null => {
  const v = name.trim();
  if (!v) return null;
  const list = load();
  if (list.some(c => c.name.toLowerCase() === v.toLowerCase())) return null;
  const cat: DropdownCatalog = { id: crypto.randomUUID(), name: v, values: [] };
  persist([...list, cat]);
  return cat;
};

export const renameDropdownCatalog = (id: string, name: string): boolean => {
  const v = name.trim();
  if (!v) return false;
  const list = load();
  if (list.some(c => c.id !== id && c.name.toLowerCase() === v.toLowerCase())) return false;
  persist(list.map(c => c.id === id ? { ...c, name: v } : c));
  return true;
};

export const deleteDropdownCatalog = (id: string): boolean => {
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat || cat.system) return false;
  persist(list.filter(c => c.id !== id));
  return true;
};

export const addCatalogValue = (id: string, value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat) return false;
  if (cat.values.some(x => x.toLowerCase() === v.toLowerCase())) return false;
  persist(list.map(c => c.id === id ? { ...c, values: [...c.values, v] } : c));
  return true;
};

export const updateCatalogValue = (id: string, index: number, value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat) return false;
  if (cat.values.some((x, i) => i !== index && x.toLowerCase() === v.toLowerCase())) return false;
  persist(list.map(c => c.id === id ? { ...c, values: c.values.map((x, i) => i === index ? v : x) } : c));
  return true;
};

export const removeCatalogValue = (id: string, index: number) => {
  const list = load();
  persist(list.map(c => c.id === id ? { ...c, values: c.values.filter((_, i) => i !== index) } : c));
};

// ---------- Strukturlaşdırılmış sətirlər üçün CRUD ----------
const newRowId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const addCatalogRow = (id: string, row: Omit<CatalogRow, "id">): boolean => {
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat || !cat.schema) return false;
  const next: CatalogRow = { ...(row as any), id: newRowId() };
  persist(list.map(c => c.id === id ? { ...c, rows: [...(c.rows || []), next] } : c));
  return true;
};

export const updateCatalogRow = (id: string, rowId: string, patch: Partial<CatalogRow>): boolean => {
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat || !cat.rows) return false;
  persist(list.map(c => c.id === id
    ? { ...c, rows: c.rows!.map(r => r.id === rowId ? { ...r, ...(patch as any) } : r) }
    : c));
  return true;
};

export const removeCatalogRow = (id: string, rowId: string): boolean => {
  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat || !cat.rows) return false;
  persist(list.map(c => c.id === id ? { ...c, rows: c.rows!.filter(r => r.id !== rowId) } : c));
  return true;
};
