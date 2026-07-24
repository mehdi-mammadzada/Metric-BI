// Approval queue for KPI cards that were submitted with a Təsdiqləmə Matrisi.
// Both HR (/sistem-tesdiq) and Manager (/manager/sistem-tesdiq) read from here.

import { useEffect, useState } from "react";
import { getSharedKpiCards, setKpiStatus, type SharedKpiStatus } from "./kpiCardStore";
import { pushNotification } from "./notificationsStore";

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface ApprovalItem {
  id: string;
  kpiCardId: string;            // SharedKpiCard.id
  kpiName: string;
  matrixId: string;
  approverIds: string[];        // current step approvers (active)
  decisions: Record<string, { decision: ApprovalDecision; note?: string; at?: string }>;
  status: ApprovalDecision;     // aggregate: approved when all approvers approve; rejected on first rejection
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Sequential-flow chain: list of approver id arrays, one per matrix step.
  stepsChain?: string[][];
  currentStep?: number;
}

const KEY = "kpi_approval_queue_v2";
const EVT = "kpi-approval-queue-updated";

const load = (): ApprovalItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const save = (list: ApprovalItem[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
};

const decisionTime = (item: Pick<ApprovalItem, "decisions" | "updatedAt" | "createdAt">) => {
  const decisionTimes = Object.values(item.decisions || {})
    .map(d => Date.parse(d?.at || "") || 0);
  return Math.max(
    Date.parse(item.updatedAt || "") || 0,
    Date.parse(item.createdAt || "") || 0,
    ...decisionTimes,
  );
};

const terminalRank = (status: ApprovalDecision) => status === "pending" ? 0 : 1;

const betterApprovalItem = (a: ApprovalItem, b: ApprovalItem) => {
  const ar = terminalRank(a.status);
  const br = terminalRank(b.status);
  if (ar !== br) return br > ar ? b : a;
  const at = decisionTime(a);
  const bt = decisionTime(b);
  if (at !== bt) return bt > at ? b : a;
  return Date.parse(b.updatedAt || b.createdAt || "") >= Date.parse(a.updatedAt || a.createdAt || "") ? b : a;
};

const upsertLocalApproval = (incoming: ApprovalItem) => {
  const list = load();
  const idx = list.findIndex(a => a.id === incoming.id);
  if (idx >= 0) list[idx] = betterApprovalItem(list[idx], incoming);
  else list.unshift(incoming);
  save(list.sort((a, b) => (decisionTime(b) || Date.parse(b.createdAt || "") || 0) - (decisionTime(a) || Date.parse(a.createdAt || "") || 0)));
};

const flushSoon = () => {
  void import("./approvalsService").then(m => m.flushApprovalsToCloud()).catch(() => undefined);
};

const flushCardsSoon = () => {
  void import("./kpiCardsService").then(m => m.flushLocalKpiCardsToCloud()).catch(() => undefined);
};

const cardAliases = (cardId: string) => {
  const cards = getSharedKpiCards();
  const card = cards.find(c => c.id === cardId || (c.numericId != null && (`kpi-${c.numericId}` === cardId || String(c.numericId) === cardId)));
  if (!card) return { canonicalId: cardId, numericId: null as number | null };
  return { canonicalId: card.id, numericId: card.numericId ?? null };
};

const syncCardStatus = (item: ApprovalItem, status: SharedKpiStatus, actor: string, note?: string) => {
  const { canonicalId, numericId } = cardAliases(item.kpiCardId);
  setKpiStatus(canonicalId, status, actor, note);
  if (numericId != null) {
    void import("./kpiCardStatusStore").then(m => m.upsertStatus({
      card_id: numericId,
      status,
      use_matrix: true,
      submitted_for_approval: true,
      rejected_by: status === "imtina" ? actor : null,
      rejected_at: status === "imtina" ? new Date().toISOString() : null,
      rejection_reason: status === "imtina" ? note || "Rəhbər imtina etdi" : null,
    })).catch(() => undefined);
  }
};

export const getApprovals = (): ApprovalItem[] => load();

export const enqueueApproval = (input: {
  kpiCardId: string;
  kpiName: string;
  matrixId: string;
  approverIds: string[];
  createdBy: string;
  stepsChain?: string[][];
}): ApprovalItem => {
  const list = load();
  // dedupe: one approval lifecycle per KPI card. Terminal approvals are kept forever
  // and must not be replaced by a fresh pending request after refresh/hydration.
  const existing = list
    .filter(a => a.kpiCardId === input.kpiCardId)
    .sort((a, b) => decisionTime(b) - decisionTime(a))[0];
  if (existing) return existing;
  const chain = input.stepsChain && input.stepsChain.length > 0 ? input.stepsChain : [input.approverIds];
  const firstStep = chain[0];
  const item: ApprovalItem = {
    id: crypto.randomUUID(),
    kpiCardId: input.kpiCardId,
    kpiName: input.kpiName,
    matrixId: input.matrixId,
    approverIds: firstStep,
    decisions: Object.fromEntries(firstStep.map(a => [a, { decision: "pending" as const }])),
    status: "pending",
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stepsChain: chain,
    currentStep: 0,
  };
  list.unshift(item);
  save(list);
  flushSoon();
  firstStep.forEach(approverId => {
    pushNotification({
      toEmployeeId: approverId,
      type: "approval_request",
      title: `Təsdiq tələbi: ${input.kpiName}`,
      body: "Sistem Təsdiqləri modulunda kart sizi gözləyir.",
      link: "/manager/sistem-tesdiq",
    });
  });
  return item;
};

export const decideApproval = (
  approvalId: string,
  approverId: string,
  decision: Exclude<ApprovalDecision, "pending">,
  note?: string,
) => {
  const list = load();
  const idx = list.findIndex(a => a.id === approvalId);
  if (idx < 0) return;
  const item = { ...list[idx] };
  if (item.status !== "pending") return;
  if (!item.approverIds.includes(approverId)) return;
  if (item.decisions[approverId]?.decision && item.decisions[approverId].decision !== "pending") return;
  item.decisions = {
    ...item.decisions,
    [approverId]: { decision, note, at: new Date().toISOString() },
  };

  const allApproved = item.approverIds.every(id => item.decisions[id]?.decision === "approved");
  const anyRejected = item.approverIds.some(id => item.decisions[id]?.decision === "rejected");

  if (anyRejected) {
    item.status = "rejected";
  } else if (allApproved) {
    const chain = item.stepsChain || [item.approverIds];
    const cur = item.currentStep ?? 0;
    if (cur + 1 < chain.length) {
      // Advance to next step
      const nextStep = chain[cur + 1];
      item.currentStep = cur + 1;
      item.approverIds = nextStep;
      nextStep.forEach(id => {
        if (!item.decisions[id]) item.decisions[id] = { decision: "pending" };
      });
      item.status = "pending";
      nextStep.forEach(nextApprover => {
        pushNotification({
          toEmployeeId: nextApprover,
          type: "approval_request",
          title: `Təsdiq tələbi: ${item.kpiName}`,
          body: "Sistem Təsdiqləri modulunda kart sizi gözləyir.",
          link: "/manager/sistem-tesdiq",
        });
      });
    } else {
      item.status = "approved";
    }
  } else {
    item.status = "pending";
  }

  item.updatedAt = new Date().toISOString();
  list[idx] = item;
  save(list);
  flushSoon();
  try { upsertLocalApproval(item); } catch {}

  // Mirror the decision onto the shared KPI card itself.
  if (item.status === "approved") {
    syncCardStatus(item, "aktiv", approverId, "Matris vasitəsilə təsdiq edildi");
    flushCardsSoon();
    pushNotification({
      toEmployeeId: item.createdBy,
      type: "approval_result",
      title: `KPI təsdiq olundu: ${item.kpiName}`,
      body: "Kart aktiv statusa keçdi.",
      link: "/kpi-kartlari",
    });
  } else if (item.status === "rejected") {
    syncCardStatus(item, "imtina", approverId, note || "Rəhbər imtina etdi");
    flushCardsSoon();
    pushNotification({
      toEmployeeId: item.createdBy,
      type: "approval_result",
      title: `KPI imtina olundu: ${item.kpiName}`,
      body: note || "Səbəb göstərilməyib.",
      link: "/kpi-kartlari",
    });
  }
};

export const useApprovals = (): ApprovalItem[] => {
  const [rows, setRows] = useState<ApprovalItem[]>(() => load());
  useEffect(() => {
    const h = () => setRows(load());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return rows;
};
