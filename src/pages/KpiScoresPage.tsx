import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { BarChart3, Search, Eye, Check, X as XIcon, ChevronDown, User as UserIcon, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, isSameWeek } from "date-fns";
import { az } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import ExportMenu from "@/components/common/ExportMenu";
import { DataTable } from "@/components/common/DataTable";
import { getEmployees } from "@/lib/orgStore";
import { MONTHS, type Month } from "@/lib/salaryStore";
import { cn, withKartSuffix } from "@/lib/utils";

const YEARS = [2024, 2025, 2026];

const KPI_CARDS = [
  "Satış Həcmi",
  "Müştəri Məmnuniyyəti",
  "Komanda İşi",
  "Vaxtında Tapşırıq Yerinə Yetirmə",
  "Peşəkar İnkişaf",
  "Yeni Müştəri Cəlbi",
];

const EVALUATORS = [];

const monthIdx = (m: string) => MONTHS.indexOf(m as Month);
const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, mIdx: number) => new Date(year, mIdx + 1, 0).getDate();

// Deterministic pseudo-score so the page is stable across renders
const scoreFor = (empId: number, cardIdx: number, year: number, mIdx: number) => {
  const seed = (empId * 31 + cardIdx * 7 + year + mIdx * 3) % 100;
  const base = 3.4 + (seed / 100) * 1.6; // 3.4..5.0
  return Math.round(base * 10) / 10;
};

// Hər hədəf üçün 1–3 qiymətləndirici (çəki + bal) — bəzilərində 2+ qiymətləndirici olur.
const evaluatorsFor = (empId: number, cardIdx: number): { name: string; role: string; weight: number; score: number }[] => {
  const count = ((empId + cardIdx) % 3) + 1; // 1, 2 və ya 3
  const picks: { name: string; role: string; weight: number; score: number }[] = [];
  for (let i = 0; i < count; i++) {
    const ev = EVALUATORS[(empId + cardIdx + i * 2) % EVALUATORS.length];
    const seed = (empId * 17 + cardIdx * 5 + i * 11) % 100;
    const s = Math.round((2 + (seed / 100) * 3) * 10) / 10; // 2..5
    picks.push({ name: ev.name, role: ev.role, weight: 0, score: s });
  }
  // Çəkiləri 100%-ə normallaşdır (ilk fərqli paylar: 80/20, 60/30/10 və s.)
  const weights = count === 1 ? [100] : count === 2 ? [70, 30] : [50, 30, 20];
  picks.forEach((p, i) => (p.weight = weights[i]));
  return picks;
};

const evaluatorFor = (empId: number, cardIdx: number) =>
  EVALUATORS[(empId + cardIdx) % EVALUATORS.length];

const scoreColor = (s: number) =>
  s >= 4.5
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : s >= 4.0
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : s >= 3.5
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

interface ScoreRow {
  empId: number;
  fullName: string;
  fatherName: string;
  cardIdx: number;
  cardName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  score: number;
}

export interface KpiScoresPageProps {
  employeesOverride?: ReturnType<typeof getEmployees>;
  hideChrome?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
}

type Periodicity = "weekly" | "monthly" | "quarterly" | "halfyear" | "yearly" | "other";

