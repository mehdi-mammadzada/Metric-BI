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
  // Hədəf Tipləri (strukturlaşdırılmış)
  {
    id: "kpi_types",
    name: "Hədəf Tipləri",
    system: true,
    schema: "target_types",
    rows: [],
    values: [],
  },

  // KPI Növləri (strukturlaşdırılmış)
  {
    id: "kpi_kinds",
    name: "KPI Növləri",
    system: true,
    schema: "kpi_kinds",
    rows: [],
    values: [],
  },

  // Hədəf (strukturlaşdırılmış)
  {
    id: "sub_kpis",
    name: "Hədəf",
    system: true,
    schema: "sub_kpis",
    rows: [],
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
  { id: "kpi_categories", name: "KPI Kateqoriyaları", system: true, values: []},
  { id: "calc_units", name: "Hesablama Vahidləri", system: true, values: []},
  { id: "sub_kpi_units", name: "Hədəf Növləri", system: true, values: []},
  { id: "frequencies", name: "Dövr", system: true, values: [
    "Aylıq", "Rüblük", "6 Aylıq", "İllik", "Custom",
  ]},
  { id: "kpi_lifecycle_periods", name: "KPI Lifecycle Dövrləri", system: true, values: []},
  { id: "kpi_statuses", name: "KPI Kartı Statusları", system: true, values: [
    "Qaralama", "Natamam", "Təsdiq gözlənilir", "İmtina", "Aktiv", "Qiymətləndirmə", "Tamamlanıb", "Silindi",
  ]},
  { id: "kpi_zones", name: "KPI Zonaları", system: true, values: []},
  { id: "whistleblower_statuses", name: "Anonim Bildiriş Statusları", system: true, values: []},
  { id: "evaluation_statuses", name: "Qiymətləndirmə Statusları", system: true, values: []},
  { id: "integration_systems", name: "İnteqrasiya Sistemləri", system: true, values: []},
  { id: "evaluator_types", name: "Qiymətləndirici seçimi", system: true, values: []},
  { id: "whistleblower_categories", name: "Bildiriş Kateqoriyaları", system: true, values: []},
  { id: "scoring_systems", name: "Qiymətləndirmə Bal Sistemi", system: true, values: []},
];

// Məlumat Cədvəlində yalnız kataloq başlıqları bərpa edilir; köhnə demo dəyərlər seed edilmir.
const SEED: DropdownCatalog[] = RAW_SEED.map(c => ({ ...c, rows: [], values: c.id === "frequencies" || c.id === "kpi_statuses" ? c.values : [] }));

// Strukturlaşdırılmış kataloqlarda values array-ı rows.name-dən avtomatik sinxronlaşdırılır
const syncValues = (cat: DropdownCatalog): DropdownCatalog => {
  if (cat.schema && cat.schema !== "kpi_periods" && cat.rows) {
    return { ...cat, values: cat.rows.filter(r => (r as any).active !== false).map(r => r.name) };
  }
  return cat;
};

// Bayaq səhvən gizlədilən sistem kataloqları yenidən göstərilir.
export const REMOVED_CATALOG_IDS = new Set<string>([]);

const LEGACY_ROW_NAMES = new Set([
  "absolut hədəf (məs: aylıq satış)",
  "faiz hədəfi (məs: sifarişlərin çatdırılması)",
  "trend hədəfi (məs: müştəri şikayətlərinin azaldılması)",
  "benchmark hədəfi (məs: sənaye standartı üzrə məmnuniyyət)",
  "say hədəfi (məs: yeni müştəri sayı)",
  "fərdi inkişaf (məs: təlim modulları)",
  "360 qiymətləndirmə (məs: performans rəyi)",
  "kəmiyyət kpi-ları (ölçülə bilən)",
  "keyfiyyət kpi-ları",
  "vaxt kpi-ları",
  "online satış",
  "mağaza satışı",
  "sosial media müştəriləri",
  "referral müştərilər",
  "reklam kampaniyası",
]);

const LEGACY_SIMPLE_DEFAULTS: Record<string, string[]> = {
  kpi_categories: ["Maliyyə KPI ları", "Müştəri KPI ları", "Əməliyyat KPI ları", "İnkişaf KPI ları"],
  calc_units: ["Valyuta (AZN)", "Faiz (%)", "Zaman (Gün)", "Boolean (Hə/Yox)", "Qiymət", "Nisbət"],
  sub_kpi_units: ["Məbləğ", "Say", "İcra", "Səriştə", "Fərdi İnkişaf", "Faiz", "Nisbət", "Boolean", "Zaman"],
  kpi_lifecycle_periods: ["Günlük", "Həftəlik", "Aylıq", "Rüblük", "Yarımillik", "İllik"],
  kpi_zones: ["Yaşıl Zona", "Sarı Zona", "Qırmızı Zona"],
  whistleblower_statuses: ["Yeni", "Araşdırılır", "Həll olundu"],
  evaluation_statuses: ["Tamamlanıb", "Gözləyir"],
  integration_systems: ["CRM Sistemi", "CHR", "Microsoft 365", "SIEM Platform"],
  evaluator_types: ["Komandadaxili", "Konkret şəxs", "Özü", "İnteqrasiya"],
  whistleblower_categories: [
    "Korrupsiya", "Saxtakarlıq", "Mobbing / Təzyiq", "Diskriminasiya",
    "Təhlükəsizlik pozuntusu", "Etik qayda pozuntusu", "Digər",
  ],
  scoring_systems: ["1-3 Bal Sistemi", "1-5 Bal Sistemi", "1-10 Bal Sistemi", "Faiz (0-100)"],
};

const normalizeText = (value: unknown) => String(value ?? "").trim().toLowerCase();
const isSameValueSet = (current: string[] = [], legacy: string[] = []) => {
  if (current.length !== legacy.length) return false;
  const currentSet = new Set(current.map(normalizeText));
  return legacy.every(value => currentSet.has(normalizeText(value)));
};

// Səhv bərpadan gəlmiş köhnə demo/pre-era dəyərləri təmizləyir, istifadəçinin yeni əlavə etdiklərinə toxunmur.
const sanitizeLegacySeedData = (list: DropdownCatalog[]): { list: DropdownCatalog[]; changed: boolean } => {
  let changed = false;
  const next = list.map(c => {
    if (!c.system) return c;
    const legacyDefaults = LEGACY_SIMPLE_DEFAULTS[c.id];
    const values = legacyDefaults && isSameValueSet(c.values, legacyDefaults) ? [] : (c.values ?? []);
    const rows = c.rows?.filter(row => !LEGACY_ROW_NAMES.has(normalizeText(row.name)));
    if (values.length !== (c.values ?? []).length || (rows && rows.length !== (c.rows ?? []).length)) changed = true;
    return {
      ...c,
      values,
      rows,
    };
  });
  return { list: next, changed };
};

const load = (): DropdownCatalog[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: DropdownCatalog[] = JSON.parse(raw);
      const ids = new Set(parsed.map(c => c.id));
      const missing = SEED.filter(s => !ids.has(s.id));
      const merged = missing.length === 0 ? parsed : [...parsed, ...missing];
      const sanitized = sanitizeLegacySeedData(merged);
      const synced = sanitized.list.map(syncValues);
      if (missing.length > 0 || sanitized.changed) {
        localStorage.setItem(KEY, JSON.stringify(synced));
      }
      return synced;
    }
  } catch {}
  const seeded = SEED.map(syncValues);
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
