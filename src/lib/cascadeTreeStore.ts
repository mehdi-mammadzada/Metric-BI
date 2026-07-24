// Cascade Tree Store — Ana Hədəf → Alt Hədəflər zənciri.
// Hər node bir şəxsə ayrılmış limitdir. Bölgü rekursivdir və heç bir
// Cascading Matrix tələb etmir; təşkilati struktur `orgStore`-dan alınır.
import { useEffect, useState } from "react";
import { getEmployees, isStarPerson } from "@/lib/orgStore";

export interface CascadeTreeNode {
  id: string;
  rootId: string;
  parentId: string | null;
  /** Root üçün: mənbə KPI kartı adı */
  cardName: string;
  /** Root üçün: hədəfin adı */
  goalName: string;
  /** Ölçü vahidi (AZN, ədəd, %) */
  unit: string;
  assigneeId: number;
  assigneeName: string;
  positionName?: string;
  isStar: boolean;
  /** Bu şəxsə ayrılmış limit */
  limit: number;
  createdAt: number;
  updatedAt: number;
  /** Rəhbər bu hədəfi daha aşağı kaskadlamamaq qərarı verib */
  frozen?: boolean;
  /** Bu node növbəti səviyyəyə Cascade Load verə bilər. Köhnə datada boşdursa true kimi qəbul edilir. */
  cascadable?: boolean;
}

const KEY = "cascade_tree_nodes_v4";
// köhnə seed versiyalarını təmizlə
try { ["cascade_tree_nodes_v1","cascade_tree_nodes_v2","cascade_tree_nodes_v3"].forEach(k => localStorage.removeItem(k)); } catch {}
const EVT = "cascade-tree-updated";

const norm = (value?: string | number | null) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const nodeKey = (node: CascadeTreeNode) => [
  node.parentId || "root",
  norm(node.cardName),
  norm(node.goalName),
  node.assigneeId,
].join("::");

const betterNode = (a: CascadeTreeNode, b: CascadeTreeNode) => (Number(b.updatedAt || b.createdAt) || 0) > (Number(a.updatedAt || a.createdAt) || 0) ? b : a;

export const dedupeCascadeNodes = (rows: CascadeTreeNode[]): CascadeTreeNode[] => {
  const byId = new Map<string, CascadeTreeNode>();
  rows.forEach(row => byId.set(row.id, byId.has(row.id) ? betterNode(byId.get(row.id)!, row) : row));
  const byNode = new Map<string, CascadeTreeNode>();
  Array.from(byId.values()).forEach(row => {
    const key = nodeKey(row);
    byNode.set(key, byNode.has(key) ? betterNode(byNode.get(key)!, row) : row);
  });
  return Array.from(byNode.values()).sort((a, b) => (Number(b.updatedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.createdAt) || 0));
};

const load = (): CascadeTreeNode[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const compact = dedupeCascadeNodes(Array.isArray(parsed) ? parsed : []);
      if (Array.isArray(parsed) && compact.length !== parsed.length) localStorage.setItem(KEY, JSON.stringify(compact));
      return compact;
    }
  } catch {}
  const seed = seedNodes();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
};

const persist = (rows: CascadeTreeNode[]) => {
  localStorage.setItem(KEY, JSON.stringify(dedupeCascadeNodes(rows)));
  window.dispatchEvent(new Event(EVT));
};

export const getNodes = (): CascadeTreeNode[] => load();
export const getRoots = (): CascadeTreeNode[] => load().filter(n => n.parentId === null);
export const getChildren = (id: string): CascadeTreeNode[] => load().filter(n => n.parentId === id);
export const getNode = (id: string): CascadeTreeNode | undefined => load().find(n => n.id === id);

/** Bir node-un birbaşa alt bölgülərinin cəmi. */
export const distributedOf = (id: string): number =>
  getChildren(id).reduce((s, c) => s + (Number(c.limit) || 0), 0);

/** Bir node-a ayrılmış qalıq limit. */
export const remainingOf = (id: string): number => {
  const n = getNode(id);
  if (!n) return 0;
  return Math.max(0, (Number(n.limit) || 0) - distributedOf(id));
};

export type CascadeStatus = "wait" | "in_progress" | "problem" | "done";

/** 🟢 done / 🟡 in_progress / 🔴 problem / ⚪ wait */
export const statusOf = (id: string): CascadeStatus => {
  const n = getNode(id);
  if (!n) return "wait";
  const kids = getChildren(id);
  const dist = distributedOf(id);
  if (kids.length === 0) {
    // son icraçı və ya hələ bölünməyib
    if (n.frozen) return "done";
    if (n.limit === 0) return "wait";
    // Star deyilsə son icraçı sayılır
    return isStarPerson(n.assigneeId) ? "wait" : "done";
  }
  if (dist === 0) return "wait";
  if (dist >= n.limit) return "done";
  if (dist < n.limit && n.frozen) return "problem";
  return "in_progress";
};