const KpiScoresPage = ({ employeesOverride, hideChrome, heroTitle, heroSubtitle }: KpiScoresPageProps = {}) => {
  const employees = useMemo(() => employeesOverride || getEmployees().filter(e => e.active), [employeesOverride]);

  // ==== Period selection (Bonus-style) ====
  const [periodicity, setPeriodicity] = useState<Periodicity>("monthly");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1)); // 1..12
  const [quarter, setQuarter] = useState<string>("");
  const [half, setHalf] = useState<string>("");
  const [weekDate, setWeekDate] = useState<Date | undefined>();
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});

  const resetSelection = () => {
    setYear(String(new Date().getFullYear())); setMonth(""); setQuarter(""); setHalf("");
    setWeekDate(undefined); setRange({});
  };

  const [selectedCards, setSelectedCards] = useState<string[]>([...KPI_CARDS]);
  const [cardSearch, setCardSearch] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [viewEmp, setViewEmp] = useState<{ id: number; fullName: string; cardIdx: number; cardName: string } | null>(null);

  const filteredCardOpts = KPI_CARDS.filter(c => c.toLowerCase().includes(cardSearch.trim().toLowerCase()));
  const allSelected = selectedCards.length === KPI_CARDS.length;

  const toggleCard = (c: string) =>
    setSelectedCards(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));
  const toggleAll = () => setSelectedCards(allSelected ? [] : [...KPI_CARDS]);

  // Resolve currently selected period → { label, start, end, yr, mIdx }
  const resolvedPeriod = useMemo(() => {
    const fmtDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    if (periodicity === "weekly" && weekDate) {
      const s = startOfWeek(weekDate, { weekStartsOn: 1 });
      const e = endOfWeek(weekDate, { weekStartsOn: 1 });
      return { label: `${format(s, "d MMM", { locale: az })} – ${format(e, "d MMM yyyy", { locale: az })}`, start: fmtDate(s), end: fmtDate(e), yr: s.getFullYear(), mIdx: s.getMonth() };
    }
    if (periodicity === "monthly" && year && month) {
      const yr = Number(year); const mIdx = Number(month) - 1;
      const s = new Date(yr, mIdx, 1); const e = new Date(yr, mIdx, lastDayOfMonth(yr, mIdx));
      return { label: `${MONTHS[mIdx]} ${yr}`, start: fmtDate(s), end: fmtDate(e), yr, mIdx };
    }
    if (periodicity === "quarterly" && year && quarter) {
      const yr = Number(year); const q = Number(quarter);
      const sMonth = (q - 1) * 3; const s = new Date(yr, sMonth, 1); const e = new Date(yr, sMonth + 3, 0);
      return { label: `${yr} Rüb ${q}`, start: fmtDate(s), end: fmtDate(e), yr, mIdx: sMonth };
    }
    if (periodicity === "halfyear" && year && half) {
      const yr = Number(year); const first = half === "I";
      const s = new Date(yr, first ? 0 : 6, 1); const e = new Date(yr, first ? 6 : 12, 0);
      return { label: `${yr} ${half} yarımil`, start: fmtDate(s), end: fmtDate(e), yr, mIdx: first ? 0 : 6 };
    }
    if (periodicity === "yearly" && year) {
      const yr = Number(year); const s = new Date(yr, 0, 1); const e = new Date(yr, 11, 31);
      return { label: `${yr}`, start: fmtDate(s), end: fmtDate(e), yr, mIdx: 0 };
    }
    if (periodicity === "other" && range.from && range.to) {
      return { label: `${format(range.from, "d MMM yyyy", { locale: az })} – ${format(range.to, "d MMM yyyy", { locale: az })}`, start: fmtDate(range.from), end: fmtDate(range.to), yr: range.from.getFullYear(), mIdx: range.from.getMonth() };
    }
    return null;
  }, [periodicity, year, month, quarter, half, weekDate, range]);

  const rows: ScoreRow[] = useMemo(() => {
    if (selectedCards.length === 0 || !resolvedPeriod) return [];
    const { label: periodLabel, start: startDate, end: endDate, yr, mIdx } = resolvedPeriod;

    const out: ScoreRow[] = [];
    employees.forEach(emp => {
      selectedCards.forEach(card => {
        const cardIdx = KPI_CARDS.indexOf(card);
        out.push({
          empId: emp.id,
          fullName: `${emp.firstName} ${emp.lastName}`,
          fatherName: emp.fatherName ?? "",
          cardIdx,
          cardName: card,
          periodLabel,
          startDate,
          endDate,
          score: scoreFor(emp.id, cardIdx, yr, mIdx),
        });
      });
    });

    const q = globalSearch.trim().toLowerCase();
    if (!q) return out;
    return out.filter(r => r.fullName.toLowerCase().includes(q) || r.cardName.toLowerCase().includes(q));
  }, [employees, selectedCards, resolvedPeriod, globalSearch]);

  const clearAll = () => {
    setSelectedCards([]);
    setCardSearch("");
    setGlobalSearch("");
  };

  const renderPeriodPicker = () => {
    if (periodicity === "weekly") {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start", !weekDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {weekDate ? `${format(startOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM", { locale: az })} – ${format(endOfWeek(weekDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: az })}` : "Həftə seçin"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={weekDate} onSelect={setWeekDate} weekStartsOn={1}
              modifiers={{ inWeek: (d) => weekDate ? isSameWeek(d, weekDate, { weekStartsOn: 1 }) : false }}
              modifiersClassNames={{ inWeek: "bg-primary/10 text-foreground" }}
              className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      );
    }
    if (periodicity === "monthly") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="İl" /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue placeholder="Ay" /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    }
    if (periodicity === "quarterly") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="İl" /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger><SelectValue placeholder="Rüb" /></SelectTrigger>
            <SelectContent>{[1,2,3,4].map(q => <SelectItem key={q} value={String(q)}>Rüb {q}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      );
    }
    if (periodicity === "halfyear") {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="İl" /></SelectTrigger>
            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={half} onValueChange={setHalf}>
            <SelectTrigger><SelectValue placeholder="Yarımil" /></SelectTrigger>
            <SelectContent><SelectItem value="I">I yarımil</SelectItem><SelectItem value="II">II yarımil</SelectItem></SelectContent>
          </Select>
        </div>
      );
    }
    if (periodicity === "yearly") {
      return (
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger><SelectValue placeholder="İl seçin" /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    if (periodicity === "other") {
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start", !range.from && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {range.from && range.to ? `${format(range.from, "d MMM yyyy", { locale: az })} – ${format(range.to, "d MMM yyyy", { locale: az })}` : "Tarix aralığı"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={range as any} onSelect={(r: any) => setRange(r || {})} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen">
      {!hideChrome && <Header title="KPI Nəticələri" />}
      <main className={hideChrome ? "" : "p-6 pb-24"}>
        {!hideChrome && (
          <PageHero
            badge="KPI Nəticələri"
            icon={BarChart3}
            title={heroTitle || "KPI Nəticələri"}
            subtitle={heroSubtitle || "Əməkdaşların KPI kartları üzrə qiymətləndirmə nəticələri"}
          />
        )}


        {/* Filter bar */}
        <div className="rounded-xl border border-border bg-card p-4 mb-4 grid grid-cols-1 md:grid-cols-[200px_260px_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Dövrlük</label>
            <Select value={periodicity} onValueChange={(v) => { setPeriodicity(v as Periodicity); resetSelection(); }}>
              <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Həftəlik</SelectItem>
                <SelectItem value="monthly">Aylıq</SelectItem>
                <SelectItem value="quarterly">Rüblük</SelectItem>
                <SelectItem value="halfyear">Yarımillik</SelectItem>
                <SelectItem value="yearly">İllik</SelectItem>
                <SelectItem value="other">Digər</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Konkret dövr</label>
            {renderPeriodPicker()}
          </div>

          <div className="min-w-[260px]">
            <label className="text-xs text-muted-foreground">KPI Kartları</label>
            <Popover open={cardOpen} onOpenChange={setCardOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mt-1 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-background text-sm hover:bg-secondary/40"
                >
                  <span className="flex items-center gap-1 flex-wrap min-h-[1.25rem]">
                    {selectedCards.length === 0 ? (
                      <span className="text-muted-foreground">KPI kartı seçin...</span>
                    ) : (
                      <>
                        {selectedCards.slice(0, 2).map(c => (
                          <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                            {c}
                            <XIcon
                              className="w-3 h-3 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); toggleCard(c); }}
                            />
                          </span>
                        ))}
                        {selectedCards.length > 2 && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                            +{selectedCards.length - 2}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      autoFocus
                      value={cardSearch}
                      onChange={(e) => setCardSearch(e.target.value)}
                      placeholder="KPI kartı axtar..."
                      className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/50 border-b border-border"
                >
                  <Checkbox checked={allSelected} />
                  <span className="font-medium">Hamısını seç</span>
                </button>
                <div className="max-h-64 overflow-y-auto">
                  {filteredCardOpts.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">Tapılmadı</div>
                  ) : filteredCardOpts.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCard(c)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/40"
                    >
                      <Checkbox checked={selectedCards.includes(c)} />
                      <span>{c}</span>
                      {selectedCards.includes(c) && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={clearAll}>Təmizlə</Button>
          </div>
        </div>

        {/* Table */}
        <DataTable<ScoreRow>
          rows={selectedCards.length === 0 || !resolvedPeriod ? [] : rows}
          rowKey={(r) => `${r.empId}-${r.cardIdx}`}
          storageKey="kpi-scores-table"
          emptyMessage={!resolvedPeriod ? "Cədvəli görmək üçün dövrü seçin" : selectedCards.length === 0 ? "Ən azı bir KPI kartı seçin" : "Nəticə tapılmadı"}
          toolbarLeft={
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Əməkdaş və ya KPI axtar..."
                className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring w-64"
              />
            </div>
          }
          toolbarRight={
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Cəmi: {rows.length} nəticə</span>
              <ExportMenu
                size="sm"
                disabled={!rows.length}
                getData={() => ({
                  title: `KPI Qiymətləri ${resolvedPeriod?.label || ""}`,
                  fileName: `kpi-qiymetleri-${resolvedPeriod?.label || "hesabat"}`,
                  headers: ["Əməkdaşın A.S.A.", "KPI Kartının Adı", "Başlama tarixi", "Bitmə tarixi", "Qiymət (Bal)"],
                  rows: rows.map(r => [[r.fullName, r.fatherName].filter(Boolean).join(" "), withKartSuffix(r.cardName), r.startDate, r.endDate, `${r.score.toFixed(2)} / 5`]),
                })}
              />
            </div>
          }
          columns={[
            { key: "name", label: "Əməkdaşın A.S.A.", filterType: "text", accessor: (r) => [r.fullName, r.fatherName].filter(Boolean).join(" "), render: (r) => <span className="font-medium text-foreground">{[r.fullName, r.fatherName].filter(Boolean).join(" ")}</span> },
            { key: "card", label: "KPI Kartının Adı", filterType: "text", accessor: (r) => withKartSuffix(r.cardName), render: (r) => <span>{withKartSuffix(r.cardName)}</span> },
            { key: "start", label: "Başlama Tarixi", filterType: "text", accessor: (r) => r.startDate, render: (r) => <span className="text-muted-foreground">{r.startDate}</span> },
            { key: "end", label: "Bitmə Tarixi", filterType: "text", accessor: (r) => r.endDate, render: (r) => <span className="text-muted-foreground">{r.endDate}</span> },
            { key: "score", label: "Qiymət (Bal)", filterType: "number", accessor: (r) => r.score, render: (r) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${scoreColor(r.score)}`}>{r.score.toFixed(2)} / 5</span>
            ) },
            { key: "op", label: "Əməliyyat", filterType: "none", align: "center", width: 100, render: (r) => (
              <button
                onClick={() => setViewEmp({ id: r.empId, fullName: r.fullName, cardIdx: r.cardIdx, cardName: r.cardName })}
                title="Detallar"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
            ) },
          ]}
        />

      </main>

      <EmployeeKpiDialog
        emp={viewEmp}
        year={resolvedPeriod?.yr ?? new Date().getFullYear()}
        mIdx={resolvedPeriod?.mIdx ?? 0}
        periodLabel={resolvedPeriod?.label ?? ""}
        onClose={() => setViewEmp(null)}
      />
    </div>
  );
};

