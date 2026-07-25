import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import ExportMenu from "@/components/common/ExportMenu";
import { Wallet, Plus, Trash2, ChevronDown, ChevronUp, X, FileSpreadsheet, Filter as FilterIcon, Columns, Download, Search, Eye, User as UserIcon, Calendar, FileText, ArrowLeft } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchableSelect from "@/components/common/SearchableSelect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import chrLogo from "@/assets/chr-logo.jpeg";
import { getEmployees, type OrgEmployee } from "@/lib/orgStore";
import {
  getRecords, addRecord, computePay, MONTHS,
  type SalaryRecord, type SalaryPeriod, type Month,
} from "@/lib/salaryStore";
import { getUploads, addUpload, type SalaryUpload } from "@/lib/salaryUploadsStore";
import { AdvancedFilter, evaluateAdvFilter, type AdvFilterState } from "@/components/common/AdvancedFilter";
import type { DataTableColumn } from "@/components/common/DataTable";

const YEARS = [2023, 2024, 2025, 2026];

type ColKey =
  | "no" | "operator" | "firstName" | "lastName" | "fatherName"
  | "monthPay" | "totalPaid" | "avgMonthly" | "pctCurrent" | "pct12m";

interface AggRow {
  employee: OrgEmployee;
  operatorName: string;
  monthPay: number;
  totalPaid: number;
  avgMonthly: number;
  pctCurrent: number;
  pct12m: number;
  allPeriods: Array<SalaryPeriod & { _recordId: number }>;
}