/** Root yarat (HR kartı təyin etmə fazasına keçirəndə çağırılır). */
export const createRoot = (payload: {
  cardName: string;
  goalName: string;
  unit: string;
  assigneeId: number;
  assigneeName: string;
  positionName?: string;
  limit: number;
}): CascadeTreeNode => {
  const existing = findRootByGoal(payload.cardName, payload.goalName, payload.assigneeId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const node: CascadeTreeNode = {
    id, rootId: id, parentId: null,
    cardName: payload.cardName,
    goalName: payload.goalName,
    unit: payload.unit,
    assigneeId: payload.assigneeId,
    assigneeName: payload.assigneeName,
    positionName: payload.positionName,
    isStar: isStarPerson(payload.assigneeId),
    limit: Number(payload.limit) || 0,
    cascadable: true,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  persist([...load(), node]);
  return node;
};

export interface CascadeSliceInput {
  assigneeId: number;
  assigneeName: string;
  positionName?: string;
  limit: number;
  cascadable?: boolean;
}

/** Bir node-u alt şəxslər arasında bölüşdürür.
 *  Əvvəlki bölgülər saxlanılır; eyni şəxsə yenidən bölgü edilərsə dedupe
 *  ən son yazını saxlayır. Beləliklə qalıq = limit - bütün child-ların cəmi olur. */
export const distribute = (parentId: string, slices: CascadeSliceInput[]): { ok: boolean; error?: string } => {
  const parent = getNode(parentId);
  if (!parent) return { ok: false, error: "Ana hədəf tapılmadı" };
  const filtered = slices.filter(s => s.assigneeId && Number(s.limit) > 0);
  const now = Date.now();
  const newKids: CascadeTreeNode[] = filtered.map(s => ({
    id: crypto.randomUUID(),
    rootId: parent.rootId,
    parentId: parent.id,
    cardName: parent.cardName,
    goalName: parent.goalName,
    unit: parent.unit,
    assigneeId: s.assigneeId,
    assigneeName: s.assigneeName,
    positionName: s.positionName,
    isStar: isStarPerson(s.assigneeId),
    limit: Number(s.limit),
    cascadable: s.cascadable ?? true,
    createdAt: now, updatedAt: now,
  }));
  persist([...load(), ...newKids]);
  return { ok: true };
};

/** Rəhbər hədəfi aşağı bölüşdürməmək qərarı verir — son icraçı kimi qeyd et. */
export const freezeNode = (id: string, frozen: boolean) => {
  persist(load().map(n => n.id === id ? { ...n, frozen, updatedAt: Date.now() } : n));
};

/** Root-un mövcud olub-olmadığını yoxlayır (KpiSet entry üçün id əsasında). */
export const findRootByGoal = (cardName: string, goalName: string, assigneeId: number): CascadeTreeNode | undefined =>
  load().find(n => n.parentId === null && n.cardName === cardName && n.goalName === goalName && n.assigneeId === assigneeId);

export const deleteSubtree = (id: string) => {
  const all = load();
  const drop = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of all) if (n.parentId && drop.has(n.parentId) && !drop.has(n.id)) { drop.add(n.id); changed = true; }
  }
  persist(all.filter(n => !drop.has(n.id)));
};

