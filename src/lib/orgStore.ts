// Organization Structure store (localStorage demo)
// Manages: employees, nested structures, positions and slots (ştat) with assignment.

export interface OrgEmployee {
  id: number;
  firstName: string;
  lastName: string;
  fatherName?: string;
  fin: string;
  phone: string;
  email: string;
  active: boolean;
  // Auto-filled from structure assignment
  structurePath?: string; // e.g. "İnsan Resursları › İşə qəbul şöbəsi"
  positionName?: string;
  salary?: number;
  /** Rəhbər rolu — bu şəxs KPI hədəflərini qəbul edə və tabeliyindəkilərə bölüşdürə bilər.
   *  Ulduz VƏZİFƏYƏ deyil, birbaşa ŞƏXSƏ verilir. */
  isStarPerson?: boolean;
}

export type OrgSlotFraction = 1 | 0.75 | 0.5 | 0.25;

export interface OrgSlot {
  id: number;
  employeeId: number | null; // null = vacant
  salary: number | null;
  fraction?: OrgSlotFraction; // ştat vahidi (default: 1)
}

export interface OrgPosition {
  id: number;
  name: string;
  slots: OrgSlot[];
}


export interface OrgStructure {
  id: number;
  type: string; // "Departament" | "Şöbə" | "Sektor" ...
  name: string;
  children: OrgStructure[];
  positions: OrgPosition[];
}

const STORAGE_EMPLOYEES = "kpi_org_employees_v5";
const STORAGE_STRUCTURES = "kpi_org_structures_v6";

// ---------- Seed: 40 employees ----------
// 12 leaders + 8 rank-and-file assigned = 20 in slots; 20 unassigned bench.
const mkEmp = (
  id: number,
  firstName: string,
  lastName: string,
  fatherName: string,
  email: string,
  extras: Partial<OrgEmployee> = {},
): OrgEmployee => ({
  id, firstName, lastName, fatherName,
  fin: `FIN${String(id).padStart(5, "0")}`,
  phone: `+9945012${String(34500 + id).padStart(5, "0")}`,
  email, active: true, ...extras,
});

const seedEmployees: OrgEmployee[] = [];

// Slot / position id counters
let __sid = 4000;
const nextSlotId = () => ++__sid;
let __pid = 5000;
const nextPosId = () => ++__pid;

const mkSlot = (employeeId: number | null, salary: number | null): OrgSlot => ({
  id: nextSlotId(), employeeId, salary, fraction: 1,
});

/** Build a şöbə with 1 leader (müdir) + N mütəxəssis. Boş slot qalmır. */
const mkSobe = (
  id: number,
  name: string,
  mudirEmpId: number,
  mudirSalary: number,
  mutexPositionName: string,
  mutexAssignedEmpIds: number[],
  mutexAssignedSalary: number,
): OrgStructure => ({
  id, type: "Şöbə", name, children: [],
  positions: [
    { id: nextPosId(), name: "Şöbə Müdiri", slots: [mkSlot(mudirEmpId, mudirSalary)] },
    {
      id: nextPosId(), name: mutexPositionName,
      slots: mutexAssignedEmpIds.map(eid => mkSlot(eid, mutexAssignedSalary)),
    },
  ],
});

const seedStructures: OrgStructure[] = [];

// NOTE: We deliberately do NOT persist the fallback back into localStorage.
// The database is the source of truth; hydrate() writes the real data.
// Persisting a seed here would race with hydrate and cause fresh browsers
// to push the local demo seed back to the cloud, wiping other browsers' work.
const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
};


const save = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("org-updated"));
};

// ---------- Employees ----------

export const getEmployees = (): OrgEmployee[] => load(STORAGE_EMPLOYEES, [] as OrgEmployee[]);

export const setEmployees = (list: OrgEmployee[]) => save(STORAGE_EMPLOYEES, list);

export const addEmployee = (data: Omit<OrgEmployee, "id" | "active" | "structurePath" | "positionName" | "salary">) => {
  const list = getEmployees();
  const id = list.length ? Math.max(...list.map(e => e.id)) + 1 : 1;
  const next = [...list, { ...data, id, active: true } as OrgEmployee];
  setEmployees(next);
  return next;
};

