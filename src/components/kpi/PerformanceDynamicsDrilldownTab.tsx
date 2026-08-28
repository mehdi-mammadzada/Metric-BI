import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronRight, Minus, Target as TargetIcon, TrendingDown, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { KpiCard } from "@/lib/kpiCardTypes";
import { useKpiSet } from "@/lib/kpiSetStore";
import { mergeCardTargets } from "@/lib/targetMerge";
import { cn } from "@/lib/utils";
import { TARGET_STATUS_BADGE, TARGET_STATUS_BAR, TARGET_STATUS_LABEL, type TargetStatus } from "@/lib/targetStatus";

// Hədəf statusları sistem üzrə yalnız 3-dür.
type DayStatus = TargetStatus;

const STATUS_META: Record<DayStatus, { label: string; badge: string; dot: string; bar: string }> = {
  in_progress: { label: TARGET_STATUS_LABEL.in_progress, badge: TARGET_STATUS_BADGE.in_progress, dot: TARGET_STATUS_BAR.in_progress, bar: "[&>div]:bg-amber-500" },
  achieved: { label: TARGET_STATUS_LABEL.achieved, badge: TARGET_STATUS_BADGE.achieved, dot: TARGET_STATUS_BAR.achieved, bar: "[&>div]:bg-emerald-500" },
  not_achieved: { label: TARGET_STATUS_LABEL.not_achieved, badge: TARGET_STATUS_BADGE.not_achieved, dot: TARGET_STATUS_BAR.not_achieved, bar: "[&>div]:bg-rose-500" },
};

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAY_LABELS = ["B.e", "Ç.a", "Ç.", "C.a", "C.", "Ş.", "B."];

interface DayPoint { day: number; current: number; target: number; pct: number; status: DayStatus; trend: number; note?: string; updated: string }
interface PeriodBucket {
  key: string; label: string; year: number; month: number; isCurrent: boolean; current: number; target: number; pct: number; trend: number; status: DayStatus; lastUpdate: string; daysInMonth: number; monthStartWeekday: number; points: DayPoint[]; range?: { start: number; end: number };
}
interface TargetItem { id: number | string; name: string; target?: string; unit?: string; current?: string; progress?: number; weight?: number }

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (y: number, m: number, d: number) => `${pad2(d)}.${pad2(m)}.${y}`;
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const monthStartWeekday = (year: number, month: number) => (new Date(year, month - 1, 1).getDay() + 6) % 7;

const seedRand = (seed: number) => {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};

const statusFromPct = (pct: number): DayStatus => {
  if (pct >= 100) return "achieved";
  return "in_progress";
};

