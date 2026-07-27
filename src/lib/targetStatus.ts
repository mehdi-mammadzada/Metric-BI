// Sistem üzrə hədəflər üçün YALNIZ 3 status mövcuddur.
// 🟡 İcrada · 🟢 Hədəfə çatıb · 🔴 Hədəfə çatmayıb
// Başqa heç bir hədəf statusu (Gecikir, Riskdə, Gözləyir, Dayandırılıb və s.)
// istifadə edilməməlidir.

export type TargetStatus = "in_progress" | "achieved" | "not_achieved";

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  in_progress: "İcrada",
  achieved: "Hədəfə çatıb",
  not_achieved: "Hədəfə çatmayıb",
};

export const TARGET_STATUS_BADGE: Record<TargetStatus, string> = {
  in_progress: "bg-amber-100 text-amber-700 hover:bg-amber-100 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  achieved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30",
  not_achieved: "bg-rose-100 text-rose-700 hover:bg-rose-100 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30",
};

export const TARGET_STATUS_BAR: Record<TargetStatus, string> = {
  in_progress: "bg-amber-500",
  achieved: "bg-emerald-500",
  not_achieved: "bg-rose-500",
};

/** Köhnə / xarici status adlarını 3 kanonik statusa map edir. */
export const normalizeTargetStatus = (s?: string | null): TargetStatus => {
  const v = String(s ?? "").toLowerCase();
  if (["achieved", "completed", "done", "tamamlandi", "tamamlandı", "tamamlanib", "tamamlanıb"].includes(v)) return "achieved";
  if (["not_achieved", "failed", "missed", "overdue", "delayed", "gecikme", "gecikib", "gecikir", "legv_olundu"].includes(v)) return "not_achieved";
  return "in_progress";
};

const parseDeadline = (deadline?: string): Date | null => {
  if (!deadline || deadline === "—") return null;
  const m1 = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(deadline);
  if (m1) return new Date(+m1[3], +m1[2] - 1, +m1[1]);
  const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  return null;
};

export const isPastDeadline = (deadline?: string): boolean => {
  const d = parseDeadline(deadline);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

/** İcra faizi + son tarixə əsasən status hesablayır. */
export const inferTargetStatus = (pct: number, deadline?: string): TargetStatus => {
  if (pct >= 100) return "achieved";
  if (isPastDeadline(deadline)) return "not_achieved";
  return "in_progress";
};
