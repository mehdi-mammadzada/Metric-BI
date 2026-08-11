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
  /** İstifadəçi tərəfindən silinmiş seed dəyərləri — bir daha bərpa olunmasın */
  removed?: string[];
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
  { id: "sub_kpi_units", name: "Hədəf Növləri", system: true, values: [
    "Məbləğ", "Say", "İcra", "Səriştə", "Fərdi İnkişaf", "Faiz", "Nisbət", "Boolean", "Zaman",
  ]},
  { id: "frequencies", name: "Dövr", system: true, values: [
    "Aylıq", "Rüblük", "6 Aylıq", "İllik", "Custom",
  ]},
  { id: "kpi_lifecycle_periods", name: "KPI Lifecycle Dövrləri", system: true, values: []},
  { id: "kpi_statuses", name: "KPI Kartı Statusları", system: true, values: [
    "Qaralama", "Natamam", "Təsdiq gözlənilir", "İmtina", "Aktiv",
    "Qiymətləndirmə", "Tamamlanıb", "Ləğv olundu", "Silindi",
  ]},
  { id: "kpi_zones", name: "KPI Zonaları", system: true, values: []},
  { id: "whistleblower_statuses", name: "Anonim Bildiriş Statusları", system: true, values: [
    "Yeni", "Araşdırılır", "Həll olundu",
  ]},
  { id: "evaluation_statuses", name: "Qiymətləndirmə Statusları", system: true, values: [
    "Tamamlanıb", "Gözləyir",
  ]},
  { id: "integration_systems", name: "İnteqrasiya Sistemləri", system: true, values: []},
  { id: "evaluator_types", name: "Qiymətləndirici Seçimi", system: true, values: [
    "Şəxs", "Komanda", "Struktur", "Özü", "İnteqrasiya",
  ]},
  { id: "whistleblower_categories", name: "Bildiriş Kateqoriyaları", system: true, values: [
    "Korrupsiya", "Saxtakarlıq", "Mobbing / Təzyiq", "Diskriminasiya",
    "Təhlükəsizlik pozuntusu", "Etik qayda pozuntusu", "Digər",
  ]},
  { id: "scoring_systems", name: "Qiymətləndirmə Bal Sistemi", system: true, values: [
    "1-3 Bal Sistemi", "1-5 Bal Sistemi", "1-10 Bal Sistemi", "Faiz (0-100)",
  ]},
];

const SEED: DropdownCatalog[] = RAW_SEED.map(c => ({ ...c, rows: [] }));

/** Məlumat Cədvəlində göstərilən yeganə kataloqlar — bu sıra ilə. */
export const VISIBLE_CATALOG_IDS: string[] = [
  "frequencies",
  "sub_kpi_units",
  "evaluator_types",
  "kpi_statuses",
  "whistleblower_statuses",
  "evaluation_statuses",
  "whistleblower_categories",
  "scoring_systems",
];

/** Bu kataloqlara yeni dəyər əlavə etmək olmaz (sistem sabitləri). */
export const LOCKED_CATALOG_IDS = new Set<string>([
  "kpi_statuses",
  "evaluator_types",
  "sub_kpi_units",
  "evaluation_statuses",
  "frequencies",
  "scoring_systems",
]);

// Strukturlaşdırılmış kataloqlarda values array-ı rows.name-dən avtomatik sinxronlaşdırılır
const syncValues = (cat: DropdownCatalog): DropdownCatalog => {
  if (cat.schema && cat.schema !== "kpi_periods" && cat.rows) {
    return { ...cat, values: cat.rows.filter(r => (r as any).active !== false).map(r => r.name) };
  }
  return cat;
};

// Məlumat Cədvəlində gizlədilən (amma dropdownlar üçün saxlanılan) kataloqlar.
export const REMOVED_CATALOG_IDS = new Set<string>(
  RAW_SEED.map(c => c.id).filter(id => !VISIBLE_CATALOG_IDS.includes(id)),
);

// Migrasiya markeri payload-un içində saxlanılır ki, bulud sinxronizasiyası ilə
// digər brauzerlərə də getsin və istifadəçinin əlavə etdiyi dəyərlər sıfırlanmasın.
const META_ID = "__catalog_meta_v7";
const META_ENTRY: DropdownCatalog = { id: META_ID, name: META_ID, system: true, values: [] };

const seedById = new Map(SEED.map(c => [c.id, c]));

const EVALUATOR_TYPE_ALIASES: Record<string, string> = {
  "konkret şəxs": "Şəxs",
  "şəxs": "Şəxs",
  "komandadaxili": "Komanda",
  "komanda": "Komanda",
  "struktur": "Struktur",
  "özü": "Özü",
  "inteqrasiya": "İnteqrasiya",
};

const uniqueValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach(value => {
    const v = String(value || "").trim();
    if (!v) return;
    const key = v.toLocaleLowerCase("az-AZ");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  });
  return out;
};

