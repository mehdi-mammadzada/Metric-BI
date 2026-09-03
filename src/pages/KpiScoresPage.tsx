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
import { MONTHS } from "@/lib/salaryStore";
import { cn, withKartSuffix } from "@/lib/utils";
import { useVisibleSharedKpiCards } from "@/lib/kpiCardStore";
import { calcCompletion, getSubKpis, isEvaluated } from "@/lib/kpiEvaluationStore";
import { useSampleResultsSeed } from "@/lib/sampleResultsSeed";


const YEARS = [2025, 2026];

const pad = (n: number) => String(n).padStart(2, "0");
const lastDayOfMonth = (year: number, mIdx: number) => new Date(year, mIdx + 1, 0).getDate();

const scoreColor = (s: number) =>
  s >= 4.5
    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
    : s >= 4.0
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : s >= 3.5
    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

interface GoalRow {
  name: string;
  target: number;
  actual: number;
  unit: string;
  weight: number;
  score: number;
  progress: number;
  note?: string;
}

interface ScoreRow {
  empId: number;
  fullName: string;
  fatherName: string;
  cardId: string;
  cardName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  score: number;
  goals: GoalRow[];
}

export interface KpiScoresPageProps {
  employeesOverride?: ReturnType<typeof getEmployees>;
  hideChrome?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
}

type Periodicity = "weekly" | "monthly" | "quarterly" | "halfyear" | "yearly" | "other";

const KpiScoresPage = ({ employeesOverride, hideChrome, heroTitle, heroSubtitle }: KpiScoresPageProps = {}) => {
  useSampleResultsSeed();
  const employees = useMemo(() => employeesOverride || getEmployees().filter(e => e.active), [employeesOverride]);

  const cards = useVisibleSharedKpiCards();
  const employeeById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getEmployees>[number]>();
    employees.forEach(e => {
      map.set(String(e.id), e);
      map.set(`e${e.id}`, e);
    });
    return map;
  }, [employees]);
  const cardOptions = useMemo(() => Array.from(new Set(cards.map(c => c.name).filter(Boolean))), [cards]);

  const [period, setPeriod] = useState<PeriodSelection>(() => emptyPeriodSelection("monthly"));

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [cardSearch, setCardSearch] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [viewEmp, setViewEmp] = useState<ScoreRow | null>(null);

  const filteredCardOpts = cardOptions.filter(c => c.toLowerCase().includes(cardSearch.trim().toLowerCase()));
  const allSelected = cardOptions.length > 0 && selectedCards.length === cardOptions.length;

  const toggleCard = (c: string) =>
    setSelectedCards(s => (s.includes(c) ? s.filter(x => x !== c) : [...s, c]));
  const toggleAll = () => setSelectedCards(allSelected ? [] : [...cardOptions]);

  const resolvedPeriod = useMemo(() => resolvePeriod(period), [period]);

  const rows: ScoreRow[] = useMemo(() => {
    if (!resolvedPeriod) return [];
    const activeCards = selectedCards.length > 0 ? selectedCards : cardOptions;
    if (activeCards.length === 0) return [];
    const out: ScoreRow[] = [];
    cards.filter(card => activeCards.includes(card.name)).forEach(card => {
      card.assigneeIds.forEach(assigneeId => {
        const emp = employeeById.get(String(assigneeId));
        if (!emp) return;
        const evaluated = getSubKpis(String(assigneeId)).filter(k => (k.cardId === card.id || k.cardId === card.name) && isEvaluated(k));
        if (evaluated.length === 0) return;
        const totalWeight = evaluated.reduce((sum, item) => sum + item.weight, 0) || 100;
        const goals: GoalRow[] = evaluated.map(item => ({
          name: item.name,
          target: item.target,
          actual: item.actual ?? 0,
          unit: item.unit,
          weight: item.weight,
          score: item.evaluatedScore ?? 0,
          progress: calcCompletion(item),
          note: item.selfComment,
        }));
        const score = evaluated.reduce((sum, item) => sum + ((item.evaluatedScore ?? 0) * item.weight), 0) / totalWeight;
        out.push({
          empId: emp.id,
          fullName: `${emp.firstName} ${emp.lastName}`,
          fatherName: emp.fatherName ?? "",
          cardId: card.id,
          cardName: card.name,
          periodLabel: resolvedPeriod.label,
          startDate: card.startDate || "—",
          endDate: card.endDate || "—",
          score: Math.round(score * 100) / 100,
          goals,
        });
      });
    });
    const q = globalSearch.trim().toLowerCase();
    if (!q) return out;
    return out.filter(r => r.fullName.toLowerCase().includes(q) || r.cardName.toLowerCase().includes(q));
  }, [cards, selectedCards, cardOptions, resolvedPeriod, globalSearch, employeeById]);

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
        <div className="rounded-xl border border-border bg-card p-4 mb-4 grid grid-cols-1 md:grid-cols-[minmax(400px,460px)_1fr_auto] gap-3 items-end">
          <PeriodRangePicker value={period} onChange={setPeriod} />


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
          rows={!resolvedPeriod ? [] : rows}
          rowKey={(r) => `${r.empId}-${r.cardId}`}
          storageKey="kpi-scores-table"
          emptyMessage={!resolvedPeriod ? "Cədvəli görmək üçün dövrü seçin" : "Nəticə tapılmadı"}
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
                onClick={() => setViewEmp(r)}
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
        periodLabel={resolvedPeriod?.label ?? ""}
        onClose={() => setViewEmp(null)}
      />
    </div>
  );
};

const fmtNum = (n: number) => new Intl.NumberFormat("az-AZ").format(n);

// ===== Employee detail dialog — bir KPI kartının daxili =====

const EmployeeKpiDialog = ({
  emp, periodLabel, onClose,
}: {
  emp: ScoreRow | null;
  periodLabel: string;
  onClose: () => void;
}) => {
  const rows = emp?.goals ?? [];
  const total = emp?.score ?? 0;

  return (
    <Dialog open={!!emp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            {emp?.fullName} — {emp ? withKartSuffix(emp.cardName) : ""}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Dövr: {periodLabel} · Real qiymətləndirmə nəticələri</p>
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
                        <div className="text-[11px] text-muted-foreground mt-0.5">{r.note || "Qiymətləndirmə qeydi yoxdur"}</div>
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

                  {/* SAĞ: Qiymətləndirmə paneli */}
                  <div className="p-4 bg-secondary/20">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Qiymətləndirmə</div>
                    <div className="text-sm text-foreground">Real nəticə: {r.score.toFixed(2)} / 5</div>
                    <div className="mt-3 rounded-md bg-background/70 border border-border px-3 py-2 text-[11px] font-mono text-muted-foreground">
                      ({r.weight}%×{r.score.toFixed(2)}) ={" "}
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

