import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Workflow, Eye, Save, Trash2, FileText } from "lucide-react";
import { useKpiLifecycles, type CardLifecycle } from "@/lib/kpiLifecycleStore";
import LifecycleDetailDialog from "@/components/kpi/LifecycleDetailDialog";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { withKartSuffix } from "@/lib/utils";
import {
  useLifecycleTemplates, addLifecycleTemplate, deleteLifecycleTemplate,
  updateLifecycleTemplate, toggleLifecycleTemplateActive,
  buildTemplateOffsets,
  type LifecycleTemplate,
} from "@/lib/lifecycleTemplatesStore";
import { Pencil, CalendarClock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

/** Lifecycle-ın son bitmə tarixi — bonus/qiymətləndirmə/təyinat və review-lərin ən böyük bitmə tarixi. */
const lifecycleEndDate = (l: CardLifecycle): string => {
  const dates = [
    l.bonus?.end, l.evaluation?.end, l.assignment?.end,
    ...(l.reviews || []).map(r => r.end),
  ].filter((d): d is string => !!d);
  if (!dates.length) return "";
  return dates.sort((a, b) => a.localeCompare(b))[dates.length - 1].slice(0, 10);
};


const KpiLifecyclePage = () => {
  const lifecycles = useKpiLifecycles();
  const templates = useLifecycleTemplates();
  const [viewing, setViewing] = useState<CardLifecycle | null>(null);
  const [tab, setTab] = useState<"plans" | "templates">("plans");
  const [saveDialog, setSaveDialog] = useState<CardLifecycle | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [detailTpl, setDetailTpl] = useState<LifecycleTemplate | null>(null);
  const [editTpl, setEditTpl] = useState<LifecycleTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const rows = useMemo(
    () => lifecycles.slice().sort((a, b) => a.cardName.localeCompare(b.cardName)),
    [lifecycles],
  );
  const activeViewing = viewing ? lifecycles.find(l => l.cardId === viewing.cardId) || viewing : null;

  const handleSaveTemplate = () => {
    if (!saveDialog || !tplName.trim()) {
      toast.error("Şablon adı tələb olunur");
      return;
    }
    const baseData = {
      assignment: saveDialog.assignment,
      evaluation: saveDialog.evaluation,
      bonus: saveDialog.bonus,
      reviews: saveDialog.reviews,
    };
    const offsets = buildTemplateOffsets(baseData);
    addLifecycleTemplate({
      name: tplName.trim(),
      description: tplDesc.trim() || undefined,
      data: { ...baseData, offsets },
    });
    toast.success(offsets
      ? "Şablon nisbi vaxt aralıqları ilə yadda saxlanıldı"
      : "Şablon yadda saxlanıldı");
    setSaveDialog(null);
    setTplName("");
    setTplDesc("");
  };

  return (
    <div className="min-h-screen">
      <Header title="KPI lifecycle izlənilmələri" />
      <main className="p-6 pb-24">
        <PageHero
          badge="KPI lifecycle izlənilmələri"
          icon={Workflow}
          title="KPI lifecycle izlənilmələri"
          subtitle="Hər KPI kartı üçün təyin olunmuş planlama mərhələləri (təyinat, qiymətləndirmə, bonus, review)"
        />

        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("plans")}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === "plans" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Lifecycle planları
            </button>
            <button
              onClick={() => setTab("templates")}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === "templates" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              Lifecycle şablonları
              {templates.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary">{templates.length}</span>
              )}
            </button>
          </div>

          {tab === "plans" ? (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Lifecycle Planları</h3>
                <span className="text-xs text-muted-foreground">{rows.length} kart</span>
              </div>
              <DataTable<CardLifecycle>
                rows={rows}
                rowKey={(l) => l.cardId}
                storageKey="kpi-lifecycle-table"
                emptyMessage="Hələ heç bir KPI üçün lifecycle təyin olunmayıb. KPI kartı yaradarkən 2-ci addımda lifecycle əlavə edin."
                columns={[
                  {
                    key: "name", label: "KPI Kartı", filterType: "text",
                    accessor: (l) => withKartSuffix(l.cardName),
                    render: (l) => <span className="font-medium text-foreground">{withKartSuffix(l.cardName)}</span>,
                  },
                  {
                    key: "reviews", label: "Review", filterType: "number",
                    accessor: (l) => l.reviews.length,
                    render: (l) => (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                        {l.reviews.length} ədəd
                      </span>
                    ),
                  },
                  {
                    key: "end", label: "Bitmə tarixi", filterType: "date",
                    accessor: (l) => lifecycleEndDate(l),
                    render: (l) => <span className="text-xs text-muted-foreground">{lifecycleEndDate(l) || "—"}</span>,
                  },
                  {
                    key: "op", label: "Əməliyyat", width: 160, align: "center", filterType: "none",
                    render: (l) => (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewing(l)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-primary/10 text-primary"
                          title="Detallara bax"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSaveDialog(l); setTplName(`${withKartSuffix(l.cardName)} şablonu`); setTplDesc(""); }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-emerald-500/10 text-emerald-600"
                          title="Şablon kimi yadda saxla"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Lifecycle Şablonları</h3>
                <span className="text-xs text-muted-foreground">{templates.length} şablon</span>
              </div>
              {templates.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Hələ şablon yaradılmayıb. Lifecycle planları tabından "Şablon kimi yadda saxla" düyməsi ilə şablon əlavə edin.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setDetailTpl(t)}
                      className={`border rounded-xl p-4 bg-card transition-colors cursor-pointer flex flex-col h-[220px] ${t.active ? "border-border hover:border-primary/40" : "border-border/60 opacity-60"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-sm text-foreground truncate">{t.name}</span>
                          {t.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">Sistem</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditTpl(t); setEditName(t.name); setEditDesc(t.description || ""); }}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                            title="Redaktə et"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {!t.isSystem && (
                            <button
                              onClick={() => { deleteLifecycleTemplate(t.id); toast.success("Şablon silindi"); }}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 min-h-[32px]">
                        {t.description || "—"}
                      </p>
                      <div className="mt-3 text-[11px] text-muted-foreground space-y-0.5 flex-1">
                        <div>Təyinat: {t.data.assignment?.period ?? "—"}</div>
                        <div>Qiymətləndirmə: {t.data.evaluation?.period ?? "—"}</div>
                        <div>Bonus: {t.data.bonus?.period ?? "—"}</div>
                        <div>Review: {t.data.reviews.length} ədəd</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </span>
                        <label
                          className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Switch
                            checked={t.active}
                            onCheckedChange={() => {
                              toggleLifecycleTemplateActive(t.id);
                              toast.success(t.active ? "Şablon deaktiv edildi" : "Şablon aktivləşdirildi");
                            }}
                          />
                          {t.active ? "Aktiv" : "Deaktiv"}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <LifecycleDetailDialog
          open={!!viewing}
          onOpenChange={(o) => { if (!o) setViewing(null); }}
          lifecycle={activeViewing}
        />

        <Dialog open={!!saveDialog} onOpenChange={(o) => !o && setSaveDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Şablon kimi yadda saxla</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Şablon adı</label>
                <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Məs: Aylıq satış lifecycle" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Təsvir (məcburi deyil)</label>
                <Textarea value={tplDesc} onChange={e => setTplDesc(e.target.value)} rows={3} placeholder="Şablonun nə üçün istifadə olunacağı..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialog(null)}>Ləğv et</Button>
              <Button onClick={handleSaveTemplate} className="gap-2"><Save className="w-4 h-4" /> Yadda saxla</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Şablon detalı */}
        <Dialog open={!!detailTpl} onOpenChange={(o) => !o && setDetailTpl(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {detailTpl?.name}
                {detailTpl?.isSystem && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Sistem</span>}
              </DialogTitle>
            </DialogHeader>
            {detailTpl && (() => {
              const isDynamic = detailTpl.data.dynamic === "monthly-standard";
              const off = detailTpl.data.offsets;
              const fmtOffsetStage = (o?: { startOffset: number; endOffset: number }) => {
                if (!o) return null;
                const dur = o.endOffset - o.startOffset;
                return `Başlama: +${o.startOffset} gün · Bitmə: +${o.endOffset} gün · Müddət: ${dur} gün`;
              };
              const fmtAbsStage = (s?: { start?: string; end?: string }) => {
                if (!s?.start || !s?.end) return null;
                return `Başlama: ${s.start} · Bitmə: ${s.end}`;
              };
              const dynamicLine = (label: string) => {
                if (label === "KPI təyin olunması") return "KPI başlanğıc tarixindən +0 gün, müddət ~2 gün (auto)";
                if (label === "KPI qiymətləndirilməsi") return "Ayın sonundan 5 gün əvvəl başlayır, ~3 gün davam edir (auto)";
                if (label === "Bonusun hesablanması") return "Qiymətləndirmədən sonra, ayın son gününədək (auto)";
                return "";
              };
              const stages: { label: string; s: any; okey: "assignment" | "evaluation" | "bonus" }[] = [
                { label: "KPI təyin olunması", s: detailTpl.data.assignment, okey: "assignment" },
                { label: "KPI qiymətləndirilməsi", s: detailTpl.data.evaluation, okey: "evaluation" },
                { label: "Bonusun hesablanması", s: detailTpl.data.bonus, okey: "bonus" },
              ];
              return (
              <div className="space-y-3">
                {detailTpl.description && <p className="text-xs text-muted-foreground">{detailTpl.description}</p>}
                {isDynamic && (
                  <div className="text-xs text-primary flex items-center gap-1.5 bg-primary/5 p-2 rounded border border-primary/20">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Bu şablonda tarixlər KPI-ın yaradıldığı tarixə əsasən avtomatik hesablanır.
                  </div>
                )}
                {stages.map(({ label, s, okey }) => {
                  const line = isDynamic
                    ? dynamicLine(label)
                    : (fmtOffsetStage(off?.[okey]) || fmtAbsStage(s) || "Təyin olunmayıb");
                  return (
                    <div key={label} className="border border-border rounded-md p-2.5">
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Dövr: {s?.period ?? "—"} · {line}
                      </div>
                    </div>
                  );
                })}
                <div className="border border-border rounded-md p-2.5">
                  <div className="text-sm font-medium text-foreground">KPI Review ({detailTpl.data.reviews.length})</div>
                  {detailTpl.data.reviews.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground mt-0.5">Yoxdur</div>
                  ) : detailTpl.data.reviews.map((r, i) => {
                    const ro = off?.reviews?.find(x => x.id === r.id);
                    const line = isDynamic
                      ? "KPI yaradılmasından ~3 gün sonra başlayır, 5 gün davam edir (auto)"
                      : (ro
                          ? `Başlama: +${ro.startOffset} gün · Bitmə: +${ro.endOffset} gün · Müddət: ${ro.endOffset - ro.startOffset} gün`
                          : (r.start && r.end ? `Başlama: ${r.start} · Bitmə: ${r.end}` : "Təyin olunmayıb"));
                    return (
                      <div key={r.id} className="text-[11px] text-muted-foreground mt-1">
                        #{i + 1} · {r.period} · {line}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailTpl(null)}>Bağla</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Şablon redaktəsi */}
        <Dialog open={!!editTpl} onOpenChange={(o) => !o && setEditTpl(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Şablonu redaktə et</DialogTitle>
            </DialogHeader>
            {editTpl && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Şablon adı</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Təsvir</label>
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} />
                </div>
                {editTpl.isSystem && (
                  <p className="text-[11px] text-muted-foreground">
                    Sistem şablonunda tarixlər avtomatik hesablanır, ona görə mərhələ tarixləri redaktə edilə bilməz. Yalnız ad və təsviri dəyişə bilərsiniz.
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTpl(null)}>Ləğv et</Button>
              <Button
                onClick={() => {
                  if (!editTpl) return;
                  if (!editName.trim()) { toast.error("Ad tələb olunur"); return; }
                  updateLifecycleTemplate(editTpl.id, { name: editName.trim(), description: editDesc.trim() || undefined });
                  toast.success("Şablon yeniləndi");
                  setEditTpl(null);
                }}
                className="gap-2"
              >
                <Save className="w-4 h-4" /> Yadda saxla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default KpiLifecyclePage;