export const updateEmployee = (id: number, patch: Partial<OrgEmployee>) => {
  const next = getEmployees().map(e => e.id === id ? { ...e, ...patch } : e);
  setEmployees(next);
  return next;
};

export const toggleEmployeeActive = (id: number) => {
  const next = getEmployees().map(e => e.id === id ? { ...e, active: !e.active } : e);
  setEmployees(next);
  return next;
};

// ---------- Catalog usage checks (structure types & positions) ----------
const collectStructureTypes = (list: OrgStructure[], out: Set<string>) => {
  for (const n of list) {
    if (n.type) out.add(n.type);
    if (n.children.length) collectStructureTypes(n.children, out);
  }
};

const collectPositionNames = (list: OrgStructure[], out: Set<string>) => {
  for (const n of list) {
    for (const p of n.positions) if (p.name) out.add(p.name);
    if (n.children.length) collectPositionNames(n.children, out);
  }
};

export const isStructureTypeInUse = (typeName: string): boolean => {
  const set = new Set<string>();
  collectStructureTypes(getStructures(), set);
  return set.has(typeName);
};

export const isPositionInUse = (positionName: string): boolean => {
  const set = new Set<string>();
  collectPositionNames(getStructures(), set);
  if (set.has(positionName)) return true;
  return getEmployees().some(e => e.positionName === positionName);
};

// ---------- Structures (tree) ----------

export const getStructures = (): OrgStructure[] => load(STORAGE_STRUCTURES, [] as OrgStructure[]);

export const setStructures = (list: OrgStructure[]) => {
  save(STORAGE_STRUCTURES, list);
  syncEmployeesFromStructures(list);
};

const newId = () => Date.now() + Math.floor(Math.random() * 1000);

const cloneStructures = (list: OrgStructure[]): OrgStructure[] => JSON.parse(JSON.stringify(list));

const findAndMutate = (
  list: OrgStructure[],
  targetId: number,
  mutator: (node: OrgStructure) => void,
): boolean => {
  for (const node of list) {
    if (node.id === targetId) {
      mutator(node);
      return true;
    }
    if (findAndMutate(node.children, targetId, mutator)) return true;
  }
  return false;
};

export const addRootStructure = (type: string, name: string, count: number = 1) => {
  const list = cloneStructures(getStructures());
  const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
  for (let i = 0; i < n; i++) {
    const baseName = name && name.trim() ? name : `Yeni ${type}`;
    const suffix = n > 1 ? ` ${i + 1}` : "";
    list.push({ id: newId() + i, type, name: `${baseName}${suffix}`, children: [], positions: [] });
  }
  setStructures(list);
  return list;
};

export const addSubStructure = (parentId: number, type: string, name: string, count: number = 1) => {
  const list = cloneStructures(getStructures());
  const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
  findAndMutate(list, parentId, (node) => {
    for (let i = 0; i < n; i++) {
      const baseName = name && name.trim() ? name : `Yeni ${type}`;
      const suffix = n > 1 ? ` ${i + 1}` : "";
      node.children.push({ id: newId() + i, type, name: `${baseName}${suffix}`, children: [], positions: [] });
    }
  });
  setStructures(list);
  return list;
};

export const renameStructure = (structureId: number, name: string) => {
  const list = cloneStructures(getStructures());
  findAndMutate(list, structureId, (node) => { node.name = name; });
  setStructures(list);
  return list;
};

export const addPosition = (structureId: number, name: string) => {
  const list = cloneStructures(getStructures());
  findAndMutate(list, structureId, (node) => {
    node.positions.push({ id: newId(), name, slots: [] });
  });
  setStructures(list);
  return list;
};

const findPositionAndMutate = (
  list: OrgStructure[],
  positionId: number,
  mutator: (pos: OrgPosition, parent: OrgStructure) => void,
): boolean => {
  for (const node of list) {
    const pos = node.positions.find(p => p.id === positionId);
    if (pos) {
      mutator(pos, node);
      return true;
    }
    if (findPositionAndMutate(node.children, positionId, mutator)) return true;
  }
  return false;
};

export const addSlot = (positionId: number, count: number = 1, fraction: OrgSlotFraction = 1) => {
  const list = cloneStructures(getStructures());
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1));
  findPositionAndMutate(list, positionId, (pos) => {
    for (let i = 0; i < n; i++) {
      pos.slots.push({ id: newId() + i, employeeId: null, salary: null, fraction });
    }
  });
  setStructures(list);
  return list;
};