// ===== Card goals catalog (real system goals) =====
const CARD_GOALS: Record<string, { name: string; target: number; unit: string; weight: number }[]> = {
  "Satış Həcmi": [
    { name: "Aylıq satış həcmi", target: 150000, unit: "AZN", weight: 45 },
    { name: "Yeni müqavilə sayı", target: 12, unit: "ədəd", weight: 30 },
    { name: "Ortalama sövdələşmə ölçüsü", target: 12500, unit: "AZN", weight: 25 },
  ],
  "Müştəri Məmnuniyyəti": [
    { name: "CSAT balı", target: 90, unit: "%", weight: 40 },
    { name: "NPS", target: 55, unit: "bal", weight: 35 },
    { name: "Şikayət cavab müddəti", target: 24, unit: "saat", weight: 25 },
  ],
  "Komanda İşi": [
    { name: "Komanda məmnuniyyət balı", target: 4.5, unit: "bal", weight: 40 },
    { name: "Cross-functional layihə iştirakı", target: 3, unit: "ədəd", weight: 30 },
    { name: "Peer review ortalaması", target: 4.3, unit: "bal", weight: 30 },
  ],
  "Vaxtında Tapşırıq Yerinə Yetirmə": [
    { name: "Vaxtında bitirilmə faizi", target: 95, unit: "%", weight: 50 },
    { name: "Gecikən tapşırıq sayı", target: 2, unit: "ədəd", weight: 25 },
    { name: "SLA uyğunluğu", target: 98, unit: "%", weight: 25 },
  ],
  "Peşəkar İnkişaf": [
    { name: "Tədris saatları", target: 20, unit: "saat", weight: 40 },
    { name: "Tamamlanmış sertifikatlar", target: 2, unit: "ədəd", weight: 35 },
    { name: "Daxili mentor saatları", target: 8, unit: "saat", weight: 25 },
  ],
  "Yeni Müştəri Cəlbi": [
    { name: "Yeni aktiv müştəri", target: 20, unit: "ədəd", weight: 45 },
    { name: "Lead-dən müştəriyə konversiya", target: 25, unit: "%", weight: 30 },
    { name: "Outbound zəng sayı", target: 200, unit: "ədəd", weight: 25 },
  ],
};

