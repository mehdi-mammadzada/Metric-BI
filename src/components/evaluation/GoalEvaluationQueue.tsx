// Hədəf qiymətləndirmə növbəsi — "Gözləyən" və "Tamamlanan" tabları.
// Yalnız qiymətləndirmə mərhələsinə keçmiş kartların, cari istifadəçinin
// qiymətləndiricisi olduğu hədəfləri göstərilir. Tamamlanan hədəflər yalnız baxış üçündür.
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Award, ClipboardCheck, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withKartSuffix } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { calcCompletion, isEvaluated, type SubKpi } from "@/lib/kpiEvaluationStore";
import { useEvaluatorGoals, type EvaluatorGoalRow } from "@/lib/goalEvaluationQueue";
import { KpiEvalDialog } from "@/components/evaluation/KpiEvaluationSection";
import { RatingCircles } from "@/components/evaluation/RatingCircles";

const pctTone = (pct: number) => {
  if (pct >= 100) return "bg-zone-green-bg text-zone-green-text";
  if (pct >= 75) return "bg-zone-yellow-bg text-zone-yellow-text";
  return "bg-zone-red-bg text-zone-red-text";
};

const fmtEval = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString("az-AZ") : n.toLocaleString("az-AZ", { maximumFractionDigits: 2 });

const MiniHeaderStat = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) => (
  <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
    <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${accent || "text-primary"}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${accent || "text-foreground"}`}>{value}</div>
    </div>
  </div>
);

export const GoalEvaluationQueue = () => {
  const { user } = useAuth();
  const rows = useEvaluatorGoals(user);
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [viewing, setViewing] = useState<SubKpi | null>(null);
  const [viewReadOnly, setViewReadOnly] = useState(false);

  const pending = useMemo(() => rows.filter(r => !isEvaluated(r)), [rows]);
  const done = useMemo(() => rows.filter(isEvaluated), [rows]);
  const active = tab === "pending" ? pending : done;

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; cardName: string; period: string; items: EvaluatorGoalRow[] }>();
    active.forEach(r => {
      const key = r.cardId;
      if (!map.has(key)) map.set(key, { key, cardName: r.cardName, period: r.period, items: [] });
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values());
  }, [active]);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MiniHeaderStat icon={Award} label="Kart" value={new Set(rows.map(r => r.cardId)).size} accent="text-indigo-600" />
        <MiniHeaderStat icon={Clock} label="Gözləyən" value={pending.length} accent="text-amber-600" />
        <MiniHeaderStat icon={CheckCircle2} label="Tamamlanan" value={done.length} accent="text-emerald-600" />
      </div>

      <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-border bg-card mb-4">
        {([["pending", `Gözləyən (${pending.length})`], ["done", `Tamamlanan (${done.length})`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              tab === k ? "bg-emerald-600 text-white" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {tab === "pending"
              ? "Qiymətləndirmə gözləyən hədəf yoxdur."
              : "Qiymətləndirilmiş hədəf yoxdur."}
          </div>
        ) : groups.map(g => {
          const isOpen = openMap[g.key] ?? true;
          return (
            <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <button
                onClick={() => setOpenMap(o => ({ ...o, [g.key]: !isOpen }))}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-foreground truncate">{withKartSuffix(g.cardName)}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {g.items.length} hədəf
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{g.period}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-600 text-white">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Hədəf</th>
                        <th className="text-left px-4 py-3 font-medium">Əməkdaş</th>
                        <th className="text-right px-4 py-3 font-medium">Hədəf</th>
                        <th className="text-right px-4 py-3 font-medium">Faktiki</th>
                        <th className="text-right px-4 py-3 font-medium">İcra %</th>
                        <th className="text-center px-4 py-3 font-medium">Çəki</th>
                        <th className="text-center px-4 py-3 font-medium">Yekun bal</th>
                        <th className="text-center px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Əməliyyat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(k => {
                        const ev = isEvaluated(k);
                        const pct = calcCompletion(k);
                        return (
                          <tr key={k.id} className="border-t border-border hover:bg-secondary/20">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{k.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{k.description}</p>
                            </td>
                            <td className="px-4 py-3 text-foreground">{k.assigneeName}</td>
                            <td className="px-4 py-3 text-right text-foreground tabular-nums">{fmtEval(k.target)} {k.unit}</td>
                            <td className="px-4 py-3 text-right text-foreground tabular-nums">
                              {k.actual !== undefined ? `${fmtEval(k.actual)} ${k.unit}` : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {ev ? (
                                <span className={`inline-flex items-center justify-end px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${pctTone(pct)}`}>
                                  {pct.toFixed(0)}%
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{k.weight}%</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center">
                                {ev ? (
                                  <RatingCircles value={k.evaluatedScore ?? 0} size="sm" readOnly showLabel={false} />
                                ) : <span className="text-muted-foreground text-xs">—</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {ev ? (
                                <Badge className="bg-zone-green-bg text-zone-green-text hover:bg-zone-green-bg gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Qiymətləndirilib
                                </Badge>
                              ) : (
                                <Badge className="bg-zone-yellow-bg text-zone-yellow-text hover:bg-zone-yellow-bg gap-1">
                                  <Clock className="w-3 h-3" /> Gözləyir
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant={ev ? "outline" : "default"}
                                className="gap-1"
                                onClick={() => { setViewReadOnly(ev); setViewing(k); }}
                              >
                                {ev ? <><Eye className="w-3.5 h-3.5" /> Bax</> : "Qiymətləndir"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
              )}
            </div>
          );
        })}
      </div>

      {viewing && (
        <KpiEvalDialog item={viewing} readOnly={viewReadOnly} onClose={() => setViewing(null)} />
      )}
    </>
  );
};


export default GoalEvaluationQueue;
