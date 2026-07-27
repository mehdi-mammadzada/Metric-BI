import { useMemo } from "react";
import { User as UserIcon, Sliders } from "lucide-react";
import { getEntriesForCard, type LimitSet, TIER_LABELS } from "@/lib/kpiSetStore";

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

const perspectiveByDept: Record<string, string> = {
  "Satış Departamenti": "Maliyyə",
  "Marketinq": "Müştəri",
  "Müştəri Xidmətləri": "Müştəri",
  "Əməliyyatlar": "Daxili Proseslər",
  "R&D": "Öyrənmə və İnkişaf",
  "Audit Departamenti": "Daxili Proseslər",
};

const parseNum = (v: string): number => {
  if (!v) return 0;
  const s = String(v).replace(/\s+/g, "").replace(",", ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  let n = parseFloat(m[0]);
  if (/m/i.test(s)) n *= 1_000_000;
  else if (/k/i.test(s)) n *= 1_000;
  return n;
};

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const gsrToScore = (gsr: number) => {
  if (gsr >= 90) return 5;
  if (gsr >= 80) return 4;
  if (gsr >= 60) return 3;
  if (gsr >= 40) return 2;
  return 1;
};

const gsrTone = (gsr: number) => {
  if (gsr >= 95) return { bg: "bg-zone-green-bg", text: "text-zone-green-text", label: "Əla Performans", barColor: "bg-zone-green-text" };
  if (gsr >= 80) return { bg: "bg-zone-yellow-bg", text: "text-zone-yellow-text", label: "Yaxşı Performans", barColor: "bg-zone-yellow-text" };
  return { bg: "bg-zone-red-bg", text: "text-zone-red-text", label: "Aşağı Performans", barColor: "bg-zone-red-text" };
};

const scoreLabels = ["", "Aşağı", "Orta-Aşağı", "Orta", "Yaxşı", "Çox Yaxşı"];

const isInverse = (type: string, name: string) => {
  const k = `${type} ${name}`.toLowerCase();
  return /(xərc|müddət|şikayət|cost|time|defect|qüsur)/i.test(k);
};

// Vahidə görə dəyər formatla (faiz isə % əlavə et)
const fmtUnit = (n: number, unit: string) => {
  const isPct = unit === "%" || /faiz/i.test(unit);
  if (isPct) return `${Math.round(n)}%`;
  return `${fmt(n)} ${unit}`.trim();
};

// % aralıqlarını hədəfə görə vahid aralığına çevir
const unitRangesFromTarget = (target: number, unit: string) => {
  const pcts = [
    { from: 0, to: 39, score: 1, label: "Aşağı", tone: "bg-zone-red-bg text-zone-red-text" },
    { from: 40, to: 59, score: 2, label: "Orta-Aşağı", tone: "bg-zone-red-bg/60 text-zone-red-text" },
    { from: 60, to: 79, score: 3, label: "Orta", tone: "bg-zone-yellow-bg text-zone-yellow-text" },
    { from: 80, to: 89, score: 4, label: "Yaxşı", tone: "bg-zone-green-bg/70 text-zone-green-text" },
    { from: 90, to: 100, score: 5, label: "Çox Yaxşı", tone: "bg-zone-green-bg text-zone-green-text" },
  ];
  const isPct = unit === "%" || /faiz/i.test(unit) || !target;
  return pcts.map(p => ({
    ...p,
    rangeText: isPct
      ? `${p.from}% - ${p.to}${p.score === 5 ? "%+" : "%"}`
      : `${fmtUnit((target * p.from) / 100, unit)} – ${fmtUnit((target * p.to) / 100, unit)}`,
  }));
};

export default function BscScorecardTab({ kpi }: { kpi: KpiLike }) {
  const target = parseNum(kpi.target);
  const actual = parseNum(kpi.current);
  const inverse = isInverse(kpi.type, kpi.name);
  const gsr = inverse
    ? (actual === 0 ? 0 : (target / actual) * 100)
    : (target === 0 ? 0 : (actual / target) * 100);
  const gsrClamped = Math.max(0, Math.min(150, gsr));
  const score = gsrToScore(gsr);
  const tone = gsrTone(gsr);
  const perspective = perspectiveByDept[kpi.department] || "Daxili Proseslər";
  const unit = kpi.unit || "";

  const formulaText = inverse
    ? "GSR = ( Hədəf Dəyər / Faktiki Dəyər ) × 100"
    : "GSR = ( Faktiki Dəyər / Hədəf Dəyər ) × 100";
  const sampleText = inverse
    ? `GSR = ( ${fmt(target)} / ${fmt(actual)} ) × 100`
    : `GSR = ( ${fmt(actual)} / ${fmt(target)} ) × 100`;

  const ranges = useMemo(() => unitRangesFromTarget(target, unit), [target, unit]);

  // KPI Set entry-lərini hədəf kimi birləşdir
  const mergedSubKpis = useMemo(() => {
    const own = kpi.subKpis || [];
    if (!kpi.id) return own.map(s => ({ ...s, _entryId: null as string | null, limits: undefined as LimitSet | undefined }));
    const entries = getEntriesForCard(kpi.id);
    const ownById = new Map(own.map(s => [s.id, s]));
    const list: any[] = own.map((s: any) => {
      const e = entries.find(en => en.subKpiId === s.id);
      // Wizard-dan gələn subKpi.limits/scoreDescriptions üstünlük təşkil edir
      return { ...s, _entryId: e?.id ?? null, limits: s.limits ?? e?.limits, scoreDescriptions: s.scoreDescriptions ?? e?.scoreDescriptions, assignerFromSet: e?.assigneeName, unit: s.unit || e?.unit };
    });
    // KPI Set-də olan, kartda olmayan hədəf-lar
    entries.forEach(e => {
      if (!ownById.has(e.subKpiId) && e.subKpiName) {
        list.push({
          id: e.subKpiId,
          name: e.subKpiName,
          target: e.target,
          unit: e.unit,
          weight: 0,
          assignerFromSet: e.assigneeName,
          limits: e.limits,
          _entryId: e.id,
        });
      }
    });
    return list;
  }, [kpi.id, kpi.subKpis]);

  

  return (
    <div className="space-y-3">
      {/* Üfüqi kompakt göstərici kartları */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Perspektiv", value: perspective, sub: kpi.department || "—" },
          { label: "Hədəf", value: fmtUnit(target, unit), sub: "Plan" },
          { label: "Faktiki", value: fmtUnit(actual, unit), sub: "Cari nəticə" },
          { label: "GSR", value: `${Math.round(gsrClamped)}%`, sub: tone.label },
          { label: "Bal", value: `${score}/5`, sub: scoreLabels[score] || "—" },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold text-foreground truncate">{item.value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] text-muted-foreground">{formulaText}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>{sampleText}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${tone.barColor}`} style={{ width: `${Math.min(100, gsrClamped)}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {ranges.map(r => (
            <div key={r.score} className={`rounded-md px-2 py-1 text-center ${r.tone}`}>
              <p className="text-[10px]">{r.label}</p>
              <p className="text-[10px] font-semibold tabular-nums">{r.rangeText}</p>
            </div>
          ))}
        </div>
      </div>

          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Hədəflər ({mergedSubKpis.length})</p>
            <span className="text-[10px] text-muted-foreground">Hər hədəfin çəkisi, dəyəri və qiymət limitləri</span>
          </div>
          <div className="divide-y divide-border">
            {mergedSubKpis.map(sk => {
              const assigner =
                sk.assigner ||
                sk.assignerFromSet ||
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

