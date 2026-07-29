// Əməkdaşlar üzrə KPI kart görünüşü — "Toplu KPI kartları" (KPI İzlənməsi)
// məntiqi ilə: Hədəflər / Performans dinamikası / Reviewlər tabları.
import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock } from "lucide-react";
import { withKartSuffix } from "@/lib/utils";
import KpiAccordionList, { type AccordionKpi } from "@/components/kpi/KpiAccordionList";
import PerformanceDynamicsDrilldownTab from "@/components/kpi/PerformanceDynamicsDrilldownTab";
import { REVIEW_STATUS_STYLES } from "@/components/kpi/LifecycleView";
import { computeReviewStatus, getLifecycleWithFallback } from "@/lib/kpiLifecycleStore";

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

interface Props {
  card: any | null;
  employeeName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Əvvəlki (tam) kart detalları görünüşünü açır. */
  onOpenFullDetails?: () => void;
}

export default function EmployeeCardDetailDialog({ card, employeeName, open, onOpenChange, onOpenFullDetails }: Props) {
  const accordionItems: AccordionKpi[] = useMemo(() => {
    if (!card) return [];
    return [{
      id: card.id,
      name: card.name,
      createdAt: card.startDate || card.createdAt || "—",
      deadline: card.endDate || card.deadline || "—",
      status: "in_progress",
      targets: (card.subKpis || []).map((sk: any, i: number) => ({
        id: String(sk.id ?? i),
        name: sk.name || `Hədəf ${i + 1}`,
        plan: toNum(sk.target),
        fakt: toNum(sk.current),
        unit: sk.unit || "",
      })),
    }];
  }, [card]);

  const reviews = useMemo(() => {
    if (!card) return [];
    const lc = getLifecycleWithFallback(card.id, withKartSuffix(card.name), {
      startDate: card.startDate, endDate: card.endDate, frequency: card.frequency,
    });
    return lc?.reviews || [];
  }, [card]);

  if (!card) return null;

  const reviewer = (card.team && card.team[0]?.name) || card.responsible || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            {withKartSuffix(card.name)}
            {employeeName ? <span className="text-muted-foreground font-normal"> · {employeeName}</span> : null}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="targets" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="targets">Hədəflər</TabsTrigger>
            <TabsTrigger value="dynamics">Performans dinamikası</TabsTrigger>
            <TabsTrigger value="reviews">Reviewlər</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto pt-4">
            <TabsContent value="targets" className="mt-0">
              <KpiAccordionList items={accordionItems} emptyLabel="Bu əməkdaş üçün hədəf tapılmadı." />
            </TabsContent>

            <TabsContent value="dynamics" className="mt-0">
              <PerformanceDynamicsDrilldownTab kpi={card} />
            </TabsContent>

            <TabsContent value="reviews" className="mt-0">
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
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
