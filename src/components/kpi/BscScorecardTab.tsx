import { useEffect, useMemo, useState } from "react";
import { User as UserIcon, Sliders } from "lucide-react";
import { type LimitSet, TIER_LABELS } from "@/lib/kpiSetStore";
import { mergeCardTargets } from "@/lib/targetMerge";


interface SubKpiLike {
  id: number;
  name: string;
  target?: string;
  unit?: string;
  weight?: number;
  evaluator?: { type?: string | null; persons?: { name: string; weight: number }[]; integrationName?: string };
  assigner?: string;
}

interface KpiLike {
  id?: number;
  name: string;
  target: string;
  current: string;
  unit: string;
  type: string;
  department: string;
  weight: number;
  formula?: string;
  subKpis?: SubKpiLike[];
}

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// Vahidə görə dəyər formatla (faiz isə % əlavə et)
const fmtUnit = (n: number, unit: string) => {
  const isPct = unit === "%" || /faiz/i.test(unit);
  if (isPct) return `${Math.round(n)}%`;
  return `${fmt(n)} ${unit}`.trim();
};

export default function BscScorecardTab({ kpi }: { kpi: KpiLike }) {
  // Store yeniləndikdə (cloud sinxronizasiya, limit təyini) yenidən oxunsun ki,
  // Balanced Scorecard heç vaxt itməsin.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onUpd = () => setTick(t => t + 1);
    window.addEventListener("kpi-set-updated", onUpd);
    window.addEventListener("shared-kpi-cards-updated", onUpd);
    window.addEventListener("kpi-cards-updated", onUpd);
    return () => {
      window.removeEventListener("kpi-set-updated", onUpd);
      window.removeEventListener("shared-kpi-cards-updated", onUpd);
      window.removeEventListener("kpi-cards-updated", onUpd);
    };
  }, []);

  // KPI Set entry-lərini hədəf kimi birləşdir (vahid məntiq)
  const mergedSubKpis = useMemo(
    () => mergeCardTargets(kpi.id, (kpi.subKpis || []) as any[]) as any[],
    [kpi.id, kpi.subKpis, tick]
  );



  return (
    <div className="space-y-3">
      {mergedSubKpis.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">Bu kart üçün hədəf təyin edilməyib.</p>
      )}





      {mergedSubKpis.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">

            <p className="text-xs font-medium text-foreground">Hədəflər ({mergedSubKpis.length})</p>
            <span className="text-[10px] text-muted-foreground">Hər hədəfin çəkisi, dəyəri və qiymət limitləri</span>
          </div>
          <div className="divide-y divide-border">
            {mergedSubKpis.map(sk => {
              const assigner =
                sk.assignerName ||
                sk.assigner ||
                (sk.evaluator?.persons?.length ? sk.evaluator.persons.map((p: any) => p.name).join(", ") : null);

              const limits: LimitSet | undefined = sk.limits;
              return (
                <div key={sk.id} className="px-3 py-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">{sk.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {typeof sk.weight === "number" && sk.weight > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Çəki: {sk.weight}%
                        </span>
                      )}
                      {sk.target && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground">
                          Hədəf: {sk.target} {sk.unit || ""}
                        </span>
                      )}
                      {assigner && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          <UserIcon className="w-3 h-3" /> {assigner}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                    <Sliders className="w-3 h-3 text-primary" />
                    Qiymət Limitləri
                  </div>
                  {limits ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {TIER_LABELS.map(({ tier, label }) => {
                        const r = limits[tier];
                        return (
                          <div
                            key={tier}
                            className="rounded-md border border-border bg-background px-2 py-1.5 text-center"
                          >
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className="text-[11px] font-semibold tabular-nums mt-0.5 text-foreground">
                              {fmtUnit(r.min, sk.unit || "")} – {fmtUnit(r.max, sk.unit || "")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (sk.scoreDescriptions && sk.scoreDescriptions.length > 0) ? (

                    <div className="grid grid-cols-5 gap-1.5">
                      {[1,2,3,4,5].map(s => {
                        const row = sk.scoreDescriptions!.find((d: any) => Number(d.score) === s);
                        return (
                          <div key={s} className="rounded-md border border-border bg-background px-2 py-1.5 text-center">
                            <p className="text-[10px] text-muted-foreground">Bal {s}</p>
                            <p className="text-[11px] font-medium text-foreground truncate">{row?.description || "—"}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Hələ limit təyin olunmayıb.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

