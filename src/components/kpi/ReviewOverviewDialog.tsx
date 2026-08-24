// Review Ümumi Baxış — Metric BI dizayn sisteminə uyğun böyük Dialog.
// KPI izlənməsi → Reviewlar cədvəlində Eye ikonuna klik edildikdə açılır.
import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Calendar as CalendarIcon,
  Users,
  Check,
  Clock,
  CalendarClock,
  XCircle,
  ClipboardList,
  Eye,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import KpiCommentThread from "./KpiCommentThread";
import type { ReviewStatusValue } from "./ReviewStatusChangeDialog";

export interface ReviewOverviewData {
  reviewType: string;        // Aylıq, Həftəlik...
  planDate: string;
  nextReviewDate: string;
  updatedAt: string;
  status: ReviewStatusValue;
  overallProgress: number;   // 0-100
  reviewers: { name: string; position: string; badge: string; avatarSeed?: string }[];
  targets: {
    name: string;
    progress: number;
    status: ReviewStatusValue;
    lastScore?: string;
    note?: string;
  }[];
}

const STATUS_META: Record<ReviewStatusValue, { label: string; badge: string; dot: string; icon: typeof Check; tint: string; bar: string }> = {
  held:        { label: "Keçirildi",     badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25", dot: "bg-emerald-500", icon: Check,        tint: "text-emerald-600", bar: "bg-emerald-500" },
  in_progress: { label: "İcrada",        badge: "bg-amber-500/15 text-amber-700 border-amber-500/25",       dot: "bg-amber-500",   icon: Clock,        tint: "text-amber-600",   bar: "bg-amber-500" },
  deferred:    { label: "Təxirə salındı", badge: "bg-violet-500/15 text-violet-700 border-violet-500/25",   dot: "bg-violet-500",  icon: CalendarClock, tint: "text-violet-600",  bar: "bg-violet-500" },
  missed:      { label: "Keçirilmədi",   badge: "bg-rose-500/15 text-rose-700 border-rose-500/25",          dot: "bg-rose-500",    icon: XCircle,      tint: "text-rose-600",    bar: "bg-rose-500" },
};

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  data: ReviewOverviewData;
  onChangeStatus: () => void;
  onOpenTarget?: (index: number) => void;
  /** Şərhlərin bağlandığı ümumi KPI kartı referansı (məs: `card:12`). */
  commentRefId?: string | number | null;
}

