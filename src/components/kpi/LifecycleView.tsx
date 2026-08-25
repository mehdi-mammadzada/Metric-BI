import { useState } from "react";
import { Target, Star, Wallet, RefreshCw, CalendarDays, CheckCircle2, Clock, Circle, XCircle, PauseCircle, Plus } from "lucide-react";
import {
  formatStagePeriod,
  computeReviewStatus,
  appendReviewToCard,
  type CardLifecycle,
  type LifecycleStage,
  type LifecycleReview,
  type ReviewComputedStatus,
} from "@/lib/kpiLifecycleStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import NewReviewDialog from "./NewReviewDialog";

type StageStatus = "completed" | "in_progress" | "pending";

const getStageStatus = (stage?: { start?: string; end?: string }): StageStatus | null => {
  if (!stage || !stage.start || !stage.end) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(stage.start);
  const end = new Date(stage.end);
  if (today > end) return "completed";
  if (today < start) return "pending";
  return "in_progress";
};

const STATUS_STYLES: Record<StageStatus, {
  card: string; icon: string; title: string; meta: string; value: string;
  badge: string; badgeIcon: React.ComponentType<{ className?: string }>; badgeLabel: string;
}> = {
  completed: {
    card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    title: "text-emerald-900 dark:text-emerald-100",
    meta: "text-emerald-700/80 dark:text-emerald-300/70",
    value: "text-emerald-900 dark:text-emerald-100",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    badgeIcon: CheckCircle2, badgeLabel: "Tamamlandı",
  },
  in_progress: {
    card: "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-900",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    title: "text-amber-900 dark:text-amber-100",
    meta: "text-amber-700/80 dark:text-amber-300/70",
    value: "text-amber-900 dark:text-amber-100",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    badgeIcon: Clock, badgeLabel: "Davam edir",
  },
  pending: {
    card: "bg-slate-100/70 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800",
    icon: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    title: "text-slate-500 dark:text-slate-400",
    meta: "text-slate-400 dark:text-slate-500",
    value: "text-slate-500 dark:text-slate-400",
    badge: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    badgeIcon: Circle, badgeLabel: "Gözləyir",
  },
};

const NEUTRAL = {
  card: "bg-card border-border", icon: "bg-primary/10 text-primary",
  title: "text-foreground", meta: "text-muted-foreground", value: "text-foreground",
};

// Review üçün 5 status: held / deferred / missed / in_progress / pending
export const REVIEW_STATUS_STYLES: Record<ReviewComputedStatus, {
  card: string; meta: string; value: string; badge: string;
  badgeIcon: React.ComponentType<{ className?: string }>; badgeLabel: string;
}> = {
  held: {
    card: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900",
    meta: "text-emerald-700/80 dark:text-emerald-300/70",
    value: "text-emerald-900 dark:text-emerald-100",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    badgeIcon: CheckCircle2, badgeLabel: "Keçirildi",
  },
  deferred: {
    card: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900",
    meta: "text-violet-700/80 dark:text-violet-300/70",
    value: "text-violet-900 dark:text-violet-100",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
    badgeIcon: PauseCircle, badgeLabel: "Təxirə salındı",
  },
  missed: {
    card: "bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900",
    meta: "text-rose-700/80 dark:text-rose-300/70",
    value: "text-rose-900 dark:text-rose-100",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
    badgeIcon: XCircle, badgeLabel: "Keçirilmədi",
  },
  in_progress: {
    card: "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-900",
    meta: "text-amber-700/80 dark:text-amber-300/70",
    value: "text-amber-900 dark:text-amber-100",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    badgeIcon: Clock, badgeLabel: "İcrada",
  },
  pending: {
    card: "bg-slate-100/70 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800",
    meta: "text-slate-400 dark:text-slate-500",
    value: "text-slate-500 dark:text-slate-400",
    badge: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    badgeIcon: Circle, badgeLabel: "Planlaşdırılıb",
  },
};

