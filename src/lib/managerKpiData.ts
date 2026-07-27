// Rəhbər modulları üçün REAL KPI datası (mock yoxdur).
// Mənbələr: shared_kpi_cards (HR-in yaratdığı kartlar) + cascade_tree (paylanmış hədəflər).
import { getEmployees } from "@/lib/orgStore";
import { getSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { getNodes, type CascadeTreeNode } from "@/lib/cascadeTreeStore";
import { getTeams } from "@/lib/teamsStore";

export interface RealTarget {
  id: string;
  name: string;
  plan: number;
  fakt: number;
  unit: string;
  weight: number;
  status: "in_progress" | "completed" | "not_achieved";
}

export interface RealKpiCard {
  id: string;
  cardId?: number;
  name: string;
  createdAt: string;
  deadline: string;
  status: "in_progress" | "completed" | "not_achieved";
  targets: RealTarget[];
  ownerName?: string;
  cardStatus?: string;
  scoringSystem?: string;
  frequency?: string;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const dt = (s?: string) => {
  if (!s) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : s;
};

const empKey = (id: number) => `e${id}`;

/** Kartlar yalnız real statuslarda göstərilir (silinmiş/imtina olunmuş kartlar yox). */
const VISIBLE = new Set(["aktiv", "natamam", "tesdiq_gozlenilir"]);

const cardToReal = (c: SharedKpiCard): RealKpiCard => ({
  id: `sk-${c.id}`,
  cardId: c.numericId,
  name: c.name,
  createdAt: dt(c.startDate || (c.createdAt || "").slice(0, 10)),
  deadline: dt(c.endDate),
  status: "in_progress",
  cardStatus: c.status,
  scoringSystem: c.scoringSystem,
  frequency: c.frequency,
  targets: (c.targets || []).map((t, i) => ({
    id: `${c.id}-${t.id ?? i}`,
    name: t.name || `Hədəf ${i + 1}`,
    plan: num(t.targetValue ?? t.scoreLimit),
    fakt: 0,
    unit: t.unit || "",
    weight: Number(t.weight) || 0,
    status: "in_progress" as const,
  })),
});

/** Cascade node-larını kart formatına çevir (kart adı üzrə qruplaşdırılmış). */
const cascadeToReal = (nodes: CascadeTreeNode[]): RealKpiCard[] => {
  const byCard = new Map<string, CascadeTreeNode[]>();
  nodes.forEach(n => {
    const k = n.cardName || "Kaskad hədəflər";
    byCard.set(k, [...(byCard.get(k) || []), n]);
  });
  return [...byCard.entries()].map(([cardName, list]) => ({
    id: `ct-${cardName}`,
    name: cardName,
    createdAt: new Date(Math.min(...list.map(n => n.createdAt))).toLocaleDateString("az-AZ"),
    deadline: "—",
    status: "in_progress" as const,
    targets: list.map(n => ({
      id: `ctn-${n.id}`,
      name: n.goalName || "Ana hədəf",
      plan: Number(n.limit) || 0,
      fakt: 0,
      unit: n.unit || "",
      weight: 0,
      status: "in_progress" as const,
    })),
  }));
};

/** Bir əməkdaşa təyin olunmuş bütün REAL KPI kartları (kaskad daxil). */
export const getRealKpiCardsForEmployee = (employeeId: number): RealKpiCard[] => {
  const key = empKey(employeeId);
  const cards = getSharedKpiCards()
    .filter(c => VISIBLE.has(c.status) && (c.assigneeIds || []).includes(key))
    .map(cardToReal);

  const nodes = getNodes().filter(n => n.assigneeId === employeeId);
  // Kaskad node-u eyni kart/hədəf adı ilə kartda varsa təkrarlanmasın.
  const seen = new Set(
    cards.flatMap(c => c.targets.map(t => `${c.name}::${t.name}`.toLowerCase())),
  );
  const cascade = cascadeToReal(
    nodes.filter(n => !seen.has(`${n.cardName}::${n.goalName || "Ana hədəf"}`.toLowerCase())),
  );
  return [...cards, ...cascade];
};

/** Əməkdaşın üzv olduğu komandalara TOPLU verilmiş kartlar. */
export const getRealTeamKpiCards = (employeeId: number): RealKpiCard[] => {
  const emp = getEmployees().find(e => e.id === employeeId);
  if (!emp) return [];
  const fullName = `${emp.firstName} ${emp.lastName}`.trim();
  const myTeams = getTeams().filter(
    t => t.leader === fullName || (t.members || []).some(m => m.name === fullName),
  );
  if (myTeams.length === 0) return [];
  const teamIds = new Set(myTeams.map(t => String(t.id)));
  return getSharedKpiCards()
    .filter(c => VISIBLE.has(c.status) && (c.teamIds || []).some(id => teamIds.has(String(id))))
    .map(cardToReal);
};

export const findEmployeeByUser = (user?: { email?: string | null; name?: string | null } | null) => {
  if (!user) return undefined;
  const emps = getEmployees().filter(e => e.active);
  return (
    emps.find(e => (e.email || "").toLowerCase() === String(user.email || "").toLowerCase()) ||
    emps.find(e => `${e.firstName} ${e.lastName}`.trim() === String(user.name || "").trim())
  );
};
