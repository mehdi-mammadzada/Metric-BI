// Approval & Deletion Matrix store.
// Multiple matrices supported. Backed by localStorage. Matrices cannot be deleted, only edited.

import { getEmployees } from "@/lib/orgStore";

export interface ApprovalStep {
  id: string;
  label: string;
  assignees: { type: "user" | "role"; name: string }[];
  minApprovals?: number; // minimal təsdiq sayı (default 1)
}

export interface ApprovalMatrix {
  id: string;
  name: string;
  mode?: "position" | "user"; // vəzifəyə görə | şəxsə görə
  steps: ApprovalStep[];
  updatedAt: string;
}

export interface DeletionMatrix {
  id: string;
  name: string;
  mode?: "position" | "user";
  approver: { type: "user" | "role"; name: string } | null;
  minApprovals?: number;
  updatedAt: string;
}

const APPROVAL_KEY = "kpi_approval_matrices_v3";
const DELETION_KEY = "kpi_deletion_matrices_v3";

// ---- Role → users mapping (demo). Used to display "Rol (Şəxs)" combined labels.
export const roleUserMap: Record<string, string[]> = {};

// User → primary role mapping (demo). Used to display "Şəxs (Rol)" labels.
export const userRoleMap: Record<string, string> = {};

// Returns "Şəxs (Rol)" for users or "Rol (Şəxs1, Şəxs2)" for roles.
export const formatAssignee = (a: { type: "user" | "role"; name: string }): string => {
  const clean = String(a.name || "").split(" — ")[0].trim();
  if (a.type === "user") {
    const emp = getEmployees().find(e => `${e.firstName} ${e.lastName}` === clean);
    const role = emp?.positionName || userRoleMap[clean];
    return role ? `${clean} (${role})` : clean;
  }
  const users = getEmployees()
    .filter(e => String(e.positionName || "").trim().toLowerCase() === clean.toLowerCase())
    .map(e => `${e.firstName} ${e.lastName}`);
  return users.length > 0 ? `${clean} (${users.join(", ")})` : clean;
};

// Helper for KPI create flow person dropdowns: "Şəxs adı (Rol)".
export const formatUserWithRole = (name: string): string => {
  const clean = String(name || "").split(" — ")[0].trim();
  const emp = getEmployees().find(e => `${e.firstName} ${e.lastName}` === clean);
  const role = emp?.positionName || userRoleMap[clean];
  return role ? `${clean} (${role})` : clean;
};

// ---- Approval matrices (list)
export const getApprovalMatrices = (): ApprovalMatrix[] => {
  try {
    const raw = localStorage.getItem(APPROVAL_KEY);
    if (raw) return JSON.parse(raw);
    // seed demo matrix so module is never empty
    const seed: ApprovalMatrix[] = [];
    localStorage.setItem(APPROVAL_KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
};

export const deleteApprovalMatrix = (id: string) => {
  const list = getApprovalMatrices().filter(x => x.id !== id);
  localStorage.setItem(APPROVAL_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("matrix:updated"));
};

export const deleteDeletionMatrix = (id: string) => {
  const list = getDeletionMatrices().filter(x => x.id !== id);
  localStorage.setItem(DELETION_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("matrix:updated"));
};

export const saveApprovalMatrix = (m: Omit<ApprovalMatrix, "id" | "updatedAt"> & { id?: string }) => {
  const list = getApprovalMatrices();
  if (m.id) {
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], name: m.name, mode: m.mode, steps: m.steps, updatedAt: new Date().toISOString() };
    }
  } else {
    list.push({ id: crypto.randomUUID(), name: m.name, mode: m.mode, steps: m.steps, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(APPROVAL_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("matrix:updated"));
};

// Backwards-compat: returns first approval matrix (used by KPI delete flow read-only views).
export const getApprovalMatrix = (): ApprovalMatrix | null => {
  const list = getApprovalMatrices();
  return list[0] || null;
};

// ---- Deletion matrices (list)
export const getDeletionMatrices = (): DeletionMatrix[] => {
  try {
    const raw = localStorage.getItem(DELETION_KEY);
    if (raw) return JSON.parse(raw);
    const seed: DeletionMatrix[] = [];
    localStorage.setItem(DELETION_KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
};

export const saveDeletionMatrix = (m: Omit<DeletionMatrix, "id" | "updatedAt"> & { id?: string }) => {
  const list = getDeletionMatrices();
  if (m.id) {
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], name: m.name, mode: m.mode, approver: m.approver, minApprovals: m.minApprovals, updatedAt: new Date().toISOString() };
    }
  } else {
    list.push({ id: crypto.randomUUID(), name: m.name, mode: m.mode, approver: m.approver, minApprovals: m.minApprovals, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(DELETION_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("matrix:updated"));
};

export const getDeletionMatrix = (): DeletionMatrix | null => {
  const list = getDeletionMatrices();
  return list[0] || null;
};

// ---- Pending deletion requests for approved KPIs.
export interface DeletionRequest {
  id: string;
  kpiId: number;
  kpiName: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

const REQUESTS_KEY = "kpi_deletion_requests_v1";
const DELETION_REQUEST_EVT = "kpi-deletion-requests-updated";

export const getDeletionRequests = (): DeletionRequest[] => {
  try {
    const raw = localStorage.getItem(REQUESTS_KEY);
    if (raw) return JSON.parse(raw);
    const seed: DeletionRequest[] = [];
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(seed));
    return seed;
  } catch { return []; }
};

export const addDeletionRequest = (req: Omit<DeletionRequest, "id" | "requestedAt" | "status">) => {
  const list = getDeletionRequests();
  // dedupe — if a pending request already exists for this KPI, return existing
  const existing = list.find(r => r.kpiId === req.kpiId && r.status === "pending");
  if (existing) return existing;
  const value: DeletionRequest = { ...req, id: crypto.randomUUID(), requestedAt: new Date().toISOString(), status: "pending" };
  list.unshift(value);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(DELETION_REQUEST_EVT));
  return value;
};

export const updateDeletionRequest = (id: string, status: "approved" | "rejected") => {
  const list = getDeletionRequests().map(r => r.id === id ? { ...r, status } : r);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  if (status === "approved") {
    const req = list.find(r => r.id === id);
    if (req) {
      const deletedKey = "kpi_deleted_ids_v1";
      try {
        const raw = localStorage.getItem(deletedKey);
        const ids: number[] = raw ? JSON.parse(raw) : [];
        if (!ids.includes(req.kpiId)) {
          ids.push(req.kpiId);
          localStorage.setItem(deletedKey, JSON.stringify(ids));
        }
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("kpi:deleted", { detail: { kpiId: req.kpiId } }));
    }
  }
  window.dispatchEvent(new Event(DELETION_REQUEST_EVT));
};

export const getDeletedKpiIds = (): number[] => {
  try {
    const raw = localStorage.getItem("kpi_deleted_ids_v1");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
