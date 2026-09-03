// Vahid dövr seçimi: əvvəlcə dövrlük (günlük/həftəlik/aylıq/rüblük/6 aylıq/illik/custom),
// sonra seçilmiş dövrlüyə uyğun konkret dövr. KPI İzlənməsi, Nəticələr və Bonuslar
// modullarında eyni məntiqlə istifadə olunur.
import { format, startOfWeek, endOfWeek, isSameWeek } from "date-fns";
import { az } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Periodicity = "daily" | "weekly" | "monthly" | "quarterly" | "halfyear" | "yearly" | "custom";

export interface PeriodSelection {
  periodicity: Periodicity;
  day?: Date;
  weekDate?: Date;
  year?: string;
  month?: string;
  quarter?: string;
  half?: string;
  range?: { from?: Date; to?: Date };
}

export interface ResolvedPeriod {
  label: string;
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
}

export const PERIODICITY_OPTIONS: { value: Periodicity; label: string }[] = [
  { value: "daily", label: "Günlük" },
  { value: "weekly", label: "Həftəlik" },
  { value: "monthly", label: "Aylıq" },
  { value: "quarterly", label: "Rüblük" },
  { value: "halfyear", label: "6 aylıq" },
  { value: "yearly", label: "İllik" },
  { value: "custom", label: "Custom" },
];