const ensureSystemCatalogs = (list: DropdownCatalog[]): { list: DropdownCatalog[]; changed: boolean } => {
  let changed = false;
  const byId = new Map(list.map(c => [c.id, c]));
  const next = SEED.map(seed => {
    const existing = byId.get(seed.id);
    if (!existing) {
      changed = true;
      return { ...seed };
    }

    const removed = existing.removed ?? [];
    const removedSet = new Set(removed.map(v => v.toLocaleLowerCase("az-AZ")));
    let values = existing.values ?? [];
    if (!seed.schema && seed.system) {
      const seedValues = (seed.values ?? []).filter(v => !removedSet.has(v.toLocaleLowerCase("az-AZ")));
      values = uniqueValues([...seedValues, ...values]);
      if (seed.id === "evaluator_types") {
        values = uniqueValues(values.map(v => EVALUATOR_TYPE_ALIASES[v.toLocaleLowerCase("az-AZ")] ?? v));
        values = uniqueValues([...seedValues, ...values]);
      }
      values = values.filter(v => !removedSet.has(v.toLocaleLowerCase("az-AZ")));
    }

    const merged: DropdownCatalog = {
      ...seed,
      ...existing,
      name: seed.system ? seed.name : existing.name,
      system: seed.system || existing.system,
      schema: seed.schema ?? existing.schema,
      values,
      removed,
      rows: seed.schema && seed.schema !== "kpi_periods" ? (existing.rows ?? []) : existing.rows,
    };

    if (JSON.stringify(existing) !== JSON.stringify(merged)) changed = true;
    return merged;
  });

  list.forEach(cat => {
    if (!seedById.has(cat.id) && cat.id !== META_ID) next.push(cat);
  });

  if (list.some(cat => cat.id === META_ID)) next.push(META_ENTRY);
  return { list: next, changed };
};

// Bir dəfəlik sıfırlama: sistem kataloqları tələb olunan standart dəyərlərə gətirilir.
const applyResetMigration = (list: DropdownCatalog[]): { list: DropdownCatalog[]; changed: boolean } => {
  if (list.some(c => c.id === META_ID)) return { list, changed: false };
  const next = list.map(c => {
    const seed = seedById.get(c.id);
    if (!seed || seed.schema) return c;
    const removedSet = new Set((c.removed ?? []).map(v => v.toLocaleLowerCase("az-AZ")));
    return {
      ...c,
      values: uniqueValues([...(seed.values ?? []), ...(c.values ?? [])])
        .filter(v => !removedSet.has(v.toLocaleLowerCase("az-AZ"))),
    };
  });
  return { list: [...next, META_ENTRY], changed: true };
};


const load = (): DropdownCatalog[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: DropdownCatalog[] = JSON.parse(raw);
      const ids = new Set(parsed.map(c => c.id));
      const missing = SEED.filter(s => !ids.has(s.id));
      const merged = missing.length === 0 ? parsed : [...parsed, ...missing];
      const ensured = ensureSystemCatalogs(merged);
      const reset = applyResetMigration(ensured.list);
      const synced = reset.list.map(syncValues);
      if (missing.length > 0 || ensured.changed || reset.changed) {
        localStorage.setItem(KEY, JSON.stringify(synced));
        window.dispatchEvent(new Event("dropdown-catalogs-updated"));
      }
      return synced;
    }
  } catch {}
  const seeded = [...SEED.map(syncValues), META_ENTRY];
  try {
    localStorage.setItem(KEY, JSON.stringify(seeded));
  } catch {}
  return seeded;
};


const persist = (list: DropdownCatalog[]) => {
  const synced = list.map(syncValues);
  localStorage.setItem(KEY, JSON.stringify(synced));
  window.dispatchEvent(new Event("dropdown-catalogs-updated"));
};

/** Məlumat Cədvəli üçün — yalnız icazə verilən kataloqlar, sabit sıra ilə. */
export const getDropdownCatalogs = (): DropdownCatalog[] => {
  const list = load();
  return VISIBLE_CATALOG_IDS
    .map(id => list.find(c => c.id === id))
    .filter((c): c is DropdownCatalog => !!c);
};

/** Bütün kataloqlar (gizlədilənlər daxil) — daxili istifadə üçün. */
export const getAllDropdownCatalogs = (): DropdownCatalog[] => load();

/** Müəyyən kataloqun dəyərlərini qaytarır. Tapılmazsa və ya boşdursa, fallback istifadə edilir. */
export const getCatalogValues = (id: string, fallback: string[] = []): string[] => {
  const cat = load().find(c => c.id === id);
  if (!cat) return fallback;
  if (cat.values.length === 0 && REMOVED_CATALOG_IDS.has(id)) return fallback;
  return cat.values;
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
  if (LOCKED_CATALOG_IDS.has(id)) return false;
  const v = value.trim();
  if (!v) return false;

  const list = load();
  const cat = list.find(c => c.id === id);
  if (!cat) return false;
  if (cat.values.some(x => x.toLowerCase() === v.toLowerCase())) return false;
  persist(list.map(c => c.id === id
    ? { ...c, values: [...c.values, v], removed: (c.removed ?? []).filter(x => x.toLowerCase() !== v.toLowerCase()) }
    : c));

  return true;
};

export const updateCatalogValue = (id: string, index: number, value: string): boolean => {
  if (LOCKED_CATALOG_IDS.has(id)) return false;
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
  if (LOCKED_CATALOG_IDS.has(id)) return;
  const list = load();
  persist(list.map(c => {
    if (c.id !== id) return c;
    const victim = c.values[index];
    const removed = uniqueValues([...(c.removed ?? []), ...(victim ? [victim] : [])]);
    return { ...c, values: c.values.filter((_, i) => i !== index), removed };
  }));
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
