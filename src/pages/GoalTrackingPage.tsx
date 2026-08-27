import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Target, Bell, Search, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useCascadeAssignments, emptyLimits, type CascadeSlice, type CascadeAssignment } from "@/lib/cascadingStore";
import { useCascadeTree } from "@/lib/cascadeTreeStore";
import { withKartSuffix } from "@/lib/utils";
import { TARGET_STATUS_BADGE, type TargetStatus } from "@/lib/targetStatus";

// Sistem üzrə yalnız 3 hədəf statusu istifadə olunur.
type ExecStatus = TargetStatus;

// Real fakt dəyəri hələ mövcud deyil — mock/generasiya edilmiş irəliləyiş göstərilmir.
const statusFor = (_id: string): { status: ExecStatus; progress: number } => {
  return { status: "in_progress", progress: 0 };
};

const STATUS_META: Record<ExecStatus, { labelKey: string; cls: string; icon: typeof CheckCircle2 }> = {
  achieved:     { labelKey: "goal_tracking.status_achieved",     cls: TARGET_STATUS_BADGE.achieved, icon: CheckCircle2 },
  in_progress:  { labelKey: "goal_tracking.status_in_progress",  cls: TARGET_STATUS_BADGE.in_progress, icon: Clock },
  not_achieved: { labelKey: "goal_tracking.status_not_achieved", cls: TARGET_STATUS_BADGE.not_achieved, icon: AlertTriangle },
};

const GoalTrackingPage = ({ onBack }: { onBack?: () => void }) => {
  const { t } = useTranslation();
  const baseAssignments = useCascadeAssignments();
  const cascadeNodes = useCascadeTree();
  const [search, setSearch] = useState("");

  // Cascade Tree-dəki ilkin Root-lar (HR-ın yaratdığı kartlar) və onların bütün
  // alt zənciri Hədəf Təyinatlarının İzlənməsinə əlavə edilir.
  const assignments = useMemo<CascadeAssignment[]>(() => {
    const roots = cascadeNodes.filter(n => !n.parentId);
    const treeAssignments: CascadeAssignment[] = roots.map(r => {
      const kids = cascadeNodes.filter(n => n.rootId === r.rootId && n.parentId);
      return {
        id: `tr-${r.id}`,
        entryId: r.id,
        cardName: r.cardName,
        subKpiName: r.goalName || t("goal_tracking.main_goal_fallback"),
        parentTarget: String(r.limit),
        unit: r.unit,
        status: "submitted" as const,
        updatedAt: r.updatedAt,
        slices: kids.map(k => ({
          id: k.id,
          assigneeName: k.assigneeName,
          target: String(k.limit),
          limits: emptyLimits(),
        })),
      };
    });
    return [...baseAssignments, ...treeAssignments];
  }, [baseAssignments, cascadeNodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter(a =>
      a.cardName.toLowerCase().includes(q) ||
      a.subKpiName.toLowerCase().includes(q) ||
      a.slices.some(s => s.assigneeName.toLowerCase().includes(q))
    );
  }, [assignments, search]);

  const totals = useMemo(() => {
    let total = 0, done = 0, overdue = 0;
    assignments.forEach(a => a.slices.forEach(s => {
      total++;
      const st = statusFor(s.id).status;
      if (st === "achieved") done++;
      if (st === "not_achieved") overdue++;
    }));
    return { total, done, overdue };
  }, [assignments]);

  const notify = (slice: CascadeSlice, cardName: string) => {
    toast.success(t("goal_tracking.toast_notify_one", { name: slice.assigneeName }), {
      description: t("goal_tracking.toast_notify_one_desc", { card: cardName }),
    });
  };

  const notifyAll = (cardName: string, slices: CascadeSlice[]) => {
    toast.success(t("goal_tracking.toast_notify_many", { count: slices.length }), {
      description: t("goal_tracking.toast_notify_many_desc", { card: cardName }),
    });
  };

  return (
    <div className="min-h-screen">
      <Header title={t("goal_tracking.page_title")} />
      <main className="p-6 pb-24">
        <PageHero
          badge={t("goal_tracking.hero_badge")}
          icon={Target}
          title={t("goal_tracking.hero_title")}
          subtitle={t("goal_tracking.hero_subtitle")}
          right={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs">
                <span className="font-semibold text-foreground">{totals.total}</span>
                <span className="text-muted-foreground">{t("goal_tracking.stats_assignments")} • </span>
                <span className="font-semibold text-emerald-600">{totals.done}</span>
                <span className="text-muted-foreground">{t("goal_tracking.stats_done")} • </span>
                <span className="font-semibold text-red-600">{totals.overdue}</span>
                <span className="text-muted-foreground">{t("goal_tracking.stats_overdue")}</span>
              </div>
            </div>
          }
        />

        <div className="mb-4 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("goal_tracking.search_placeholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center text-muted-foreground">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm">{t("goal_tracking.empty")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(a => {
              const avg = Math.round(a.slices.reduce((s, sl) => s + statusFor(sl.id).progress, 0) / Math.max(1, a.slices.length));
              return (
                <div key={a.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between gap-3 p-4 bg-secondary/40 border-b border-border">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{withKartSuffix(a.cardName)}</div>
                      <div className="font-semibold text-foreground truncate">{a.subKpiName}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t("goal_tracking.total_target")} <span className="font-medium text-foreground">{a.parentTarget} {a.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">{t("goal_tracking.avg_progress")}</div>
                        <div className="text-lg font-bold text-foreground">{avg}%</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => notifyAll(a.cardName, a.slices)} className="gap-1.5">
                        <Bell className="w-3.5 h-3.5" /> {t("goal_tracking.notify_all")}
                      </Button>
                    </div>
                  </div>


                  <div className="divide-y divide-border">
                    {a.slices.map(s => {
                      const { status, progress } = statusFor(s.id);
                      const meta = STATUS_META[status];
                      const Icon = meta.icon;
                      return (
                        <div key={s.id} className="p-4 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {s.assigneeName.split(" ").map(p => p[0]).slice(0, 2).join("")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground text-sm truncate">{s.assigneeName}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${meta.cls}`}>
                                <Icon className="w-3 h-3" /> {t(meta.labelKey)}
                              </span>
                            </div>
                          </div>
                          <div className="w-[260px] shrink-0">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    status === "achieved" ? "bg-emerald-500" :
                                    status === "not_achieved" ? "bg-rose-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-primary w-9 text-right">{progress}%</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {t("goal_tracking.target")} <span className="text-foreground font-medium">{s.target} {a.unit}</span>
                              </span>
                              <span className="text-border">|</span>
                              <span>{t("goal_tracking.current")} <span className="text-foreground font-medium">{Math.round((Number(s.target) || 0) * progress / 100)} {a.unit}</span></span>
                            </div>
                          </div>
                          <Button size="sm" onClick={() => notify(s, a.cardName)} className="gap-1.5 shrink-0">
                            <Bell className="w-3.5 h-3.5" /> {t("goal_tracking.notify")}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default GoalTrackingPage;