const ReviewOverviewDialog = ({ open, onOpenChange, title, data, onChangeStatus, onOpenTarget, commentRefId }: Props) => {
  const totals = useMemo(() => {
    const counts = { held: 0, in_progress: 0, deferred: 0, missed: 0 } as Record<ReviewStatusValue, number>;
    data.targets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    const total = data.targets.length;
    const avg = total ? Math.round(data.targets.reduce((s, t) => s + t.progress, 0) / total) : 0;
    return { ...counts, total, avg };
  }, [data]);

  const pct = (n: number) => (totals.total ? Math.round((n / totals.total) * 100) : 0);
  const cur = STATUS_META[data.status];
  const CurIcon = cur.icon;
  // Circle progress
  const R = 44, C = 2 * Math.PI * R;
  const dash = (Math.min(data.overallProgress, 100) / 100) * C;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center">1</span>
              <h2 className="text-lg font-bold text-foreground truncate">Review Ümumi Baxış</h2>
            </div>
            <p className="text-xs text-muted-foreground pl-9 truncate">{title} — Review haqqında ümumi məlumat və xülasə</p>
          </div>
          <Button variant="outline" onClick={onChangeStatus} className="gap-1.5 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Statusu dəyiş
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Block 1: Meta card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5 grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sol */}
            <div className="space-y-4">
              <MetaItem icon={<CalendarIcon className="w-4 h-4" />} label="Review növü" value={data.reviewType} />
              <MetaItem icon={<CalendarIcon className="w-4 h-4" />} label="Plan tarixi" value={data.planDate} />
              <MetaItem icon={<CalendarClock className="w-4 h-4" />} label="Növbəti review" value={data.nextReviewDate} />
            </div>
            {/* Orta */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
                <Users className="w-4 h-4 text-muted-foreground" />
                Review-u həyata keçirən şəxs(lər)
              </div>
              <div className="space-y-3">
                {data.reviewers.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0">{initials(r.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.position}</div>
                    </div>
                    <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/15 border-sky-500/25">{r.badge}</Badge>
                  </div>
                ))}
              </div>
            </div>
            {/* Sağ */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">Review statusu</div>
              <Badge className={cn(cur.badge, "hover:" + cur.badge, "border inline-flex items-center gap-1.5 mb-3")}>
                <CurIcon className="w-3 h-3" /> {cur.label}
              </Badge>
              <div className="text-xs text-muted-foreground mb-2">Tamamlanma progressi</div>
              <div className="flex items-center gap-3">
                <svg width="100" height="100" className="shrink-0">
                  <circle cx="50" cy="50" r={R} strokeWidth="8" className="stroke-secondary" fill="none" />
                  <circle cx="50" cy="50" r={R} strokeWidth="8" className="stroke-primary transition-all duration-500" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 50 50)" />
                  <text x="50" y="55" textAnchor="middle" className="fill-foreground text-lg font-bold">{data.overallProgress}%</text>
                </svg>
                <div className="text-[11px] text-muted-foreground">
                  <div>Son yenilənmə</div>
                  <div className="text-foreground font-medium mt-0.5">{data.updatedAt}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Block 2: KPI Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard tone="indigo" label="Ortalama Progress" value={`${totals.avg}%`} icon={<TrendingUp className="w-4 h-4" />} />
            <SummaryCard tone="emerald" label="Tamamlanan KPI" value={`${totals.held} / ${totals.total}`} sub={`${pct(totals.held)}%`} icon={<Check className="w-4 h-4" />} />
            <SummaryCard tone="amber" label="İcrada olan KPI" value={`${totals.in_progress} / ${totals.total}`} sub={`${pct(totals.in_progress)}%`} icon={<Clock className="w-4 h-4" />} />
            <SummaryCard tone="violet" label="Təxirə salınan KPI" value={`${totals.deferred} / ${totals.total}`} sub={`${pct(totals.deferred)}%`} icon={<CalendarClock className="w-4 h-4" />} />
            <SummaryCard tone="rose" label="Keçirilmədi olan KPI" value={`${totals.missed} / ${totals.total}`} sub={`${pct(totals.missed)}%`} icon={<XCircle className="w-4 h-4" />} />
            <SummaryCard tone="sky" label="Növbəti Review" value={data.nextReviewDate} icon={<CalendarIcon className="w-4 h-4" />} />
          </div>

          {/* Block 3: Targets table */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium">KPI / Hədəf</th>
                    <th className="text-left px-4 py-3 font-medium w-[200px]">Progress</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Son nəticə</th>
                    <th className="text-left px-4 py-3 font-medium">Review qeydi</th>
                    <th className="text-center px-4 py-3 font-medium w-14">Bax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.targets.map((t, i) => {
                    const meta = STATUS_META[t.status];
                    const Icon = meta.icon;
                    return (
                      <tr key={i} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                              <div className={cn("h-full transition-all", meta.bar)} style={{ width: `${Math.min(t.progress, 100)}%` }} />
                            </div>
                            <span className="text-xs tabular-nums font-medium w-10 text-right">{t.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={cn(meta.badge, "hover:" + meta.badge, "border inline-flex items-center gap-1")}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">{t.lastScore || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[280px] truncate" title={t.note}>{t.note || "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onOpenTarget?.(i)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Hədəfə bax"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-4 border-t border-border bg-secondary/20">
              {(["held", "in_progress", "deferred", "missed"] as ReviewStatusValue[]).map(s => {
                const m = STATUS_META[s];
                const desc = s === "held" ? "Review tamamlanıb." : s === "in_progress" ? "Hazırda review müddəti davam edir." : s === "deferred" ? "Review başqa tarixə ertələnib." : "Review dövrü bitib, lakin review keçirilməyib.";
                return (
                  <div key={s} className="flex items-start gap-2 text-xs">
                    <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", m.dot)} />
                    <div className="min-w-0">
                      <div className={cn("font-semibold", m.tint)}>{m.label}</div>
                      <div className="text-muted-foreground">{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Block 4: Ümumi kart şərhləri — bu KPI kartına yazılan şərhlər */}
          {commentRefId != null && (
            <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Kart üzrə şərhlər</h3>
              </div>
              <KpiCommentThread refId={commentRefId} placeholder="KPI kartı üzrə şərhinizi yazın..." />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const MetaItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <span className="w-9 h-9 rounded-lg bg-secondary/60 text-muted-foreground flex items-center justify-center shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground truncate">{value}</div>
    </div>
  </div>
);

const TONE_MAP: Record<string, { bg: string; text: string; iconBg: string; iconText: string }> = {
  indigo:  { bg: "bg-indigo-50/70 dark:bg-indigo-500/10",   text: "text-indigo-700 dark:text-indigo-300",   iconBg: "bg-indigo-500/15",  iconText: "text-indigo-600" },
  emerald: { bg: "bg-emerald-50/70 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", iconBg: "bg-emerald-500/15", iconText: "text-emerald-600" },
  amber:   { bg: "bg-amber-50/70 dark:bg-amber-500/10",     text: "text-amber-700 dark:text-amber-300",     iconBg: "bg-amber-500/15",   iconText: "text-amber-600" },
  violet:  { bg: "bg-violet-50/70 dark:bg-violet-500/10",   text: "text-violet-700 dark:text-violet-300",   iconBg: "bg-violet-500/15",  iconText: "text-violet-600" },
  rose:    { bg: "bg-rose-50/70 dark:bg-rose-500/10",       text: "text-rose-700 dark:text-rose-300",       iconBg: "bg-rose-500/15",    iconText: "text-rose-600" },
  sky:     { bg: "bg-sky-50/70 dark:bg-sky-500/10",         text: "text-sky-700 dark:text-sky-300",         iconBg: "bg-sky-500/15",     iconText: "text-sky-600" },
};

const SummaryCard = ({ tone, label, value, sub, icon }: { tone: keyof typeof TONE_MAP; label: string; value: string; sub?: string; icon: React.ReactNode }) => {
  const t = TONE_MAP[tone];
  return (
    <div className={cn("rounded-2xl border border-border p-4 shadow-sm", t.bg)}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", t.iconBg, t.iconText)}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className={cn("text-xl font-bold tabular-nums", t.text)}>{value}</span>
        {sub && <span className={cn("text-xs font-semibold tabular-nums", t.text)}>{sub}</span>}
      </div>
    </div>
  );
};

export default ReviewOverviewDialog;
