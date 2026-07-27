// Shared KPI card detail view — 9 tabs identical to the main "KPI Kartları" popup.
// Used by:
//  - src/pages/KpiCardsPage.tsx (main HR view)
//  - src/pages/manager/ManagerKpiTrackingPage.tsx (KPI izlənməsi drawer)
// The visual container (Dialog / Drawer) is provided by the caller — this component
// renders only the tab strip and the tab content.

import { useState } from "react";
import {
  Target, Clock, ArrowUp, ArrowDown, CheckCircle, AlertTriangle, Calendar,
  ChevronDown, ChevronUp, Info, ShoppingCart, Store, Monitor, BarChart3,
  FileText, User, Crosshair, Activity,
} from "lucide-react";
import type { KpiCard } from "@/lib/kpiCardTypes";
import type { KpiCardStatusRow, KpiCardStatus } from "@/lib/kpiCardStatusStore";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/kpiCardStatusStore";

import KpiExtraTabContent, { isExtraTab } from "./KpiExtraTabs";
import BscScorecardTab from "./BscScorecardTab";
import LifecycleView, { REVIEW_STATUS_STYLES } from "./LifecycleView";
import PerformanceDynamicsTab from "./PerformanceDynamicsDrilldownTab";
import { getLifecycle, getLifecycleWithFallback, computeReviewStatus, setReviewOutcome } from "@/lib/kpiLifecycleStore";
import { getEntriesForCard } from "@/lib/kpiSetStore";
import { getApprovalMatrices, formatAssignee } from "@/lib/matrixStore";
import { getEmployees } from "@/lib/orgStore";
import { withKartSuffix } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";


export type KpiDetailTab =
  | "general" | "bsc" | "lifecycle" | "reviewTrack"
  | "history" | "team" | "comments" | "status" | "setStatus";

export const KPI_DETAIL_TABS: [KpiDetailTab, string][] = [
  ["general", "Ümumi"],
  ["bsc", "Balanced Scorecard"],
  ["lifecycle", "Lifecycle"],
  ["reviewTrack", "Review İzləmə"],
  ["history", "Performans Dinamikası"],
  ["team", "KPI Üzvləri"],
  ["comments", "Şərhlər"],
  ["status", "Təsdiqləmə Matrisi"],
  ["setStatus", "Təyin Statusu"],
];

export interface KpiDetailViewProps {
  kpi: KpiCard;
  /** Initial active tab. */
  initialTab?: KpiDetailTab;
  /** Optional: card status lookup — used for Lifecycle/Təyin Statusu logic and reject banner. */
  getStatusFor?: (id: number) => KpiCardStatusRow;
  /** Optional: bulk vs personal assignment label. */
  getAssignKindFor?: (id: number) => "Fərdi" | "Toplu";
  /** Optional: wizard drafts (bulk selection breakdown for the "Ümumi" tab). */
  cardDrafts?: Record<number, any>;
  /** Compact mode → smaller paddings for narrow drawer containers. */
  compact?: boolean;
}

const defaultStatus = (cardId: number): KpiCardStatusRow => ({
  card_id: cardId,
  status: "aktiv" as KpiCardStatus,
  use_matrix: false,
  submitted_for_approval: false,
  rejected_by: null,
  rejected_at: null,
  assignees: [],
  updated_at: new Date().toISOString(),
});

