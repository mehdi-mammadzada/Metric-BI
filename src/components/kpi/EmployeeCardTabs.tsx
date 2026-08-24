// Əməkdaşlar üzrə KPI kartı üçün əlavə tabların məzmunu:
// Hədəflər / Performans dinamikası / Reviewlər.
import { useEffect, useMemo, useState } from "react";
import { Clock, MessageSquare } from "lucide-react";
import { withKartSuffix } from "@/lib/utils";
import KpiAccordionList, { type AccordionKpi } from "@/components/kpi/KpiAccordionList";
import PerformanceDynamicsDrilldownTab from "@/components/kpi/PerformanceDynamicsDrilldownTab";
import { REVIEW_STATUS_STYLES } from "@/components/kpi/LifecycleView";
import { computeReviewStatus, getLifecycleWithFallback } from "@/lib/kpiLifecycleStore";
import { getAssignedTargetValues } from "@/lib/kpiSetStore";
import {
  fetchKpiComments,
  formatCommentDate,
  getCachedComments,
  KPI_COMMENTS_EVT,
  type KpiComment,
} from "@/lib/kpiCommentsService";

export type EmployeeCardTab = "empTargets" | "empDynamics" | "empReviews";

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

interface Props {
  card: any;
  tab: EmployeeCardTab;
  /** Əməkdaş adı — verildikdə şərhlər yalnız bu əməkdaşa aid oxunur. */
  employeeName?: string | null;
}

/** Əməkdaş səviyyəli şərh referansı — reviewlar və kart görünüşü eyni açardan istifadə edir. */
export const employeeCommentRef = (cardId: string | number, employeeKey: string | number) =>
  `card:${cardId}:emp:${String(employeeKey).trim().toLowerCase().replace(/\s+/g, " ")}`;

export default function EmployeeCardTabs({ card, tab, employeeName }: Props) {

  const accordionItems: AccordionKpi[] = useMemo(() => {
    if (!card) return [];
    // Hədəf dəyərləri vahid mənbədən: rəhbərin təyin etdiyi aktual dəyər üstündür.
    const cardId = Number(card.id);
    const assigned = Number.isFinite(cardId) ? getAssignedTargetValues(cardId) : new Map();
    const key = (v: unknown) => String(v ?? "").split(" — ")[0].trim().toLowerCase().replace(/\s+/g, " ");
    return [{
      id: card.id,
      name: card.name,
      createdAt: card.startDate || card.createdAt || "—",
      deadline: card.endDate || card.deadline || "—",
      status: "in_progress",
      targets: (card.subKpis || []).map((sk: any, i: number) => {
        const name = sk.name || `Hədəf ${i + 1}`;
        const a = assigned.get(key(name));
        return {
          id: String(sk.id ?? i),
          name,
          plan: a ? a.value : toNum(sk.target),
          fakt: toNum(sk.current),
          unit: a?.unit || sk.unit || "",
        };
      }),
    }];
  }, [card]);


  const reviews = useMemo(() => {
    if (!card) return [];
    const lc = getLifecycleWithFallback(card.id, withKartSuffix(card.name), {
      startDate: card.startDate, endDate: card.endDate, frequency: card.frequency,
    });
    return lc?.reviews || [];
  }, [card]);

  // KPI kartına yazılmış şərhlər — əməkdaş görünüşündə yalnız həmin əməkdaşın şərhləri.
  const cardRef = card ? (employeeName ? employeeCommentRef(card.id, employeeName) : `card:${card.id}`) : null;

  const [cardComments, setCardComments] = useState<KpiComment[]>(() => getCachedComments(cardRef));
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterDate, setFilterDate] = useState("");
  useEffect(() => {
    if (!cardRef) return;
    setCardComments(getCachedComments(cardRef));
    void fetchKpiComments(cardRef).then(setCardComments);
    const onEvt = () => setCardComments(getCachedComments(cardRef));
    window.addEventListener(KPI_COMMENTS_EVT, onEvt);
    window.addEventListener("storage", onEvt);
    return () => {
      window.removeEventListener(KPI_COMMENTS_EVT, onEvt);
      window.removeEventListener("storage", onEvt);
    };
  }, [cardRef]);

  if (!card) return null;


  if (tab === "empTargets") {
    return <KpiAccordionList items={accordionItems} emptyLabel="Bu əməkdaş üçün hədəf tapılmadı." />;
  }

  if (tab === "empDynamics") {
    return <PerformanceDynamicsDrilldownTab kpi={card} />;
  }

  const reviewer = (card.team && card.team[0]?.name) || card.responsible || "—";
  const authors = Array.from(new Set(cardComments.map(c => c.author).filter(Boolean)));
  const filteredComments = cardComments.filter(c => {
    if (filterAuthor && c.author !== filterAuthor) return false;
    if (filterDate) {
      const d = new Date(c.createdAt);
      const iso = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      if (iso !== filterDate) return false;
    }
    return true;
  });


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
          {reviews.map((r: any, i: number) => {
            const computed = computeReviewStatus(r);
            const styleDef = REVIEW_STATUS_STYLES[computed];
            const BadgeIcon = styleDef.badgeIcon;
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
                    <div className="mt-2 p-2 rounded-md border border-border bg-secondary/40">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {computed === "deferred" ? "Təxirə salınma səbəbi" : "Review nəticəsi"}
                      </p>
                      <p className="text-xs text-foreground mt-0.5 break-words whitespace-pre-wrap">{r.outcomeComment}</p>
                    </div>
                  )}

                  {/* Review şərhləri — kart üzrə yazılmış şərhlər (oxunur) */}
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" /> Review şərhləri
                      </p>
                      <div className="flex items-center gap-2">
                        <select
                          value={filterAuthor}
                          onChange={e => setFilterAuthor(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
                        >
                          <option value="">Bütün müəlliflər</option>
                          {authors.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <input
                          type="date"
                          value={filterDate}
                          onChange={e => setFilterDate(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
                        />
                        {(filterAuthor || filterDate) && (
                          <button
                            type="button"
                            onClick={() => { setFilterAuthor(""); setFilterDate(""); }}
                            className="text-xs px-2 py-1 rounded border border-border bg-background text-muted-foreground hover:text-foreground"
                          >
                            Sıfırla
                          </button>
                        )}
                      </div>
                    </div>
                    {filteredComments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-lg">
                        {cardComments.length === 0 ? "Bu KPI kartı üzrə şərh yazılmayıb." : "Filtrə uyğun şərh tapılmadı."}
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border bg-background/60 divide-y divide-border">
                        {[...filteredComments].reverse().map(c => (
                          <div key={c.id} className="flex gap-2.5 p-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary shrink-0 flex items-center justify-center text-[10px] font-semibold">
                              {(c.author || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{c.author}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">{formatCommentDate(c.createdAt)}</span>
                              </div>
                              <p className="text-sm text-foreground mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
