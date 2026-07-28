// Avtomatik Approval Workflow tetikleyicisi.
// KPI kartındakı bütün Set entry-lər tamamlandıqda (təyinedici hədəfləri təyin edib bitirdikdə)
// və kartda Təsdiqləmə Matrisi seçilibsə — sistem avtomatik olaraq
// approval task yaradır (matrisdəki şəxslərin "Sistem Təsdiqləri" modulunda görünsün deyə)
// və kart statusunu "tesdiq_gozlenilir" olaraq təyin edir.

import { getKpiSetEntries } from "./kpiSetStore";
import { getSharedKpiCards, setKpiStatus, type SharedKpiCard, type SharedKpiStatus } from "./kpiCardStore";
import { getApprovalMatrices } from "./matrixStore";
import { enqueueApproval, getApprovals } from "./approvalsStore";
import { getKpiCardMeta } from "./kpiCardMetaStore";
import { fetchAllStatuses, submitToMatrix, upsertStatus } from "./kpiCardStatusStore";
import { getEnrichedEmployee } from "@/data/mockExtras";
import { getEmployees } from "./orgStore";

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Matrisdəki approver adını enrichedEmployees id-sinə çevir.
 * 1) Tam ad üzrə eyni.
 * 2) Alınmasa, ad+soyad-ın hər biri üzrə partial (ilk ad uyğunluğu).
 */
const nameToEmployeeId = (name: string): string | null => {
  const cleanName = String(name || "").split(" — ")[0].trim();
  const target = normalize(cleanName);
  if (!target) return null;
  const orgExact = getEmployees().find(e => normalize(`${e.firstName} ${e.lastName}`) === target);
  if (orgExact) return String(orgExact.id);
  return null;
};

const roleToEmployeeIds = (roleName: string): string[] => {
  const ids = new Set<string>();
  const roleNorm = normalize(roleName);
  getEmployees().forEach(e => {
    const pos = normalize(e.positionName || "");
    if (pos === roleNorm) ids.add(String(e.id));
  });
  return Array.from(ids);
};

interface CardContext {
  id: string;              // approval-a yazılacaq stable id
  name: string;
  matrixId: string;
  ownerId: string;
  currentStatus?: string;
}

const idsForCard = (card: Pick<SharedKpiCard, "id" | "numericId">): string[] => {
  const ids = new Set<string>([card.id]);
  if (card.numericId != null) {
    ids.add(String(card.numericId));
    ids.add(`kpi-${card.numericId}`);
  }
  return Array.from(ids);
};

const sameCard = (approvalCardId: string, card: Pick<SharedKpiCard, "id" | "numericId">) =>
  idsForCard(card).includes(approvalCardId);

const approvalRank = (status?: string) => status && status !== "pending" ? 1 : 0;

const approvalDecisionTime = (approval: ReturnType<typeof getApprovals>[number]) => {
  const decisionTimes = Object.values(approval.decisions || {}).map(d => Date.parse(d?.at || "") || 0);
  return Math.max(
    Date.parse(approval.updatedAt || "") || 0,
    Date.parse(approval.createdAt || "") || 0,
    ...decisionTimes,
  );
};

const approvalForCard = (card: Pick<SharedKpiCard, "id" | "numericId">) =>
  getApprovals()
    .filter(a => sameCard(a.kpiCardId, card))
    .sort((a, b) => {
      const rankDiff = approvalRank(b.status) - approvalRank(a.status);
      if (rankDiff !== 0) return rankDiff;
      return approvalDecisionTime(b) - approvalDecisionTime(a);
    })[0] || null;

const isDeletionApproval = (approval: Pick<ReturnType<typeof getApprovals>[number], "matrixId"> | null | undefined) =>
  String(approval?.matrixId || "").startsWith("deletion:");

const setterStateForCard = (numericId: number) => {
  const bySetter = new Map<string, { name: string; ok: boolean }>();
  getKpiSetEntries()
    .filter(e => e.cardId === numericId)
    .forEach(e => {
      const key = e.assigneeId != null ? String(e.assigneeId) : e.assigneeName;
      const prev = bySetter.get(key);
      bySetter.set(key, {
        name: e.assigneeName || key,
        ok: (prev?.ok ?? true) && e.status === "completed",
      });
    });
  return Array.from(bySetter.values());
};

const setSharedStatusIfNeeded = (card: SharedKpiCard, status: SharedKpiStatus, actor: string, note?: string) => {
  if (card.status !== status || (status === "imtina" && note && card.rejectedReason !== note)) {
    setKpiStatus(card.id, status, actor, note);
  }
};