const KpiDetailView = ({
  kpi: selectedKpi,
  initialTab = "general",
  getStatusFor = defaultStatus,
  getAssignKindFor = () => "Fərdi",
  cardDrafts = {},
  compact = false,
}: KpiDetailViewProps) => {
  const [detailTab, setDetailTab] = useState<KpiDetailTab>(initialTab);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [reviewCommentFilters, setReviewCommentFilters] =
    useState<Record<string, { author: string; date: string }>>({});
  const [outcomeDialog, setOutcomeDialog] = useState<{ reviewId: string; status: "held" | "deferred"; comment: string } | null>(null);
  const { toast } = useToast();


  const hasMatrix = !!selectedKpi.matrixId;
  const isPersonalCard = getAssignKindFor(selectedKpi.id) === "Fərdi";
  const tabs = KPI_DETAIL_TABS
    .filter(([k]) => k !== "status" || hasMatrix)
    .filter(([k]) => !isPersonalCard || (k !== "reviewTrack" && k !== "history"));


  const st = getStatusFor(selectedKpi.id);
  const rejectBanner = st.status === "imtina" ? (
    <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-rose-700 dark:text-rose-400">İmtina səbəbi</div>
        <div className="text-sm text-foreground mt-0.5">
          {(st as any).rejection_reason || `${st.rejected_by || "Təsdiq mərhələsi"} tərəfindən imtina edildi`}
        </div>
      </div>
    </div>
  ) : null;

  const px = compact ? "px-4" : "px-6";
  const pb = compact ? "pb-4" : "pb-6";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className={`${px} pt-4 space-y-4 shrink-0`}>
        {rejectBanner}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDetailTab(key)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${
                detailTab === key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto ${px} ${pb} pt-4 space-y-4`}>
        {detailTab === "bsc" && <BscScorecardTab kpi={selectedKpi as any} />}

        {detailTab === "lifecycle" && (() => {
          const status = getStatusFor(selectedKpi.id).status;
          const lc = status === "qaralama"
            ? (getLifecycle(selectedKpi.id) || null)
            : getLifecycleWithFallback(selectedKpi.id, withKartSuffix(selectedKpi.name), {
                startDate: selectedKpi.startDate, endDate: selectedKpi.endDate, frequency: selectedKpi.frequency,
              });
          return (
            <LifecycleView
              lifecycle={lc}
              cardId={selectedKpi.id}
              cardName={withKartSuffix(selectedKpi.name)}
              cardMeta={{ startDate: selectedKpi.startDate, endDate: selectedKpi.endDate, frequency: selectedKpi.frequency }}
            />
          );
        })()}


        {detailTab === "reviewTrack" && (() => {
          const lc = getLifecycleWithFallback(selectedKpi.id, withKartSuffix(selectedKpi.name), {
            startDate: selectedKpi.startDate, endDate: selectedKpi.endDate, frequency: selectedKpi.frequency,
          });
          const reviews = lc?.reviews || [];
          const today = new Date(); today.setHours(0, 0, 0, 0);
          return (
            <div className="bg-card rounded-lg border border-border p-4">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Review Tarixçəsi
              </h4>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-8">
                  Bu KPI üçün hələ review təyin olunmayıb.
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r, i) => {
                    const computed = computeReviewStatus(r);
                    const styleDef = REVIEW_STATUS_STYLES[computed];
                    const BadgeIcon = styleDef.badgeIcon;
                    // Legacy 3-way status for comment seeding compatibility
                    const status = (computed === "held" || computed === "missed" || computed === "deferred")
                      ? "completed" : computed === "in_progress" ? "in_progress" : "pending";
                    const reviewer = (selectedKpi.team && selectedKpi.team[0]?.name) || selectedKpi.responsible || "—";
                    return (
                      <div key={r.id} className={`flex items-start gap-3 p-3 rounded-lg border ${styleDef.card}`}>
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          #{i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">Review #{i + 1} · {r.period}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${styleDef.badge}`}>
                              <BadgeIcon className="w-3 h-3" />{styleDef.badgeLabel}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>Başlama: {r.start || "—"}</span>
                            <span>Bitmə: {r.end || "—"}</span>
                            <span>Məsul: {reviewer}</span>
                          </div>
                          {r.outcomeComment && (
                            <div className={`mt-2 p-2 rounded-md border ${computed === "deferred" ? "border-violet-200 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-900" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900"}`}>
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                                {computed === "deferred" ? "Təxirə salınma səbəbi" : "Review nəticəsi"}
                              </p>
                              <p className="text-xs text-foreground mt-0.5">{r.outcomeComment}</p>
                            </div>
                          )}

                          {(() => {
                            const key = `kpi_review_comments_v1::${selectedKpi.id}::${r.id}`;
                            let comments: { author: string; date: string; text: string }[] = [];
                            try {
                              const raw = localStorage.getItem(key);
                              if (raw) comments = JSON.parse(raw);
                            } catch {}
                            const filter = reviewCommentFilters[r.id] || { author: "", date: "" };
                            const availableAuthors = Array.from(new Set(comments.map(c => c.author).filter(Boolean)));
                            const filteredComments = comments.filter(c => {
                              if (filter.author && c.author !== filter.author) return false;
                              if (filter.date && !(c.date || "").includes(filter.date)) return false;
                              return true;
                            });
                            const isExpanded = expandedReviews.has(r.id);
                            const showAll = isExpanded || filteredComments.length <= 3;
                            const visible = showAll ? filteredComments : filteredComments.slice(0, 3);
                            const hiddenCount = filteredComments.length - 3;
                            const toggle = () => setExpandedReviews(prev => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                              return next;
                            });
                            const setFilter = (patch: Partial<{ author: string; date: string }>) =>
                              setReviewCommentFilters(prev => ({ ...prev, [r.id]: { ...filter, ...patch } }));
                            return (
                              <div className="mt-3 pt-3 border-t border-border/60">
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Review şərhləri</p>
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={filter.author}
                                      onChange={(e) => setFilter({ author: e.target.value })}
                                      className="text-[11px] px-2 py-1 rounded border border-border bg-background text-foreground"
                                    >
                                      <option value="">Bütün müəlliflər</option>
                                      {availableAuthors.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                    <input
                                      type="date"
                                      value={filter.date}
                                      onChange={(e) => setFilter({ date: e.target.value })}
                                      className="text-[11px] px-2 py-1 rounded border border-border bg-background text-foreground"
                                    />
                                    {(filter.author || filter.date) && (
                                      <button
                                        type="button"
                                        onClick={() => setFilter({ author: "", date: "" })}
                                        className="text-[11px] px-2 py-1 rounded border border-border bg-background text-muted-foreground hover:text-foreground"
                                      >
                                        Sıfırla
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-border/60 bg-background/40 overflow-hidden">
                                  <div className="p-2 space-y-2 transition-all duration-[250ms] ease-out">
                                    {visible.length === 0 && (
                                      <div className="text-center text-[11px] text-muted-foreground py-4">
                                        Filtrə uyğun şərh tapılmadı.
                                      </div>
                                    )}
                                    {visible.map((c, ci) => (
                                      <div key={ci} className="flex items-start gap-2 p-2 rounded-md bg-background/80 border border-border/50">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
                                          {(c.author || "?")[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-semibold text-foreground">{c.author}</p>
                                            {c.date && <p className="text-[10px] text-muted-foreground">{c.date}</p>}
                                          </div>
                                          <p className="text-xs text-foreground/90 mt-0.5">{c.text}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {filteredComments.length > 3 && (
                                    <button
                                      type="button"
                                      onClick={toggle}
                                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-primary bg-[#F8FAFC] hover:bg-[#F1F5F9] dark:bg-secondary/60 dark:hover:bg-secondary transition-colors cursor-pointer"
                                    >
                                      {isExpanded ? "Daha az göstər" : `${hiddenCount} daha çox şərh var`}
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {isExtraTab(detailTab) && <KpiExtraTabContent kpi={selectedKpi as any} tab={detailTab as any} />}

        {detailTab === "general" && (
          <>
            <div className={compact || isPersonalCard ? "space-y-4" : "grid grid-cols-2 gap-4"}>
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-semibold text-foreground text-base">Əsas Məlumatlar</h4>
                </div>
                <div className="divide-y divide-border">
                  {(() => {
                    const assignKind = getAssignKindFor(selectedKpi.id);
                    const bulkDetail = (() => {
                      const d = cardDrafts[selectedKpi.id];
                      if (!d || d.mode !== "bulk") return "";
                      const bs = d.bulkSelections || {};
                      const parts: string[] = [];
                      if (bs.teams?.length) parts.push(`Komandalar: ${bs.teams.join(", ")}`);
                      if (bs.positions?.length) parts.push(`Vəzifələr: ${bs.positions.join(", ")}`);
                      if (bs.structures?.length) parts.push(`Strukturlar: ${bs.structures.length}`);
                      if (bs.persons?.length) parts.push(`Şəxslər: ${bs.persons.join(", ")}`);
                      return parts.join(" · ");
                    })();
                    const upd = st.updated_at ? new Date(st.updated_at) : null;
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const updDate = upd && !isNaN(upd.getTime())
                      ? `${pad(upd.getDate())}.${pad(upd.getMonth() + 1)}.${upd.getFullYear()}`
                      : "—";
                    const updTime = upd && !isNaN(upd.getTime()) ? `${pad(upd.getHours())}:${pad(upd.getMinutes())}` : "";
                    const rows: { icon: any; label: string; value: React.ReactNode }[] = [
                      { icon: User, label: "Məsul Şəxs", value: selectedKpi.responsible || "—" },
                      {
                        icon: Crosshair, label: "Təyinat",
                        value: (
                          <span className="text-right">
                            {assignKind}
                            {bulkDetail && <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">{bulkDetail}</span>}
                          </span>
                        ),
                      },
                      {
                        icon: Activity, label: "Status",
                        value: (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${STATUS_STYLES[st.status]}`}>
                            {STATUS_LABELS[st.status]}
                          </span>
                        ),
                      },
                      { icon: Calendar, label: "Başlama", value: selectedKpi.startDate || "—" },
                      { icon: Calendar, label: "Bitmə", value: selectedKpi.endDate || "—" },
                      {
                        icon: Clock, label: "Son yenilənmə",
                        value: (
                          <span>
                            {updDate}
                            {updTime && <span className="ml-1.5 text-muted-foreground font-normal">{updTime}</span>}
                          </span>
                        ),
                      },
                    ];
                    return rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <r.icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm text-muted-foreground truncate">{r.label}</span>
                        </div>
                        <div className="text-sm font-semibold text-foreground text-right">{r.value}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              {!isPersonalCard && (() => {

                const own = selectedKpi.subKpis || [];
                const entries = selectedKpi.id ? getEntriesForCard(selectedKpi.id) : [];
                const ownIds = new Set(own.map(s => s.id));
                const extras = entries
                  .filter((e: any) => e.subKpiName && !ownIds.has(e.subKpiId))
                  .map((e: any) => ({ id: e.subKpiId, name: e.subKpiName, target: e.target, unit: e.unit, weight: 0, current: "", progress: undefined, evaluator: undefined as any, _fromSet: true, _assignee: e.assigneeName }));
                let merged: any[] = [...own.map(s => ({ ...s, _fromSet: false as boolean, _assignee: "" })), ...extras];
                if (merged.length === 0) {
                  merged = [{
                    id: 1,
                    name: selectedKpi.name,
                    target: (selectedKpi as any).generalTarget || (selectedKpi as any).target || "—",
                    unit: (selectedKpi as any).unit || "",
                    weight: 100,
                    current: (selectedKpi as any).current || "—",
                    progress: selectedKpi.progress,
                    evaluator: { type: "self", persons: [{ name: selectedKpi.responsible || "Məsul şəxs", weight: 100 }] } as any,
                    _fromSet: false,
                    _assignee: selectedKpi.responsible || "",
                  }];
                }
                return (
                  <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Target className="w-5 h-5" />
                      </div>
                      <h4 className="font-semibold text-foreground text-base">Hədəflər</h4>
                    </div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-secondary/40 text-xs font-medium text-muted-foreground">
                        <div className="col-span-5">Hədəf</div>
                        <div className="col-span-3">Cari vəziyyət</div>
                        <div className="col-span-2 text-right">Hədəf dəyər</div>
                        <div className="col-span-2 text-right">Çəki</div>
                      </div>
                      <div className="divide-y divide-border">
                        {merged.map((sk, i) => {
                          const parseNum = (v: any) => {
                            if (v === null || v === undefined) return NaN;
                            const s = String(v).replace(/[^\d.,-]/g, "").replace(",", ".");
                            const n = parseFloat(s);
                            return isNaN(n) ? NaN : n;
                          };
                          const cur = parseNum(sk.current);
                          const tgt = parseNum(sk.target);
                          const pct = !isNaN(cur) && !isNaN(tgt) && tgt !== 0
                            ? Math.min(100, Math.round((cur / tgt) * 100))
                            : (typeof sk.progress === "number" ? sk.progress : 0);
                          const icons = [ShoppingCart, Store, Monitor, BarChart3, Target];
                          const Icon = icons[i % icons.length];
                          const hasCurrent = sk.current && String(sk.current).trim() !== "";
                          return (
                            <div key={sk.id} className="grid grid-cols-12 gap-3 px-4 py-4 items-center hover:bg-secondary/20 transition-colors">
                              <div className="col-span-5 flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                                    <span className="truncate">{sk.name}</span>
                                    {sk._fromSet && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">KPI Set</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="col-span-3 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="text-sm font-bold text-primary tabular-nums truncate">{hasCurrent ? `${sk.current}${sk.unit ? ` ${sk.unit}` : ""}` : "—"}</p>
                                  <span className="text-[11px] font-semibold text-primary tabular-nums shrink-0">{pct}%</span>
                                </div>
                                <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              <div className="col-span-2 text-right text-sm font-medium text-foreground tabular-nums truncate">{sk.target}{sk.unit ? ` ${sk.unit}` : ""}</div>
                              <div className="col-span-2 text-right text-sm font-medium text-foreground tabular-nums border-l border-border pl-2">{sk.weight ? `${sk.weight}%` : "—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/40 border border-border px-3 py-2">
                      <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">Faiz göstəricisi cari vəziyyətin hədəf dəyərə nisbətini göstərir.</p>
                    </div>
                  </div>
                );
              })()}

            </div>
          </>
        )}

        {detailTab === "history" && <PerformanceDynamicsTab kpi={selectedKpi} />}


        {detailTab === "team" && (() => {
          const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
          type Member = { name: string; role: string; avatar: string; kind: "leader" | "assigner" | "evaluator" };
          const map = new Map<string, Member>();
          const upsert = (name: string, kind: Member["kind"], role: string) => {
            if (!name || name === "—") return;
            const key = `${name}::${kind}`;
            if (!map.has(key)) map.set(key, { name, role, avatar: initials(name), kind });
          };
          upsert(selectedKpi.responsible || "Məsul şəxs", "leader", "Lider / Məsul");
          (selectedKpi.subKpis || []).forEach(sk => {
            if ((sk as any).assigner) upsert((sk as any).assigner, "assigner", "Təyinedici");
            const persons = (sk as any)?.evaluator?.persons || [];
            persons.forEach((p: any) => upsert(p?.name, "evaluator", "Qiymətləndirici"));
          });
          let members = Array.from(map.values());
          if (members.length <= 1) {
            members = [
              { name: selectedKpi.responsible || "Məsul şəxs", role: "Lider / Məsul", avatar: initials(selectedKpi.responsible || "MS"), kind: "leader" },
              { name: "Nizami Əliyev", role: "Təyinedici", avatar: "NƏ", kind: "assigner" },
              { name: "Aynur Məmmədova", role: "Qiymətləndirici", avatar: "AM", kind: "evaluator" },
            ];
          }
          const badgeCls = (k: Member["kind"]) =>
            k === "leader" ? "bg-zone-green-bg text-zone-green-text"
            : k === "assigner" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30"
            : "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30";
          const badgeLbl = (k: Member["kind"]) =>
            k === "leader" ? "Lider" : k === "assigner" ? "Təyinedici" : "Qiymətləndirici";
          return (
            <div className="bg-card rounded-lg border border-border p-4">
              <h4 className="font-semibold text-foreground mb-4">KPI Üzvləri</h4>
              <div className="space-y-3">
                {members.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">{m.avatar}</div>
                      <div><p className="text-sm font-medium text-foreground">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeCls(m.kind)}`}>{badgeLbl(m.kind)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {detailTab === "setStatus" && (() => {
          const own = selectedKpi.subKpis || [];
          const entries = selectedKpi.id ? getEntriesForCard(selectedKpi.id) : [];
          const ownIds = new Set(own.map(s => s.id));
          const extras = entries
            .filter((e: any) => e.subKpiName && !ownIds.has(e.subKpiId))
            .map((e: any) => ({ id: e.subKpiId, name: e.subKpiName, assignee: e.assigneeName, isSet: true as const }));
          let merged: any[] = [
            ...own.map(s => ({ id: s.id, name: s.name, assignee: (s as any)?.evaluator?.persons?.[0]?.name || selectedKpi.responsible || "—", isSet: false as const })),
            ...extras,
          ];
          if (merged.length === 0) {
            merged = [{ id: 1, name: selectedKpi.name, assignee: selectedKpi.responsible || "—", isSet: false as const }];
          }
          const cardStatus = getStatusFor(selectedKpi.id).status;
          const isActive = cardStatus === "aktiv";
          const isDraft = cardStatus === "natamam";

          const emps = getEmployees();
          const norm = (s: string) => s.trim().toLowerCase();
          const posOf = (name: string) => {
            if (!name || name === "—") return "";
            const found = emps.find((e: any) => {
              const full1 = norm(`${e.firstName} ${e.lastName}`);
              const full2 = norm(`${e.lastName} ${e.firstName}`);
              return full1 === norm(name) || full2 === norm(name);
            });
            return (found as any)?.positionName || "";
          };

          return (
            <div className="bg-card rounded-lg border border-border p-4">
              <h4 className="font-semibold text-foreground mb-4">Təyin Statusu</h4>
              <div className="space-y-3">
                {merged.map((h, idx) => {
                  const done = isActive || (!isDraft && h.isSet);
                  const badge = done
                    ? { cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: <CheckCircle className="w-3 h-3" />, text: "Tamamlanıb" }
                    : isDraft
                    ? { cls: "bg-muted text-muted-foreground border-border", icon: <Clock className="w-3 h-3" />, text: "Natamam" }
                    : { cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", icon: <Clock className="w-3 h-3" />, text: "Gözləyir" };
                  const cardCls = done
                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-l-4 border-emerald-500 border border-emerald-500/20"
                    : isDraft
                    ? "bg-muted/40 border-l-4 border-muted-foreground/30 border border-border"
                    : "bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-500 border border-amber-500/20";
                  const position = posOf(h.assignee || "");
                  return (
                    <div key={idx} className={`flex items-center justify-between p-4 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${cardCls}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                        <p className="text-base font-bold text-foreground mt-1">
                          {h.assignee || "—"}
                          {position && <span className="text-xs font-normal text-muted-foreground ml-1">({position})</span>}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1 ${badge.cls}`}>{badge.icon} {badge.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {detailTab === "status" && (() => {
          const matrixId = selectedKpi.matrixId || null;
          const matrix = matrixId ? getApprovalMatrices().find(m => m.id === matrixId) : null;
          if (!matrix) {
            return (
              <div className="bg-card rounded-lg border border-border p-4 text-sm text-muted-foreground">
                Bu KPI kartı üçün təsdiqləmə matrisi seçilməyib.
              </div>
            );
          }
          const isApproved = selectedKpi.approvalStatus === "approved";
          const status = getStatusFor(selectedKpi.id).status;
          const totalSteps = matrix.steps.length;
          const chain = matrix.steps.map((s: any, i: number) => {
            const people = s.assignees.map((a: any) => formatAssignee(a)).join(", ") || s.label;
            let stStatus: "approved" | "pending" | "waiting" = "waiting";
            if (isApproved || status === "aktiv" || status === "tamamlanib" || status === "qiymetlendirme") stStatus = "approved";
            else if (status === "tesdiq_gozlenilir" && i === 0) stStatus = "pending";
            return { role: s.label, person: people, status: stStatus };
          });
          const completedSteps = chain.filter(s => s.status === "approved").length;
          const overallStatus = isApproved ? "Təsdiq edilib" : "Təsdiq gözləyir";
          const statusColor = overallStatus === "Təsdiq edilib" ? "bg-zone-green-bg text-zone-green-text" : "bg-zone-yellow-bg text-zone-yellow-text";

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Matris</p><p className="text-sm font-semibold text-foreground mt-1">{matrix.name}</p></div>
                <div className="bg-secondary rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Ümumi Status</p><span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>{overallStatus}</span></div>
                <div className="bg-secondary rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Progress</p><p className="text-lg font-bold text-foreground mt-1">{completedSteps}/{totalSteps}</p></div>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <h4 className="font-semibold text-foreground text-sm mb-4">Təsdiqləmə Matrisi</h4>
                <div className="space-y-3">
                  {chain.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        step.status === "approved" ? "bg-zone-green-bg text-zone-green-text" : step.status === "pending" ? "bg-zone-yellow-bg text-zone-yellow-text" : "bg-muted text-muted-foreground"
                      }`}>{step.status === "approved" ? <CheckCircle className="w-4 h-4" /> : i + 1}</div>
                      <div className="flex-1"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-foreground">{step.role}</p><p className="text-xs text-muted-foreground">{step.person}</p></div>
                        <div className="text-right">
                          {step.status === "approved" && <span className="text-xs text-zone-green-text">✓ Təsdiqləndi</span>}
                          {step.status === "pending" && <span className="text-xs text-zone-yellow-text">⏳ Gözləyir</span>}
                          {step.status === "waiting" && <span className="text-xs text-muted-foreground">Növbədə</span>}
                        </div>
                      </div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-success rounded-full h-2 transition-all" style={{ width: `${(completedSteps / totalSteps) * 100}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">{completedSteps} / {totalSteps} mərhələ tamamlandı</p>
            </div>
          );
        })()}
      </div>

      <Dialog open={!!outcomeDialog} onOpenChange={(o) => { if (!o) setOutcomeDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review nəticəsini qeyd et</DialogTitle></DialogHeader>
          {outcomeDialog && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nəticə</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button"
                    onClick={() => setOutcomeDialog({ ...outcomeDialog, status: "held" })}
                    className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${outcomeDialog.status === "held" ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-border hover:border-emerald-300"}`}>
                    Keçirildi
                  </button>
                  <button type="button"
                    onClick={() => setOutcomeDialog({ ...outcomeDialog, status: "deferred" })}
                    className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${outcomeDialog.status === "deferred" ? "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100" : "border-border hover:border-violet-300"}`}>
                    Təxirə salındı
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="outcome-comment">
                  {outcomeDialog.status === "held" ? "Müzakirə, qərar və nəticələr *" : "Təxirə salınma səbəbi *"}
                </Label>
                <Textarea id="outcome-comment" rows={4} className="mt-1"
                  placeholder={outcomeDialog.status === "held" ? "Review zamanı müzakirə olunanlar və qərarlar..." : "Səbəbi qeyd edin..."}
                  value={outcomeDialog.comment}
                  onChange={(e) => setOutcomeDialog({ ...outcomeDialog, comment: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOutcomeDialog(null)}>Ləğv et</Button>
            <Button onClick={() => {
              if (!outcomeDialog) return;
              if (!outcomeDialog.comment.trim()) {
                toast({ title: "Şərh məcburidir", variant: "destructive" });
                return;
              }
              setReviewOutcome(
                selectedKpi.id,
                withKartSuffix(selectedKpi.name),
                { startDate: selectedKpi.startDate, endDate: selectedKpi.endDate, frequency: selectedKpi.frequency },
                outcomeDialog.reviewId,
                { status: outcomeDialog.status, comment: outcomeDialog.comment.trim(), by: selectedKpi.responsible },
              );
              toast({ title: outcomeDialog.status === "held" ? "Review keçirildi kimi qeyd olundu" : "Review təxirə salındı" });
              setOutcomeDialog(null);
            }}>Yadda saxla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default KpiDetailView;
