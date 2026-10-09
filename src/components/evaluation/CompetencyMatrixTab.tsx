import { matrixMaxScore } from "@/lib/competencyEvaluation";
import { useMemo, useState } from "react";
import {
  Grid3x3, Briefcase, HelpCircle, Target as TargetIcon, Plus, Search, Eye,
  Pencil, Copy, Archive, Trash2, MoreHorizontal, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useCompetencyMatrices, upsertCompetencyMatrix, deleteCompetencyMatrix,
  duplicateCompetencyMatrix, archiveCompetencyMatrix,
  type CompetencyMatrix, type CompetencyQuestion, type CompetencyAnswer, type CompetencyStatus,
} from "@/lib/competencyMatrixStore";
import { mockEmployees } from "@/data/mockData";
import { getStructures, type OrgStructure } from "@/lib/orgStore";

// ---------- Position pool (Struktur kataloqundakı mövcud vəzifələr) ----------
const collectPositions = (nodes: OrgStructure[]): string[] => {
  const out: string[] = [];
  for (const n of nodes) {
    (n.positions || []).forEach(p => out.push(p.name));
    if (n.children?.length) out.push(...collectPositions(n.children));
  }
  return out;
};
const getPositionPool = (): string[] =>
  Array.from(new Set(collectPositions(getStructures()))).sort();

// ---------- helpers ----------
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

