// Yalnız seçilmiş hədəfə aid REAL detal — sağ tərəfdən açılan drawer.
// Pop-up (dialog) açılmır. Heç bir mock şərh/tarixçə göstərilmir.
import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AccordionTarget } from "./KpiAccordionList";
import { getKpiSetEntries } from "@/lib/kpiSetStore";
import { getAllLifecycles, formatStagePeriod, type CardLifecycle } from "@/lib/kpiLifecycleStore";
import { getSharedKpiCards } from "@/lib/kpiCardStore";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kpiName: string;
  target: AccordionTarget | null;
  deadline?: string;
  status?: string;
}

const toNumber = (v: number | string | undefined): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number | string | undefined): string => {
  const n = toNumber(v);
  if (!n && v !== 0 && v !== "0") return String(v ?? "—");
  return new Intl.NumberFormat("az-AZ").format(n);
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*kart[ıi]$/i, "");

const TargetDetailDialog = ({ open, onOpenChange, kpiName, target, deadline, status }: Props) => {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onOpenChange]);

  const limits = useMemo(() => {
    if (!target) return null;
    const entry = getKpiSetEntries().find(
      e => normalize(e.subKpiName || "") === normalize(target.name) &&
           (!kpiName || normalize(e.cardName || "") === normalize(kpiName)),
    );
    return entry?.limits ?? null;
  }, [target, kpiName]);

  const lifecycle: CardLifecycle | null = useMemo(() => {
    if (!kpiName) return null;
    const card = getSharedKpiCards().find(c => normalize(c.name) === normalize(kpiName));
    const all = getAllLifecycles();
    return (
      all.find(l => (card?.numericId != null && l.cardId === card.numericId)) ||
      all.find(l => normalize(l.cardName) === normalize(kpiName)) ||
      null
    );
  }, [kpiName]);

  if (!open || !target) return null;
  const plan = toNumber(target.plan);
  const fakt = toNumber(target.fakt);
  const pct = plan ? Math.round((fakt / plan) * 100) : 0;
  const unit = target.unit ? (target.unit === "AZN" ? " ₼" : ` ${target.unit}`) : "";

  return (
    <aside className="fixed top-0 right-0 h-screen w-full sm:w-[560px] bg-card border-l border-border shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">Hədəf: {target.name}</h3>
          <p className="text-xs text-muted-foreground truncate">KPI: {kpiName || "—"}</p>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="w-8 h-8 shrink-0 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Bağla"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Plan" value={`${fmt(target.plan)}${unit}`} />
          <Stat label="Fakt" value={`${fmt(target.fakt)}${unit}`} />
          <Stat label="İcra %" value={`${pct}%`} />
          <Stat label="Deadline" value={deadline || "—"} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">İcra faizi</span>
            {status && <Badge variant="outline">{status}</Badge>}
          </div>
          <Progress value={Math.min(pct, 100)} />
        </div>

        <Section title="Balanced Scorecard — qiymət limitləri">
          {!limits ? (
            <p className="text-xs text-muted-foreground italic">Bu hədəf üçün qiymət limitləri təyin edilməyib.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Bal</th>
                    <th className="text-right px-3 py-2 font-medium">Min dəyər</th>
                    <th className="text-right px-3 py-2 font-medium">Max dəyər</th>
                  </tr>
                </thead>
                <tbody>
                  {(["l1", "l2", "l3", "l4", "l5"] as const).map((tier, i) => {
                    const r = (limits as any)[tier] || {};
                    return (
                      <tr key={tier} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.min ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.max ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Lifecycle">
          {!lifecycle ? (
            <p className="text-xs text-muted-foreground italic">Bu KPI kartı üçün lifecycle təyin edilməyib.</p>
          ) : (
            <div className="space-y-1.5">
              <LifeRow label="Təyinat" value={formatStagePeriod(lifecycle.assignment)} />
              <LifeRow label="Qiymətləndirmə" value={formatStagePeriod(lifecycle.evaluation)} />
              <LifeRow label="Bonus" value={formatStagePeriod(lifecycle.bonus)} />
              <LifeRow
                label="Reviewlar"
                value={lifecycle.reviews?.length ? `${lifecycle.reviews.length} review` : "Review təyin edilməyib"}
              />
            </div>
          )}
        </Section>
      </div>
    </aside>
  );
};

const LifeRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-secondary/40">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium">{value || "—"}</span>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="p-2.5 rounded-lg border border-border bg-card">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
    <div className="space-y-1.5">{children}</div>
  </div>
);

export default TargetDetailDialog;
