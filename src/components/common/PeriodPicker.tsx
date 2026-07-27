import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronLeft } from "lucide-react";

export type PeriodMode = "year" | "quarter" | "month";
export interface PeriodValue {
  mode: PeriodMode;
  year: number;
  quarter?: 1 | 2 | 3 | 4; // 1..4
  month?: number; // 0..11
}

export const MONTHS_AZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];
export const MONTHS_SHORT_AZ = [
  "Yan", "Fev", "Mar", "Apr", "May", "İyn",
  "İyl", "Avq", "Sen", "Okt", "Noy", "Dek",
];

export const currentPeriod = (mode: PeriodMode = "year"): PeriodValue => {
  const now = new Date();
  return {
    mode,
    year: now.getFullYear(),
    quarter: (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4,
    month: now.getMonth(),
  };
};

export const periodLabel = (p: PeriodValue): string => {
  if (p.mode === "year") return `${p.year} ili`;
  if (p.mode === "quarter") return `${p.year} • ${p.quarter}-ci rüb`;
  return `${MONTHS_AZ[p.month ?? 0]} ${p.year}`;
};

/** Returns chart X-axis category labels for the given period. */
export const periodCategories = (p: PeriodValue): string[] => {
  if (p.mode === "year") return MONTHS_SHORT_AZ;
  if (p.mode === "quarter") {
    const q = p.quarter ?? 1;
    const start = (q - 1) * 3;
    return MONTHS_SHORT_AZ.slice(start, start + 3);
  }
  const days = new Date(p.year, (p.month ?? 0) + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, "0"));
};

/** Empty series scaffold — real values come from the database, never demo noise. */
export const buildDemoSeries = (p: PeriodValue, _baseline = 75): { name: string; value: number }[] =>
  periodCategories(p).map((name) => ({ name, value: 0 }));

interface Props {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
  className?: string;
}

export const PeriodPicker = ({ value, onChange, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"year" | "quarter" | "month">("year");
  const [pickYear, setPickYear] = useState(value.year);

  const years = Array.from({ length: 7 }, (_, i) => 2023 + i);

  const openPopover = () => {
    setPickYear(value.year);
    setStep("year");
    setOpen(true);
  };

  const chooseMode = (m: PeriodMode) => {
    onChange({ ...value, mode: m });
    setPickYear(value.year);
    setStep("year");
    setOpen(true);
  };

  const commitYear = (y: number) => {
    if (value.mode === "year") {
      onChange({ mode: "year", year: y });
      setOpen(false);
      return;
    }
    setPickYear(y);
    setStep(value.mode === "quarter" ? "quarter" : "month");
  };

  const commitQuarter = (q: 1 | 2 | 3 | 4) => {
    onChange({ mode: "quarter", year: pickYear, quarter: q });
    setOpen(false);
  };

  const commitMonth = (m: number) => {
    onChange({ mode: "month", year: pickYear, month: m });
    setOpen(false);
  };

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
        {(["year", "quarter", "month"] as PeriodMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => chooseMode(m)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              value.mode === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "year" ? "İl" : m === "quarter" ? "Rüb" : "Ay"}
          </button>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={openPopover}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
          >
            <CalendarIcon className="w-3.5 h-3.5" /> {periodLabel(value)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 pointer-events-auto" align="end">
          {step !== "year" && (
            <button
              onClick={() => setStep("year")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {pickYear}
            </button>
          )}
          {step === "year" && (
            <div className="grid grid-cols-3 gap-2">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => commitYear(y)}
                  className={`px-2 py-2 text-sm rounded-md border transition-colors ${
                    y === value.year ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-secondary/50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          {step === "quarter" && (
            <div className="grid grid-cols-2 gap-2">
              {([1, 2, 3, 4] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => commitQuarter(q)}
                  className={`px-2 py-3 text-sm rounded-md border transition-colors ${
                    value.quarter === q && value.year === pickYear
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  {q}-ci rüb
                </button>
              ))}
            </div>
          )}
          {step === "month" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_AZ.map((m, i) => (
                <button
                  key={m}
                  onClick={() => commitMonth(i)}
                  className={`px-1 py-2 text-xs rounded-md border transition-colors ${
                    value.month === i && value.year === pickYear
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PeriodPicker;
