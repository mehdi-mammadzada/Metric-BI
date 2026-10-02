import type {
  ScheduleConfig, FrequencyKind, Weekday, WeekOfMonth, MonthlyMode, CustomUnit,
} from "@/lib/notificationSettingsStore";
import { FREQUENCY_LABELS } from "@/lib/notificationSettingsStore";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS_AZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS_AZ: { v: Weekday; label: string }[] = [
  { v: 1, label: "Bazar ertəsi" },
  { v: 2, label: "Çərşənbə axşamı" },
  { v: 3, label: "Çərşənbə" },
  { v: 4, label: "Cümə axşamı" },
  { v: 5, label: "Cümə" },
  { v: 6, label: "Şənbə" },
  { v: 7, label: "Bazar" },
];
const WEEK_OF_MONTH_LABEL: Record<WeekOfMonth, string> = {
  first: "ilk", second: "ikinci", third: "üçüncü", fourth: "dördüncü", last: "son",
};

const QUARTER_MONTHS: Record<1 | 2 | 3 | 4, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background";
const labelCls = "text-xs font-medium text-muted-foreground mb-1 block";

interface Props {
  value: ScheduleConfig;
  onChange: (next: ScheduleConfig) => void;
}

const TimeInput = ({ value, onChange, label = "Saat" }: { value?: string; onChange: (v: string) => void; label?: string }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <input type="time" value={value || ""} onChange={e => onChange(e.target.value)} className={inputCls} />
  </div>
);

const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromIsoDate = (iso?: string) => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const scheduleDate = (month?: number, day?: number) => {
  const year = new Date().getFullYear();
  const safeMonth = month || 1;
  const maxDay = new Date(year, safeMonth, 0).getDate();
  return new Date(year, safeMonth - 1, Math.min(day || 1, maxDay));
};

const DateInput = ({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(inputCls, "flex items-center justify-between text-left font-normal", !value && "text-muted-foreground")}>
          <span>{value ? fmtDate(value) : "Təqvimdən tarix seçin"}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={fromIsoDate(value)} onSelect={(date) => date && onChange(toIsoDate(date))} initialFocus />
      </PopoverContent>
    </Popover>
  </div>
);

const CalendarDateButton = ({ label, date, onSelect, disabled, fromMonth, toMonth, defaultMonth }: { label: string; date?: Date; onSelect: (date: Date) => void; disabled?: (date: Date) => boolean; fromMonth?: Date; toMonth?: Date; defaultMonth?: Date }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cn(inputCls, "flex items-center justify-between text-left font-normal")}>
          <span>{date ? fmtDate(toIsoDate(date)) : "Təqvimdən tarix seçin"}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(next) => next && onSelect(next)} disabled={disabled} fromMonth={fromMonth} toMonth={toMonth} defaultMonth={defaultMonth || date} initialFocus />
      </PopoverContent>
    </Popover>
  </div>
);