const isLowerBetter = (unit: string, name: string) =>
  /saat|gün|day|hour|şikayət|gecik/i.test(`${unit} ${name}`);

const goalScoreFor = (empId: number, cardIdx: number, goalIdx: number, year: number, mIdx: number) => {
  const seed = (empId * 41 + cardIdx * 13 + goalIdx * 7 + year + mIdx * 5) % 100;
  return Math.round((3 + (seed / 100) * 2) * 10) / 10; // 3.0..5.0
};

const actualFromScore = (target: number, score: number, lower: boolean) => {
  // score 5 → 100%, 3 → 70%, 1 → 40% (təxmini)
  const pct = 40 + (score / 5) * 60;
  const val = lower ? target / (pct / 100) : target * (pct / 100);
  const rounded = target >= 100 ? Math.round(val) : Math.round(val * 100) / 100;
  return rounded;
};

const fmtNum = (n: number) => new Intl.NumberFormat("az-AZ").format(n);

// ===== Employee detail dialog — bir KPI kartının daxili =====

const initials = (fullName: string) =>
  fullName.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");

const EmployeeKpiDialog = ({
  emp, year, mIdx, periodLabel, onClose,
}: {
  emp: { id: number; fullName: string; cardIdx: number; cardName: string } | null;
  year: number;
  mIdx: number;
  periodLabel: string;
  onClose: () => void;
}) => {
  const goals = emp ? (CARD_GOALS[emp.cardName] || []) : [];
  // Hər hədəf üçün qiymətləndiriciləri götürürük və hədəfin balını
  // Σ(çəki × bal) formulası ilə hesablayırıq (backend-dən real gələn məlumat kimi işlənir).
  const rows = emp ? goals.map((g, gi) => {
    const evaluators = evaluatorsFor(emp.id, emp.cardIdx * 10 + gi);
    // Daxili hesablamada tam dəqiqlik saxlanılır, yuvarlaqlaşdırma yalnız göstərilən nəticələrdə.
    const scoreRaw = evaluators.reduce((s, e) => s + (e.weight / 100) * e.score, 0);
    const score = Math.round(scoreRaw * 100) / 100;
    const lower = isLowerBetter(g.unit, g.name);
    const actual = actualFromScore(g.target, score, lower);
    return { ...g, score, scoreRaw, actual, lower, evaluators, weightedRaw: (g.weight / 100) * scoreRaw };
  }) : [];
  const totalRaw = rows.reduce((s, r) => s + r.weightedRaw, 0);
  const total = Math.round(totalRaw * 100) / 100;

  return (
    <Dialog open={!!emp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            {emp?.fullName} — {emp ? withKartSuffix(emp.cardName) : ""}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Dövr: {periodLabel} · Hər hədəf üzrə qiymətləndiricilər və yekun hesablama</p>
        </DialogHeader>

        {emp && (
          <div className="space-y-4">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                Bu kart üçün hədəf tapılmadı
              </div>
            ) : rows.map((r, i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-0">
                  {/* SOL: hədəf məlumatı */}
                  <div className="p-4 border-b md:border-b-0 md:border-r border-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold text-foreground">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.lower ? "Az yaxşıdır" : "Çox yaxşıdır"}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs border font-semibold ${scoreColor(r.score)}`}>
                        {r.score.toFixed(2)} / 5
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-md bg-secondary/40 px-2 py-1.5">
                        <div className="text-muted-foreground">Hədəf</div>
                        <div className="font-medium tabular-nums">{fmtNum(r.target)} {r.unit}</div>
                      </div>
                      <div className="rounded-md bg-secondary/40 px-2 py-1.5">
                        <div className="text-muted-foreground">Faktiki</div>
                        <div className="font-medium tabular-nums">{fmtNum(r.actual)} {r.unit}</div>
                      </div>
                      <div className="rounded-md bg-secondary/40 px-2 py-1.5">
                        <div className="text-muted-foreground">Çəki</div>
                        <div className="font-medium tabular-nums">{r.weight}%</div>
                      </div>
                    </div>
                  </div>

                  {/* SAĞ: Qiymətləndirənlər paneli */}
                  <div className="p-4 bg-secondary/20">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Qiymətləndirənlər</div>
                    <div className="space-y-2">
                      {r.evaluators.map((ev, j) => (
                        <div key={j} className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                            {initials(ev.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">{ev.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{ev.role}</div>
                          </div>
                          <div className="text-xs tabular-nums text-foreground/80">
                            <span className="font-medium">{ev.weight}%</span> × <span className="font-medium">{ev.score.toFixed(2)}</span>/5
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-md bg-background/70 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground">
                      {r.evaluators.map(e => `(${e.weight}%×${e.score.toFixed(2)})`).join(" + ")}
                      {" = "}
                      <span className="text-primary font-bold">{r.score.toFixed(2)} bal</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Yekun kart nəticəsi */}
            {rows.length > 0 && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-foreground">Ümumi KPI kart nəticəsi</div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm border font-semibold ${scoreColor(total)}`}>
                    {total.toFixed(2)} / 5
                  </span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  {rows.map(r => `(${r.weight}%×${r.score.toFixed(2)})`).join(" + ")} ={" "}
                  <span className="text-primary font-bold">{total.toFixed(2)}</span> bal
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button onClick={onClose}>Bağla</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KpiScoresPage;

