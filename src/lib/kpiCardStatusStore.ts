// NOTE: The `kpi_card_status` table has been removed as part of the foundation
// migration. Status persistence will be reintroduced when the KPI card module
// is migrated to the new multi-tenant schema. Until then, statuses are held in
// localStorage so the existing UI continues to work.
const LS_KEY = "kpi_card_status_v1";

export type KpiCardStatus =
  | "qaralama"
  | "natamam"
  | "tesdiq_gozlenilir"
  | "imtina"
  | "aktiv"
  | "silindi"
  | "qiymetlendirme"
  | "tamamlanib"
  | "legv_olundu";

export interface AssigneeState {
  name: string;
  ok: boolean; // true = check (yaşıl), false = X (qırmızı)
}

export interface KpiCardStatusRow {
  card_id: number;
  status: KpiCardStatus;
  use_matrix: boolean;
  submitted_for_approval: boolean;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason?: string | null;
  assignees: AssigneeState[];
  updated_at: string;
}

export const STATUS_LABELS: Record<KpiCardStatus, string> = {
  qaralama: "Qaralama",
  natamam: "Natamam",
  tesdiq_gozlenilir: "Təsdiq gözlənilir",
  imtina: "İmtina",
  aktiv: "Aktiv",
  silindi: "Silindi",
  qiymetlendirme: "Qiymətləndirmə",
  tamamlanib: "Tamamlanıb",
  legv_olundu: "Ləğv olunmuş",
};

export const STATUS_STYLES: Record<KpiCardStatus, string> = {
  qaralama: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800/40 dark:text-slate-300",
  natamam: "bg-muted text-muted-foreground border-border",
  tesdiq_gozlenilir: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  imtina: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  aktiv: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  silindi: "bg-slate-800 text-slate-100 border-slate-900 dark:bg-slate-900 dark:text-slate-200",
  qiymetlendirme: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  tamamlanib: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  legv_olundu: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

const isDeletedStatus = (status: KpiCardStatus | undefined | null) =>
  status === "silindi" || status === "legv_olundu";

export async function fetchAllStatuses(): Promise<Record<number, KpiCardStatusRow>> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function upsertStatus(row: Partial<KpiCardStatusRow> & { card_id: number }): Promise<void> {
  const current = await fetchAllStatuses();
  const existing = current[row.card_id];
  const nextStatus = isDeletedStatus(existing?.status) && row.status && !isDeletedStatus(row.status)
    ? existing.status
    : row.status;
  current[row.card_id] = {
    ...(existing ?? {
      card_id: row.card_id,
      status: "natamam",
      use_matrix: false,
      submitted_for_approval: false,
      rejected_by: null,
      rejected_at: null,
      assignees: [],
      updated_at: new Date().toISOString(),
    }),
    ...row,
    ...(nextStatus ? { status: nextStatus } : {}),
    updated_at: new Date().toISOString(),
  } as KpiCardStatusRow;
  localStorage.setItem(LS_KEY, JSON.stringify(current));
  window.dispatchEvent(new Event("kpi-cards-updated"));
}

export async function submitToMatrix(cardId: number): Promise<void> {
  await upsertStatus({ card_id: cardId, status: "tesdiq_gozlenilir", submitted_for_approval: true });
}