export const MONTHS_AZ = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
const YEARS = ["2024", "2025", "2026", "2027", "2028"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export const emptyPeriodSelection = (periodicity: Periodicity = "monthly"): PeriodSelection => ({
  periodicity,
  year: String(new Date().getFullYear()),
  month: periodicity === "monthly" ? String(new Date().getMonth() + 1) : undefined,
  range: {},
});

/** Seçim dəyişəndə asılı dəyərləri sıfırla. */
export const withPeriodicity = (periodicity: Periodicity): PeriodSelection => ({
  periodicity,
  year: String(new Date().getFullYear()),
  range: {},
});

export const resolvePeriod = (sel: PeriodSelection | null | undefined): ResolvedPeriod | null => {
  if (!sel) return null;
  const build = (s: Date, e: Date, label: string): ResolvedPeriod => ({
    label, start: dayStart(s), end: dayEnd(e), startLabel: fmtDate(s), endLabel: fmtDate(e),
  });
  const yr = Number(sel.year);
  switch (sel.periodicity) {
    case "daily":
      if (!sel.day) return null;
      return build(sel.day, sel.day, format(sel.day, "d MMMM yyyy", { locale: az }));
    case "weekly": {
      if (!sel.weekDate) return null;
      const s = startOfWeek(sel.weekDate, { weekStartsOn: 1 });
      const e = endOfWeek(sel.weekDate, { weekStartsOn: 1 });
      return build(s, e, `${format(s, "d MMM", { locale: az })} – ${format(e, "d MMM yyyy", { locale: az })}`);
    }
    case "monthly": {
      if (!sel.year || !sel.month) return null;
      const mIdx = Number(sel.month) - 1;
      return build(new Date(yr, mIdx, 1), new Date(yr, mIdx + 1, 0), `${MONTHS_AZ[mIdx]} ${yr}`);
    }
    case "quarterly": {
      if (!sel.year || !sel.quarter) return null;
      const q = Number(sel.quarter);
      return build(new Date(yr, (q - 1) * 3, 1), new Date(yr, q * 3, 0), `${yr} Rüb ${q}`);
    }
    case "halfyear": {
      if (!sel.year || !sel.half) return null;
      const first = sel.half === "I";
      return build(new Date(yr, first ? 0 : 6, 1), new Date(yr, first ? 6 : 12, 0), `${yr} ${sel.half} yarımil`);
    }
    case "yearly":
      if (!sel.year) return null;
      return build(new Date(yr, 0, 1), new Date(yr, 11, 31), `${yr}`);
    case "custom": {
      const from = sel.range?.from; const to = sel.range?.to;
      if (!from || !to) return null;
      return build(from, to, `${format(from, "d MMM yyyy", { locale: az })} – ${format(to, "d MMM yyyy", { locale: az })}`);
    }
    default:
      return null;
  }
};

/** "dd.mm.yyyy" və ya ISO formatlı tarixi Date-ə çevirir. */
export const parseFlexibleDate = (v?: string | null): Date | null => {
  const s = String(v ?? "").trim();
  if (!s || s === "—") return null;
  const azm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (azm) return new Date(Number(azm[3]), Number(azm[2]) - 1, Number(azm[1]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t);
};

/** Kartın tarix aralığı seçilmiş dövrlə kəsişirmi? */
export const overlapsPeriod = (
  period: ResolvedPeriod | null,
  startDate?: string | null,
  endDate?: string | null,
): boolean => {
  if (!period) return true;
  const s = parseFlexibleDate(startDate);
  const e = parseFlexibleDate(endDate);
  if (!s && !e) return true;
  const from = s ?? e!;
  const to = e ?? s!;
  return from <= period.end && to >= period.start;
};

interface Props {
  value: PeriodSelection;
  onChange: (v: PeriodSelection) => void;
  /** kompakt: rəhbər filter panelləri üçün daha qısa hündürlük */
  compact?: boolean;
  className?: string;
  showLabels?: boolean;
}

const PeriodRangePicker = ({ value, onChange, compact, className, showLabels = true }: Props) => {
  const h = compact ? "h-9" : "";
  const set = (patch: Partial<PeriodSelection>) => onChange({ ...value, ...patch });

  const concrete = () => {
    switch (value.periodicity) {
      case "daily":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal", h, !value.day && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.day ? format(value.day, "d MMMM yyyy", { locale: az }) : "Gün seçin"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
              <Calendar mode="single" selected={value.day} onSelect={(d) => set({ day: d || undefined })} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        );
      case "weekly":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal", h, !value.weekDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.weekDate
                  ? `${format(startOfWeek(value.weekDate, { weekStartsOn: 1 }), "d MMM", { locale: az })} – ${format(endOfWeek(value.weekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: az })}`
                  : "Həftə seçin"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
              <Calendar
                mode="single"
                selected={value.weekDate}
                onSelect={(d) => set({ weekDate: d || undefined })}
                weekStartsOn={1}
                modifiers={{ inWeek: (d) => (value.weekDate ? isSameWeek(d, value.weekDate, { weekStartsOn: 1 }) : false) }}
                modifiersClassNames={{ inWeek: "bg-primary/10 text-foreground" }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        );
      case "monthly":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Select value={value.year || ""} onValueChange={(v) => set({ year: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="İl" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={value.month || ""} onValueChange={(v) => set({ month: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="Ay" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{MONTHS_AZ.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );
      case "quarterly":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Select value={value.year || ""} onValueChange={(v) => set({ year: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="İl" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={value.quarter || ""} onValueChange={(v) => set({ quarter: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="Rüb" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>Rüb {q}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );
      case "halfyear":
        return (
          <div className="grid grid-cols-2 gap-2">
            <Select value={value.year || ""} onValueChange={(v) => set({ year: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="İl" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={value.half || ""} onValueChange={(v) => set({ half: v })}>
              <SelectTrigger className={h}><SelectValue placeholder="6 ay" /></SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="I">I yarımil (Yan–İyn)</SelectItem>
                <SelectItem value="II">II yarımil (İyl–Dek)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "yearly":
        return (
          <Select value={value.year || ""} onValueChange={(v) => set({ year: v })}>
            <SelectTrigger className={h}><SelectValue placeholder="İl seçin" /></SelectTrigger>
            <SelectContent className="z-50 bg-popover">{YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
        );
      case "custom":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start font-normal", h, !value.range?.from && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.range?.from && value.range?.to
                  ? `${format(value.range.from, "d MMM yyyy", { locale: az })} – ${format(value.range.to, "d MMM yyyy", { locale: az })}`
                  : "Tarix aralığı"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
              <Calendar mode="range" selected={value.range as any} onSelect={(r: any) => set({ range: r || {} })} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-[170px_minmax(220px,1fr)] gap-2 items-end", className)}>
      <div>
        {showLabels && <label className="text-[11px] text-muted-foreground mb-1 block">Dövrlük</label>}
        <Select
          value={value.periodicity}
          onValueChange={(v) => onChange(withPeriodicity(v as Periodicity))}
        >
          <SelectTrigger className={h}><SelectValue placeholder="Dövrlük" /></SelectTrigger>
          <SelectContent className="z-50 bg-popover">
            {PERIODICITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        {showLabels && <label className="text-[11px] text-muted-foreground mb-1 block">Konkret dövr</label>}
        {concrete()}
      </div>
    </div>
  );
};

export default PeriodRangePicker;