const Info = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs text-muted-foreground bg-secondary/40 border border-border/60 rounded-lg p-2.5">{children}</div>
);

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS_AZ[Number(m) - 1]} ${y}`;
};

const summarize = (s: ScheduleConfig): string => {
  const t = s.time || "09:00";
  switch (s.kind) {
    case "on_event": return "Hadisə baş verdikdə";
    case "on_date": return s.date ? `${fmtDate(s.date)} saat ${t}` : "Tarix seçin";
    case "daily":
      return `Hər gün saat ${t}${s.startDate ? ` (${fmtDate(s.startDate)}${s.endDate ? ` – ${fmtDate(s.endDate)}` : ""})` : ""}`;
    case "weekly": {
      const days = (s.weekdays || []).map(w => WEEKDAYS_AZ.find(x => x.v === w)?.label).filter(Boolean).join(", ");
      return days ? `Hər həftə: ${days} saat ${t}` : "Həftə günü seçin";
    }
    case "monthly":
      if (s.monthlyMode === "weekOfMonth" && s.weekOfMonth && s.weekday) {
        const w = WEEKDAYS_AZ.find(x => x.v === s.weekday)?.label;
        return `Hər ayın ${WEEK_OF_MONTH_LABEL[s.weekOfMonth === "fourth" ? "last" : s.weekOfMonth]} ${w}-si saat ${t}`;
      }
      return `Hər ayın ${s.dayOfMonth ?? 1}-i saat ${t}`;
    case "quarterly":
      return `Hər ${["I","II","III","IV"][(s.quarter ?? 1) - 1]} rübün ${MONTHS_AZ[(s.month ?? 1) - 1]} ayı ${s.day ?? 1}-i saat ${t}`;
    case "yearly":
      return `Hər il ${s.day ?? 1} ${MONTHS_AZ[(s.month ?? 1) - 1]} saat ${t}`;
    case "custom": {
      const unit = s.customUnit === "week" ? "həftə" : s.customUnit === "month" ? "ay" : "gün";
      const range = s.startDate ? `${fmtDate(s.startDate)}${s.endDate ? ` – ${fmtDate(s.endDate)}` : ""}` : "";
      return `Hər ${s.repeatEvery ?? 1} ${unit} bir${range ? ` (${range})` : ""}${s.cron ? ` · cron: ${s.cron}` : ""}`;
    }
  }
};

const NotificationSchedulePicker = ({ value: s, onChange }: Props) => {
  const set = (patch: Partial<ScheduleConfig>) => onChange({ ...s, ...patch });

  const setKind = (kind: FrequencyKind) => {
    const base: ScheduleConfig = { kind, time: s.time || "09:00" };
    if (kind === "monthly") { base.monthlyMode = "dayOfMonth"; base.dayOfMonth = 1; }
    if (kind === "weekly") base.weekdays = [1];
    if (kind === "quarterly") { base.quarter = 1; base.month = 1; base.day = 1; }
    if (kind === "yearly") { base.month = 1; base.day = 1; }
    if (kind === "custom") { base.repeatEvery = 1; base.customUnit = "day"; }
    onChange(base);
  };

  const toggleWeekday = (w: Weekday) => {
    const cur = new Set(s.weekdays || []);
    cur.has(w) ? cur.delete(w) : cur.add(w);
    set({ weekdays: Array.from(cur).sort() as Weekday[] });
  };

  const setQuarter = (q: 1 | 2 | 3 | 4) => {
    // Rüb dəyişəndə ay avtomatik həmin rübün ilk ayına düşür.
    set({ quarter: q, month: QUARTER_MONTHS[q][0] });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Tezlik</label>
        <select
          value={s.kind || ""}
          onChange={e => setKind(e.target.value as FrequencyKind)}
          className={inputCls}
        >
          {!s.kind && <option value="" disabled>Seçin</option>}
          {(Object.keys(FREQUENCY_LABELS) as FrequencyKind[]).map(k => (
            <option key={k} value={k}>{FREQUENCY_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {s.kind === "on_event" && (
        <div>
          <Info>Bildiriş hadisə baş verdiyi anda göndəriləcək.</Info>
        </div>
      )}

      {s.kind === "on_date" && (
        <div className="grid grid-cols-2 gap-3">
          <DateInput value={s.date} onChange={v => set({ date: v })} label="Tarix" />
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
          <div className="col-span-2"><Info>Bildiriş seçilmiş tarix və saatda yalnız bir dəfə göndəriləcək.</Info></div>
        </div>
      )}

      {s.kind === "daily" && (
        <div className="grid grid-cols-2 gap-3">
          <DateInput value={s.startDate} onChange={v => set({ startDate: v })} label="Başlama tarixi" />
          <DateInput value={s.endDate} onChange={v => set({ endDate: v })} label="Bitmə tarixi (ixtiyari)" />
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
          <div className="col-span-2"><Info>Bildiriş hər gün seçilmiş saatda göndəriləcək.</Info></div>
        </div>
      )}

      {s.kind === "weekly" && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Həftənin günləri</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_AZ.map(d => {
                const on = (s.weekdays || []).includes(d.v);
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleWeekday(d.v)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
          <Info>Bildiriş seçilmiş həftə günlərində göndəriləcək.</Info>
        </div>
      )}

      {s.kind === "monthly" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={s.monthlyMode !== "weekOfMonth"} onChange={() => set({ monthlyMode: "dayOfMonth" })} />
              Ayın günü
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={s.monthlyMode === "weekOfMonth"} onChange={() => set({ monthlyMode: "weekOfMonth", weekOfMonth: s.weekOfMonth || "first", weekday: s.weekday || 1 })} />
              Ayın ilk/ikinci/üçüncü/son həftəsi
            </label>
          </div>
          {s.monthlyMode !== "weekOfMonth" ? (
            <CalendarDateButton
              label="Ayın günü"
              date={new Date(new Date().getFullYear(), new Date().getMonth(), s.dayOfMonth ?? 1)}
              onSelect={(date) => set({ dayOfMonth: date.getDate() })}
              disabled={(date) => date.getFullYear() !== new Date().getFullYear() || date.getMonth() !== new Date().getMonth()}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Həftə</label>
                <select value={s.weekOfMonth === "fourth" ? "last" : (s.weekOfMonth || "first")} onChange={e => set({ weekOfMonth: e.target.value as WeekOfMonth })} className={inputCls}>
                  {(Object.keys(WEEK_OF_MONTH_LABEL) as WeekOfMonth[]).filter(k => k !== "fourth").map(k => (
                    <option key={k} value={k}>{WEEK_OF_MONTH_LABEL[k]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Həftənin günü</label>
                <select value={s.weekday || 1} onChange={e => set({ weekday: Number(e.target.value) as Weekday })} className={inputCls}>
                  {WEEKDAYS_AZ.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
          <Info>Bildiriş hər ay avtomatik göndəriləcək.</Info>
        </div>
      )}

      {s.kind === "quarterly" && (() => {
        const q = (s.quarter ?? 1) as 1 | 2 | 3 | 4;
        const allowedMonths = QUARTER_MONTHS[q];
        const month = allowedMonths.includes(s.month ?? 0) ? (s.month as number) : allowedMonths[0];
        const year = new Date().getFullYear();
        const firstQuarterMonth = allowedMonths[0];
        const lastQuarterMonth = allowedMonths[allowedMonths.length - 1];
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rüb</label>
              <select value={q} onChange={e => setQuarter(Number(e.target.value) as 1|2|3|4)} className={inputCls}>
                {[1,2,3,4].map(qq => <option key={qq} value={qq}>{["I","II","III","IV"][qq-1]} rüb</option>)}
              </select>
            </div>
            <CalendarDateButton
              label="Tarix (yalnız seçilmiş rübün ayları)"
              date={scheduleDate(month, s.day)}
              onSelect={(date) => set({ month: date.getMonth() + 1, day: date.getDate() })}
              disabled={(date) => date.getFullYear() !== new Date().getFullYear() || !allowedMonths.includes(date.getMonth() + 1)}
              fromMonth={new Date(year, firstQuarterMonth - 1, 1)}
              toMonth={new Date(year, lastQuarterMonth - 1, 1)}
              defaultMonth={new Date(year, month - 1, 1)}
            />
            <TimeInput value={s.time} onChange={v => set({ time: v })} />
            <div className="col-span-2"><Info>Yalnız {["I","II","III","IV"][q-1]} rübün ayları göstərilir.</Info></div>
          </div>
        );
      })()}

      {s.kind === "yearly" && (
        <div className="grid grid-cols-2 gap-3">
          <CalendarDateButton
            label="Tarix"
            date={scheduleDate(s.month, s.day)}
            onSelect={(date) => set({ month: date.getMonth() + 1, day: date.getDate() })}
            disabled={(date) => date.getFullYear() !== new Date().getFullYear()}
            fromMonth={new Date(new Date().getFullYear(), 0, 1)}
            toMonth={new Date(new Date().getFullYear(), 11, 1)}
          />
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
        </div>
      )}

      {s.kind === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          <DateInput value={s.startDate} onChange={v => set({ startDate: v })} label="Başlama tarixi" />
          <DateInput value={s.endDate} onChange={v => set({ endDate: v })} label="Bitmə tarixi" />
          <div>
            <label className={labelCls}>Təkrarlanma intervalı</label>
            <input type="number" min={1} value={s.repeatEvery ?? 1} onChange={e => set({ repeatEvery: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vahid</label>
            <select value={s.customUnit || "day"} onChange={e => set({ customUnit: e.target.value as CustomUnit })} className={inputCls}>
              <option value="day">Gün</option>
              <option value="week">Həftə</option>
              <option value="month">Ay</option>
            </select>
          </div>
          <TimeInput value={s.time} onChange={v => set({ time: v })} />
          <div className="col-span-2">
            <label className={labelCls}>Advanced Schedule (Cron ifadəsi, ixtiyari)</label>
            <input value={s.cron || ""} onChange={e => set({ cron: e.target.value })} placeholder="0 9 * * 1-5" className={`${inputCls} font-mono`} />
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border/60">
        <div className="text-xs text-muted-foreground">Cədvəl xülasəsi</div>
        <div className="text-sm text-foreground font-medium">• {summarize(s)}</div>
      </div>
    </div>
  );
};

export default NotificationSchedulePicker;
