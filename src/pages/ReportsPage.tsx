import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/layout/Header";
import { Search, Download, ChevronDown, Sparkles, Mic, X, Check, Target, Users, ShoppingCart, AlertCircle, Settings2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, AreaChart, Area, ComposedChart } from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTeams, type Team } from "@/lib/teamsStore";
import { PageHero } from "@/components/ui/page-hero";
import ExcelImportButton from "@/components/common/ExcelImportButton";
import PeriodPicker, { currentPeriod, periodLabel, type PeriodValue } from "@/components/common/PeriodPicker";
import DropdownMultiSelect from "@/components/kpi/DropdownMultiSelect";
import SearchableSelect from "@/components/common/SearchableSelect";
import { useReportRows, buildTrendSeries, type ReportRow } from "@/lib/reportsDataset";
import { useSampleResultsSeed } from "@/lib/sampleResultsSeed";
import { inferTargetStatus, TARGET_STATUS_LABEL, type TargetStatus } from "@/lib/targetStatus";

const STATUS_COLOR: Record<TargetStatus, string> = {
  achieved: "hsl(152 60% 38%)",
  in_progress: "hsl(38 92% 50%)",
  not_achieved: "hsl(0 72% 55%)",
};

const rowDeadline = (r: ReportRow) => {
  const parts = String(r.period || "").split(/\s[–-]\s/);
  return parts[parts.length - 1]?.trim();
};
const rowStatus = (r: ReportRow): TargetStatus => inferTargetStatus(r.progress, rowDeadline(r));

const CompareTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const diff = d.actual - d.target;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md space-y-0.5">
      <p className="font-semibold text-foreground">{d.fullName}</p>
      <p className="text-muted-foreground">Hədəf: <b className="text-foreground">{d.target.toLocaleString()} {d.unit}</b></p>
      <p className="text-muted-foreground">Faktiki: <b className="text-foreground">{d.actual.toLocaleString()} {d.unit}</b></p>
      <p className="text-muted-foreground">Fərq: <b className="text-foreground">{diff > 0 ? "+" : ""}{diff.toLocaleString()} {d.unit}</b></p>
      <p className="text-muted-foreground">İcra faizi: <b className="text-foreground">{d.faktiki}%</b></p>
      <p className="text-muted-foreground">Status: <b className="text-foreground">{TARGET_STATUS_LABEL[d.status as TargetStatus]}</b></p>
    </div>
  );
};

type FilterType = "position" | "person" | "structure" | "team";
const FILTER_LABELS: Record<FilterType, string> = {
  position: "Vəzifə",
  person: "Şəxs",
  structure: "Struktur",
  team: "Komanda",
};

const uniq = (list: string[]) => Array.from(new Set(list.filter(Boolean)));

const COLORS = [
  "hsl(230, 75%, 50%)", "hsl(145, 65%, 42%)", "hsl(38, 92%, 55%)", "hsl(0, 78%, 60%)",
  "hsl(265, 70%, 55%)", "hsl(192, 80%, 48%)", "hsl(20, 85%, 55%)", "hsl(330, 70%, 55%)",
];


