// Hesabatlar modulunun məlumat mənbəyi.
// Hər təşkilat üçün öz real datasından (KPI kartları + qiymətləndirmə nəticələri
// + təşkilati struktur + komandalar) hesabat sətirləri qurur.
// Nəticəsi olan (qiymətləndirilmiş) hədəflər hesabatlarda görünür.

import { useEffect, useState } from "react";
import { getEmployees, type OrgEmployee } from "@/lib/orgStore";
import { getVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { getAllSubKpis, calcCompletion, isEvaluated, type SubKpi } from "@/lib/kpiEvaluationStore";
import { getTeams } from "@/lib/teamsStore";

export interface ReportRow {
  cardId: string;
  cardName: string;
  targetName: string;
  employeeId: string;
  employeeName: string;
  position: string;
  structure: string;
  teams: string[];
  progress: number;   // 0–100+ (%)
  target: number;
  actual: number;
  unit: string;
  weight: number;
  score?: number;
  period: string;
}

const empName = (e: OrgEmployee) => `${e.firstName} ${e.lastName}`.trim();

const matchesCard = (k: SubKpi, card: SharedKpiCard) =>
  k.cardId === card.id || k.cardId === card.name || k.cardId === String(card.numericId ?? "");

/** Bütün təşkilat üzrə nəticəsi olan hədəf sətirlərini qaytarır. */
export const buildReportRows = (): ReportRow[] => {
  const employees = getEmployees();
  const byId = new Map<string, OrgEmployee>();
  employees.forEach(e => {
    byId.set(String(e.id), e);
    byId.set(`e${e.id}`, e);
  });

  const teams = getTeams();
  const teamsOf = (name: string) =>
    teams
      .filter(t => t.leader === name || t.members.some(m => m.name === name))
      .map(t => t.name);

  const evals = getAllSubKpis().filter(isEvaluated);
  if (evals.length === 0) return [];

  const cards = getVisibleSharedKpiCards();
  const rows: ReportRow[] = [];

  cards.forEach(card => {
    (card.assigneeIds || []).forEach(rawId => {
      const emp = byId.get(String(rawId));
      if (!emp) return;
      const name = empName(emp);
      const memberTeams = teamsOf(name);

      evals
        .filter(k => k.assigneeId === String(rawId) && matchesCard(k, card))
        .forEach(k => {
          rows.push({
            cardId: card.id,
            cardName: card.name,
            targetName: k.name,
            employeeId: String(emp.id),
            employeeName: name,
            position: emp.positionName || "—",
            structure: emp.structurePath || "—",
            teams: memberTeams,
            progress: Math.round(calcCompletion(k)),
            target: k.target,
            actual: k.actual ?? 0,
            unit: k.unit || "",
            weight: k.weight || 0,
            score: k.evaluatedScore,
            period: k.period || `${card.startDate || ""} – ${card.endDate || ""}`.trim(),
          });
        });
    });
  });

  return rows;
};

/** Reaktiv variant — kart/qiymətləndirmə/komanda dəyişəndə yenilənir. */
export const useReportRows = (): ReportRow[] => {
  const [rows, setRows] = useState<ReportRow[]>(() => buildReportRows());
  useEffect(() => {
    const refresh = () => setRows(buildReportRows());
    const events = [
      "shared-kpi-cards-updated",
      "user-kpi-subkpis-updated",
      "teams-updated",
      "teams-hydrated",
      "org-employees-updated",
      "storage",
    ];
    events.forEach(e => window.addEventListener(e, refresh));
    return () => events.forEach(e => window.removeEventListener(e, refresh));
  }, []);
  return rows;
};

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"];

/** Nəticələrdən deterministik aylıq trend seriyası qurur (nümunə hesabat üçün). */
export const buildTrendSeries = (rows: ReportRow[], months = 6) => {
  const avg = rows.length ? rows.reduce((s, r) => s + r.progress, 0) / rows.length : 0;
  const start = Math.max(20, Math.round(avg * 0.65));
  const end = Math.round(avg);
  return MONTHS.slice(0, months).map((name, i) => {
    const ratio = months === 1 ? 1 : i / (months - 1);
    const actual = Math.round(start + (end - start) * ratio);
    return { name, actual, target: Math.min(100, Math.round(70 + 30 * ratio)) };
  });
};