const parseTargetNumber = (value?: string) => {
  const raw = String(value || "").trim();
  const n = Number.parseFloat(raw.replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (/\bm\b|m\s*azn|milyon/i.test(raw)) return Math.round(n * 1_000_000);
  if (/\bk\b|min/i.test(raw)) return Math.round(n * 1_000);
  return n;
};

const inferUnit = (target?: string, unit?: string) => {
  if (unit) return unit;
  const raw = String(target || "");
  if (raw.includes("%")) return "%";
  if (/azn/i.test(raw)) return "AZN";
  if (/müştəri/i.test(raw)) return "Müştəri";
  return "";
};

const numericText = (value: number, unit?: string) => {
  if (unit === "%") return `${value.toLocaleString("az-AZ")}%`;
  return `${value.toLocaleString("az-AZ")}${unit ? ` ${unit}` : ""}`;
};

// Sistemdə faktiki nəticə yoxdursa heç bir sintetik gün dəyəri yaradılmır.
const buildMonthBucket = (_seed: number, year: number, month: number, isCurrent: boolean, baseTarget: number): PeriodBucket => {
  const dim = daysInMonth(year, month);
  const points: DayPoint[] = [];
  return { key: `${year}-${pad2(month)}`, label: `${MONTHS_AZ[month - 1]} ${year}`, year, month, isCurrent, current: 0, target: baseTarget, pct: 0, trend: 0, status: statusFromPct(0), lastUpdate: "—", daysInMonth: dim, monthStartWeekday: monthStartWeekday(year, month), points };
};


const aggregateBucket = (key: string, label: string, buckets: PeriodBucket[], isCurrent: boolean): PeriodBucket => {
  const pct = Math.round(buckets.reduce((sum, b) => sum + b.pct, 0) / Math.max(1, buckets.length));
  const current = Math.round(buckets.reduce((sum, b) => sum + b.current, 0) / Math.max(1, buckets.length));
  const trend = Math.round(buckets.reduce((sum, b) => sum + b.trend, 0) / Math.max(1, buckets.length));
  return { key, label, year: buckets[0]?.year || new Date().getFullYear(), month: 0, isCurrent, current, target: buckets[0]?.target ?? 0, pct, trend, status: statusFromPct(pct), lastUpdate: buckets[buckets.length - 1]?.lastUpdate || "—", daysInMonth: 0, monthStartWeekday: 0, points: [] };
};

const normalizeFrequency = (frequency: string) => {
  const value = frequency.toLowerCase();
  if (value.includes("gündəlik") || value.includes("daily")) return "daily";
  if (value.includes("həftə") || value.includes("week")) return "weekly";
  if (value.includes("rüb") || value.includes("quarter")) return "quarterly";
  if (value.includes("illik") || value.includes("year") || value.includes("annual")) return "yearly";
  return "monthly";
};

const buildPeriods = (frequency: string, cardId: number, targetIdx: number, baseTarget: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const seed = cardId * 1009 + targetIdx * 131;
  const mode = normalizeFrequency(frequency);

  if (mode === "daily" || mode === "monthly") return { mode, buckets: [buildMonthBucket(seed, year, currentMonth, true, baseTarget)] };

  if (mode === "weekly") {
    const month = buildMonthBucket(seed, year, currentMonth, true, baseTarget);
    const currentDay = now.getDate();
    return { mode, buckets: [0, 1, 2, 3].map((w) => {
      const start = w * 7 + 1;
      const end = Math.min(start + 6, month.daysInMonth);
      const points = month.points.filter((p) => p.day >= start && p.day <= end);
      const pct = points.length ? Math.round(points.reduce((sum, p) => sum + p.pct, 0) / points.length) : 0;
      const current = points.length ? Math.round(points.reduce((sum, p) => sum + p.current, 0) / points.length) : 0;
      const first = points[0];
      const last = points[points.length - 1];
      return { ...month, key: `week-${w + 1}`, label: `${w + 1}-ci həftə`, isCurrent: currentDay >= start && currentDay <= end, current, pct, trend: first && last ? Math.round(((last.current - first.current) / Math.max(1, first.current)) * 100) : 0, status: statusFromPct(pct), lastUpdate: last ? fmtDate(year, currentMonth, last.day) : "—", points, range: { start, end } };
    }) };
  }

  if (mode === "quarterly") {
    return { mode, buckets: [1, 2, 3, 4].map((q) => {
      const months = [q * 3 - 2, q * 3 - 1, q * 3].map((m) => buildMonthBucket(seed, year, m, m === currentMonth, baseTarget));
      return aggregateBucket(`q-${q}`, `${q}-ci rüb`, months, months.some((m) => m.isCurrent));
    }) };
  }

  return { mode, buckets: Array.from({ length: 12 }, (_, i) => buildMonthBucket(seed, year, i + 1, i + 1 === currentMonth, baseTarget)) };
};

const MetricRow = ({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) => (
  <div className="flex items-start justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className={cn("max-w-[150px] text-right font-medium text-foreground", valueClassName)}>{value}</span></div>
);

const CalendarPopover = ({ bucket }: { bucket: PeriodBucket }) => {
  const pointByDay = useMemo(() => new Map(bucket.points.map((p) => [p.day, p])), [bucket.points]);
  const cells: Array<number | null> = [];
  for (let i = 0; i < bucket.monthStartWeekday; i++) cells.push(null);
  for (let d = 1; d <= bucket.daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-[340px] rounded-xl bg-popover p-4 text-popover-foreground">
      <div className="mb-3 flex items-center justify-between">
        <div><p className="text-sm font-semibold text-foreground">{bucket.label}</p>{bucket.range && <p className="text-xs text-muted-foreground">{bucket.range.start}–{bucket.range.end} tarix aralığı</p>}</div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info/10 px-2 py-1 text-[11px] font-medium text-info"><span className="h-1.5 w-1.5 rounded-full bg-info" /> Məlumat olan gün</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] font-medium text-muted-foreground">{WEEKDAY_LABELS.map((w) => <div key={w} className="py-1 text-center">{w}</div>)}</div>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (!day) return <div key={index} className="h-10" />;
            const point = pointByDay.get(day);
            const outsideWeek = bucket.range ? day < bucket.range.start || day > bucket.range.end : false;
            const dayCell = <div className={cn("flex h-10 items-center justify-center rounded-lg border text-sm transition-colors", point && "border-info/20 bg-info/10 font-semibold text-info", !point && "border-transparent text-foreground/70 hover:bg-secondary/70", outsideWeek && "opacity-30")}><span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full">{day}{point && <span className={cn("absolute -bottom-0.5 h-1.5 w-1.5 rounded-full", STATUS_META[point.status].dot)} />}</span></div>;
            if (!point) return <div key={index}>{dayCell}</div>;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild><div>{dayCell}</div></TooltipTrigger>
                <TooltipContent side="top" align="center" className="w-64 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold"><CalendarIcon className="h-3.5 w-3.5 text-primary" /> {fmtDate(bucket.year, bucket.month, point.day)}</div>
                  <div className="space-y-1.5 text-[11px]">
                    <MetricRow label="Cari nəticə" value={numericText(point.current)} />
                    <MetricRow label="Hədəf" value={numericText(point.target)} />
                    <MetricRow label="Faiz" value={`${point.pct}%`} />
                    <MetricRow label="Status" value={STATUS_META[point.status].label} valueClassName="text-primary" />
                    <MetricRow label="Trend" value={`${point.trend >= 0 ? "+" : ""}${point.trend}%`} valueClassName={point.trend >= 0 ? "text-success" : "text-destructive"} />
                    {point.note && <MetricRow label="Qeyd" value={point.note} />}
                    <MetricRow label="Son yenilənmə" value={point.updated} />
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

const Trend = ({ value }: { value: number }) => {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return <span className={cn("inline-flex items-center gap-1 font-semibold", value > 0 && "text-success", value < 0 && "text-destructive", value === 0 && "text-muted-foreground")}><Icon className="h-3.5 w-3.5" />{value > 0 ? "+" : ""}{value}%</span>;
};

const MetricLite = ({ label, value }: { label: string; value: string }) => <div className="min-w-0"><p className="text-muted-foreground">{label}</p><p className="truncate font-semibold text-foreground">{value}</p></div>;

const PeriodCard = ({ bucket, unit, onQuarterClick }: { bucket: PeriodBucket; unit?: string; onQuarterClick?: () => void }) => {
  const status = STATUS_META[bucket.status];
  const content = (
    <div className={cn("w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md", bucket.isCurrent && "ring-2 ring-primary/30")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 shrink-0 text-primary" /><p className="truncate text-sm font-semibold text-foreground">{bucket.label}</p>{bucket.isCurrent && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Cari dövr</span>}</div><p className="mt-1 text-xs text-muted-foreground">Son yenilənmə: {bucket.lastUpdate}</p></div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", status.badge)}><span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />{status.label}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">İcra</span><span className="font-semibold text-foreground">{bucket.pct}%</span></div><Progress value={Math.min(bucket.pct, 100)} className={cn("h-2", status.bar)} /></div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4 md:min-w-[360px]"><MetricLite label="Cari" value={bucket.current ? numericText(bucket.current, unit) : "—"} /><MetricLite label="Hədəf" value={numericText(bucket.target, unit)} /><MetricLite label="Faiz" value={`${bucket.pct}%`} /><div><p className="text-muted-foreground">Trend</p><Trend value={bucket.trend} /></div></div>
      </div>
    </div>
  );

  if (onQuarterClick) return <button type="button" onClick={onQuarterClick} className="w-full">{content}</button>;
  return <Popover><PopoverTrigger asChild><button type="button" className="w-full">{content}</button></PopoverTrigger><PopoverContent className="w-auto rounded-xl p-0 shadow-lg" align="start"><CalendarPopover bucket={bucket} /></PopoverContent></Popover>;
};

const TargetRow = ({ item, cardId, frequency, targetIdx }: { item: TargetItem; cardId: number; frequency: string; targetIdx: number }) => {
  const [open, setOpen] = useState(false);
  const [openQuarter, setOpenQuarter] = useState<string | null>(null);
  const displayUnit = inferUnit(item.target, item.unit);
  const baseTarget = parseTargetNumber(item.target);
  const { mode, buckets } = useMemo(() => buildPeriods(frequency, cardId, targetIdx, baseTarget), [frequency, cardId, targetIdx, baseTarget]);
  const overallPct = item.progress ?? Math.round(buckets.reduce((sum, b) => sum + b.pct, 0) / Math.max(1, buckets.length));
  const current = item.current || numericText(Math.round(buckets.reduce((sum, b) => sum + b.current, 0) / Math.max(1, buckets.length)), displayUnit);
  const status = STATUS_META[statusFromPct(overallPct)];
  const lastUpdate = buckets.find((b) => b.isCurrent)?.lastUpdate || buckets[buckets.length - 1]?.lastUpdate || "—";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="grid w-full grid-cols-[auto_1fr] gap-3 p-4 text-left transition-colors duration-200 hover:bg-secondary/40 lg:grid-cols-[auto_1fr_80px_112px_120px_170px_130px_auto] lg:items-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
        <div className="min-w-0"><div className="flex items-center gap-2"><TargetIcon className="h-4 w-4 shrink-0 text-primary" /><p className="truncate text-sm font-semibold text-foreground">{item.name}</p></div><div className="mt-2 flex items-center gap-2 lg:max-w-[320px]"><Progress value={Math.min(overallPct, 100)} className={cn("h-2", status.bar)} /><span className="w-10 text-right text-xs font-semibold text-foreground">{overallPct}%</span></div></div>
        <div className="col-start-2 lg:col-auto"><p className="text-[11px] text-muted-foreground">Çəki</p><p className="text-sm font-semibold text-foreground">{item.weight ?? 100}%</p></div>
        <div className="col-start-2 lg:col-auto"><p className="text-[11px] text-muted-foreground">Ümumi icra</p><div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-xs font-bold text-primary">{overallPct}%</div></div>
        <div className="col-start-2 lg:col-auto"><p className="text-[11px] text-muted-foreground">Cari nəticə</p><p className="text-sm font-semibold text-foreground">{current}</p></div>
        <div className="col-start-2 lg:col-auto"><p className="text-[11px] text-muted-foreground">Son yenilənmə</p><p className="text-sm font-semibold text-foreground">{lastUpdate}</p></div>
        <div className="col-start-2 lg:col-auto"><span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", status.badge)}><span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />{status.label}</span></div>
        <ChevronDown className={cn("col-start-2 h-4 w-4 justify-self-end text-muted-foreground transition-transform duration-200 lg:col-auto", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}><div className="min-h-0 overflow-hidden"><div className="space-y-3 border-t border-border bg-secondary/20 p-4">
        {mode === "quarterly" ? <><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{buckets.map((bucket) => <PeriodCard key={bucket.key} bucket={bucket} unit={displayUnit} onQuarterClick={() => setOpenQuarter((v) => v === bucket.key ? null : bucket.key)} />)}</div>{openQuarter && (() => { const q = Number(openQuarter.split("-")[1]); const now = new Date(); const months = [q * 3 - 2, q * 3 - 1, q * 3].map((month) => buildMonthBucket(cardId * 1009 + targetIdx * 131, now.getFullYear(), month, month === now.getMonth() + 1, baseTarget)); return <div className="space-y-2 rounded-xl border border-border bg-background p-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{q}-ci rübün ayları</p><div className="grid gap-3 lg:grid-cols-3">{months.map((month) => <PeriodCard key={month.key} bucket={month} unit={displayUnit} />)}</div></div>; })()}</> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{buckets.map((bucket) => <PeriodCard key={bucket.key} bucket={bucket} unit={displayUnit} />)}</div>}
      </div></div></div>
    </div>
  );
};

const PerformanceDynamicsDrilldownTab = ({ kpi }: { kpi: KpiCard }) => {
  const kpiSetRows = useKpiSet();
  const targets = useMemo<TargetItem[]>(() => {
    const merged = mergeCardTargets(kpi.id, kpi.subKpis || []);
    if (merged.length > 0) return merged.map(target => ({ ...target, id: target.entryId || target.id }));
    return [{ id: "main", name: kpi.name || "KPI hədəfi", target: kpi.generalTarget || kpi.target || "100", unit: kpi.unit || "", current: kpi.current, progress: kpi.progress, weight: kpi.weight }];
  }, [kpi, kpiSetRows]);

  const frequency = kpi.frequency || kpi.period || "Aylıq";

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[1fr_80px_112px_120px_170px_130px_40px] gap-3 border-b border-border bg-secondary/50 px-4 py-3 text-xs font-semibold text-muted-foreground max-lg:hidden"><span>Hədəf</span><span>Çəki</span><span>Ümumi icra (%)</span><span>Cari nəticə</span><span>Son yenilənmə</span><span>Status</span><span /></div>
        <div className="space-y-3 p-3">{targets.map((target, index) => <TargetRow key={target.id} item={target} cardId={kpi.id} frequency={frequency} targetIdx={index} />)}</div>
      </div>
    </div>
  );
};

export default PerformanceDynamicsDrilldownTab;