const resolveCardContext = (cardId: number): CardContext | null => {
  // 1) SharedKpiCard varsa oradan.
  const shared = getSharedKpiCards().find(c => c.numericId === cardId);
  if (shared) {
    return {
      id: shared.id,
      name: shared.name,
      matrixId: shared.matrixId || "",
      ownerId: shared.ownerId,
      currentStatus: shared.status,
    };
  }
  // 2) HR wizard-in yaratdığı yüngül meta.
  const meta = getKpiCardMeta(cardId);
  if (meta) {
    return {
      id: meta.stringId,
      name: meta.name,
      matrixId: meta.matrixId || "",
      ownerId: meta.ownerId,
    };
  }
  return null;
};

/**
 * Verilmiş kartın bütün Set entry-ləri "completed" olubsa və kartda matris varsa,
 * approval workflow-nu başlat. Matris yoxdursa — birbaşa "aktiv"-ə keçir.
 * Təkrar çağırışlar təhlükəsizdir — dedupe var.
 */
export const triggerCardApprovalIfComplete = (cardId: number): void => {
  try {
    const entries = getKpiSetEntries().filter(e => e.cardId === cardId);
    // If there are Set entries, all must be completed. Otherwise (owner-only card
    // with no target-setters), proceed directly.
    if (entries.length > 0 && entries.some(e => e.status !== "completed")) return;

    const ctx = resolveCardContext(cardId);
    if (!ctx) return;

    if (ctx.currentStatus === "aktiv") return;

    // NO MATRIX — bütün təyinedicilər hədəfləri təyin edib bitirdikdə kart avtomatik "aktiv".
    if (!ctx.matrixId) {
      try { setKpiStatus(ctx.id, "aktiv", "system", "Bütün təyinedicilər hədəfləri təyin etdi"); } catch {}
      void import("./kpiCardsService").then(m => m.flushLocalKpiCardsToCloud()).catch(() => undefined);
      return;
    }

    // Eyni kart üçün approval varsa təkrar yaratma. Approved/rejected tarixçə
    // bütün cihazlarda terminal qalmalıdır; refresh-dən sonra yeni pending açılmamalıdır.
    const existing = approvalForCard({ id: ctx.id, numericId: cardId });
    if (existing) {
      if (existing.status === "approved") {
        try { setKpiStatus(ctx.id, "aktiv", "system", "Matris vasitəsilə təsdiq edildi"); } catch {}
      } else if (existing.status === "rejected") {
        const rejected = Object.entries(existing.decisions || {}).find(([, d]) => d?.decision === "rejected");
        try { setKpiStatus(ctx.id, "imtina", rejected?.[0] || "system", rejected?.[1]?.note || "İmtina edildi"); } catch {}
      } else {
        try { setKpiStatus(ctx.id, "tesdiq_gozlenilir", "system", "Set tamamlandı — təsdiq axını davam edir"); } catch {}
      }
      try { submitToMatrix(cardId); } catch {}
      void import("./kpiCardsService").then(m => m.flushLocalKpiCardsToCloud()).catch(() => undefined);
      return;
    }

    const matrix = getApprovalMatrices().find(m => m.id === ctx.matrixId);
    if (!matrix) return;

    // Build per-step approver chain (sequential flow). Each matrix step becomes
    // one link in the chain — only the current step's approvers get the task.
    const stepsChain: string[][] = matrix.steps.map(step => {
      const ids = new Set<string>();
      step.assignees.forEach(a => {
          const resolved = a.type === "user"
            ? [nameToEmployeeId(a.name)].filter((id): id is string => !!id)
            : roleToEmployeeIds(a.name);
          resolved.forEach(id => ids.add(id));
      });
      return Array.from(ids);
    }).filter(step => step.length > 0);

    // Fallback: ən azı kart sahibi (HR) təsdiqçi olsun ki, approval boş qalmasın.
    if (stepsChain.length === 0 && ctx.ownerId && getEnrichedEmployee(ctx.ownerId)) stepsChain.push([ctx.ownerId]);
    if (stepsChain.length === 0) return;

    enqueueApproval({
      kpiCardId: ctx.id,
      kpiName: ctx.name,
      matrixId: ctx.matrixId,
      approverIds: stepsChain[0],
      createdBy: ctx.ownerId,
      stepsChain,
    });

    // Həm SharedKpiCard, həm də lokal KpiCard status store-u yenilə.
    try { setKpiStatus(ctx.id, "tesdiq_gozlenilir", "system", "Set tamamlandı — avtomatik təsdiq axını başladıldı"); } catch {}
    try { submitToMatrix(cardId); } catch {}
    void import("./approvalsService").then(m => m.flushApprovalsToCloud()).catch(() => undefined);
    void import("./kpiCardsService").then(m => m.flushLocalKpiCardsToCloud()).catch(() => undefined);
  } catch (err) {
    console.warn("triggerCardApprovalIfComplete failed", err);
  }
};