const StageRow = ({
  icon: Icon, title, stage,
}: { icon: React.ComponentType<{ className?: string }>; title: string; stage?: LifecycleStage }) => {
  const status = getStageStatus(stage);
  const s = status ? STATUS_STYLES[status] : NEUTRAL;
  const BadgeIcon = status ? STATUS_STYLES[status].badgeIcon : null;
  return (
    <div className={`border rounded-lg p-3 transition-colors ${s.card}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${s.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-sm font-semibold flex-1 ${s.title}`}>{title}</span>
        {status && BadgeIcon && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[status].badge}`}>
            <BadgeIcon className="w-3 h-3" />
            {STATUS_STYLES[status].badgeLabel}
          </span>
        )}
      </div>
      {stage ? (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><p className={`mb-0.5 ${s.meta}`}>Dövr</p><p className={`font-medium ${s.value}`}>{formatStagePeriod(stage)}</p></div>
          <div><p className={`mb-0.5 ${s.meta}`}>Başlama</p><p className={`font-medium inline-flex items-center gap-1 ${s.value}`}><CalendarDays className="w-3 h-3" /> {stage.start || "—"}</p></div>
          <div><p className={`mb-0.5 ${s.meta}`}>Bitmə</p><p className={`font-medium inline-flex items-center gap-1 ${s.value}`}><CalendarDays className="w-3 h-3" /> {stage.end || "—"}</p></div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Təyin olunmayıb</p>
      )}
    </div>
  );
};

const ReviewRow = ({ r, i }: { r: LifecycleReview; i: number }) => {
  const status = computeReviewStatus(r);
  const s = REVIEW_STATUS_STYLES[status];
  const BadgeIcon = s.badgeIcon;
  return (
    <div className={`border rounded-md p-2.5 ${s.card}`}>
      <div className="grid grid-cols-[24px,1fr,1fr,1fr,auto] gap-2 items-center text-xs">
        <span className={s.meta}>#{i + 1}</span>
        <div><p className={s.meta}>Dövr</p><p className={`font-medium ${s.value}`}>{formatStagePeriod(r)}</p></div>
        <div><p className={s.meta}>Başlama</p><p className={`font-medium ${s.value}`}>{r.start || "—"}</p></div>
        <div><p className={s.meta}>Bitmə</p><p className={`font-medium ${s.value}`}>{r.end || "—"}</p></div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${s.badge}`}>
          <BadgeIcon className="w-3 h-3" />{s.badgeLabel}
        </span>
      </div>
      {status === "deferred" && r.outcomeComment && (
        <div className="mt-2 pt-2 border-t border-violet-200 dark:border-violet-900">
          <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.meta}`}>Təxirə salınma səbəbi</p>
          <p className={`text-xs mt-0.5 ${s.value}`}>{r.outcomeComment}</p>
        </div>
      )}
      {status === "held" && r.outcomeComment && (
        <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900">
          <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.meta}`}>Review nəticəsi</p>
          <p className={`text-xs mt-0.5 ${s.value}`}>{r.outcomeComment}</p>
        </div>
      )}
    </div>
  );
};

interface LifecycleViewProps {
  lifecycle: CardLifecycle | null;
  /** Editing mode — "Yeni Review yarat" düyməsi göstərilir. */
  editable?: boolean;
  cardId?: number;
  cardName?: string;
  cardMeta?: { startDate?: string; endDate?: string; frequency?: string };
}