const ReportsPage = () => {
  // Nəticəsi olan KPI-lar üçün nümunə hesabat datası hazırlanır
  useSampleResultsSeed();
  const [teams, setTeams] = useState<Team[]>(() => getTeams());


  // Filter type + values
  const [filterType, setFilterType] = useState<FilterType>("team");
  const [filterValues, setFilterValues] = useState<string[]>([]);
  const [showFilterTypeDropdown, setShowFilterTypeDropdown] = useState(false);

  // Targets dropdown
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [targetSearch, setTargetSearch] = useState("");

  const [generated, setGenerated] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // AI assistant
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const refresh = () => setTeams(getTeams());
    window.addEventListener("teams-updated", refresh);
    return () => window.removeEventListener("teams-updated", refresh);
  }, []);

  // Təşkilatın real KPI nəticələri (nümunə nəticələr də bura daxildir)
  const rows = useReportRows();

  // Options for the second dropdown based on filter type
  const secondOptions = useMemo(() => {
    if (filterType === "position") return uniq(rows.map(r => r.position));
    if (filterType === "structure") return uniq(rows.map(r => r.structure));
    if (filterType === "team") return uniq(rows.flatMap(r => r.teams));
    if (filterType === "person") {
      return uniq(rows.map(r => r.employeeId)).map(id => {
        const r = rows.find(x => x.employeeId === id)!;
        return { value: id, label: r.employeeName, group: r.position };
      });
    }
    return [];
  }, [filterType, rows]);

  const isMulti = filterType !== "person";

  // Seçimə uyğun nəticə sətirləri
  const filteredRows = useMemo(() => {
    if (filterValues.length === 0) return [] as ReportRow[];
    return rows.filter(r => {
      if (filterType === "team") return r.teams.some(t => filterValues.includes(t));
      if (filterType === "structure") return filterValues.some(v => r.structure === v || r.structure.includes(v));
      if (filterType === "position") return filterValues.includes(r.position);
      return filterValues.includes(r.employeeId);
    });
  }, [rows, filterType, filterValues]);

  const groupOf = (r: ReportRow) => {
    if (filterType === "team") return r.teams.find(t => filterValues.includes(t)) || "—";
    if (filterType === "structure") return filterValues.find(v => r.structure.includes(v)) || r.structure;
    if (filterType === "position") return r.position;
    return r.employeeName;
  };

  // Qrup etiketləri (komanda / struktur / vəzifə / şəxs)
  const resolvedTeams = useMemo(
    () => uniq(filteredRows.map(groupOf)),
    [filteredRows, filterType, filterValues],
  );

  // Selection summary label
  const selectionLabel = useMemo(() => {
    if (filterValues.length === 0) return "";
    if (filterType === "person") {
      const opt = (secondOptions as { value: string; label: string }[]).find(o => o.value === filterValues[0]);
      return opt?.label || "";
    }
    return `${filterValues.length} seçildi`;
  }, [filterType, filterValues, secondOptions]);

  // Hədəf adına görə qruplaşdırılmış nəticələr
  const availableTargets = useMemo(() => {
    const map = new Map<string, { team: string; sum: number; n: number; kpi: { name: string; structure: string; subStructure: string; progress: number; target: string; current: string; icon: any } }>();
    filteredRows.forEach(r => {
      const prev = map.get(r.targetName);
      if (prev) {
        prev.sum += r.progress;
        prev.n += 1;
        prev.kpi.progress = Math.round(prev.sum / prev.n);
        return;
      }
      map.set(r.targetName, {
        team: groupOf(r),
        sum: r.progress,
        n: 1,
        kpi: {
          name: r.targetName,
          structure: r.structure,
          subStructure: r.cardName,
          progress: r.progress,
          target: `${r.target}${r.unit ? " " + r.unit : ""}`,
          current: `${r.actual}${r.unit ? " " + r.unit : ""}`,
          icon: r.progress >= 100 ? Target : r.progress >= 75 ? Users : AlertCircle,
        },
      });
    });
    return Array.from(map.values()).map(v => ({ team: v.team, kpi: v.kpi }));
  }, [filteredRows, filterType, filterValues]);

  const displayedTargets = availableTargets.filter(t => t.kpi.name.toLowerCase().includes(targetSearch.toLowerCase()));
  const allTargetsSelected = displayedTargets.length > 0 && displayedTargets.every(t => selectedTargets.includes(t.kpi.name));

  const handleFilterTypeChange = (t: FilterType) => {
    setFilterType(t);
    setFilterValues([]);
    setSelectedTargets([]);
    setGenerated(false);
    setShowFilterTypeDropdown(false);
  };

  const toggleFilterValue = (v: string) => {
    setFilterValues(prev => {
      if (!isMulti) return prev[0] === v ? [] : [v];
      return prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v];
    });
    setSelectedTargets([]);
    setGenerated(false);
  };

  const setFilterValuesBulk = (next: string[]) => {
    setFilterValues(next);
    setSelectedTargets([]);
    setGenerated(false);
  };

  const toggleAllTargets = () => {
    if (allTargetsSelected) setSelectedTargets([]);
    else setSelectedTargets(displayedTargets.map(t => t.kpi.name));
  };
  const toggleTarget = (name: string) => setSelectedTargets(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const handleGenerate = () => {
    if (filterValues.length === 0) { toast.error("Ən azı bir dəyər seçin"); return; }
    if (selectedTargets.length === 0) { toast.error("Ən azı bir hədəf seçin"); return; }
    setGenerated(true);
  };

  // Chart data
  const chartKpis = availableTargets.filter(t => selectedTargets.includes(t.kpi.name)).map(t => ({ ...t.kpi, team: t.team }));
  const selectedRows = filteredRows.filter(r => selectedTargets.includes(r.targetName));
  const pieData = chartKpis.map(k => ({ name: k.name.length > 16 ? k.name.substring(0, 16) + "…" : k.name, value: k.progress }));
  const barData = chartKpis.map(k => ({ name: k.name.length > 12 ? k.name.substring(0, 12) + "…" : k.name, performans: k.progress, hedef: 100 }));
  const lineData = buildTrendSeries(selectedRows);
  const radarData = chartKpis.slice(0, 6).map(k => ({ subject: k.name.length > 10 ? k.name.substring(0, 10) + "…" : k.name, value: k.progress, fullMark: 100 }));
  const areaData = lineData.map(d => ({ name: d.name, value: d.actual, hedef: d.target }));

  // Per-group comparison
  const teamCompare = resolvedTeams.map(t => {
    const groupRows = selectedRows.filter(r => groupOf(r) === t);
    const avg = groupRows.length ? Math.round(groupRows.reduce((s, r) => s + r.progress, 0) / groupRows.length) : 0;
    const achieved = groupRows.filter(r => rowStatus(r) === "achieved").length;
    return {
      name: t.length > 24 ? t.substring(0, 24) + "…" : t,
      value: avg,
      achievedPct: groupRows.length ? Math.round((achieved / groupRows.length) * 100) : 0,
    };
  });

  // Hədəf vs faktiki (KPI üzrə)
  const compareData = chartKpis.map(k => {
    const rs = selectedRows.filter(r => r.targetName === k.name);
    const r0 = rs[0];
    const statuses = rs.map(rowStatus);
    const status: TargetStatus = statuses.every(s => s === "achieved") ? "achieved"
      : statuses.some(s => s === "not_achieved") ? "not_achieved" : (k.progress >= 100 ? "achieved" : "in_progress");
    const target = rs.reduce((s, r) => s + (r.target || 0), 0);
    const actual = rs.reduce((s, r) => s + (r.actual || 0), 0);
    return {
      name: k.name.length > 26 ? k.name.substring(0, 26) + "…" : k.name,
      fullName: k.name, hedef: 100, faktiki: k.progress, status,
      target, actual, unit: r0?.unit || "",
    };
  });

  // Status bölgüsü (sistemin 3 hədəf statusu)
  const statusData = (["achieved", "in_progress", "not_achieved"] as TargetStatus[])
    .map(key => ({ key, name: TARGET_STATUS_LABEL[key], value: compareData.filter(d => d.status === key).length }))
    .filter(d => d.value > 0);


  const handleDownloadPdf = async () => {
    if (!chartsRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(chartsRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.setFontSize(16); pdf.text("KPI Hesabat", 14, 15);
      pdf.setFontSize(10); pdf.text(`${FILTER_LABELS[filterType]}: ${filterValues.join(", ")}`, 14, 22);
      pdf.addImage(imgData, "PNG", 10, 28, pdfWidth - 20, pdfHeight * ((pdfWidth - 20) / pdfWidth));
      pdf.save("KPI_Hesabat.pdf");
    } catch (e) { console.error(e); }
    setDownloading(false);
  };

  // AI placeholder: parse keywords to auto-pick teams / targets
  const runAi = () => {
    const text = aiText.toLowerCase();
    const matched: string[] = [];
    teams.forEach(t => { if (text.includes(t.name.toLowerCase())) matched.push(t.name); });
    if (matched.length === 0) {
      toast.error("Komanda tanınmadı");
      return;
    }
    setFilterType("team");
    setFilterValues(matched);
    setTimeout(() => {
      const teamRows = rows.filter(r => r.teams.some(t => matched.includes(t)));
      const named = uniq(teamRows.map(r => r.targetName).filter(n => text.includes(n.toLowerCase().split(" ")[0])));
      const finalTargets = named.length > 0 ? named : uniq(teamRows.map(r => r.targetName));

      setSelectedTargets(finalTargets);
      setGenerated(true);
      toast.success("AI seçimləri tətbiq etdi");
      setAiOpen(false);
      setAiText("");
    }, 200);
  };

  const toggleRecording = () => {
    setRecording(r => !r);
    if (!recording) toast.info("Mikrofon (placeholder) — sonra qoşulacaq");
  };

  return (
    <div className="relative min-h-screen">
      <Header title="Hesabat" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Hesabat Mərkəzi"
          icon={Sparkles}
          title="KPI Dashboard"
          subtitle="Komandaları və hədəfləri seçərək vizual hesabat qurun"
          right={
            <div className="flex items-center gap-2">
              <ExcelImportButton />
              <button
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-md hover:shadow-lg hover:scale-[1.02] transition-all text-sm font-medium"
              >
                <Sparkles className="w-4 h-4" /> AI Köməkçi
              </button>
            </div>
          }
        />

        {/* Setup card */}
        <div className="bg-card rounded-xl p-5 border border-border max-w-3xl shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            {/* Filter type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Filtr növü</label>
              <div className="relative">
                <div onClick={() => setShowFilterTypeDropdown(v => !v)} className="w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background cursor-pointer flex items-center justify-between">
                  <span className="text-foreground">{FILTER_LABELS[filterType]}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                {showFilterTypeDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    {(Object.keys(FILTER_LABELS) as FilterType[]).map(t => (
                      <div key={t} onClick={() => handleFilterTypeChange(t)} className={`px-3 py-2 text-sm hover:bg-secondary cursor-pointer flex items-center justify-between ${filterType === t ? 'bg-primary/5 font-medium' : ''}`}>
                        <span>{FILTER_LABELS[t]}</span>
                        {filterType === t && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic second dropdown */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{FILTER_LABELS[filterType]}</label>
              {isMulti ? (
                <DropdownMultiSelect
                  options={secondOptions as string[]}
                  selected={filterValues}
                  onToggle={toggleFilterValue}
                  onChange={setFilterValuesBulk}
                  placeholder={`${FILTER_LABELS[filterType]} seçin`}
                  searchPlaceholder="Axtar..."
                  hideTags
                  countLabel={(n) => `${n} ${FILTER_LABELS[filterType].toLowerCase()} seçilib`}
                />
              ) : (
                <SearchableSelect
                  value={filterValues[0] || ""}
                  onChange={v => { setFilterValues(v ? [v] : []); setSelectedTargets([]); setGenerated(false); }}
                  options={secondOptions as any}
                  placeholder="Şəxs seçin"
                  allowClear
                />
              )}
            </div>

            {/* Targets multi-select dropdown */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Hədəflər</label>
              <div className="relative">
                <div
                  onClick={() => filterValues.length > 0 && setShowTargetDropdown(!showTargetDropdown)}
                  className={`w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background flex items-center justify-between ${filterValues.length > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                >
                  <span className={selectedTargets.length > 0 ? "text-foreground" : "text-muted-foreground"}>
                    {selectedTargets.length > 0 ? `${selectedTargets.length} hədəf seçilib` : "Hədəf seçin"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                {showTargetDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
                    <div className="p-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={targetSearch} onChange={e => setTargetSearch(e.target.value)} placeholder="Hədəf axtar..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded bg-background" onClick={e => e.stopPropagation()} />
                      </div>
                      <button onClick={e => { e.stopPropagation(); toggleAllTargets(); }} className="text-xs text-primary font-medium px-2 py-1 hover:bg-primary/10 rounded">
                        {allTargetsSelected ? "Sil" : "Hamısı"}
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {displayedTargets.map((t, i) => {
                        const Icon = t.kpi.icon;
                        const sel = selectedTargets.includes(t.kpi.name);
                        return (
                          <div key={i} onClick={e => { e.stopPropagation(); toggleTarget(t.kpi.name); }} className={`px-3 py-2 text-sm hover:bg-secondary cursor-pointer flex items-center gap-2 ${sel ? 'bg-primary/5' : ''}`}>
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{t.kpi.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{t.team}</p>
                            </div>
                            {sel && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </div>
                        );
                      })}
                      {displayedTargets.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">Hədəf yoxdur</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-5">
            <button onClick={handleGenerate} disabled={filterValues.length === 0 || selectedTargets.length === 0} className="px-5 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
              Hesabatı formalaşdır
            </button>
          </div>
        </div>


        {/* Charts */}
        {generated && chartKpis.length > 0 && (
          <>
            <div className="flex justify-end mt-6 mb-3">
              <button onClick={handleDownloadPdf} disabled={downloading} className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm">
                <Download className="w-4 h-4" /> {downloading ? "Yüklənir..." : "PDF olaraq yüklə"}
              </button>
            </div>
            <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Hədəf və faktiki nəticələrin müqayisəsi */}
              <div className="lg:col-span-2">
                <ChartFrame title="Hədəf və faktiki nəticələrin müqayisəsi" subtitle="Hər KPI üzrə planlaşdırılmış hədəf və faktiki icra">
                  {(factor) => {
                    const data = compareData.map(d => ({ ...d, faktiki: Math.round(d.faktiki * factor) }));
                    return (
                      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 56 + 60)}>
                        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} tick={{ fontSize: 12 }} unit="%" />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={170} />
                          <Tooltip content={<CompareTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="hedef" name="Planlaşdırılmış hədəf" fill="hsl(var(--muted-foreground) / 0.35)" radius={[0, 4, 4, 0]} barSize={14} />
                          <Bar dataKey="faktiki" name="Faktiki nəticə" radius={[0, 4, 4, 0]} barSize={14}
                            label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}%` }}>
                            {data.map((d, i) => <Cell key={i} fill={STATUS_COLOR[d.status]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  }}
                </ChartFrame>
              </div>

              {/* 2. KPI statuslarının bölgüsü */}
              <ChartFrame title="KPI statuslarının bölgüsü" subtitle="Hədəflərin statuslar üzrə sayı">
                {() => (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="45%" innerRadius={70} outerRadius={115} paddingAngle={2} dataKey="value"
                          label={({ value, percent }) => `${value} (${Math.round(percent * 100)}%)`}>
                          {statusData.map(d => <Cell key={d.key} fill={STATUS_COLOR[d.key]} stroke="hsl(var(--card))" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute left-0 right-0 top-[45%] -translate-y-1/2 text-center">
                      <p className="text-3xl font-bold text-foreground">{chartKpis.length}</p>
                      <p className="text-xs text-muted-foreground">Ümumi KPI</p>
                    </div>
                  </div>
                )}
              </ChartFrame>

              {/* 3. Performansın zaman üzrə dinamikası */}
              <ChartFrame title="Performansın zaman üzrə dinamikası" subtitle="Hədəf və faktiki icra faizi">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={lineData.map(d => ({ ...d, actual: Math.round(d.actual * factor), target: 100 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 120]} unit="%" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="actual" stroke="hsl(152 60% 42%)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} name="Faktiki nəticə" />
                      <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="6 6" dot={false} name="Hədəf" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              {/* 4. Komandaların müqayisəsi */}
              <div className="lg:col-span-2">
                <ChartFrame title="Komandaların müqayisəsi" subtitle="Orta performans faizinə görə sıralanıb">
                  {(factor) => {
                    const data = teamCompare
                      .map(d => ({ ...d, value: Math.round(d.value * factor) }))
                      .sort((a, b) => b.value - a.value);
                    return (
                      <div className="space-y-4">
                        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 48 + 40)}>
                          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={170} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} formatter={(v: number) => `${v}%`} />
                            <Bar dataKey="value" name="Orta performans" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={18}
                              label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}%` }} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {data.map(d => (
                            <div key={d.name} className="rounded-lg border border-border bg-background px-3 py-2">
                              <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>Orta performans: <b className="text-foreground">{d.value}%</b></span>
                                <span>Hədəfə çatan: <b className="text-foreground">{d.achievedPct}%</b></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                </ChartFrame>
              </div>
            </div>
          </>
        )}
      </main>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Hesabat Köməkçisi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Görmək istədiyiniz hesabatı təsvir edin — komandalar və hədəflər avtomatik seçiləcək.</p>
            <div className="relative">
              <textarea value={aiText} onChange={e => setAiText(e.target.value)} rows={4} placeholder="Məsələn: Elite Satış komandasının aylıq satış göstəricilərini göstər" className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background resize-none focus:ring-2 focus:ring-ring focus:outline-none" />
              <button onClick={toggleRecording} className={`absolute bottom-2 right-2 p-2 rounded-full transition-colors ${recording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary hover:bg-primary hover:text-primary-foreground'}`}>
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={runAi} disabled={!aiText.trim()} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">Tətbiq et</button>
              <button onClick={() => setAiOpen(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary transition-colors">Ləğv et</button>
            </div>
            <p className="text-[11px] text-muted-foreground italic">AI sonra qoşulacaq — hazırda placeholder.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PERIOD_FACTORS = { year: 1.1, quarter: 1, month: 0.85 } as const;

const ChartFrame = ({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: (factor: number) => React.ReactNode }) => {
  const [period, setPeriod] = useState<PeriodValue>(() => currentPeriod("quarter"));
  const factor = PERIOD_FACTORS[period.mode];
  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-md">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-foreground text-lg truncate">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle ? `${subtitle} • ` : ""}{periodLabel(period)}</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>
      {children(factor)}
    </div>
  );
};

export default ReportsPage;