export const assignSlot = (
  slotId: number,
  patch: { employeeId?: number | null; salary?: number | null; fraction?: OrgSlotFraction },
) => {
  const list = cloneStructures(getStructures());
  const visit = (nodes: OrgStructure[]): boolean => {
    for (const node of nodes) {
      for (const pos of node.positions) {
        const s = pos.slots.find(x => x.id === slotId);
        if (s) {
          if (patch.employeeId !== undefined) s.employeeId = patch.employeeId;
          if (patch.salary !== undefined) s.salary = patch.salary;
          if (patch.fraction !== undefined) s.fraction = patch.fraction;
          return true;
        }
      }
      if (visit(node.children)) return true;
    }
    return false;
  };
  visit(list);
  setStructures(list);
  return list;
};

export const removeSlot = (slotId: number) => {
  const list = cloneStructures(getStructures());
  const visit = (nodes: OrgStructure[]): boolean => {
    for (const node of nodes) {
      for (const pos of node.positions) {
        const i = pos.slots.findIndex(x => x.id === slotId);
        if (i >= 0) { pos.slots.splice(i, 1); return true; }
      }
      if (visit(node.children)) return true;
    }
    return false;
  };
  visit(list);
  setStructures(list);
  return list;
};

export const removePosition = (positionId: number) => {
  const list = cloneStructures(getStructures());
  const visit = (nodes: OrgStructure[]): boolean => {
    for (const node of nodes) {
      const i = node.positions.findIndex(p => p.id === positionId);
      if (i >= 0) { node.positions.splice(i, 1); return true; }
      if (visit(node.children)) return true;
    }
    return false;
  };
  visit(list);
  setStructures(list);
  return list;
};

export const replaceStructurePositions = (structureId: number, positions: OrgPosition[]) => {
  const list = cloneStructures(getStructures());
  findAndMutate(list, structureId, (node) => {
    node.positions = JSON.parse(JSON.stringify(positions)) as OrgPosition[];
  });
  setStructures(list);
  return list;
};

/** Struktur boş deyilsə (alt struktur və ya təyin olunmuş əməkdaş varsa) səbəbi qaytarır. */
export const canRemoveStructure = (structureId: number): { ok: true } | { ok: false; hasChildren: boolean; hasEmployees: boolean; reason: string } => {
  const findNode = (nodes: OrgStructure[]): OrgStructure | null => {
    for (const n of nodes) {
      if (n.id === structureId) return n;
      const r = findNode(n.children);
      if (r) return r;
    }
    return null;
  };
  const node = findNode(getStructures());
  if (!node) return { ok: true };
  const hasChildren = node.children.length > 0;
  const hasEmployees = node.positions.some(p => p.slots.some(s => s.employeeId != null));
  if (!hasChildren && !hasEmployees) return { ok: true };
  let reason = "";
  if (hasChildren && hasEmployees) reason = "Bu struktur silinə bilməz. Həm alt strukturlar, həm də aktiv əməkdaşlar mövcuddur. Əvvəlcə əməkdaşları çıxarın və alt strukturları silin.";
  else if (hasChildren) reason = "Bu struktur silinə bilməz. Daxilində alt strukturlar mövcuddur. Əvvəlcə bütün alt strukturları silin.";
  else reason = "Bu struktur silinə bilməz. Struktur daxilində aktiv əməkdaşlar mövcuddur. Zəhmət olmasa əvvəlcə bütün əməkdaşları strukturdan çıxarın.";
  return { ok: false, hasChildren, hasEmployees, reason };
};

export const removeStructure = (structureId: number) => {
  const check = canRemoveStructure(structureId);
  if (!check.ok) throw new Error((check as { reason: string }).reason);
  const list = cloneStructures(getStructures());
  const visit = (nodes: OrgStructure[]): boolean => {
    const i = nodes.findIndex(n => n.id === structureId);
    if (i >= 0) { nodes.splice(i, 1); return true; }
    for (const n of nodes) if (visit(n.children)) return true;
    return false;
  };
  visit(list);
  setStructures(list);
  return list;
};