const SalaryPage = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<SalaryRecord[]>(() => getRecords());

  const [employees, setEmployees] = useState<OrgEmployee[]>(() => getEmployees());
  const [uploads, setUploads] = useState<SalaryUpload[]>(() => getUploads());

  // Tabs
  const [activeTab, setActiveTab] = useState<"base" | "uploads">("base");

  // Period selectors — default to a period with data so the table is pre-filled
  const [year, setYear] = useState<string>("2026");
  const [month, setMonth] = useState<string>("Yanvar");
  const [appliedYear, setAppliedYear] = useState<number | null>(2026);
  const [appliedMonth, setAppliedMonth] = useState<Month | null>("Yanvar");

  const [showAdd, setShowAdd] = useState(false);
  const [operatorView, setOperatorView] = useState<AggRow | null>(null);

  // Import flow
  const [importStep, setImportStep] = useState<"closed" | "ask-template" | "pick-period">("closed");
  const [importYear, setImportYear] = useState<string>("");
  const [importMonth, setImportMonth] = useState<string>("");
  const [viewUpload, setViewUpload] = useState<SalaryUpload | null>(null);
  const [mismatchDialog, setMismatchDialog] = useState<{ fileName: string; issues: string[] } | null>(null);

  // Table controls
  const [openSearch, setOpenSearch] = useState<Record<string, boolean>>({});
  const [colSearch, setColSearch] = useState<Record<string, string>>({});
  const [fontSize, setFontSize] = useState(14);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [defaultColWidth, setDefaultColWidth] = useState(150);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [colOrder, setColOrder] = useState<ColKey[]>([
    "no", "operator", "firstName", "lastName", "fatherName",
    "monthPay", "totalPaid", "avgMonthly", "pctCurrent", "pct12m",
  ]);
  const [page, setPage] = useState(1);
  const [dragCol, setDragCol] = useState<ColKey | null>(null);
  const [advFilter, setAdvFilter] = useState<AdvFilterState>({ logic: "AND", rows: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setRecords(getRecords());
    const refreshUploads = () => setUploads(getUploads());
    const refreshEmployees = () => setEmployees(getEmployees());
    window.addEventListener("salary-updated", refresh);
    window.addEventListener("salary-uploads-updated", refreshUploads);
    window.addEventListener("org-updated", refreshEmployees);
    return () => {
      window.removeEventListener("salary-updated", refresh);
      window.removeEventListener("salary-uploads-updated", refreshUploads);
      window.removeEventListener("org-updated", refreshEmployees);
    };
  }, []);

  const COLUMNS = useMemo<{ key: ColKey; label: string; searchable?: boolean }[]>(() => [
    { key: "no", label: "№" },
    { key: "operator", label: "Operatorlar" },
    { key: "firstName", label: "Ad", searchable: true },
    { key: "lastName", label: "Soyad", searchable: true },
    { key: "fatherName", label: "Ata adı", searchable: true },
    { key: "monthPay", label: appliedMonth ?? "Ay", searchable: true },
    { key: "totalPaid", label: "Cəmi ödənilmiş (AZN)", searchable: true },
    { key: "avgMonthly", label: "Orta aylıq əmək haqqı", searchable: true },
    { key: "pctCurrent", label: "Cari ay üçün orta (%)", searchable: true },
    { key: "pct12m", label: "Cari ay üçün orta 12 ay (%)", searchable: true },
  ], [appliedMonth]);

  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>(
    () => ({
      no: true, operator: true, firstName: true, lastName: true, fatherName: true,
      monthPay: true, totalPaid: true, avgMonthly: true, pctCurrent: true, pct12m: true,
    })
  );

  const rows = useMemo<AggRow[]>(() => {
    if (appliedYear == null || appliedMonth == null) return [];
    // Aggregate per employee — merge periods across any duplicate records for
    // the same employee, and dedupe by (year, month) preferring the highest id
    // (most recent write wins).
    const byEmp = new Map<number, { rec: SalaryRecord; periods: SalaryPeriod[] }>();
    for (const r of records) {
      const cur = byEmp.get(r.employeeId);
      if (cur) cur.periods.push(...r.periods);
      else byEmp.set(r.employeeId, { rec: r, periods: [...r.periods] });
    }
    const out: AggRow[] = [];
    byEmp.forEach((v, empId) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      const dedup = new Map<string, SalaryPeriod>();
      for (const p of v.periods) {
        const k = `${p.year}-${p.month}`;
        const prev = dedup.get(k);
        if (!prev || p.id > prev.id) dedup.set(k, p);
      }
      const periods = Array.from(dedup.values());
      const periodMonth = periods.find(p => p.year === appliedYear && p.month === appliedMonth);
      if (!periodMonth) return;
      const monthPay = computePay(periodMonth);
      const totalPaid = periods.reduce((s, p) => s + computePay(p), 0);
      const avgMonthly = periods.length ? Math.round(periods.reduce((s, p) => s + p.salary, 0) / periods.length) : 0;
      const pctCurrent = avgMonthly ? Math.round((monthPay / avgMonthly) * 10000) / 100 : 0;
      const sorted = [...periods].sort((a, b) => a.year - b.year || MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
      const last12 = sorted.slice(-12);
      const avg12 = last12.length ? last12.reduce((s, p) => s + p.salary, 0) / last12.length : 0;
      const pct12m = avg12 ? Math.round((monthPay / avg12) * 10000) / 100 : 0;
      out.push({
        employee: emp,
        operatorName: v.rec.operator,
        monthPay, totalPaid, avgMonthly, pctCurrent, pct12m,
        allPeriods: periods.map(p => ({ ...p, _recordId: v.rec.id })),
      });
    });
    return out;
  }, [records, employees, appliedYear, appliedMonth]);


  const advCols = useMemo<DataTableColumn<AggRow>[]>(() => COLUMNS.map(c => ({
    key: c.key,
    label: c.label,
    filterType: (["monthPay", "totalPaid", "avgMonthly", "pctCurrent", "pct12m"].includes(c.key) ? "number" : "text"),
    accessor: (r) => getCellText(r, c.key),
  })), [COLUMNS]);

  const filteredRows = useMemo(() => {
    const base = rows.filter(row => {
      for (const c of COLUMNS) {
        const q = (colSearch[c.key] || "").trim().toLowerCase();
        if (!q) continue;
        const val = getCellText(row, c.key).toLowerCase();
        if (!val.includes(q)) return false;
      }
      return true;
    });
    return evaluateAdvFilter(base, advCols, advFilter);
  }, [rows, colSearch, COLUMNS, advCols, advFilter]);

  const handleDownload = () => {
    const cols = COLUMNS.filter(c => visibleCols[c.key]);
    const header = cols.map(c => c.label).join(",");
    const lines = filteredRows.map((row, idx) =>
      cols.map(c => `"${(c.key === "no" ? String(idx + 1) : getCellText(row, c.key)).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `emekhaqqi-${appliedYear}-${appliedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const yr = Number(importYear) || new Date().getFullYear();
    const mo = (importMonth || "Yanvar") as Month;

    // Uyğunsuzluq nümunəsi: fayl adında "uygunsuz" / "mismatch" / "xeta" olarsa,
    // sistemə yükləmə tam bloklanır və istifadəçiyə düzəldiş üçün pop-up göstərilir.
    const nameLower = file.name.toLowerCase();
    const looksInvalid = /(uygunsuz|uyğunsuz|mismatch|xeta|xəta|error)/.test(nameLower);

    if (looksInvalid) {
      setMismatchDialog({
        fileName: file.name,
        issues: [
          "3-cü sətir: FIN kodu sistemdə tapılmadı (əməkdaş uyğunlaşdırıla bilmədi).",
          "5-ci sətir: “Ay (məbləğ)” xanası boşdur — məcburi sahədir.",
          "7-ci sətir: “Orta aylıq əmək haqqı” dəyəri mənfi ola bilməz.",
          "Ümumi: 3 sətir uyğunsuzdur — sənəd sistemə yüklənmədi.",
        ],
      });
      e.target.value = "";
      setImportYear("");
      setImportMonth("");
      return; // Uyğunsuzluq düzələnə qədər sənəd sistemə yüklənmir.
    }

    // Build details from real org employees (demo: static-matched)
    const details = employees.map((emp, i) => {
      const monthPay = emp.salary ?? 0;
      const totalPaid = monthPay * 3;
      return {
        no: i + 1,
        firstName: emp.firstName ?? "",
        lastName: emp.lastName ?? "",
        fatherName: emp.fatherName ?? "",
        monthPay,
        totalPaid,
        avgMonthly: monthPay,
        pctCurrent: 100,
        pct12m: 100,
        status: "Uyğunlaşdırıldı" as const,
        qeyd: "FIN və əməkdaş NO üzrə uyğunlaşdırıldı",
      };
    });
    const matched = details.filter(d => d.status === "Uyğunlaşdırıldı").length;
    const unmatched = details.length - matched;
    const totalAmount = details.reduce((s, d) => s + d.monthPay, 0);

    addUpload({
      operator: "HR Departamenti",
      year: yr,
      month: mo,
      status: "Aktiv",
      totalAmount,
      totalRows: details.length,
      matched,
      unmatched,
      fileName: file.name,
      uploadedBy: "Admin",
      title: "Əməkhaqqı detalları",
      details,
    });

    // Also seed base records for the selected period for each employee
    employees.forEach(emp => {
      if (!emp.salary) return;
      void addRecord({
        employeeId: emp.id,
        operator: "HR Departamenti",
        periods: [{
          id: Date.now() + emp.id,
          month: mo,
          year: yr,
          salary: emp.salary,
          totalDays: 22,
          workedDays: 22,
        }],
      });
    });

    toast.success(`"${file.name}" yükləndi və baza yeniləndi`);
    setImportYear(""); setImportMonth("");
    e.target.value = "";
    setActiveTab("uploads");
  };


  const downloadTemplate = () => {
    const headers = ["Ad", "Soyad", "Ata adı", "Ay (məbləğ)", "Cəmi ödənilmiş (AZN)", "Orta aylıq əmək haqqı", "Cari ay üçün orta (%)", "Cari ay üçün orta 12 ay (%)"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Şablon");
    XLSX.writeFile(wb, "emekhaqqi-shablon.xlsx");
    toast.success("Şablon yükləndi");
    setImportStep("closed");
  };

  const visibleColumns = colOrder
    .map(k => COLUMNS.find(c => c.key === k)!)
    .filter(c => c && visibleCols[c.key]);

  const getColWidth = (k: ColKey) => colWidths[k] ?? defaultColWidth;

  const toggleColSearch = (key: string) => {
    setOpenSearch(s => {
      const next = { ...s, [key]: !s[key] };
      if (!next[key]) setColSearch(cs => ({ ...cs, [key]: "" }));
      return next;
    });
  };

  // Pagination
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pagedRows = filteredRows.slice(startIdx, startIdx + rowsPerPage);
  useEffect(() => { setPage(1); }, [appliedYear, appliedMonth, colSearch, rowsPerPage]);

  // Column resize
  const startResize = (key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = getColWidth(key);
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(60, startW + (ev.clientX - startX));
      setColWidths(cw => ({ ...cw, [key]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Column reorder
  const onDragStartCol = (key: ColKey) => setDragCol(key);
  const onDropCol = (target: ColKey) => {
    if (!dragCol || dragCol === target) { setDragCol(null); return; }
    setColOrder(order => {
      const next = order.filter(k => k !== dragCol);
      const idx = next.indexOf(target);
      next.splice(idx, 0, dragCol);
      return next;
    });
    setDragCol(null);
  };


  return (
    <div className="min-h-screen">
      <Header title="Əməkhaqqı bazası" />
      <main className="p-6 pb-24">
        <button
          onClick={() => navigate("/teskilati-struktur")}
          className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        <PageHero

          badge="Əməkhaqqı bazası"
          icon={Wallet}
          title="Əməkhaqqı bazası"
          subtitle="Əməkdaşların əməkhaqqı məlumatlarının idarə edilməsi"
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelImport}
              />
              <button
                onClick={() => toast.success("CHR-dan məlumat sinxronlaşdırılır...")}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors"
              >
                <img src={chrLogo} alt="CHR" className="w-5 h-5 object-contain" />
                CHR-dan import et
              </button>
              <button
                onClick={() => setImportStep("ask-template")}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border bg-background hover:bg-secondary/50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel-dən import et
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <Plus className="w-4 h-4" /> Yeni məlumat əlavə et
              </button>
            </div>
          }
        />

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 border-b border-border">
          <button
            onClick={() => setActiveTab("base")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "base" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Əməkhaqqı bazası
          </button>
          <button
            onClick={() => setActiveTab("uploads")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === "uploads" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Yüklənən sənədlər
          </button>
        </div>

        {activeTab === "uploads" ? (
          <UploadsTab uploads={uploads} onView={setViewUpload} />
        ) : (<>

        {/* Period selector */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">İl</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32 mt-1"><SelectValue placeholder="İl seçin" /></SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ay</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-40 mt-1"><SelectValue placeholder="Ay seçin" /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!year || !month}
            onClick={() => { setAppliedYear(Number(year)); setAppliedMonth(month as Month); }}
          >
            Göstər
          </Button>
          {(appliedYear !== null || appliedMonth !== null) && (
            <Button
              variant="outline"
              onClick={() => { setYear(""); setMonth(""); setAppliedYear(null); setAppliedMonth(null); }}
            >
              Sıfırla
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border">
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Columns className="w-4 h-4" /> Sütunlar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <div className="space-y-1">
                    {COLUMNS.map(c => (
                      <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                        <Checkbox
                          checked={visibleCols[c.key]}
                          onCheckedChange={(v) => setVisibleCols(s => ({ ...s, [c.key]: !!v }))}
                        />
                        <span className="text-sm">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <AdvancedFilter columns={advCols} value={advFilter} onChange={setAdvFilter} />
            </div>
            <ExportMenu
              size="sm"
              disabled={!filteredRows.length}
              getData={() => {
                const cols = visibleColumns;
                return {
                  title: `Əməkhaqqı ${appliedYear}-${appliedMonth}`,
                  fileName: `emekhaqqi-${appliedYear}-${appliedMonth}`,
                  headers: cols.map(c => c.label),
                  rows: filteredRows.map((row, idx) =>
                    cols.map(c => (c.key === "no" ? String(idx + 1) : getCellText(row, c.key)))
                  ),
                };
              }}
            />
          </div>

          {/* Density controls */}
          <div className="flex flex-wrap items-center gap-4 px-3 py-2 border-b border-border text-xs text-muted-foreground bg-secondary/20">
            <Stepper label="Şrift ölçüsü" value={fontSize} setValue={setFontSize} min={10} max={24} />
            <Stepper label="Sətir sayı" value={rowsPerPage} setValue={setRowsPerPage} min={5} max={100} step={5} />
            <Stepper label="Sütun eni" value={defaultColWidth} setValue={setDefaultColWidth} min={80} max={400} step={10} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: `${fontSize}px`, tableLayout: "fixed" }}>
              <thead className="bg-secondary/40">
                <tr className="text-left text-muted-foreground">
                  {visibleColumns.map(c => (
                    <th
                      key={c.key}
                      draggable
                      onDragStart={() => onDragStartCol(c.key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropCol(c.key)}
                      className="relative px-3 py-3 font-medium align-top select-none cursor-grab active:cursor-grabbing"
                      style={{ width: `${getColWidth(c.key)}px`, minWidth: `${getColWidth(c.key)}px` }}
                    >
                      <div className="flex items-center gap-1">
                        {c.searchable && (
                          <button
                            type="button"
                            onClick={() => toggleColSearch(c.key)}
                            className={`p-0.5 rounded hover:bg-secondary ${openSearch[c.key] ? "text-primary" : "opacity-60"}`}
                            title="Axtar"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="truncate">{c.label}</span>
                      </div>
                      {c.searchable && openSearch[c.key] && (
                        <input
                          type="text"
                          autoFocus
                          placeholder="axtar..."
                          value={colSearch[c.key] || ""}
                          onChange={(e) => setColSearch(s => ({ ...s, [c.key]: e.target.value }))}
                          className="mt-2 w-full px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      )}
                      <span
                        onMouseDown={(e) => startResize(c.key, e)}
                        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                        title="Sütunu enləndir"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appliedYear == null || appliedMonth == null ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-muted-foreground">
                      Cədvəli görmək üçün il və ay seçin
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-muted-foreground">
                      Bu dövr üçün məlumat tapılmadı
                    </td>
                  </tr>
                ) : pagedRows.map((row, idx) => (
                  <tr
                    key={row.employee.id}
                    className="border-t border-border hover:bg-secondary/30"
                  >
                    {visibleColumns.map(c => (
                      <td key={c.key} className="px-3 py-2 truncate" style={{ width: `${getColWidth(c.key)}px`, minWidth: `${getColWidth(c.key)}px` }}>
                        {c.key === "no" ? startIdx + idx + 1
                          : c.key === "operator" ? (
                            <button
                              onClick={() => setOperatorView(row)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                              title="Əməkdaşın məlumatları"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )
                          : getCellDisplay(row, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

          {/* Pagination */}
          {appliedYear != null && appliedMonth != null && totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs">
              <div className="text-muted-foreground space-y-0.5">
                <div>Mövcud aralıq: <span className="font-semibold text-foreground">{startIdx + 1} - {Math.min(startIdx + rowsPerPage, totalRows)}</span></div>
                <div>Ümumi say: <span className="font-semibold text-foreground">{totalRows}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Səhifə:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={safePage}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                    setPage(v);
                  }}
                  className="w-14 px-2 py-1 rounded-md border border-border bg-background text-center"
                />
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary/60 disabled:opacity-40"
                >‹</button>
                <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">{safePage}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary/60 disabled:opacity-40"
                >›</button>
              </div>
            </div>
          )}
        </div>
        </>)}
      </main>

      {/* Import: ask template */}
      <Dialog open={importStep === "ask-template"} onOpenChange={(o) => !o && setImportStep("closed")}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Şablonu yükləmək istəyirsiz mi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bəli — sistem şablonunu cihazınıza yükləyəcək. Xeyr — il və ay seçib öz hazır şablonunuzu import edə bilərsiniz.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setImportStep("pick-period"); }}>Xeyr</Button>
            <Button onClick={downloadTemplate}>Bəli</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import: pick period then file */}
      <Dialog open={importStep === "pick-period"} onOpenChange={(o) => !o && setImportStep("closed")}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>İl və ay seçin</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">İl</label>
              <Select value={importYear} onValueChange={setImportYear}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="İl seçin" /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ay</label>
              <Select value={importMonth} onValueChange={setImportMonth}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Ay seçin" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportStep("closed")}>Ləğv et</Button>
            <Button
              disabled={!importYear || !importMonth}
              onClick={() => { setImportStep("closed"); setTimeout(() => fileInputRef.current?.click(), 50); }}
            >
              Davam et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UploadDetailDialog upload={viewUpload} onClose={() => setViewUpload(null)} />

      {/* Uyğunsuzluq pop-up-ı: sənəd sistemə yüklənməyib */}
      <Dialog open={!!mismatchDialog} onOpenChange={(o) => !o && setMismatchDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="w-5 h-5" />
              Sənəddə uyğunsuzluq aşkarlandı
            </DialogTitle>
          </DialogHeader>
          {mismatchDialog && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                <span className="font-medium">“{mismatchDialog.fileName}”</span> faylında uyğunsuz və ya
                çatışmayan məlumatlar var. Zəhmət olmasa aşağıdakı problemləri düzəldin və faylı yenidən yükləyin.
              </p>
              <ul className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1.5 list-disc list-inside">
                {mismatchDialog.issues.map((it, i) => (
                  <li key={i} className="text-foreground/90">{it}</li>
                ))}
              </ul>
              <div className="rounded-md bg-secondary/50 border border-border px-3 py-2 text-xs text-muted-foreground">
                Uyğunsuzluq tam düzələnə qədər sənəd sistemə yüklənməyəcək.
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setMismatchDialog(null)}>Bağla</Button>
                <Button onClick={() => { setMismatchDialog(null); fileInputRef.current?.click(); }}>
                  Yenidən yüklə
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>



      <AddSalaryDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        employees={employees}
        onSaved={(yr, mo) => {
          setYear(String(yr));
          setMonth(mo);
          setAppliedYear(yr);
          setAppliedMonth(mo);
        }}
      />


      <EmployeeDetailDialog
        row={operatorView}
        onClose={() => setOperatorView(null)}
      />
    </div>
  );
};

// ===== Employee Detail Dialog =====

const EmployeeDetailDialog = ({ row, onClose }: { row: AggRow | null; onClose: () => void }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ from?: Date; to?: Date }>({});

  useEffect(() => {
    if (!row) { setStartDate(""); setEndDate(""); setApplied({}); }
  }, [row]);

  const monthIdx = (m: string) => MONTHS.indexOf(m as Month);

  const tableRows = useMemo(() => {
    if (!row) return [];
    const sorted = [...row.allPeriods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : monthIdx(a.month) - monthIdx(b.month)
    );
    if (!applied.from && !applied.to) return sorted;
    return sorted.filter(p => {
      const d = new Date(p.year, monthIdx(p.month), 15);
      if (applied.from && d < applied.from) return false;
      if (applied.to && d > applied.to) return false;
      return true;
    });
  }, [row, applied]);

  const handleShow = () => {
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    setApplied({ from, to });
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary" />
            Əməkdaşın baza məlumatları
          </DialogTitle>
        </DialogHeader>

        {row && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/30 border border-border">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-semibold shadow-sm">
                {(row.employee.firstName?.[0] ?? "") + (row.employee.lastName?.[0] ?? "")}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{row.employee.firstName} {row.employee.lastName}</p>
                <p className="text-xs text-muted-foreground">{row.employee.positionName ?? "Əməkdaş"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Başlama tarixi</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bitmə tarixi</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleShow} disabled={!startDate && !endDate}>Göstər</Button>
              {(applied.from || applied.to) && (
                <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); setApplied({}); }}>
                  Sıfırla
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-primary text-primary-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ay</th>
                    <th className="px-4 py-2 text-left font-medium">İl</th>
                    <th className="px-4 py-2 text-left font-medium">Məbləğ</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Məlumat yoxdur</td></tr>
                  ) : tableRows.map((p, i) => (
                    <tr key={`${p._recordId}-${p.id}-${i}`} className="border-t border-border odd:bg-secondary/20">
                      <td className="px-4 py-2">{p.month}</td>
                      <td className="px-4 py-2">{p.year}</td>
                      <td className="px-4 py-2 font-medium">{computePay(p).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ===== helpers =====

const getCellText = (row: AggRow, key: ColKey): string => {
  switch (key) {
    case "no": return "";
    case "operator": return row.operatorName;
    case "firstName": return row.employee.firstName ?? "";
    case "lastName": return row.employee.lastName ?? "";
    case "fatherName": return row.employee.fatherName ?? "";
    case "monthPay": return String(row.monthPay);
    case "totalPaid": return String(row.totalPaid);
    case "avgMonthly": return String(row.avgMonthly);
    case "pctCurrent": return String(row.pctCurrent);
    case "pct12m": return String(row.pct12m);
  }
};

const getCellDisplay = (row: AggRow, key: ColKey) => {
  switch (key) {
    case "operator": return row.operatorName;
    case "firstName": return row.employee.firstName ?? "—";
    case "lastName": return row.employee.lastName ?? "—";
    case "fatherName": return row.employee.fatherName ?? "—";
    case "monthPay": return row.monthPay.toLocaleString();
    case "totalPaid": return row.totalPaid.toLocaleString();
    case "avgMonthly": return row.avgMonthly.toLocaleString();
    case "pctCurrent": return row.pctCurrent.toFixed(2);
    case "pct12m": return row.pct12m.toFixed(2);
    default: return null;
  }
};

const Stepper = ({
  label, value, setValue, min, max, step = 1,
}: { label: string; value: number; setValue: (v: number) => void; min: number; max: number; step?: number }) => (
  <div className="flex items-center gap-2">
    <span>{label}:</span>
    <button
      onClick={() => setValue(Math.max(min, value - step))}
      className="w-6 h-6 rounded border border-border bg-background hover:bg-secondary/50 flex items-center justify-center"
    >−</button>
    <span className="min-w-[2ch] text-center text-foreground">{value}</span>
    <button
      onClick={() => setValue(Math.min(max, value + step))}
      className="w-6 h-6 rounded border border-border bg-background hover:bg-secondary/50 flex items-center justify-center"
    >+</button>
  </div>
);

// =====================================================
// Add Salary Dialog
// =====================================================

interface AddSalaryDialogProps {
  open: boolean;
  onClose: () => void;
  employees: OrgEmployee[];
  onSaved?: (year: number, month: Month) => void;
}

const blankPeriod = (): Omit<SalaryPeriod, "id"> => ({
  month: "Yanvar",
  year: new Date().getFullYear(),
  salary: 0,
  totalDays: 30,
  workedDays: 0,
});

const AddSalaryDialog = ({ open, onClose, employees, onSaved }: AddSalaryDialogProps) => {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [periods, setPeriods] = useState<Array<Omit<SalaryPeriod, "id"> & { _key: number; _open: boolean }>>([
    { ...blankPeriod(), _key: Date.now(), _open: true },
  ]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEmployeeId("");
    setPeriods([{ ...blankPeriod(), _key: Date.now(), _open: true }]);
  };


  const addPeriod = () => {
    setPeriods(p => [...p, { ...blankPeriod(), _key: Date.now() + Math.random(), _open: true }]);
  };

  const removePeriod = (key: number) => {
    setPeriods(p => p.length === 1 ? p : p.filter(x => x._key !== key));
  };

  const updatePeriod = (key: number, patch: Partial<Omit<SalaryPeriod, "id">>) => {
    setPeriods(p => p.map(x => x._key === key ? { ...x, ...patch } : x));
  };

  const togglePeriod = (key: number) => {
    setPeriods(p => p.map(x => x._key === key ? { ...x, _open: !x._open } : x));
  };

  const handleSave = async () => {
    if (!employeeId) { toast.error("Əməkdaş seçin"); return; }
    const emp = employees.find(e => e.id === Number(employeeId));
    if (!emp) return;
    if (periods.some(p => !p.month || !p.year || p.salary < 0 || p.totalDays <= 0 || p.workedDays < 0)) {
      toast.error("Bütün dövr sahələrini düzgün doldurun");
      return;
    }
    setSaving(true);
    try {
      await addRecord({
        employeeId: emp.id,
        operator: "Admin",
        periods: periods.map((p, i) => ({
          id: Date.now() + i,
          month: p.month,
          year: p.year,
          salary: p.salary,
          totalDays: p.totalDays,
          workedDays: p.workedDays,
        })),
      });
      const last = periods[periods.length - 1];
      onSaved?.(last.year, last.month);
      toast.success("Məlumat əlavə edildi və yadda saxlanıldı");
      reset();
      onClose();
    } catch (e) {
      toast.error("Yadda saxlama zamanı xəta baş verdi");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni məlumat əlavə et</DialogTitle>
          <p className="text-sm text-muted-foreground">Əməkdaş üçün əməkhaqqı dövrlərini daxil edin</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Əməkdaşlar</label>
            <div className="mt-1">
              <SearchableSelect
                value={employeeId}
                onChange={setEmployeeId}
                options={employees.map(e => ({ value: String(e.id), label: `${e.firstName} ${e.lastName}` }))}
                placeholder="Əməkdaş seçin"
              />
            </div>
          </div>

          {periods.map((p, idx) => (
            <div key={p._key} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => togglePeriod(p._key)}
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  {p._open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Dövr #{idx + 1}
                </button>
                {periods.length > 1 && (
                  <button onClick={() => removePeriod(p._key)} className="p-1 rounded hover:bg-destructive/10">
                    <X className="w-4 h-4 text-destructive" />
                  </button>
                )}
              </div>

              {p._open && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Ay</label>
                      <Select value={p.month} onValueChange={(v) => updatePeriod(p._key, { month: v as Month })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">İl</label>
                      <Input
                        type="number"
                        value={p.year}
                        onChange={(e) => updatePeriod(p._key, { year: Number(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Maaş</label>
                      <Input
                        type="number"
                        value={p.salary}
                        onChange={(e) => updatePeriod(p._key, { salary: Number(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Ümumi gün sayı</label>
                      <Input
                        type="number"
                        value={p.totalDays}
                        onChange={(e) => updatePeriod(p._key, { totalDays: Number(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Gün sayı</label>
                      <Input
                        type="number"
                        value={p.workedDays}
                        onChange={(e) => updatePeriod(p._key, { workedDays: Number(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          <button
            onClick={addPeriod}
            className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/40 transition-colors flex items-center justify-center gap-2"
            title="Dövr əlavə et"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Ləğv et</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saxlanılır..." : "Yadda saxla"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================
// Uploads Tab
// =====================================================

const UploadsTab = ({ uploads, onView }: { uploads: SalaryUpload[]; onView: (u: SalaryUpload) => void }) => {
  const [q, setQ] = useState("");
  const filtered = uploads.filter(u => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.operator, u.month, String(u.year), u.fileName, u.uploadedBy, u.status].some(v => v.toLowerCase().includes(s));
  });

  const downloadOne = (u: SalaryUpload) => {
    const ws = XLSX.utils.json_to_sheet(u.details.map(d => ({
      "№": d.no,
      "Ad": d.firstName,
      "Soyad": d.lastName,
      "Ata adı": d.fatherName,
      "Ay (məbləğ)": d.monthPay,
      "Cəmi ödənilmiş (AZN)": d.totalPaid,
      "Orta aylıq əmək haqqı": d.avgMonthly,
      "Cari ay üçün orta (%)": d.pctCurrent,
      "Cari ay üçün orta 12 ay (%)": d.pct12m,
      "Status": d.status,
      "Qeyd": d.qeyd,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detallar");
    XLSX.writeFile(wb, u.fileName.replace(/\.[^.]+$/, "") + ".xlsx");
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Axtar..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground">Ümumi: {filtered.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
          <thead className="bg-secondary/40">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-3 font-medium w-12">№</th>
              <th className="px-3 py-3 font-medium">Operatorlar</th>
              <th className="px-3 py-3 font-medium">İl</th>
              <th className="px-3 py-3 font-medium">Ay</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Cəmi sətir</th>
              <th className="px-3 py-3 font-medium">Uyğun</th>
              <th className="px-3 py-3 font-medium">Uyğunsuz</th>
              <th className="px-3 py-3 font-medium">Fayl adı</th>
              <th className="px-3 py-3 font-medium">Fayl yükləyən əməkdaş</th>
              <th className="px-3 py-3 font-medium">Yaradılma tarixi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Sənəd tapılmadı</td></tr>
            ) : filtered.map((u, idx) => (
              <tr key={u.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2">{idx + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onView(u)} title="Bax" className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-primary">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => downloadOne(u)} title="Yüklə" className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-primary">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">{u.year}</td>
                <td className="px-3 py-2">{u.month}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {u.status}
                  </span>
                </td>
                <td className="px-3 py-2">{u.totalRows}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs border border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    {u.matched}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs border border-border text-muted-foreground">
                    {u.unmatched}
                  </span>
                </td>
                <td className="px-3 py-2 truncate">{u.fileName}</td>
                <td className="px-3 py-2">{u.uploadedBy}</td>
                <td className="px-3 py-2">{new Date(u.createdAt).toLocaleDateString("az-AZ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
    </div>
  );
};

// =====================================================
// Upload Detail Dialog
// =====================================================

const UploadDetailDialog = ({ upload, onClose }: { upload: SalaryUpload | null; onClose: () => void }) => {
  return (
    <Dialog open={!!upload} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        {upload && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {upload.title}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {upload.status}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Dövr</div>
                <div className="font-semibold mt-1">{upload.month} {upload.year}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Ümumi məbləğ</div>
                <div className="font-semibold mt-1">{upload.totalAmount.toFixed(2)} AZN</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Uyğun / Ümumi</div>
                <div className="font-semibold mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400">{upload.matched}</span> / {upload.totalRows}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">Uyğunsuz</div>
                <div className="font-semibold mt-1">{upload.unmatched}</div>
              </div>
            </div>

            <div className="text-sm font-medium mb-2">Sətir detalları</div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium w-10">#</th>
                    <th className="px-3 py-2 font-medium">Ad</th>
                    <th className="px-3 py-2 font-medium">Soyad</th>
                    <th className="px-3 py-2 font-medium">Ata adı</th>
                    <th className="px-3 py-2 font-medium">Ay (məbləğ)</th>
                    <th className="px-3 py-2 font-medium">Cəmi ödənilmiş (AZN)</th>
                    <th className="px-3 py-2 font-medium">Orta aylıq</th>
                    <th className="px-3 py-2 font-medium">Cari ay (%)</th>
                    <th className="px-3 py-2 font-medium">12 ay (%)</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Qeyd</th>
                  </tr>
                </thead>
                <tbody>
                  {upload.details.map(d => (
                    <tr key={d.no} className="border-t border-border">
                      <td className="px-3 py-2">{d.no}</td>
                      <td className="px-3 py-2">{d.firstName}</td>
                      <td className="px-3 py-2">{d.lastName}</td>
                      <td className="px-3 py-2">{d.fatherName}</td>
                      <td className="px-3 py-2">{d.monthPay.toLocaleString()}</td>
                      <td className="px-3 py-2">{d.totalPaid.toLocaleString()}</td>
                      <td className="px-3 py-2">{d.avgMonthly.toLocaleString()}</td>
                      <td className="px-3 py-2">{d.pctCurrent.toFixed(2)}</td>
                      <td className="px-3 py-2">{d.pct12m.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${d.status === "Uyğunlaşdırıldı" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.qeyd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SalaryPage;

