// Hədəf qiymətləndirmə növbəsi.
// Lifecycle-in "qiymətləndirmə" mərhələsində olan aktiv KPI kartlarının hədəfləri,
// həmin hədəfi qiymətləndirəcək şəxsin (qiymətləndirici) "Hədəf qiymətləndirmə"
// bölməsinə düşür. Qiymətləndirmə nəticələri kpiEvaluationStore-da saxlanılır.

import { useEffect, useMemo, useState } from "react";
import { useVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { getEmployees } from "@/lib/orgStore";
import { getLifecycle } from "@/lib/kpiLifecycleStore";
import { useAllSubKpis, upsertSubKpis, type SubKpi } from "@/lib/kpiEvaluationStore";
import type { AuthUser } from "@/contexts/AuthContext";

const stripPos = (v?: string) => String(v || "").split(" — ")[0].trim().toLowerCase();

const stableNum = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const parseNum = (v?: string): number => {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Cari istifadəçinin ad / email / id aliasları. */
export const evaluatorAliases = (user: Pick<AuthUser, "name" | "email"> | null | undefined): Set<string> => {
  const set = new Set<string>();
  const push = (v?: string | number | null) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s) set.add(s);
  };
  push(user?.name);
  push(user?.email);
  const emp = getEmployees().find(e => (e.email || "").toLowerCase() === String(user?.email || "").toLowerCase());
  if (emp) {
    push(`${emp.firstName} ${emp.lastName}`);
    push(String(emp.id));
    push(`e${emp.id}`);
  }
  return set;
};

const matches = (value: unknown, aliases: Set<string>) => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return false;
  return aliases.has(raw) || aliases.has(stripPos(raw));
};

/** Kartın qiymətləndirmə mərhələsi başlayıbmı? */
export const isEvaluationStageOpen = (card: SharedKpiCard): boolean => {
  const numericId = card.numericId ?? stableNum(card.id);
  const lc = getLifecycle(numericId);
  const start = lc?.evaluation?.start || card.endDate || "";
  if (!start) return true;
  const today = new Date().toISOString().slice(0, 10);
  return today >= start;
};

export interface EvaluatorGoalRow extends SubKpi {
  cardName: string;
  assigneeName: string;
}

const buildRows = (
  cards: SharedKpiCard[],
  aliases: Set<string>,
): EvaluatorGoalRow[] => {
  const employees = getEmployees();
  const byId = new Map<string, string>();
  employees.forEach(e => {
    const label = `${e.firstName} ${e.lastName}`.trim();
    byId.set(String(e.id), label);
    byId.set(`e${e.id}`, label);
  });

  const rows: EvaluatorGoalRow[] = [];
  cards.forEach(card => {
    if (card.status !== "aktiv") return;
    if (!isEvaluationStageOpen(card)) return;
    const period = `${card.startDate || ""} – ${card.endDate || ""}`.trim();
    const assignees = (card.assigneeIds || []).map(String);
    if (assignees.length === 0) return;

    (card.targets || []).forEach((t, index) => {
      const persons = t.evaluator?.persons || [];
      const isMine = persons.length
        ? persons.some(p => matches(p.name, aliases))
        : (card.evaluatorIds || []).some(id => matches(id, aliases) || matches(byId.get(String(id)), aliases));
      if (!isMine) return;

      assignees.forEach(assigneeId => {
        rows.push({
          id: `evalq:${card.id}:${assigneeId}:${t.id || index}`,
          assigneeId,
          cardId: card.id,
          cardName: card.name,
          assigneeName: byId.get(assigneeId) || assigneeId,
          name: t.name || `Hədəf ${index + 1}`,
          description: t.type ? `Hədəf növü: ${t.type}` : "",
          target: parseNum(t.targetValue),
          unit: t.unit || "",
          weight: Number(t.weight) || 0,
          period,
        });
      });
    });
  });
  return rows;
};

// Nümunə: hər hesab üçün 1 gözləyən hədəf qiymətləndirməsi.
const SAMPLE_PENDING: Record<string, EvaluatorGoalRow> = {
  "nezrin@outlook.com": {
    id: "evalq:sample-card-nezrin:sample-emp-1:t1",
    assigneeId: "sample-emp-1",
    cardId: "sample-card-nezrin",
    cardName: "Satış KPI kartı (nümunə)",
    assigneeName: "Orxan Həsənov",
    name: "Aylıq satış həcmi",
    description: "Hədəf növü: Kəmiyyət",
    target: 50000,
    actual: 46000,
    unit: "AZN",
    weight: 40,
    period: "2026-07-01 – 2026-09-30",
  },
  "refiqe@outlook.com": {
    id: "evalq:sample-card-refiqe:sample-emp-2:t1",
    assigneeId: "sample-emp-2",
    cardId: "sample-card-refiqe",
    cardName: "Müştəri xidməti KPI kartı (nümunə)",
    assigneeName: "Leyla Quliyeva",
    name: "Müştəri məmnuniyyəti",
    description: "Hədəf növü: Faiz",
    target: 90,
    actual: 87,
    unit: "%",
    weight: 50,
    period: "2026-07-01 – 2026-09-30",
  },
};

/**
 * Cari istifadəçinin qiymətləndirməli olduğu hədəflər (saxlanmış nəticələr ilə birləşdirilmiş).
 */
export const useEvaluatorGoals = (
  user: Pick<AuthUser, "name" | "email"> | null | undefined,
): EvaluatorGoalRow[] => {
  const cards = useVisibleSharedKpiCards();
  const stored = useAllSubKpis();
  const [aliases, setAliases] = useState<Set<string>>(() => evaluatorAliases(user));

  useEffect(() => {
    setAliases(evaluatorAliases(user));
  }, [user?.email, user?.name]);

  const derived = useMemo(() => {
    const base = buildRows(cards, aliases);
    const sample = SAMPLE_PENDING[String(user?.email || "").toLowerCase()];
    return sample ? [...base, sample] : base;
  }, [cards, aliases, user?.email]);

  // Növbədəki hədəflər qiymətləndirmə anbarında mövcud olmalıdır (dialoq oradan yazır).
  useEffect(() => {
    const known = new Set(stored.map(s => s.id));
    const missing = derived.filter(d => !known.has(d.id)).map(({ cardName, assigneeName, ...rest }) => rest as SubKpi);
    if (missing.length) upsertSubKpis(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived]);

  return useMemo(() => {
    const byId = new Map(stored.map(s => [s.id, s]));
    return derived.map(d => ({ ...d, ...(byId.get(d.id) || {}), cardName: d.cardName, assigneeName: d.assigneeName }));
  }, [derived, stored]);
};
