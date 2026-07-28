import { useEffect, useMemo, useState } from "react";
import { Shield, Eye, Search, Paperclip, Download, AlertCircle, Clock, CheckCircle2, Inbox } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/common/DataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { listReports, updateStatus, WB_CATEGORIES, STATUS_LABEL, type WBReport, type WBStatus, seedWhistleblowerDemo } from "@/lib/whistleblowerStore";
import { useCatalogValues } from "@/lib/dropdownCatalogStore";
import { useAuth } from "@/contexts/AuthContext";
import { User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_WB_STATUS_KEYS: WBStatus[] = ["yeni", "arashdirilir", "hell_olundu"];

const getStatusLabel = (status: WBStatus, labels: string[]) => {
  const idx = DEFAULT_WB_STATUS_KEYS.indexOf(status);
  if (idx >= 0) return labels[idx] ?? STATUS_LABEL[status] ?? status;
  return STATUS_LABEL[status] ?? status;
};

const getStatusOptions = (labels: string[]) => {
  const base = DEFAULT_WB_STATUS_KEYS.map((value, index) => ({ value, label: labels[index] ?? STATUS_LABEL[value] ?? value }));
  const existing = new Set(base.map(o => o.label.toLocaleLowerCase("az-AZ")));
  labels.slice(DEFAULT_WB_STATUS_KEYS.length).forEach(label => {
    const v = label.trim();
    if (!v) return;
    const key = v.toLocaleLowerCase("az-AZ");
    if (existing.has(key)) return;
    existing.add(key);
    base.push({ value: v as WBStatus, label: v });
  });
  return base;
};

const statusVariant = (s: WBStatus): { cls: string; icon: typeof AlertCircle } => {
  switch (s) {
    case "yeni": return { cls: "bg-primary/15 text-primary border-primary/30", icon: AlertCircle };
    case "arashdirilir": return { cls: "bg-warning/15 text-warning border-warning/30", icon: Clock };
    case "hell_olundu": return { cls: "bg-success/15 text-success border-success/30", icon: CheckCircle2 };
    default: return { cls: "bg-muted text-muted-foreground border-border", icon: AlertCircle };
  }
};

const StatusBadge = ({ status, label }: { status: WBStatus; label: string }) => {
  const v = statusVariant(status);
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${v.cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </Badge>
  );
};

const formatDate = (iso: string) => new Date(iso).toLocaleString("az-AZ", { dateStyle: "medium", timeStyle: "short" });

const StatusUpdateDialog = ({ report, open, onOpenChange }: { report: WBReport; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { user } = useAuth();
  const wbStatusLabels = useCatalogValues("whistleblower_statuses", ["Yeni", "Araşdırılır", "Həll olundu"]);
  const statusOptions = useMemo(() => getStatusOptions(wbStatusLabels), [wbStatusLabels]);
  const [newStatus, setNewStatus] = useState<WBStatus>(report.status);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setNewStatus(report.status);
      setNote("");
    }
  }, [open, report.status]);

  const save = () => {
    if (newStatus === report.status) {
      toast.info("Status dəyişdirilməyib");
      return;
    }
    updateStatus(report.id, newStatus, note.trim() || undefined, user?.name);
    toast.success("Status yeniləndi");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Status yenilə · #{report.id}</DialogTitle>
          <DialogDescription>Cari status: {getStatusLabel(report.status, wbStatusLabels)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Yeni status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as WBStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Qeyd (istəyə bağlı)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
          <Button onClick={save}>Yadda saxla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ReportDetailDialog = ({ report, open, onOpenChange, onChangeStatus, statusLabels }: { report: WBReport | null; open: boolean; onOpenChange: (v: boolean) => void; onChangeStatus: () => void; statusLabels: string[] }) => {
  if (!report) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="font-mono">#{report.id}</DialogTitle>
            <StatusBadge status={report.status} label={getStatusLabel(report.status, statusLabels)} />
          </div>
          <DialogDescription>{report.category} · {formatDate(report.createdAt)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-base">{report.title}</h4>
            <p className="text-sm whitespace-pre-wrap mt-1">{report.description}</p>
          </div>

          {report.extraNote && (
            <div>
              <Label className="text-muted-foreground">Əlavə açıqlama</Label>
              <p className="text-sm whitespace-pre-wrap">{report.extraNote}</p>
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">Əlavə fayllar</Label>
            {report.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Fayl əlavə edilməyib</p>
            ) : (
              <div className="space-y-2 mt-1">
                {report.attachments.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(a.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <a href={a.dataUrl} download={a.name} className="text-primary hover:underline flex items-center gap-1">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-muted-foreground">Tarixçə</Label>
            <ol className="relative border-l border-border ml-2 mt-2 space-y-3">
              {report.history.map((h, i) => (
                <li key={i} className="ml-4">
                  <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">{h.action}</p>
                    {h.by && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <UserIcon className="w-3 h-3" />
                        {h.by}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(h.at)}</p>
                  {h.toStatus && (
                    <p className="text-xs mt-0.5">
                      {h.fromStatus ? `${getStatusLabel(h.fromStatus, statusLabels)} → ` : ""}
                      <span className="font-medium">{getStatusLabel(h.toStatus, statusLabels)}</span>
                    </p>
                  )}
                  {h.note && <p className="text-xs italic text-muted-foreground mt-0.5">"{h.note}"</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bağla</Button>
          <Button onClick={onChangeStatus}>Status yenilə</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PAGE_SIZE = 10;

const WhistleblowerPage = () => {
  const wbCategories = useCatalogValues("whistleblower_categories", [...WB_CATEGORIES]);
  const wbStatusLabels = useCatalogValues("whistleblower_statuses", ["Yeni", "Araşdırılır", "Həll olundu"]);
  const statusOptions = useMemo(() => getStatusOptions(wbStatusLabels), [wbStatusLabels]);
  const [reports, setReports] = useState<WBReport[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = (k: string, v: string) => setColFilters(p => ({ ...p, [k]: v }));

  const [detailOpen, setDetailOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selected, setSelected] = useState<WBReport | null>(null);

  const refresh = () => setReports(listReports());

  useEffect(() => {
    seedWhistleblowerDemo();
    refresh();
    const handler = () => refresh();
    window.addEventListener("wb:changed", handler);
    return () => window.removeEventListener("wb:changed", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cf = Object.fromEntries(Object.entries(colFilters).map(([k, v]) => [k, v.trim().toLowerCase()]));
    return reports.filter((r) => {
      if (filterCat !== "all" && r.category !== filterCat) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterDate) {
        const d = new Date(r.createdAt).toISOString().slice(0, 10);
        if (d !== filterDate) return false;
      }
      if (q && !(`${r.id} ${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q))) return false;
      if (cf.id && !r.id.toLowerCase().includes(cf.id)) return false;
      if (cf.category && !r.category.toLowerCase().includes(cf.category)) return false;
      if (cf.title && !r.title.toLowerCase().includes(cf.title)) return false;
      if (cf.status && !getStatusLabel(r.status, wbStatusLabels).toLowerCase().includes(cf.status)) return false;
      if (cf.date && !formatDate(r.createdAt).toLowerCase().includes(cf.date)) return false;
      return true;
    });
  }, [reports, search, filterCat, filterStatus, filterDate, colFilters, wbStatusLabels]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterCat, filterStatus, filterDate]);

  const stats = useMemo(() => ({
    total: reports.length,
    yeni: reports.filter(r => r.status === "yeni").length,
    arashdirilir: reports.filter(r => r.status === "arashdirilir").length,
    hell_olundu: reports.filter(r => r.status === "hell_olundu").length,
  }), [reports]);

  const openDetail = (r: WBReport) => { setSelected(r); setDetailOpen(true); };

  useEffect(() => {
    if (selected) {
      const fresh = reports.find(r => r.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [reports]);

  return (
    <div className="min-h-screen">
      <Header title="Anonim Bildiriş" />
      <div className="p-6 space-y-6">
      <PageHero
        icon={Shield}
        title="Anonim Bildirişlər"
        subtitle="Əməkdaşlardan daxil olan anonim bildirişlərin idarə edilməsi."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Cəmi bildirişlər</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Yeni</p>
              <p className="text-2xl font-bold mt-1 text-primary">{stats.yeni}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-primary/70" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Araşdırılır</p>
              <p className="text-2xl font-bold mt-1 text-warning">{stats.arashdirilir}</p>
            </div>
            <Clock className="w-8 h-8 text-warning/70" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Həll olundu</p>
              <p className="text-2xl font-bold mt-1 text-success">{stats.hell_olundu}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-success/70" />
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="ID, başlıq, təsvir..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger><SelectValue placeholder="Kateqoriya" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün kateqoriyalar</SelectItem>
              {wbCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün statuslar</SelectItem>
              {statusOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <DataTable<WBReport>
            rows={filtered}
            rowKey={(r) => r.id}
            storageKey="wb-table"
            emptyMessage="Bildiriş tapılmadı"
            columns={[
              { key: "id", label: "ID", width: 140, filterType: "text", accessor: (r) => r.id, render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
              {
                key: "op", label: "Əməliyyat", width: 100, align: "center", filterType: "none",
                render: (r) => (
                  <Button variant="ghost" size="icon" onClick={() => openDetail(r)} aria-label="Bax">
                    <Eye className="w-4 h-4" />
                  </Button>
                ),
              },
              { key: "category", label: "Kateqoriya", filterType: "select", selectOptions: [...wbCategories], accessor: (r) => r.category },
              { key: "title", label: "Başlıq", filterType: "text", accessor: (r) => r.title },
              { key: "status", label: "Status", filterType: "select", selectOptions: statusOptions.map(o => o.label), accessor: (r) => getStatusLabel(r.status, wbStatusLabels), render: (r) => <StatusBadge status={r.status} label={getStatusLabel(r.status, wbStatusLabels)} /> },
              { key: "date", label: "Tarix", filterType: "date", accessor: (r) => new Date(r.createdAt), render: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span> },
            ]}
          />
        </CardContent>
      </Card>


      <ReportDetailDialog
        report={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onChangeStatus={() => { setDetailOpen(false); setStatusOpen(true); }}
        statusLabels={wbStatusLabels}
      />
      {selected && (
        <StatusUpdateDialog report={selected} open={statusOpen} onOpenChange={setStatusOpen} />
      )}
      </div>
    </div>
  );
};

export default WhistleblowerPage;
