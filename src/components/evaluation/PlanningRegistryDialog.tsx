import { useMemo, useState } from "react";
import {
  CalendarDays, Search, Eye, RefreshCw, FileSpreadsheet, X, Building2, Users, ClipboardCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import KpiPlanningDialog from "./KpiPlanningDialog";

type Status = "Aktiv" | "Planlaşdırılır" | "Tamamlandı" | "Arxivləşdirilib";
type EvalType = "Yarımillik" | "İllik" | "Hər ikisi";

interface PlanRow {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  evalType: EvalType;
  periodCount: number;
  status: Status;
  lastEditDate: string;
  createdBy: string;
  department: string;
  approvalMatrix: string;
  reminderDays: number;
}

const initialPlans: PlanRow[] = [];

const fmt = (d: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

const statusBadge = (s: Status) => {
  const map: Record<Status, string> = {
    "Aktiv": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
    "Planlaşdırılır": "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
    "Tamamlandı": "bg-slate-200 text-slate-700 hover:bg-slate-200 border-slate-300",
    "Arxivləşdirilib": "bg-slate-100 text-slate-500 hover:bg-slate-100 border-slate-200",
  };
  return <Badge variant="outline" className={`text-[11px] font-medium ${map[s]}`}>{s}</Badge>;
};

const typeBadge = (t: EvalType) => {
  const label = t === "Yarımillik" ? "Yarımillik (6M)" : t === "İllik" ? "İllik (12M)" : "Hər ikisi";
  const cls = t === "İllik"
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : t === "Hər ikisi"
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return <Badge variant="outline" className={`text-[11px] font-medium ${cls}`}>{label}</Badge>;
};

interface Props { trigger?: React.ReactNode; }

const PlanningRegistryDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [plans] = useState<PlanRow[]>(initialPlans);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [evalType, setEvalType] = useState<string>("all");
  const [pageSize, setPageSize] = useState("10");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PlanRow | null>(null);

  const filtered = useMemo(() => {
    return plans
      .filter(p => {
        if (status !== "all" && p.status !== status) return false;
        if (evalType !== "all" && p.evalType !== evalType) return false;
        if (query) {
          const q = query.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.department.toLowerCase().includes(q) && !p.status.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.lastEditDate.localeCompare(a.lastEditDate));
  }, [plans, query, status, evalType]);

  const size = parseInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * size, currentPage * size);

  const clearFilters = () => { setQuery(""); setStatus("all"); setEvalType("all"); setPage(1); };

  const exportExcel = () => {
    const headers = ["№", "Planın adı", "Plan dövrü", "Qiymətləndirmə tipi", "Dövr sayı", "Status", "Son redaktə", "Yaradan", "Departament"];
    const rows = filtered.map((p, i) => [
      i + 1, p.name, `${fmt(p.startDate)} - ${fmt(p.endDate)}`, p.evalType, p.periodCount, p.status, fmt(p.lastEditDate), p.createdBy, p.department,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `planlama-reyestri-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel faylı yükləndi");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Planlama Reyestri
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-[1200px] w-[95vw] h-[85vh] overflow-hidden rounded-xl p-0 gap-0 flex flex-col">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Planlama Reyestri</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Yaradılmış KPI qiymətləndirmə planlarının siyahısı.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 h-9">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel export
            </Button>
            <KpiPlanningDialog />
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-border bg-muted/20">
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-4">
                <Label className="text-[11px] font-medium text-muted-foreground">Axtarış</Label>
                <div className="relative mt-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Axtar..." className="pl-8 h-9 text-sm" />
                </div>
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Bütün statuslar</SelectItem>
                    <SelectItem value="Aktiv">Aktiv</SelectItem>
                    <SelectItem value="Planlaşdırılır">Planlaşdırılır</SelectItem>
                    <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                    <SelectItem value="Arxivləşdirilib">Arxivləşdirilib</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-[11px] font-medium text-muted-foreground">Qiymətləndirmə tipi</Label>
                <Select value={evalType} onValueChange={setEvalType}>
                  <SelectTrigger className="h-9 mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Bütün</SelectItem>
                    <SelectItem value="Yarımillik">Yarımillik</SelectItem>
                    <SelectItem value="İllik">İllik</SelectItem>
                    <SelectItem value="Hər ikisi">Hər ikisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 md:col-span-2">
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full h-9 gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Təmizlə
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left w-10">#</th>
                    <th className="px-3 py-3 text-center w-24">Əməliyyatlar</th>
                    <th className="px-3 py-3 text-left">Planın adı</th>
                    <th className="px-3 py-3 text-left">Plan dövrü</th>
                    <th className="px-3 py-3 text-left">Qiymətləndirmə tipi</th>
                    <th className="px-3 py-3 text-left">Dövr sayı</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Son redaktə</th>
                  </tr>
                </thead>
                <tbody>
                  <TooltipProvider delayDuration={150}>
                    {pageRows.map((p, i) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-3 text-muted-foreground">{(currentPage - 1) * size + i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => setDetail(p)} className="p-1.5 rounded hover:bg-primary/10">
                                  <Eye className="w-4 h-4 text-primary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Bax</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-foreground">{p.name}</td>
                        <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{fmt(p.startDate)} — {fmt(p.endDate)}</td>
                        <td className="px-3 py-3">{typeBadge(p.evalType)}</td>
                        <td className="px-3 py-3 text-foreground">{p.periodCount}</td>
                        <td className="px-3 py-3">{statusBadge(p.status)}</td>
                        <td className="px-3 py-3 text-xs">
                          <div className="text-foreground">{fmt(p.lastEditDate)}</div>
                          <div className="text-muted-foreground">{p.createdBy}</div>
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">Plan tapılmadı</td></tr>
                    )}
                  </TooltipProvider>
                </tbody>
              </table>
              </div>
          </div>

          {/* Footer */}
          <div className="px-6 pt-2 pb-4 border-t border-border bg-muted/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Ümumi {filtered.length} plan</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(p => p - 1)}>‹</Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <Button key={n} variant={n === currentPage ? "default" : "outline"} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(n)}>{n}</Button>
                ))}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
                <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / səhifə</SelectItem>
                    <SelectItem value="20">20 / səhifə</SelectItem>
                    <SelectItem value="50">50 / səhifə</SelectItem>
                    <SelectItem value="100">100 / səhifə</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-3 flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-semibold">i</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Qeyd</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Yalnız bir plan <span className="font-medium">Aktiv</span> statusunda ola bilər. "Bax" düyməsi vasitəsilə planın bütün parametrlərini görə bilərsiniz. Excel export ilə cədvəli yükləyə bilərsiniz.
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="font-medium">Aktiv</span><span className="text-muted-foreground">– cari plan</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="font-medium">Planlaşdırılır</span><span className="text-muted-foreground">– gələcək</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /><span className="font-medium">Tamamlandı</span><span className="text-muted-foreground">– bitmiş</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /><span className="font-medium">Arxivləşdirilib</span></div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-[700px] w-[95vw] max-h-[85vh] overflow-y-auto rounded-xl p-0 gap-0">
          {detail && (
            <>
              <div className="px-6 pt-6 pb-4 border-b border-border flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">{detail.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Plan haqqında detallı məlumat</p>
                </div>
                <div>{statusBadge(detail.status)}</div>
              </div>
              <div className="px-6 py-5 space-y-5">
                <section className="grid grid-cols-2 gap-4">
                  <Field icon={<CalendarDays className="w-3.5 h-3.5" />} label="Başlama tarixi" value={fmt(detail.startDate)} />
                  <Field icon={<CalendarDays className="w-3.5 h-3.5" />} label="Bitmə tarixi" value={fmt(detail.endDate)} />
                  <Field icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Qiymətləndirmə tipi" value={detail.evalType} />
                  <Field icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Dövr sayı" value={String(detail.periodCount)} />
                  <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Departament" value={detail.department} />
                  <Field icon={<Users className="w-3.5 h-3.5" />} label="Yaradan şəxs" value={detail.createdBy} />
                  <Field icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Təsdiqləmə matrisi" value={detail.approvalMatrix} />
                  <Field icon={<CalendarDays className="w-3.5 h-3.5" />} label="Xatırlatma" value={`${detail.reminderDays} gün əvvəl`} />
                </section>

                <section>
                  <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">Dövrlər</h3>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Dövr</th>
                          <th className="px-3 py-2 text-left">Başlama</th>
                          <th className="px-3 py-2 text-left">Bitmə</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.evalType === "Yarımillik" ? (
                          <>
                            <tr className="border-t border-border"><td className="px-3 py-2">1</td><td className="px-3 py-2">1-ci yarımil</td><td className="px-3 py-2">{fmt(detail.startDate)}</td><td className="px-3 py-2">{detail.startDate.slice(0, 4)}-06-30</td></tr>
                            <tr className="border-t border-border"><td className="px-3 py-2">2</td><td className="px-3 py-2">2-ci yarımil</td><td className="px-3 py-2">{detail.startDate.slice(0, 4)}-07-01</td><td className="px-3 py-2">{fmt(detail.endDate)}</td></tr>
                          </>
                        ) : (
                          <tr className="border-t border-border"><td className="px-3 py-2">1</td><td className="px-3 py-2">İllik dövr</td><td className="px-3 py-2">{fmt(detail.startDate)}</td><td className="px-3 py-2">{fmt(detail.endDate)}</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                </section>
              </div>
              <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end rounded-b-xl">
                <Button variant="outline" onClick={() => setDetail(null)} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Bağla
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Field = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div>
    <div className="text-sm font-medium text-foreground">{value}</div>
  </div>
);

export default PlanningRegistryDialog;
