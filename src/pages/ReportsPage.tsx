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
    return { name: t.length > 18 ? t.substring(0, 18) + "…" : t, value: avg };
  });


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
            <div ref={chartsRef} className="grid grid-cols-2 gap-6">
              {/* Pie 1 - Hədəflər üzrə Bölgü */}
              <ChartFrame title="Hədəflər üzrə Bölgü" subtitle="Seçilmiş hədəflərin proqres müqayisəsi">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <defs>
                        {COLORS.map((c, i) => (
                          <linearGradient key={i} id={`pieGA${i}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={c} stopOpacity={1} />
                            <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie
                        data={pieData.map(d => ({ ...d, value: Math.min(100, Math.round(d.value * factor)) }))}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={120} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={`url(#pieGA${i % COLORS.length})`} stroke="hsl(var(--card))" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              {/* Pie 2 - Komanda üzrə Bölgü */}
              <ChartFrame title="Komanda üzrə Bölgü" subtitle="Komandaların ümumi proqres payı">
                {(factor) => {
                  const data = (resolvedTeams.length > 0 ? teamCompare : pieData).map(d => ({
                    name: d.name, value: Math.min(100, Math.round(d.value * factor)),
                  }));
                  return (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <defs>
                          {COLORS.map((c, i) => (
                            <linearGradient key={i} id={`pieGB${i}`} x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={c} stopOpacity={1} />
                              <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                            </linearGradient>
                          ))}
                        </defs>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={120} paddingAngle={3} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {data.map((_, i) => <Cell key={i} fill={`url(#pieGB${i % COLORS.length})`} stroke="hsl(var(--card))" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                }}
              </ChartFrame>

              {/* Kumulyativ Trend (cəmlənmiş) */}
              <ChartFrame title="Kumulyativ Trend (Cəmlənmiş)" subtitle="Aylar üzrə yığılan ümumi nəticə">
                {(factor) => {
                  let accActual = 0, accTarget = 0;
                  const data = lineData.map(d => {
                    accActual += Math.round(d.actual * factor);
                    accTarget += d.target;
                    return { name: d.name, cumActual: accActual, cumTarget: accTarget };
                  });
                  return (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="cumA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(265 70% 55%)" stopOpacity={0.7} />
                            <stop offset="100%" stopColor="hsl(265 70% 55%)" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="cumB" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(192 80% 48%)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(192 80% 48%)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="cumTarget" stroke="hsl(192 80% 48%)" fill="url(#cumB)" strokeWidth={2} name="Kumulyativ Hədəf" />
                        <Area type="monotone" dataKey="cumActual" stroke="hsl(265 70% 55%)" fill="url(#cumA)" strokeWidth={2.5} name="Kumulyativ Faktiki" />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                }}
              </ChartFrame>

              <ChartFrame title="Hədəf vs Performans">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData.map(d => ({ ...d, performans: Math.min(100, Math.round(d.performans * factor)) }))}>
                      <defs>
                        <linearGradient id="barG1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(230 75% 55%)" stopOpacity={1} />
                          <stop offset="100%" stopColor="hsl(230 75% 55%)" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="hedef" fill="hsl(220 15% 85%)" radius={[6, 6, 0, 0]} name="Hədəf" />
                      <Bar dataKey="performans" fill="url(#barG1)" radius={[6, 6, 0, 0]} name="Performans %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              <ChartFrame title="Trend">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={lineData.map(d => ({ ...d, actual: Math.round(d.actual * factor) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="actual" stroke="hsl(230 75% 50%)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Faktiki" />
                      <Line type="monotone" dataKey="target" stroke="hsl(145 65% 42%)" strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4 }} name="Hədəf" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              <ChartFrame title="Radar Analizi">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData.map(d => ({ ...d, value: Math.min(100, Math.round(d.value * factor)) }))}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar dataKey="value" stroke="hsl(265 70% 55%)" fill="hsl(265 70% 55%)" fillOpacity={0.5} strokeWidth={2} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              <ChartFrame title="Kumulyativ Trend">
                {(factor) => (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={areaData.map(d => ({ ...d, value: Math.round(d.value * factor) }))}>
                      <defs>
                        <linearGradient id="areaG1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(38 92% 55%)" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="hsl(38 92% 55%)" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="areaG2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(145 65% 42%)" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="hsl(145 65% 42%)" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="hedef" stroke="hsl(145 65% 42%)" fill="url(#areaG2)" strokeWidth={2} name="Hədəf" />
                      <Area type="monotone" dataKey="value" stroke="hsl(38 92% 55%)" fill="url(#areaG1)" strokeWidth={2} name="Faktiki" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartFrame>

              {resolvedTeams.length > 1 && (
                <div className="col-span-2">
                  <ChartFrame title="Komanda Müqayisəsi (Orta Performans)">
                    {(factor) => (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={teamCompare.map(d => ({ ...d, value: Math.min(100, Math.round(d.value * factor)) }))} layout="vertical">
                          <defs>
                            <linearGradient id="barG2" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="hsl(192 80% 48%)" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(265 70% 55%)" stopOpacity={1} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={150} />
                          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                          <Bar dataKey="value" fill="url(#barG2)" radius={[0, 6, 6, 0]} name="Orta %" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </ChartFrame>
                </div>
              )}

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