const STATUS_META: Record<CompetencyStatus, { label: string; className: string }> = {
  aktiv: { label: "Aktiv", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  qaralama: { label: "Qaralama", className: "bg-muted text-muted-foreground border-border" },
  passiv: { label: "Passiv", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
};

// Cavab faizi: saxlanmış faiz, yoxdursa bal / şkala maks.
const answerPct = (a: { score: number; percent?: number }): number =>
  Math.min(100, Math.max(0, typeof a.percent === "number" ? a.percent : Math.round((a.score / Math.max(1, matrixMaxScore())) * 100)));
const pctToScore = (p: number): number => Math.round((p / 100) * matrixMaxScore() * 100) / 100;

const scoreColor = (pct: number): string => {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-yellow-500";
  if (pct >= 40) return "bg-orange-500";
  if (pct > 0) return "bg-orange-600";
  return "bg-rose-500";
};

// ================= Positions multi-select =================
const PositionMultiSelect = ({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const pool = useMemo(() => getPositionPool(), []);
  const filtered = pool.filter(p => p.toLowerCase().includes(q.toLowerCase()));
  const toggle = (p: string) => {
    onChange(value.includes(p) ? value.filter(x => x !== p) : [...value, p]);
  };
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left"
          >
            <span className={value.length === 0 ? "text-muted-foreground" : "text-foreground"}>
              {value.length === 0 ? "Vəzifə seçin" : `${value.length} vəzifə seçilib`}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0 z-[100]" align="start" onWheel={e => e.stopPropagation()}>
          <div className="p-2 border-b border-border">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Axtar..." className="h-8" />
          </div>
          <div
            className="max-h-60 overflow-y-auto p-1 overscroll-contain"
            onWheel={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
          >
            {filtered.map(p => {
              const checked = value.includes(p);
              return (
                <label key={p} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${checked ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                  <Checkbox checked={checked} onCheckedChange={() => toggle(p)} />
                  <span>{p}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Tapılmadı</p>}
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(p => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
              {p}
              <button onClick={() => toggle(p)} type="button" className="hover:text-primary/70"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ================= Create/Edit Modal =================
const CreateEditModal = ({
  open, onClose, initial, mode = "full",
  allMatrices,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CompetencyMatrix;
  mode?: "full" | "answersOnly";
  allMatrices?: CompetencyMatrix[];
}) => {
  const isAnswersOnly = mode === "answersOnly";
  const [name, setName] = useState(initial?.name || "");
  const [positions, setPositions] = useState<string[]>(initial?.positions || []);
  const [description, setDescription] = useState(initial?.description || "");
  const [questions, setQuestions] = useState<CompetencyQuestion[]>(
    initial?.questions?.length ? initial.questions : [
      { id: uid(), text: "Komanda işi", weight: 20 },
      { id: uid(), text: "Ünsiyyət bacarığı", weight: 25 },
      { id: uid(), text: "Məsuliyyətlilik", weight: 30 },
      { id: uid(), text: "Davranış etikası", weight: 25 },
    ]
  );
  const [answers, setAnswers] = useState<CompetencyAnswer[]>(
    (initial?.answers?.length ? initial.answers : [
      { id: uid(), label: "Tam razıyam", percent: 100 },
      { id: uid(), label: "Razıyam", percent: 80 },
      { id: uid(), label: "Qismən razıyam", percent: 60 },
      { id: uid(), label: "Razı deyiləm", percent: 40 },
      { id: uid(), label: "Heç razı deyiləm", percent: 0 },
    ].map(a => ({ ...a, score: pctToScore(a.percent) })) as CompetencyAnswer[]).map(a => ({ ...a, percent: answerPct(a), score: pctToScore(answerPct(a)) }))
  );

  const totalWeight = questions.reduce((s, q) => s + (Number(q.weight) || 0), 0);
  const weightOk = totalWeight === 100;
  const uniqueScores = new Set(answers.map(a => answerPct(a))).size === answers.length;
  const canSubmit = isAnswersOnly
    ? (answers.length >= 2 && uniqueScores)
    : (
        name.trim().length > 0 &&
        positions.length > 0 &&
        questions.length >= 1 &&
        weightOk
      );

  const updateQ = (id: string, patch: Partial<CompetencyQuestion>) =>
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));
  const removeQ = (id: string) => setQuestions(qs => qs.filter(q => q.id !== id));
  const addQ = () => setQuestions(qs => [...qs, { id: uid(), text: "", weight: 0 }]);

  const updateA = (id: string, patch: Partial<CompetencyAnswer>) =>
    setAnswers(as => as.map(a => a.id === id ? { ...a, ...patch } : a));
  const removeA = (id: string) => setAnswers(as => as.filter(a => a.id !== id));
  const addA = () => setAnswers(as => [...as, { id: uid(), label: "Yeni cavab", score: 0, percent: 0 }]);

  const submit = () => {
    if (!canSubmit) return;
    if (isAnswersOnly) {
      // Apply the answer set to all matrices (shared across matrices).
      (allMatrices || []).forEach(m => {
        upsertCompetencyMatrix({
          id: m.id,
          name: m.name,
          positions: m.positions,
          description: m.description,
          questions: m.questions,
          answers,
          status: m.status,
          usedKpiCount: m.usedKpiCount,
        });
      });
      toast.success("Cavab variantları bütün matrislərə tətbiq edildi");
      onClose();
      return;
    }
    upsertCompetencyMatrix({
      id: initial?.id,
      name: name.trim(),
      positions,
      description: description.trim() || undefined,
      questions,
      answers,
      status: initial?.status || "aktiv",
      usedKpiCount: initial?.usedKpiCount || 0,
    });
    toast.success(initial ? "Matris yeniləndi" : "Yeni matris yaradıldı");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-[980px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAnswersOnly
              ? "Cavab variantları və balları redaktə et"
              : initial ? "Səriştə matrisini redaktə et" : "Yeni səriştə matrisi yarat"}
          </DialogTitle>
        </DialogHeader>

        {!isAnswersOnly && (
          <>
            {/* Section 1 — Ümumi məlumat */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Ümumi məlumat</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Matris adı *</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Məsələn: Reception əməkdaşı matrisi" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tətbiq olunduğu vəzifələr *</Label>
                  <PositionMultiSelect value={positions} onChange={setPositions} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Təsvir</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 250))} placeholder="Matris haqqında qısa təsvir (istəyə bağlı)" rows={2} />
                <p className="text-[11px] text-muted-foreground text-right">{description.length}/250</p>
              </div>
            </div>

            {/* Section 2 — Suallar */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Suallar (Kompetensiyalar)</h3>
                <Button size="sm" onClick={addQ} className="gap-1"><Plus className="w-4 h-4" /> Sual əlavə et</Button>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left w-10">#</th>
                      <th className="px-3 py-2 text-left">Sual (Kompetensiya)</th>
                      <th className="px-3 py-2 text-left w-32">Çəki (%)</th>
                      <th className="px-3 py-2 text-right w-24">Əməliyyat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, i) => (
                      <tr key={q.id} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2">
                          <Input value={q.text} onChange={e => updateQ(q.id, { text: e.target.value })} className="h-8" />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min={0} max={100}
                            value={q.weight}
                            onChange={e => updateQ(q.id, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" onClick={() => removeQ(q.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={2} className="px-3 py-2 font-semibold text-foreground">Çəki cəmi</td>
                      <td colSpan={2} className={`px-3 py-2 font-semibold ${weightOk ? "text-emerald-600" : "text-rose-600"}`}>
                        {totalWeight}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {isAnswersOnly && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Cavab variantları və ballar</h3>
              <Button size="sm" onClick={addA} className="gap-1"><Plus className="w-4 h-4" /> Cavab variantı əlavə et</Button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Cavab variantı</th>
                    <th className="px-3 py-2 text-left w-48">Faiz</th>
                    <th className="px-3 py-2 text-right w-24">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {answers.map(a => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Input value={a.label} onChange={e => updateA(a.id, { label: e.target.value })} className="h-8" />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={answerPct(a)}
                          onChange={e => {
                            const p = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            updateA(a.id, { percent: p, score: pctToScore(p) });
                          }}
                          className="h-8 w-24 inline-block"
                        /> <span className="text-xs text-muted-foreground">% = {pctToScore(answerPct(a))} bal</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => removeA(a.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!uniqueScores && (
              <p className="text-xs text-rose-600">Cavab faizləri təkrarlanmamalıdır.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Ləğv et</Button>
          <Button onClick={submit} disabled={!canSubmit}>{initial || isAnswersOnly ? "Yadda saxla" : "Yarat"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ================= View Modal (read-only) =================
const ViewModal = ({ matrix, onClose }: { matrix: CompetencyMatrix | null; onClose: () => void }) => {
  if (!matrix) return null;
  const totalWeight = matrix.questions.reduce((s, q) => s + q.weight, 0);
  const maxScore = matrixMaxScore(matrix);
  return (
    <Dialog open={!!matrix} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {matrix.name}
            <Badge variant="outline" className={STATUS_META[matrix.status].className}>
              {STATUS_META[matrix.status].label}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Vəzifələr</p>
              <p className="text-sm text-foreground">{matrix.positions.join(", ") || "—"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground">İstifadə olunan KPI-lar</p>
              <p className="text-sm text-foreground">{matrix.usedKpiCount ?? 0}</p>
            </div>
          </div>
          {matrix.description && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground mb-1">Təsvir</p>
              <p className="text-sm text-foreground">{matrix.description}</p>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold mb-2">Suallar</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr><th className="px-3 py-2 text-left w-10">#</th><th className="px-3 py-2 text-left">Sual</th><th className="px-3 py-2 text-right w-24">Çəki</th></tr>
                </thead>
                <tbody>
                  {matrix.questions.map((q, i) => (
                    <tr key={q.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">{q.text}</td>
                      <td className="px-3 py-2 text-right">{q.weight}%</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/20 font-semibold">
                    <td colSpan={2} className="px-3 py-2">Yekun çəki</td>
                    <td className={`px-3 py-2 text-right ${totalWeight === 100 ? "text-emerald-600" : "text-rose-600"}`}>{totalWeight}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bağla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ================= Right detail panel =================
const DetailPanel = ({ matrix }: { matrix: CompetencyMatrix | null }) => {
  const [tab, setTab] = useState("suallar");
  if (!matrix) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        Detalları görmək üçün cədvəldən bir matris seçin
      </div>
    );
  }
  const totalWeight = matrix.questions.reduce((s, q) => s + q.weight, 0);
  const maxScore = matrixMaxScore(matrix);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">{matrix.name}</h3>
        <Badge variant="outline" className={STATUS_META[matrix.status].className}>
          {STATUS_META[matrix.status].label}
        </Badge>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="p-4">
        <TabsList>
          <TabsTrigger value="umumi">Ümumi məlumat</TabsTrigger>
          <TabsTrigger value="suallar">Suallar</TabsTrigger>
          <TabsTrigger value="cavablar">Cavab variantları</TabsTrigger>
          <TabsTrigger value="vezifeler">Vəzifələr</TabsTrigger>
          <TabsTrigger value="tarixce">Tarixçə</TabsTrigger>
        </TabsList>

        <TabsContent value="umumi" className="pt-4 space-y-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] uppercase text-muted-foreground mb-1">Təsvir</p>
            <p className="text-sm text-foreground">{matrix.description || "—"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground">Suallar</p>
              <p className="text-lg font-semibold">{matrix.questions.length}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[11px] uppercase text-muted-foreground">İstifadə olunan KPI-lar</p>
              <p className="text-lg font-semibold">{matrix.usedKpiCount ?? 0}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suallar" className="pt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                <tr><th className="px-3 py-2 text-left w-10">#</th><th className="px-3 py-2 text-left">Sual (Kompetensiya)</th><th className="px-3 py-2 text-right w-24">Çəki (%)</th><th className="px-3 py-2 text-right w-24">Əməliyyat</th></tr>
              </thead>
              <tbody>
                {matrix.questions.map((q, i) => (
                  <tr key={q.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">{q.text}</td>
                    <td className="px-3 py-2 text-right">{q.weight}%</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={2} className="px-3 py-2">Yekun çəki</td>
                  <td colSpan={2} className={`px-3 py-2 text-right ${totalWeight === 100 ? "text-emerald-600" : "text-rose-600"}`}>{totalWeight}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="cavablar" className="pt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                <tr><th className="px-3 py-2 text-left">Cavab variantı</th><th className="px-3 py-2 text-left w-32">Faiz</th><th className="px-3 py-2 text-left w-20">Rəng</th></tr>
              </thead>
              <tbody>
                {matrix.answers.map(a => {
                  const pct = answerPct(a);
                  return (
                    <tr key={a.id} className="border-t border-border">
                      <td className="px-3 py-2">{a.label}</td>
                      <td className="px-3 py-2">{pct}%</td>
                      <td className="px-3 py-2"><span className={`inline-block w-3 h-3 rounded-full ${scoreColor(pct)}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="vezifeler" className="pt-4">
          {matrix.positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Vəzifə seçilməyib</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {matrix.positions.map(p => (
                <span key={p} className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs px-2 py-1">{p}</span>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tarixce" className="pt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-border pb-2">
            <span className="text-muted-foreground">Yaradılıb</span>
            <span>{new Date(matrix.createdAt).toLocaleString("az-AZ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Son yeniləmə</span>
            <span>{new Date(matrix.updatedAt).toLocaleString("az-AZ")}</span>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ================= Sample calculation card =================
const SampleCalculation = ({ matrix }: { matrix: CompetencyMatrix | null }) => {
  if (!matrix || matrix.questions.length === 0 || matrix.answers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
        Nümunə hesablama üçün matris seçin
      </div>
    );
  }
  const maxScore = matrixMaxScore(matrix);
  // pick alternating answers for demo
  const rows = matrix.questions.map((q, i) => {
    const ans = matrix.answers[i % matrix.answers.length];
    const weighted = (ans.score * q.weight) / 100;
    return { q, ans, weighted };
  });
  const total = rows.reduce((s, r) => s + r.weighted, 0);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Nümunə hesablanma</h3>
      </div>
      <div className="p-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Sual</th>
                <th className="px-3 py-2 text-left">Cavab</th>
                <th className="px-3 py-2 text-right w-16">Bal</th>
                <th className="px-3 py-2 text-right w-20">Çəki (%)</th>
                <th className="px-3 py-2 text-right w-20">Çəkili bal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{r.q.text}</td>
                  <td className="px-3 py-2">{r.ans.label}</td>
                  <td className="px-3 py-2 text-right">{r.ans.score}</td>
                  <td className="px-3 py-2 text-right">{r.q.weight}%</td>
                  <td className="px-3 py-2 text-right">{r.weighted.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 px-2">
          <span className="text-sm font-semibold text-foreground">Yekun nəticə</span>
          <span className="text-2xl font-bold text-primary">{total.toFixed(2)} <span className="text-sm text-muted-foreground font-normal">/ {maxScore}</span></span>
        </div>
      </div>
    </div>
  );
};

// ================= Main tab =================
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const CompetencyMatrixTab = () => {
  const list = useCompetencyMatrices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CompetencyStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CompetencyMatrix | null>(null);
  const [answersEditOpen, setAnswersEditOpen] = useState(false);
  const [viewing, setViewing] = useState<CompetencyMatrix | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CompetencyMatrix | null>(null);

  const filtered = useMemo(() => {
    return list.filter(m => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (search.trim() && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [list, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const selected = list.find(m => m.id === selectedId) || filtered[0] || null;

  // stats
  const totalMatrices = list.filter(m => m.status === "aktiv").length;
  const totalPositions = new Set(list.flatMap(m => m.positions)).size;
  const totalQuestions = list.reduce((s, m) => s + m.questions.length, 0);
  const totalKpis = list.reduce((s, m) => s + (m.usedKpiCount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-end gap-4 flex-wrap">
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Yeni matris yarat
        </Button>
      </div>

      {/* Full-width: Səriştə matrislərinin siyahısı */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Səriştə matrislərinin siyahısı</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Axtar..." className="pl-9" />
            </div>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Matris adı</th>
                  <th className="px-3 py-2 text-left">Tətbiq olunduğu vəzifələr</th>
                  <th className="px-3 py-2 text-left w-20">Suallar</th>
                  <th className="px-3 py-2 text-left w-24">Yekun çəki</th>
                  <th className="px-3 py-2 text-right w-16">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(m => {
                  const total = m.questions.reduce((s, q) => s + q.weight, 0);
                  const isSelected = selected?.id === m.id;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`border-t border-border cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{m.name}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{m.positions.slice(0, 3).join(", ")}{m.positions.length > 3 ? ` +${m.positions.length - 3}` : ""}</td>
                      <td className="px-3 py-2">{m.questions.length}</td>
                      <td className={`px-3 py-2 ${total === 100 ? "text-emerald-600" : "text-rose-600"}`}>{total}%</td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewing(m)}><Eye className="w-4 h-4 mr-2" /> Bax</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditing(m)}><Pencil className="w-4 h-4 mr-2" /> Redaktə</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmDelete(m)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Sil</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">Nəticə yoxdur</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
                const p = i + 1;
                return (
                  <Button key={p} variant={p === page ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => setPage(p)}>
                    {p}
                  </Button>
                );
              })}
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span>{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}</span>
              <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-7 w-[70px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width: Cavab variantları və ballar (Global — bütün matrislər üçün ortaq) */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">Cavab variantları və ballar</h3>
            <span className="text-xs text-muted-foreground">Bütün matrislər üçün ortaq</span>
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAnswersEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5" /> Redaktə et
          </Button>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Cavab variantı</th>
                <th className="px-3 py-2 text-left w-24">Faiz</th>
                <th className="px-3 py-2 text-left w-20">Rəng</th>
              </tr>
            </thead>
            <tbody>
              {[...((selected || list[0])?.answers?.length ? (selected || list[0])!.answers : [
                { id: "d1", percent: 100, label: "Tam razıyam", score: 10 },
                { id: "d2", percent: 80, label: "Razıyam", score: 8 },
                { id: "d3", percent: 60, label: "Qismən razıyam", score: 6 },
                { id: "d4", percent: 40, label: "Razı deyiləm", score: 4 },
                { id: "d5", percent: 0, label: "Heç razı deyiləm", score: 0 },
              ] as CompetencyAnswer[])].sort((x, y) => answerPct(y) - answerPct(x)).map(a => {
                const pct = answerPct(a);
                return (
                  <tr key={a.id || a.label} className="border-t border-border">
                    <td className="px-3 py-2">{a.label}</td>
                    <td className="px-3 py-2">{pct}%</td>
                    <td className="px-3 py-2"><span className={`inline-block w-3 h-3 rounded-full ${scoreColor(pct)}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>



      {/* Modals */}
      <CreateEditModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && <CreateEditModal open={!!editing} onClose={() => setEditing(null)} initial={editing} />}
      {answersEditOpen && (
        <CreateEditModal
          open={answersEditOpen}
          onClose={() => setAnswersEditOpen(false)}
          initial={selected || undefined}
          mode="answersOnly"
          allMatrices={list}
        />
      )}
      <ViewModal matrix={viewing} onClose={() => setViewing(null)} />
      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Matris silinsin?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">"{confirmDelete?.name}" adlı matris birdəfəlik silinəcək.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Ləğv et</Button>
            <Button variant="destructive" onClick={() => { if (confirmDelete) { deleteCompetencyMatrix(confirmDelete.id); toast.success("Silindi"); setConfirmDelete(null); } }}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetencyMatrixTab;