/**
 * Reconciles the exact KPI status flow from persisted sources on every browser:
 * - pending target setters => natamam
 * - no matrix + all target setters done => aktiv
 * - matrix + all target setters done => tesdiq_gozlenilir, then approval result
 */
export const reconcileKpiStatusFlow = async (): Promise<void> => {
  const cards = getSharedKpiCards();
  const statusRows = await fetchAllStatuses();

  for (const card of cards) {
    if (card.numericId == null) continue;
    if (card.status === "qaralama" || card.status === "silindi" || card.status === "legv_olundu") continue;
    // "Silindi" terminaldır: backend status sətri silinmiş göstərirsə, heç vaxt başqa statusa keçmir.
    const backendStatus = statusRows[card.numericId]?.status;
    if (backendStatus === "silindi" || backendStatus === "legv_olundu") {
      setSharedStatusIfNeeded(card, "silindi", "system");
      continue;
    }

    const setters = setterStateForCard(card.numericId);
    const hasSetterFlow = setters.length > 0;
    const allSettersDone = !hasSetterFlow || setters.every(s => s.ok);
    const approval = approvalForCard(card);

    let nextStatus: SharedKpiStatus;
    let note: string | undefined;
    let rejectedBy: string | null = null;
    let rejectedAt: string | null = null;

    let actor = "system";

    if (approval?.status === "approved") {
      const deletion = isDeletionApproval(approval);
      nextStatus = deletion ? "silindi" : "aktiv";
      if (deletion) {
        const approved = Object.entries(approval.decisions || {}).find(([, d]) => d?.decision === "approved");
        actor = approved?.[0] || "system";
        note = (approved?.[1]?.note || "").trim() || "Silinmə sorğusu təsdiqləndi";
      }
    } else if (card.status === "aktiv" && (!card.matrixId || approval?.status !== "rejected")) {
      nextStatus = "aktiv";
    } else if (approval?.status === "rejected") {
      nextStatus = "imtina";
      const rejected = Object.entries(approval.decisions || {}).find(([, d]) => d?.decision === "rejected");
      rejectedBy = rejected?.[0] ?? null;
      rejectedAt = rejected?.[1]?.at ?? null;
      note = rejected?.[1]?.note || "İmtina edildi";
    } else if (card.status === "imtina") {
      nextStatus = "imtina";
      note = card.rejectedReason || "İmtina edildi";
    } else if (!allSettersDone) {
      nextStatus = "natamam";
    } else if (!card.matrixId) {
      nextStatus = "aktiv";
    } else {
      nextStatus = "tesdiq_gozlenilir";
      if (!approval) triggerCardApprovalIfComplete(card.numericId);
    }

    setSharedStatusIfNeeded(card, nextStatus, actor, note);

    const current = statusRows[card.numericId];
    const nextAssignees = hasSetterFlow
      ? setters
      : (card.assigneeIds || []).map(id => {
          const emp = getEmployees().find(e => String(e.id) === String(id) || `e${e.id}` === String(id));
          return { name: emp ? `${emp.firstName} ${emp.lastName}` : id, ok: true };
        });
    const changed = !current
      || current.status !== nextStatus
      || !!current.use_matrix !== !!card.matrixId
      || JSON.stringify(current.assignees || []) !== JSON.stringify(nextAssignees)
      || (nextStatus === "imtina" && current.rejection_reason !== (note ?? null));
    if (changed) {
      await upsertStatus({
        card_id: card.numericId,
        status: nextStatus,
        use_matrix: !!card.matrixId,
        submitted_for_approval: !!card.matrixId && allSettersDone,
        rejected_by: rejectedBy,
        rejected_at: rejectedAt,
        rejection_reason: nextStatus === "imtina" ? note ?? "İmtina edildi" : null,
        assignees: nextAssignees,
      });
    }
  }

  void import("./kpiCardsService").then(m => m.flushLocalKpiCardsToCloud()).catch(() => undefined);
};
