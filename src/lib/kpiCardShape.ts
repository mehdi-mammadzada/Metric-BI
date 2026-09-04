// Vahid çevirici: SharedKpiCard → KpiDetailView-in gözlədiyi KpiCard forması.
// Həm "KPI-lar → Əməkdaşlar üzrə" (KpiCardsPage), həm də "KPI İzlənməsi"
// drawer-i eyni mənbədən eyni detallı məlumatı göstərsin.

import { Target } from "lucide-react";
import { getEmployees } from "@/lib/orgStore";
import { getSharedKpiCards, inferSharedCardAssignmentMode, type SharedKpiCard } from "@/lib/kpiCardStore";
import type { EvaluatorConfig, KpiCard, SubKpi } from "@/lib/kpiCardTypes";

const hashStr = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
};

export const sharedCardNumericId = (s: SharedKpiCard): number =>
  s.numericId ?? Math.abs(hashStr(s.id));

export const sharedAssignKind = (s: SharedKpiCard): "Fərdi" | "Toplu" =>
  inferSharedCardAssignmentMode(s) === "bulk" ? "Toplu" : "Fərdi";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "?";

const cleanPersonName = (raw: unknown) => String(raw || "").split(" — ")[0].trim();

const employeeIndex = () => {
  const byId = new Map<string, ReturnType<typeof getEmployees>[number]>();
  getEmployees().forEach(e => {
    byId.set(String(e.id), e);
    byId.set(`e${e.id}`, e);
  });
  return byId;
};

const teamFromSharedCard = (s: SharedKpiCard): KpiCard["team"] => {
  const byId = employeeIndex();
  const members = new Map<string, { name: string; role: string; avatar: string }>();
  const add = (raw: unknown, role: string) => {
    const name = cleanPersonName(raw);
    if (!name || members.has(name)) return;
    members.set(name, { name, role, avatar: initials(name) });
  };
  const owner = byId.get(String(s.ownerId));
  if (owner) add(`${owner.firstName} ${owner.lastName}`, "KPI sahibi");
  (s.assigneeIds || []).forEach(id => {
    const emp = byId.get(String(id));
    add(emp ? `${emp.firstName} ${emp.lastName}` : String(id), "Tətbiq olunan əməkdaş");
  });
  (s.targets || []).forEach(t => {
    add(t.assigner, "Təyin edici");
    (t.evaluator?.persons || []).forEach(p => add(p.name, "Qiymətləndirici"));
  });
  return Array.from(members.values());
};

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** SharedKpiCard → KPI kartı detal forması (bütün tablar üçün dolu məlumat). */
export const sharedToKpiCardShape = (s: SharedKpiCard): KpiCard => {
  const byId = employeeIndex();
  const owner = byId.get(String(s.ownerId));
  const responsible = owner ? `${owner.firstName} ${owner.lastName}` : cleanPersonName(s.ownerId) || "—";
  const notes = (s.history || [])
    .filter(h => h.note && h.note.trim())
    .map(h => `• ${h.actor}: ${h.note}`)
    .join("\n");
  const kind = sharedAssignKind(s);
  const subKpis: SubKpi[] = (s.targets || []).map((t, i) => ({
    id: i + 1,
    name: t.name,
    target: String(t.targetValue ?? "—"),
    unit: t.unit || "",
    weight: t.weight || 0,
    current: "",
    progress: 0,
    type: t.type,
    assignerMode: t.createdBy === "other" ? "other" : "self",
    assigner: t.assigner,
    evaluator: t.evaluator as EvaluatorConfig | undefined,
    limits: t.limits,
    scoreDescriptions: t.scoreDescriptions || [],
  } as SubKpi));
  const totalPlan = (s.targets || []).reduce((acc, t) => acc + num(t.targetValue ?? t.scoreLimit), 0);
  const structureName = (s.structureIds || [])[0] || "—";

  return {
    id: sharedCardNumericId(s),
    name: s.name,
    icon: Target,
    zone: s.status === "aktiv" ? "green" : s.status === "imtina" ? "red" : "yellow",
    target: totalPlan ? String(totalPlan) : "—",
    current: "0",
    unit: (s.targets || [])[0]?.unit || "",
    progress: 0,
    minTarget: 60,
    responsible,
    createdByName: responsible,
    period: `${(s.startDate || "").slice(0, 4)} - ${s.frequency || ""}`,
    type: "Absolut Hədəf",
    formula: "—",
    generalTarget: totalPlan ? `${totalPlan} ${(s.targets || [])[0]?.unit || ""}`.trim() : "",
    department: structureName,
    group: (s.teamIds || [])[0] || "—",
    subdivision: (s.positionIds || [])[0] || "—",
    startDate: s.startDate || "",
    endDate: s.endDate || "",
    frequency: s.frequency || "Aylıq",
    team: teamFromSharedCard(s),
    history: [],
    description: `${notes ? notes + "\n" : ""}Bal sistemi: ${s.scoringSystem || "1-5"} · ${kind}`,
    weight: (s.targets || []).reduce((acc, t) => acc + (Number(t.weight) || 0), 0) || 10,
    approvalStatus: s.status === "aktiv" ? "approved" : "pending",
    subKpis,
    isPersonal: kind === "Fərdi",
    matrixId: s.matrixId,
  };
};

/** Shared kartı id / numericId / ad üzrə tap. */
export const findSharedCard = (ref: { sharedId?: string; numericId?: number; name?: string }): SharedKpiCard | undefined => {
  const cards = getSharedKpiCards();
  const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return (
    (ref.sharedId ? cards.find(c => c.id === ref.sharedId) : undefined) ||
    (ref.numericId != null ? cards.find(c => sharedCardNumericId(c) === ref.numericId) : undefined) ||
    (ref.name ? cards.find(c => norm(c.name) === norm(ref.name)) : undefined)
  );
};
