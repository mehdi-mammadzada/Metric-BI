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
}

export default function EmployeeCardTabs({ card, tab }: Props) {
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

  // KPI kartına (ümumi kart səviyyəsində) yazılmış şərhlər — yalnız oxunur.
  const cardRef = card ? `card:${card.id}` : null;
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
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI kartına yazılmış şərhlər (KPI izlənməsi → Reviewlər kartından) */}
      <div className="mt-5 pt-4 border-t border-border">
        <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Kart üzrə şərhlər
        </h4>
        {cardComments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6 border border-dashed border-border rounded-lg">
            Bu KPI kartı üzrə şərh yazılmayıb.
          </p>
        ) : (
          <div className="space-y-2.5">
            {[...cardComments].reverse().map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary shrink-0 flex items-center justify-center text-xs font-semibold">
                  {(c.author || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs">
                    <span className="font-medium text-foreground">{c.author}</span>
                    <span className="text-muted-foreground"> · {formatCommentDate(c.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-sm text-foreground rounded-lg bg-secondary/50 border border-border px-3 py-2 break-words whitespace-pre-wrap">{c.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