// ---------- Sync employees with current assignments ----------

interface AssignmentInfo { structurePath: string; positionName: string; salary: number | null; }

const buildAssignmentMap = (list: OrgStructure[]): Map<number, AssignmentInfo> => {
  const map = new Map<number, AssignmentInfo>();
  const walk = (nodes: OrgStructure[], pathParts: string[]) => {
    for (const node of nodes) {
      const path = [...pathParts, node.name];
      for (const pos of node.positions) {
        for (const slot of pos.slots) {
          if (slot.employeeId != null) {
            map.set(slot.employeeId, {
              structurePath: path.join(" › "),
              positionName: pos.name,
              salary: slot.salary,
            });
          }
        }
      }
      walk(node.children, path);
    }
  };
  walk(list, []);
  return map;
};

const syncEmployeesFromStructures = (list: OrgStructure[]) => {
  const map = buildAssignmentMap(list);
  const employees = getEmployees().map(e => {
    const info = map.get(e.id);
    if (info) {
      return { ...e, structurePath: info.structurePath, positionName: info.positionName, salary: info.salary ?? undefined };
    }
    // Cleared assignment
    return { ...e, structurePath: undefined, positionName: undefined, salary: undefined };
  });
  localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify(employees));
  window.dispatchEvent(new Event("org-updated"));
};

export const getAssignedEmployeeIds = (): Set<number> => {
  const ids = new Set<number>();
  const walk = (nodes: OrgStructure[]) => {
    for (const n of nodes) {
      for (const p of n.positions) for (const s of p.slots) if (s.employeeId != null) ids.add(s.employeeId);
      walk(n.children);
    }
  };
  walk(getStructures());
  return ids;
};

// ---------- Helpers for KPI form ----------

export interface FlatStructureNode {
  id: number;
  name: string;
  type: string;
  path: string;            // "Satış › Bakı Satış Şöbəsi"
  parentId: number | null;
  hasChildren: boolean;
  depth: number;
}

export const getFlatStructureNodes = (): FlatStructureNode[] => {
  const out: FlatStructureNode[] = [];
  const walk = (nodes: OrgStructure[], parentId: number | null, pathParts: string[], depth: number) => {
    for (const n of nodes) {
      const path = [...pathParts, n.name].join(" › ");
      out.push({ id: n.id, name: n.name, type: n.type, path, parentId, hasChildren: n.children.length > 0, depth });
      walk(n.children, n.id, [...pathParts, n.name], depth + 1);
    }
  };
  walk(getStructures(), null, [], 0);
  return out;
};

/** Find a single structure node by id (deep). */
export const findStructureById = (id: number): OrgStructure | null => {
  const visit = (nodes: OrgStructure[]): OrgStructure | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      const r = visit(n.children);
      if (r) return r;
    }
    return null;
  };
  return visit(getStructures());
};

/**
 * Vəzifə adına görə həmin strukturda (və alt strukturlarında) işləyən şəxsləri tap.
 * Əgər structureId verilməyibsə, bütün təşkilatda axtarır.
 */
