// Reusable catalog store (localStorage)
// Manages: structure types, positions, evaluation criteria

const KEY_STRUCT_TYPES = "kpi_catalog_struct_types_v1";
const KEY_POSITIONS = "kpi_catalog_positions_v1";
const KEY_CRITERIA = "kpi_catalog_criteria_v1";

const seedStructTypes: string[] = [];
const seedPositions: string[] = [];
const seedCriteria: string[] = [];

// Qeyd: fallback DƏYƏRİ localStorage-a YAZILMIR — əks halda buludan
// hidratasiya bitməmiş boş massiv buluda geri yazılır və kataloq silinir.
const load = (key: string, fallback: string[]): string[] => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
};

const save = (key: string, value: string[]) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("catalog-updated"));
};

// --- Structure types ---
export const getStructureTypes = () => load(KEY_STRUCT_TYPES, seedStructTypes);
export const addStructureType = (name: string): { ok: boolean; list: string[] } => {
  const list = getStructureTypes();
  const v = name.trim();
  if (!v) return { ok: false, list };
  if (list.includes(v)) return { ok: false, list };
  const next = [...list, v];
  save(KEY_STRUCT_TYPES, next);
  return { ok: true, list: next };
};
export const removeStructureType = (name: string) => {
  const next = getStructureTypes().filter(t => t !== name);
  save(KEY_STRUCT_TYPES, next);
  return next;
};

// --- Positions ---
// Ştatda (təşkilat strukturunda) faktiki istifadə olunan vəzifələr kataloqdan
// heç vaxt itməməlidir. Ona görə kataloq oxunarkən struktur vəzifələri ilə
// birləşdirilir (self-heal) — bulud hidratasiyası gecikdikdə də siyahı boş qalmır.
const STRUCTURES_KEY = "kpi_org_structures_v6";

const collectStructurePositions = (nodes: any[], out: Set<string>) => {
  for (const n of nodes || []) {
    for (const p of n?.positions || []) {
      const v = String(p?.name ?? "").trim();
      if (v) out.add(v);
    }
    if (n?.children?.length) collectStructurePositions(n.children, out);
  }
};

const structurePositions = (): string[] => {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem(STRUCTURES_KEY);
    if (raw) collectStructurePositions(JSON.parse(raw), set);
  } catch { /* noop */ }
  return Array.from(set);
};

export const getPositions = (): string[] => {
  const stored = load(KEY_POSITIONS, seedPositions);
  const set = new Set<string>(stored.map(p => String(p ?? "").trim()).filter(Boolean));
  structurePositions().forEach(p => set.add(p));
  return Array.from(set);
};

export const addPositionCatalog = (name: string): { ok: boolean; list: string[] } => {
  const list = getPositions();
  const v = name.trim();
  if (!v) return { ok: false, list };
  if (list.includes(v)) return { ok: false, list };
  const next = [...list, v];
  save(KEY_POSITIONS, next);
  return { ok: true, list: next };
};
export const removePositionCatalog = (name: string) => {
  const stored = load(KEY_POSITIONS, seedPositions).filter(t => t !== name);
  save(KEY_POSITIONS, stored);
  return getPositions();
};


// --- Evaluation criteria ---
export const getCriteria = () => load(KEY_CRITERIA, seedCriteria);
export const addCriterion = (name: string) => {
  const list = getCriteria();
  if (!name.trim() || list.includes(name.trim())) return list;
  const next = [...list, name.trim()];
  save(KEY_CRITERIA, next);
  return next;
};
export const removeCriterion = (name: string) => {
  const next = getCriteria().filter(t => t !== name);
  save(KEY_CRITERIA, next);
  return next;
};
