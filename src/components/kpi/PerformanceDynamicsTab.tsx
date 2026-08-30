// PerformanceDynamicsTab — KPI kartında "Performans Dinamikası" tabının yeni drill-down versiyası.
// Level 1: KPI hədəfləri siyahısı (accordion)
// Level 2: Hər hədəf açıldıqda dövr kartları (Aylıq/Rüblük/Həftəlik/İllik/Gündəlik)
// Level 3: Dövr kartına klik → Popover Calendar (yalnız məlumat olan günlər vurğulanır, hover → tooltip)

import { useMemo, useState } from "react";
import {
  ChevronDown, Calendar as CalendarIcon, Target as TargetIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { KpiCard } from "@/lib/kpiCardTypes";
import { mergeCardTargets } from "@/lib/targetMerge";
import { TARGET_STATUS_LABEL, type TargetStatus } from "@/lib/targetStatus";

// ── Status helpers ────────────────────────────────────────────────────────────
// Hədəf statusları sistem üzrə yalnız 3-dür.
type DayStatus = TargetStatus;
const STATUS_META: Record<DayStatus, { label: string; dot: string; text: string; bg: string; }> = {
  in_progress:  { label: TARGET_STATUS_LABEL.in_progress,  dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-500/10" },
  achieved:     { label: TARGET_STATUS_LABEL.achieved,     dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  not_achieved: { label: TARGET_STATUS_LABEL.not_achieved, dot: "bg-rose-500",    text: "text-rose-700 dark:text-rose-300",       bg: "bg-rose-50 dark:bg-rose-500/10" },
};
const statusFromPct = (p: number): DayStatus => (p >= 100 ? "achieved" : "in_progress");

// ── Deterministic pseudo-random (seed-based) ─────────────────────────────────
const seedRand = (seed: number) => {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};

// ── Period types ─────────────────────────────────────────────────────────────
interface DayPoint {
  day: number;               // 1..31
  current: number;
  target: number;
  pct: number;
  status: DayStatus;
  trend: number;             // +/- pct vs previous
  updated: string;           // HH:MM
}
interface PeriodBucket {
  key: string;
  label: string;             // "İyun 2026" / "Q1" / "Week 1"
  year: number;
  month: number;             // 1..12 (0 if quarter root)
  isCurrent: boolean;
  current: number;
  target: number;
  pct: number;
  trend: number;
  status: DayStatus;
  lastUpdate: string;        // "24.06.2026"
  daysInMonth: number;
  monthStartWeekday: number; // 0..6 (Mon=0)
  points: DayPoint[];        // days having data
}

const MONTHS_AZ = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
const WEEKDAY_LABELS = ["B.e","Ç.a","Ç","C.a","C","Ş","B"];

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
// weekday of the 1st, Mon=0..Sun=6
const monthStartWeekday = (y: number, m: number) => {
  const js = new Date(y, m - 1, 1).getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
};
const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (y: number, m: number, d: number) => `${pad2(d)}.${pad2(m)}.${y}`;

// Real dataya əsaslanan aylıq bucket. Sistemə faktiki nəticə daxil edilməyibsə,
// heç bir sintetik gün/dəyər yaradılmır — cari dəyər 0 qalır.
const buildMonthBucket = (
  _seed: number, year: number, month: number, _targetName: string, isCurrent: boolean, baseTarget: number,
): PeriodBucket => {
  const dim = daysInMonth(year, month);
  const points: DayPoint[] = [];
  return {
    key: `${year}-${pad2(month)}`,
    label: `${MONTHS_AZ[month - 1]} ${year}`,
    year, month, isCurrent,
    current: 0, target: baseTarget, pct: 0, trend: 0,
    status: statusFromPct(0),
    lastUpdate: "—",
    daysInMonth: dim,
    monthStartWeekday: monthStartWeekday(year, month),
    points,
  };
};


const parseTargetNumber = (t?: string): number => {
  if (!t) return 0;
  const n = parseFloat(String(t).replace(/[^\d.\-]/g, ""));
  return isNaN(n) || n <= 0 ? 0 : n;
};

// Build periods for a target based on card frequency.
const buildPeriods = (freq: string, cardId: number, targetIdx: number, targetName: string, baseTarget: number): {
  mode: "monthly" | "quarterly" | "weekly" | "yearly" | "daily";
  buckets: PeriodBucket[];
} => {
  const now = new Date();
  const year = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const seed = cardId * 1000 + targetIdx * 37 + 1;
  const f = (freq || "").toLowerCase();

  if (f.includes("gündəlik") || f.includes("daily")) {
    // Yalnız cari ay
    return { mode: "daily", buckets: [buildMonthBucket(seed, year, curMonth, targetName, true, baseTarget)] };
  }
  if (f.includes("həftəlik") || f.includes("weekly")) {
    // 4 həftə (cari ay daxilində)
    const base = buildMonthBucket(seed, year, curMonth, targetName, true, baseTarget);
    const wk: PeriodBucket[] = [];
    for (let w = 0; w < 4; w++) {
      const startDay = w * 7 + 1;
      const endDay = Math.min(startDay + 6, base.daysInMonth);
      const pts = base.points.filter(p => p.day >= startDay && p.day <= endDay);
      const avgPct = pts.length ? Math.round(pts.reduce((a, p) => a + p.pct, 0) / pts.length) : 0;
      wk.push({
        ...base,
        key: `w${w}`,
        label: `Həftə ${w + 1}`,
        month: curMonth,
        isCurrent: startDay <= now.getDate() && now.getDate() <= endDay,
        pct: avgPct,
        status: statusFromPct(avgPct),
        points: pts,
      });
    }
    return { mode: "weekly", buckets: wk };
  }
  if (f.includes("rüb") || f.includes("quarter")) {
    // 4 rüb (Q1..Q4) — hər biri 3 aydan ibarət
    const qs: PeriodBucket[] = [];
    for (let q = 1; q <= 4; q++) {
      const months = [q * 3 - 2, q * 3 - 1, q * 3];
      const monthBuckets = months.map(m => buildMonthBucket(seed, year, m, targetName, m === curMonth, baseTarget));
      const avgPct = Math.round(monthBuckets.reduce((a, b) => a + b.pct, 0) / 3);
      // "Quarter" bucket-i sadəcə label göstərir — daxilində ayları drill-down üçün ayrıca göstərəcəyik.
      qs.push({
        key: `q${q}`,
        label: `Q${q}`,
        year, month: 0,
        isCurrent: months.includes(curMonth),
        current: 0, target: baseTarget, pct: avgPct, trend: 0,
        status: statusFromPct(avgPct),
        lastUpdate: monthBuckets[monthBuckets.length - 1].lastUpdate,
        daysInMonth: 0, monthStartWeekday: 0, points: [],
      });
    }
    return { mode: "quarterly", buckets: qs };
  }
  if (f.includes("illik") || f.includes("yearly") || f.includes("annual")) {
    // 12 ay
    const yrly: PeriodBucket[] = [];
    for (let m = 1; m <= 12; m++) yrly.push(buildMonthBucket(seed, year, m, targetName, m === curMonth, baseTarget));
    return { mode: "yearly", buckets: yrly };
  }
  // default: monthly (son 6 ay)
  const months: PeriodBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, curMonth - 1 - i, 1);
    months.push(buildMonthBucket(seed, d.getFullYear(), d.getMonth() + 1, targetName, i === 0, baseTarget));
  }
  return { mode: "monthly", buckets: months };
};

// ── Calendar Popover ────────────────────────────────────────────────────────
const CalendarPopover = ({ bucket }: { bucket: PeriodBucket }) => {
  const pointsMap = useMemo(() => {
    const m = new Map<number, DayPoint>();
    bucket.points.forEach(p => m.set(p.day, p));
    return m;
  }, [bucket]);

  // 6 rows × 7 cols grid.
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < bucket.monthStartWeekday; i++) cells.push({ day: null });
  for (let d = 1; d <= bucket.daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  return (
    <div className="w-[300px] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-foreground">{bucket.label}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Məlumat olan gün
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground mb-1">
        {WEEKDAY_LABELS.map(w => <div key={w} className="text-center">{w}</div>)}
      </div>
      <TooltipProvider delayDuration={0}>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (c.day === null) return <div key={i} className="h-9" />;
            const pt = pointsMap.get(c.day);
            const s = pt ? STATUS_META[pt.status] : null;
            const cell = (
              <div
                className={`h-9 rounded-md flex flex-col items-center justify-center text-xs cursor-default select-none border ${
                  pt ? `border-transparent ${s!.bg} ${s!.text} font-semibold hover:border-primary/40` : "border-transparent text-foreground/60 hover:bg-secondary"
                }`}
              >
                <span>{c.day}</span>
                {pt && <span className={`w-1 h-1 rounded-full mt-0.5 ${s!.dot}`} />}
              </div>
            );
            if (!pt) return <div key={i}>{cell}</div>;
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild><div>{cell}</div></TooltipTrigger>
                <TooltipContent side="top" className="p-3 w-56">
                  <div className="text-xs font-semibold mb-1.5">{fmtDate(bucket.year, bucket.month, pt.day)}</div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cari nəticə</span><span className="font-medium tabular-nums">{pt.current}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Hədəf</span><span className="font-medium tabular-nums">{pt.target}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Faiz</span><span className="font-medium tabular-nums">{pt.pct}%</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`inline-flex items-center gap-1 font-medium ${s!.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s!.dot}`} />{s!.label}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Trend</span><span className={`font-medium tabular-nums ${pt.trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{pt.trend >= 0 ? "+" : ""}{pt.trend}%</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="tabular-nums">{pt.updated}</span></div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};

// ── Period card (Level 2) ───────────────────────────────────────────────────
const PeriodCard = ({ bucket, onDrillQuarter, showCalendar = true }: {
  bucket: PeriodBucket;
  onDrillQuarter?: () => void;
  showCalendar?: boolean;
}) => {
  const s = STATUS_META[bucket.status];
  const trendIcon = bucket.trend > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : bucket.trend < 0 ? <TrendingDown className="w-3 h-3 text-rose-500" />
                  : <Minus className="w-3 h-3 text-muted-foreground" />;
  const body = (
    <div className={`w-full text-left rounded-xl border border-border ${bucket.isCurrent ? "ring-2 ring-primary/40" : ""} bg-card p-3 hover:shadow-md transition-shadow cursor-pointer`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{bucket.label}</span>
          {bucket.isCurrent && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Cari</span>}
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${Math.min(bucket.pct, 100)}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div><div className="text-muted-foreground">Cari</div><div className="font-semibold tabular-nums">{bucket.current || "—"}</div></div>
        <div><div className="text-muted-foreground">Hədəf</div><div className="font-semibold tabular-nums">{bucket.target}</div></div>
        <div><div className="text-muted-foreground">Faiz</div><div className="font-semibold tabular-nums">{bucket.pct}%</div></div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">{trendIcon} {bucket.trend >= 0 ? "+" : ""}{bucket.trend}%</span>
        <span>Update: {bucket.lastUpdate}</span>
      </div>
    </div>
  );

  if (onDrillQuarter) {
    return <button type="button" onClick={onDrillQuarter} className="text-left">{body}</button>;
  }
  if (!showCalendar) return body;
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" className="text-left">{body}</button></PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start"><CalendarPopover bucket={bucket} /></PopoverContent>
    </Popover>
  );
};

// ── Target row (Level 1) ────────────────────────────────────────────────────
interface TargetItem { id: number | string; name: string; target?: string; unit?: string; current?: string; progress?: number; }

const TargetRow = ({ item, cardId, frequency, targetIdx }: {
  item: TargetItem; cardId: number; frequency: string; targetIdx: number;
}) => {
  const [open, setOpen] = useState(targetIdx === 0);
  const [quarterOpen, setQuarterOpen] = useState<string | null>(null);
  const baseTarget = parseTargetNumber(item.target);
  const { mode, buckets } = useMemo(
    () => buildPeriods(frequency, cardId, targetIdx, item.name, baseTarget),
    [frequency, cardId, targetIdx, item.name, baseTarget],
  );
  const overallPct = item.progress ?? Math.round(buckets.reduce((a, b) => a + b.pct, 0) / Math.max(1, buckets.length));
  const overallStatus = statusFromPct(overallPct);
  const s = STATUS_META[overallStatus];
  const lastUpdate = buckets[buckets.length - 1]?.lastUpdate || "—";

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors text-left"
      >
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <TargetIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden max-w-[240px]">
              <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${Math.min(overallPct, 100)}%` }} />
            </div>
            <span className="text-xs font-semibold text-foreground tabular-nums">{overallPct}%</span>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
          </span>
          <span className="text-[10px] text-muted-foreground">Son yenilənmə: {lastUpdate}</span>
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/60 bg-secondary/10 space-y-3">
          {mode === "quarterly" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {buckets.map(q => (
                  <PeriodCard
                    key={q.key}
                    bucket={q}
                    onDrillQuarter={() => setQuarterOpen(quarterOpen === q.key ? null : q.key)}
                  />
                ))}
              </div>
              {quarterOpen && (() => {
                const q = Number(quarterOpen.slice(1));
                const months = [q * 3 - 2, q * 3 - 1, q * 3];
                const now = new Date();
                const monthBuckets = months.map(m => buildMonthBucket(
                  cardId * 1000 + targetIdx * 37 + 1,
                  now.getFullYear(), m, item.name, m === now.getMonth() + 1, baseTarget,
                ));
                return (
                  <div className="pt-2 border-t border-border/60">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">Q{q} ayları</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {monthBuckets.map(b => <PeriodCard key={b.key} bucket={b} />)}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {buckets.map(b => <PeriodCard key={b.key} bucket={b} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main tab ────────────────────────────────────────────────────────────────
const PerformanceDynamicsTab = ({ kpi }: { kpi: KpiCard }) => {
  const targets = useMemo(() => {
    // Vahid birləşdirmə: kartın hədəfləri + başqa əməkdaşın təyin etdikləri.
    const merged = mergeCardTargets(kpi.id, (kpi.subKpis || []) as any[]);
    if (merged.length > 0) return merged as any as TargetItem[];
    return [{
      id: 1, name: (kpi as any).name || "Ümumi hədəf",
      target: (kpi as any).generalTarget || (kpi as any).target || "100",
      unit: (kpi as any).unit || "", current: (kpi as any).current, progress: kpi.progress,
    }];
  }, [kpi]);



  const frequency = (kpi as any).frequency || (kpi as any).period || "Aylıq";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
        Performans dinamikası hər bir KPI hədəfi üzrə ayrıca göstərilir. Dövr kartına klik edin — məlumat olan günləri görmək üçün təqvim açılacaq. Günün üzərinə mouse gətirin — günlük performans tooltip-də görünəcək.
      </div>
      {targets.map((t, i) => (
        <TargetRow
          key={t.id}
          item={t}
          cardId={kpi.id}
          frequency={frequency}
          targetIdx={i}
        />
      ))}
    </div>
  );
};

export default PerformanceDynamicsTab;