export const findOccupantsByPosition = (
  positionName: string,
  structureId?: number | null,
): string[] => {
  const employees = getEmployees();
  const empName = (id: number | null) => {
    if (id == null) return null;
    const e = employees.find(x => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : null;
  };
  const collect = (nodes: OrgStructure[], out: string[]) => {
    for (const n of nodes) {
      for (const p of n.positions) {
        if (p.name.toLowerCase() === positionName.toLowerCase()) {
          for (const s of p.slots) {
            const nm = empName(s.employeeId);
            if (nm && !out.includes(nm)) out.push(nm);
          }
        }
      }
      collect(n.children, out);
    }
  };
  const out: string[] = [];
  if (structureId != null) {
    const root = findStructureById(structureId);
    if (root) collect([root], out);
  } else {
    collect(getStructures(), out);
  }
  return out;
};


// =====================================================================
// STAR PERSON — Rəhbər rolu (Kaskadlama üçün)
// =====================================================================
// Qayda: Rəhbər rolu (⭐) VƏZİFƏYƏ deyil, birbaşa ŞƏXSƏ verilir.
// Şəxs vəzifəsindən asılı olmayaraq bu statusu daşıyır. Kaskadlama
// zamanı sistem hər struktur vahidində Rəhbər rolu daşıyan şəxsləri
// tapıb hədəfləri onlara yönləndirir; həmin rəhbər öz tabeliyindəki
// alt strukturlara və şəxslərə hədəfi bölüşdürə bilər.

/** Şəxsə Rəhbər rolu ver / geri götür (yalnız administrator).
 *  QAYDA: 1 struktur vahidində yalnız 1 rəhbər ola bilər — bu şəxsə rəhbər verildikdə
 *  həmin struktur vahidindəki digər rəhbərlər avtomatik geri götürülür. */
export const setStarPerson = (employeeId: number, isStar: boolean) => {
  let next = getEmployees();
  if (isStar) {
    const findUnit = (nodes: OrgStructure[]): OrgStructure | null => {
      for (const n of nodes) {
        for (const p of n.positions) for (const s of p.slots) if (s.employeeId === employeeId) return n;
        const r = findUnit(n.children); if (r) return r;
      }
      return null;
    };
    const unit = findUnit(getStructures());
    if (unit) {
      const unitEmpIds = new Set<number>();
      for (const p of unit.positions) for (const s of p.slots) if (s.employeeId != null) unitEmpIds.add(s.employeeId);
      next = next.map(e => unitEmpIds.has(e.id) ? { ...e, isStarPerson: e.id === employeeId } : e);
    } else {
      next = next.map(e => e.id === employeeId ? { ...e, isStarPerson: true } : e);
    }
  } else {
    next = next.map(e => e.id === employeeId ? { ...e, isStarPerson: false } : e);
  }
  setEmployees(next);
  return next;
};

/** Şəxs Rəhbər rolu daşıyırmı? */
export const isStarPerson = (employeeId: number): boolean =>
  !!getEmployees().find(e => e.id === employeeId)?.isStarPerson;

/** Verilmiş struktur vahidinin slotlarında oturan Rəhbər rolu daşıyan şəxsləri qaytarır. */
export const getStarHoldersOfUnit = (unitId: number): OrgEmployee[] => {
  const node = findStructureById(unitId);
  if (!node) return [];
  const employees = getEmployees();
  const out: OrgEmployee[] = [];
  for (const pos of node.positions) {
    for (const s of pos.slots) {
      if (s.employeeId == null) continue;
      const e = employees.find(x => x.id === s.employeeId);
      if (e && e.active && e.isStarPerson && !out.find(o => o.id === e.id)) out.push(e);
    }
  }
  return out;
};

/** Vahid holder — birdən çox olsa, birincisini qaytarır. */
export const getStarHolderOfUnit = (unitId: number): OrgEmployee | null =>
  getStarHoldersOfUnit(unitId)[0] ?? null;

export interface CascadeNode {
  unitId: number;
  unitName: string;
  unitType: string;
  path: string;
  starHolder: OrgEmployee | null;
  starHolders: OrgEmployee[];
  /** Rəhbər rolu bu struktur vahidində təyin edilməyibsə true — kaskadlama bloklanır. */
  missingStar: boolean;
  /** Bu unit-də bir neçə rəhbər varsa (>1) — administratora xəbərdarlıq. */
  multipleStars: boolean;
  children: CascadeNode[];
}

/** Verilmiş kökdən başlayaraq bütün alt strukturları rekursiv gəzir. */
export const resolveCascadeChain = (rootUnitId: number): CascadeNode | null => {
  const root = findStructureById(rootUnitId);
  if (!root) return null;
  const build = (node: OrgStructure, pathParts: string[]): CascadeNode => {
    const path = [...pathParts, node.name].join(" › ");
    const holders = getStarHoldersOfUnit(node.id);
    return {
      unitId: node.id,
      unitName: node.name,
      unitType: node.type,
      path,
      starHolder: holders[0] ?? null,
      starHolders: holders,
      missingStar: holders.length === 0,
      multipleStars: holders.length > 1,
      children: node.children.map(c => build(c, [...pathParts, node.name])),
    };
  };
  return build(root, []);
};

/** Bütün kökləri (top-level struktur vahidlərini) zəncir kimi qaytarır. */
export const resolveAllCascadeChains = (): CascadeNode[] =>
  getStructures().map(s => resolveCascadeChain(s.id)!).filter(Boolean);

/** Struktur boyunca rəhbər sayını yoxlayır. */
export interface StarValidationIssue {
  unitId: number;
  unitName: string;
  path: string;
  kind: "missing" | "multiple";
  detail?: string;
}

export const validateStarStructure = (): StarValidationIssue[] => {
  const issues: StarValidationIssue[] = [];
  const walk = (nodes: OrgStructure[], pathParts: string[]) => {
    for (const n of nodes) {
      const path = [...pathParts, n.name].join(" › ");
      const totalSlots = n.positions.reduce((sum, p) => sum + p.slots.filter(s => s.employeeId != null).length, 0);
      if (totalSlots > 0) {
        const holders = getStarHoldersOfUnit(n.id);
        if (holders.length === 0) {
          issues.push({ unitId: n.id, unitName: n.name, path, kind: "missing" });
        } else if (holders.length > 1) {
          issues.push({
            unitId: n.id, unitName: n.name, path, kind: "multiple",
            detail: holders.map(h => `${h.firstName} ${h.lastName}`).join(", "),
          });
        }
      }
      walk(n.children, [...pathParts, n.name]);
    }
  };
  walk(getStructures(), []);
  return issues;
};

/** KPI hədəfini struktur vahidinə yönləndirmə üçün Rəhbər rolu daşıyan şəxsi tap. */
export class MissingStarError extends Error {
  constructor(public unitId: number, public unitName: string) {
    super(`"${unitName}" strukturunda Rəhbər rolu təyin edilməyib`);
  }
}

export const routeKpiToUnit = (unitId: number): OrgEmployee => {
  const node = findStructureById(unitId);
  if (!node) throw new Error("Struktur tapılmadı");
  const holder = getStarHolderOfUnit(unitId);
  if (!holder) throw new MissingStarError(unitId, node.name);
  return holder;
};

/** Rəhbərin bu struktur vahidində (və alt strukturlarında) idarə etdiyi bütün şəxsləri qaytarır — özündən başqa. */
export const getSubordinatesOfStarHolder = (employeeId: number, unitId: number): OrgEmployee[] => {
  const node = findStructureById(unitId);
  if (!node) return [];
  const employees = getEmployees();
  const out: OrgEmployee[] = [];
  const walk = (n: OrgStructure) => {
    for (const pos of n.positions) {
      for (const s of pos.slots) {
        if (s.employeeId == null || s.employeeId === employeeId) continue;
        const e = employees.find(x => x.id === s.employeeId);
        if (e && e.active && !out.find(o => o.id === e.id)) out.push(e);
      }
    }
    n.children.forEach(walk);
  };
  walk(node);
  return out;
};


// ---------- Rəhbər (leader) helpers ----------

const LEADER_KEYWORDS = ["direktor", "rəhbər", "müdir", "lider"];
export const isLeaderPositionName = (name: string): boolean => {
  const p = String(name || "").toLowerCase();
  return LEADER_KEYWORDS.some(k => p.includes(k));
};

export interface LeaderStructInfo {
  node: OrgStructure;
  /** Ata strukturlarının id-ləri — kartı avtomatik expand etmək üçün */
  ancestorIds: number[];
  positionId: number;
  positionName: string;
  slotId: number;
}

/** Bu əməkdaşın rəhbər olduğu bütün strukturları tapır (dərinlik-öncə). */
export const findLeaderStructuresOf = (employeeId: number): LeaderStructInfo[] => {
  const results: LeaderStructInfo[] = [];
  const walk = (nodes: OrgStructure[], ancestors: number[]) => {
    for (const node of nodes) {
      for (const pos of node.positions) {
        if (!isLeaderPositionName(pos.name)) continue;
        for (const slot of pos.slots) {
          if (slot.employeeId === employeeId) {
            results.push({ node, ancestorIds: ancestors, positionId: pos.id, positionName: pos.name, slotId: slot.id });
          }
        }
      }
      walk(node.children, [...ancestors, node.id]);
    }
  };
  walk(getStructures(), []);
  return results;
};

// Retain references to keep the seed constants from being tree-shaken warnings.
// They remain as documentation of the historical demo seed.
void seedEmployees;
void seedStructures;