export const useCascadeTree = (): CascadeTreeNode[] => {
  const [rows, setRows] = useState<CascadeTreeNode[]>(() => load());
  useEffect(() => {
    const h = () => setRows(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return rows;
};

const fmt = (n: number) => new Intl.NumberFormat("az-AZ").format(n);

// ------- Seed: tam paylanmış çoxsəviyyəli nümunə + qismən paylanmış nümunə -------
function seedNodes(): CascadeTreeNode[] {
  const emps = getEmployees();
  const byName = (n: string) => emps.find(e => `${e.firstName} ${e.lastName}` === n);
  const now = Date.now();
  const rows: CascadeTreeNode[] = [];

  const mk = (id: string, parentId: string | null, rootId: string, name: string, emp: any, limit: number, cardName: string, goalName: string): CascadeTreeNode => ({
    id, rootId, parentId,
    cardName, goalName, unit: "AZN",
    assigneeId: emp.id,
    assigneeName: `${emp.firstName} ${emp.lastName}`,
    positionName: emp.positionName,
    isStar: !!emp.isStarPerson,
    limit, createdAt: now, updatedAt: now,
  });

  // 1) Satış — tam paylanmış, geniş topologiya:
  // Samir → Rəşad + Leyla; Rəşad və Leyla da öz tabeliyindəkilərə bölüşdürür.
  const samir = byName("Samir Həsənov");
  const reshad = byName("Rəşad Əliyev");
  const leyla = byName("Leyla Məmmədova");
  const emin = byName("Emin Məmmədov");
  const nermin = byName("Nərmin Vəliyeva");
  const ceyhun = byName("Ceyhun Abbasov");
  const gunay = byName("Günay Salmanova");
  const ramil = byName("Ramil Səfərov");
  const nezrin = byName("Nəzrin Qurbanova");
  const vusal = byName("Vüsal Mirzəyev");
  const tural = byName("Tural Abbasov");
  const ulviyye = byName("Ülviyyə Nəbiyeva");
  const nergiz = byName("Nərgiz Əhmədova");
  const togrul = byName("Toğrul Kərimov");
  const nurlan = byName("Nurlan Bağırov");
  if (samir && reshad && leyla && emin && nermin && ceyhun && gunay && ramil && nezrin && vusal && tural && ulviyye && nergiz && togrul && nurlan) {
    const card = "İllik Satış Hədəfi 2026"; const goal = "Ümumi Satış Həcmi";
    rows.push(mk("cn-s-root", null, "cn-s-root", "root", samir, 1_000_000, card, goal));
    rows.push(mk("cn-s-a", "cn-s-root", "cn-s-root", "", reshad, 600_000, card, goal));
    rows.push(mk("cn-s-b", "cn-s-root", "cn-s-root", "", leyla, 400_000, card, goal));

    // Rəşad Əliyev öz hədəfini tabeliyindəki əməkdaşlar arasında tam paylaşır.
    rows.push(mk("cn-s-a1", "cn-s-a", "cn-s-root", "", emin, 250_000, card, goal));
    rows.push(mk("cn-s-a2", "cn-s-a", "cn-s-root", "", ceyhun, 150_000, card, goal));
    rows.push(mk("cn-s-a3", "cn-s-a", "cn-s-root", "", gunay, 100_000, card, goal));
    rows.push(mk("cn-s-a4", "cn-s-a", "cn-s-root", "", ramil, 100_000, card, goal));

    // Leyla Məmmədova da öz hədəfini tabeliyindəki əməkdaşlar arasında tam paylaşır.
    rows.push(mk("cn-s-b1", "cn-s-b", "cn-s-root", "", nermin, 140_000, card, goal));
    rows.push(mk("cn-s-b2", "cn-s-b", "cn-s-root", "", nezrin, 90_000, card, goal));
    rows.push(mk("cn-s-b3", "cn-s-b", "cn-s-root", "", vusal, 90_000, card, goal));
    rows.push(mk("cn-s-b4", "cn-s-b", "cn-s-root", "", tural, 80_000, card, goal));

    // Nümunə daha dərin görünsün deyə iki alt qolda komanda daxili mikro-bölgü var.
    rows.push(mk("cn-s-a1-1", "cn-s-a1", "cn-s-root", "", ulviyye, 125_000, card, goal));
    rows.push(mk("cn-s-a1-2", "cn-s-a1", "cn-s-root", "", nergiz, 125_000, card, goal));
    rows.push(mk("cn-s-b1-1", "cn-s-b1", "cn-s-root", "", togrul, 70_000, card, goal));
    rows.push(mk("cn-s-b1-2", "cn-s-b1", "cn-s-root", "", nurlan, 70_000, card, goal));
  }

  // 2) Marketinq — tam paylanmış (3 səviyyə, çoxlu qollar)
  const elvin = byName("Elvin Rəhimov");
  const kamran = byName("Kamran Quliyev");
  const aynur = byName("Aynur Cəfərova");
  const orxan = byName("Orxan Bayramov");
  const aytac = byName("Aytac Kərimova");
  if (elvin && kamran && aynur && orxan && aytac) {
    const card = "Marketinq Kampaniya Hədəfi"; const goal = "Lead Generation Həcmi";
    rows.push(mk("cn-m-root", null, "cn-m-root", "", elvin, 500_000, card, goal));
    rows.push(mk("cn-m-a", "cn-m-root", "cn-m-root", "", kamran, 300_000, card, goal));
    rows.push(mk("cn-m-b", "cn-m-root", "cn-m-root", "", aynur, 200_000, card, goal));
    rows.push(mk("cn-m-a1", "cn-m-a", "cn-m-root", "", orxan, 300_000, card, goal));
    rows.push(mk("cn-m-b1", "cn-m-b", "cn-m-root", "", aytac, 200_000, card, goal));
  }

  // 3) Maliyyə — qismən paylanmış (qırmızı zona nümunəsi)
  const nigar = byName("Nigar Hüseynova");
  const turan = byName("Turan Nəsibov");
  if (nigar && turan) {
    const card = "Maliyyə Effektivlik Hədəfi"; const goal = "Xərc Optimizasiyası";
    rows.push(mk("cn-f-root", null, "cn-f-root", "", nigar, 800_000, card, goal));
    rows.push(mk("cn-f-a", "cn-f-root", "cn-f-root", "", turan, 300_000, card, goal));
  }

  return rows;
}