const LifecycleView = ({ lifecycle, editable, cardId, cardName, cardMeta }: LifecycleViewProps) => {
  const [newReviewOpen, setNewReviewOpen] = useState(false);
  const { toast } = useToast();

  if (!lifecycle) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg bg-card">
        Bu KPI üçün lifecycle planı təyin edilməyib.
      </div>
    );
  }

  const reviewStatuses = lifecycle.reviews.map(r => computeReviewStatus(r));
  let reviewsWrapperStatus: StageStatus | null = null;
  if (reviewStatuses.length > 0) {
    if (reviewStatuses.some(s => s === "in_progress")) reviewsWrapperStatus = "in_progress";
    else if (reviewStatuses.every(s => s === "held" || s === "deferred" || s === "missed")) reviewsWrapperStatus = "completed";
    else if (reviewStatuses.every(s => s === "pending")) reviewsWrapperStatus = "pending";
    else reviewsWrapperStatus = "in_progress";
  }
  const rs = reviewsWrapperStatus ? STATUS_STYLES[reviewsWrapperStatus] : NEUTRAL;
  const RBadgeIcon = reviewsWrapperStatus ? STATUS_STYLES[reviewsWrapperStatus].badgeIcon : null;

  const canCreate = editable && cardId != null && cardName != null;

  // Ən son review-un iştirakçıları — "əvvəlki review iştirakçıları" seçimi üçün.
  const previousParticipantIds = (() => {
    const ids = new Set<string>();
    for (const r of lifecycle.reviews) {
      for (const id of r.participantIds || []) ids.add(String(id));
    }
    return Array.from(ids);
  })();

  // Kart yaradılarkən review-u keçirmək üçün seçilmiş şəxslərin adları.
  const previousParticipantNames = (() => {
    const names = new Set<string>();
    for (const r of lifecycle.reviews) {
      for (const n of r.reviewerNames || []) if (n) names.add(String(n));
      if ((r as { reviewerName?: string }).reviewerName) names.add(String((r as { reviewerName?: string }).reviewerName));
    }
    return Array.from(names);
  })();

  const handleCreate = ({ start, end, participantIds, reviewerNames }: { start: string; end: string; participantIds: string[]; reviewerNames: string[] }) => {
    if (!canCreate || cardId == null || !cardName) return;
    appendReviewToCard(cardId, cardName, cardMeta, { start, end, participantIds, reviewerNames });
    toast({ title: "Yeni review yaradıldı" });
  };

  return (
    <div className="space-y-3">
      <StageRow icon={Target} title="KPI təyin olunması" stage={lifecycle.assignment} />
      <StageRow icon={Star} title="KPI qiymətləndirilməsi" stage={lifecycle.evaluation} />
      <StageRow icon={Wallet} title="Bonusun hesablanması" stage={lifecycle.bonus} />

      <div className={`border rounded-lg p-3 ${rs.card}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${rs.icon}`}>
            <RefreshCw className="w-4 h-4" />
          </div>
          <span className={`text-sm font-semibold flex-1 ${rs.title}`}>KPI Review</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {lifecycle.reviews.length} ədəd
          </span>
          {reviewsWrapperStatus && RBadgeIcon && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[reviewsWrapperStatus].badge}`}>
              <RBadgeIcon className="w-3 h-3" />
              {STATUS_STYLES[reviewsWrapperStatus].badgeLabel}
            </span>
          )}
          {canCreate && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setNewReviewOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Yeni Review yarat
            </Button>
          )}
        </div>
        {lifecycle.reviews.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Review təyin olunmayıb</p>
        ) : (
          <div className="space-y-2">
            {lifecycle.reviews.map((r, i) => <ReviewRow key={r.id} r={r} i={i} />)}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-[11px] text-muted-foreground border-t border-border mt-2">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span><strong className="text-foreground">Keçirildi</strong></span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span><strong className="text-foreground">İcrada</strong></span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span><strong className="text-foreground">Keçirilmədi</strong></span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" /><span><strong className="text-foreground">Təxirə salındı</strong></span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /><span><strong className="text-foreground">Planlaşdırılıb</strong></span></div>
      </div>

      <NewReviewDialog
        open={newReviewOpen}
        onOpenChange={setNewReviewOpen}
        previousParticipantIds={previousParticipantIds}
        previousParticipantNames={previousParticipantNames}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default LifecycleView;
