import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Search, Settings2, Download, CheckCircle2, XCircle, Trash2, Filter, ListChecks, UserCheck, Users, ArrowRight, ArrowLeft, Sparkles, Target, Send, Calendar as CalendarIcon, Shuffle, Hand, CalendarDays, Pencil, Star, Eye, ArrowLeftCircle, ChevronDown, LayoutGrid, List as ListIcon } from "lucide-react";
import { getVisibleSharedKpiCards, type SharedKpiCard } from "@/lib/kpiCardStore";
import { mockStructures, mockTeams } from "@/data/mockExtras";
import { getTeams } from "@/lib/teamsStore";
import { getFlatStructureNodes, getEmployees, getStarHolderOfUnit } from "@/lib/orgStore";

import { PageHero } from "@/components/ui/page-hero";
import ExportMenu from "@/components/common/ExportMenu";
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useCatalogValues } from "@/lib/dropdownCatalogStore";
import { Badge } from "@/components/ui/badge";
import { mockEmployees, getInitials, MockEmployee, buildPeerAssignments, CURRENT_CYCLE_ID } from "@/data/mockData";
import { toast } from "sonner";
import { getCriteria, addCriterion, removeCriterion } from "@/lib/catalogStore";
import { getScoreScale, setScoreScale, getScoreScales, addScoreScale, removeScoreScale, setDefaultScale, getDefaultScale, getScaleById, type ScoreScale } from "@/lib/evaluationConfigStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSeasonOpen, setSeasonOpen } from "@/lib/seasonStore";
import { hasReviewerSubmitted, getReviewsForReviewee } from "@/lib/peerReviewStore";
import { getManualAssignments, addManualAssignment, removeManualAssignment, getUsedRevieweeIds, type ManualAssignment } from "@/lib/manualAssignmentsStore";
import { addSurvey } from "@/lib/evaluationSurveyStore";
import ColumnSearchHeader from "@/components/common/ColumnSearchHeader";
import CompetencyMatrixTab from "@/components/evaluation/CompetencyMatrixTab";
import { getCompetencyMatrices } from "@/lib/competencyMatrixStore";
import { AlertTriangle } from "lucide-react";
import { useUrlView } from "@/lib/useUrlView";

// =============== Survey Dialog (HR sends evaluation request to employees) ===============
const SurveyDialog = () => {
  const [open, setOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"halfYear" | "annual">("halfYear");
  const [half, setHalf] = useState<"H1" | "H2">("H1");
  const [year, setYear] = useState<number>(2026);
  const [deadline, setDeadline] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);

  const reset = () => {
    setPeriodType("halfYear"); setHalf("H1"); setYear(2026);
    setDeadline(""); setSelected([]); setNotify(true);
  };

  const allIds = mockEmployees.map(e => e.id);
  const allSelected = selected.length === allIds.length;
  const toggleAll = () => setSelected(allSelected ? [] : allIds);
  const toggleOne = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const canSubmit = selected.length > 0 && !!deadline;

  const submit = () => {
    if (!canSubmit) return;
    addSurvey({
      periodType,
      half: periodType === "halfYear" ? half : undefined,
      year,
      deadline,
      employeeIds: selected,
      notifyEmail: notify,
    });
    toast.success("Sorğu göndərildi", {
      description: `${selected.length} əməkdaş${notify ? " · email bildirişi aktiv" : ""}`,
    });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Qiymətləndirmə sorğusu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Qiymətləndirmə Sorğusu
          </DialogTitle>
          <DialogDescription>
            Seçilmiş əməkdaşlara qiymətləndirmə sorğusu göndərin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Dövr</Label>
            <Select value={periodType} onValueChange={(v: "halfYear" | "annual") => setPeriodType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="halfYear">Yarımillik</SelectItem>
                <SelectItem value="annual">İllik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "halfYear" && (
            <div className="space-y-1.5">
              <Label>Yarımil</Label>
              <Select value={half} onValueChange={(v: "H1" | "H2") => setHalf(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="H1">1-ci yarımil</SelectItem>
                  <SelectItem value="H2">2-ci yarımil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>İl</Label>
            <Input type="number" min={2024} max={2030} value={year} onChange={e => setYear(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Son tarix *</Label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>İşçilər</Label>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
            >
              {allSelected ? "Heç birini seçmə" : "Hamısını seç"}
            </button>
          </div>
          <div className="border border-border rounded-xl overflow-y-auto max-h-48 divide-y divide-border">
            {mockEmployees.map(e => {
              const checked = selected.includes(e.id);
              return (
                <label key={e.id} className={`flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${checked ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                  <Checkbox checked={checked} onCheckedChange={() => toggleOne(e.id)} />
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {getInitials(e.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.department} — {e.position} · {e.email}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{selected.length} işçi seçildi</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} />
          <Send className="w-4 h-4 text-muted-foreground" />
          Email ilə bildiriş göndər
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Ləğv et</Button>
          <Button onClick={submit} disabled={!canSubmit} className="gap-2">
            <Send className="w-4 h-4" /> Sorğu göndər ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// =============== Manual Assignment (HR → 1 reviewer + 2 reviewees + criteria) ===============
const ManualAssignmentDialog = ({ onCreated }: { onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [revieweeIds, setRevieweeIds] = useState<string[]>([]);
  const [criteriaByReviewee, setCriteriaByReviewee] = useState<Record<string, string[]>>({});
  const [scaleByReviewee, setScaleByReviewee] = useState<Record<string, string>>({});
  const [revieweeCount, setRevieweeCount] = useState<number>(2);
  const [search, setSearch] = useState("");

  const allCriteria = getCriteria();
  const allScales = getScoreScales();
  const defaultScale = getDefaultScale();
  const usedReviewees = getUsedRevieweeIds(CURRENT_CYCLE_ID);

  const reset = () => {
    setStep(1); setReviewerIds([]); setRevieweeIds([]);
    setCriteriaByReviewee({}); setScaleByReviewee({});
    setRevieweeCount(2); setSearch("");
  };

  const matchSearch = (e: MockEmployee) =>
    search.trim() === "" ||
    e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    e.position.toLowerCase().includes(search.toLowerCase());

  const reviewerPool = mockEmployees.filter(matchSearch);

  // Step 2 pool: all employees searched. Reviewers shown but disabled (greyed).
  // Previously-used reviewees are also hidden.
  const revieweePool = mockEmployees.filter(e => !usedReviewees.has(e.id) && matchSearch(e));

  const toggleReviewer = (id: string) => {
    setReviewerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleReviewee = (id: string) => {
    if (reviewerIds.includes(id)) return;
    setRevieweeIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        setCriteriaByReviewee(c => { const n = { ...c }; delete n[id]; return n; });
        setScaleByReviewee(s => { const n = { ...s }; delete n[id]; return n; });
        return next;
      }
      if (prev.length >= revieweeCount) {
        toast.error(`Maksimum ${revieweeCount} əməkdaş seçə bilərsiniz`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const performRandomPick = () => {
    const pool = revieweePool.filter(e => !reviewerIds.includes(e.id));
    const picks: string[] = [];
    const n = Math.min(revieweeCount, pool.length);
    const work = [...pool];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * work.length);
      picks.push(work[idx].id);
      work.splice(idx, 1);
    }
    setRevieweeIds(picks);
    setCriteriaByReviewee({}); setScaleByReviewee({});
    toast.success(`${picks.length} əməkdaş təsadüfi seçildi`);
  };

  const toggleCriterionFor = (revId: string, c: string) => {
    setCriteriaByReviewee(prev => {
      const cur = prev[revId] || [];
      return { ...prev, [revId]: cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c] };
    });
  };

  const setScaleFor = (revId: string, scaleId: string) => {
    setScaleByReviewee(prev => ({ ...prev, [revId]: scaleId }));
  };

  const submit = () => {
    if (reviewerIds.length === 0 || revieweeIds.length === 0) return;
    const allHave = revieweeIds.every(id => (criteriaByReviewee[id]?.length ?? 0) > 0);
    if (!allHave) return;
    // create one assignment per reviewer
    reviewerIds.forEach(rev => {
      addManualAssignment({
        reviewerId: rev,
        revieweeIds: revieweeIds,
        criteriaByReviewee,
        criteria: Array.from(new Set(revieweeIds.flatMap(id => criteriaByReviewee[id] || []))),
        scaleByReviewee,
        cycleId: CURRENT_CYCLE_ID,
      });
    });
    toast.success("Təyinat yaradıldı", {
      description: `${reviewerIds.length} qiymətləndirici × ${revieweeIds.length} əməkdaş`,
    });
    onCreated();
    setOpen(false);
    reset();
  };

  const step3Valid =
    revieweeIds.length > 0 &&
    revieweeIds.every(id => (criteriaByReviewee[id]?.length ?? 0) > 0);

  const nextDisabled =
    (step === 1 && reviewerIds.length === 0) ||
    (step === 2 && revieweeIds.length < 1) ||
    (step === 3 && !step3Valid);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm">
          <Sparkles className="w-4 h-4" /> Qiymətləndirən təyin et
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Yeni Qiymətləndirən Təyinatı
          </DialogTitle>
          <DialogDescription>
            Addım-addım qiymətləndirən(lər)i, hədəf əməkdaşları və meyarları təyin edin.
          </DialogDescription>
        </DialogHeader>


        {/* Steps indicator */}
        <div className="flex items-center gap-2 px-1">
          {[
            { n: 1, l: "Qiymətləndirici(lər)", icon: UserCheck },
            { n: 2, l: "Əməkdaşlar", icon: Users },
            { n: 3, l: "Meyarlar", icon: Target },
          ].map((s, i) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n;
            return (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 transition-all ${
                  active ? "bg-primary text-primary-foreground shadow-sm" :
                  done ? "bg-primary/15 text-primary" :
                  "bg-muted/40 text-muted-foreground"
                }`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{s.n}. {s.l}</span>
                </div>
                {i < 2 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1: pick reviewers (MULTI) */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Qiymətləndirməni aparacaq əməkdaş(lar)ı seçin.
              </p>
              <Badge variant={reviewerIds.length > 0 ? "default" : "secondary"}>{reviewerIds.length} seçilib</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad, departament və ya vəzifə..." className="pl-9" />
            </div>
            <div className="border border-border rounded-xl overflow-y-auto max-h-72 divide-y divide-border">
              {reviewerPool.map(e => {
                const checked = reviewerIds.includes(e.id);
                return (
                  <label key={e.id} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${checked ? "bg-primary/10" : "hover:bg-muted/40"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleReviewer(e.id)} />
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">{getInitials(e.fullName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{e.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{e.department} — {e.position}</p>
                    </div>
                  </label>
                );
              })}
              {reviewerPool.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Tapılmadı</div>}
            </div>
          </div>
        )}

        {/* STEP 2: pick reviewees */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Qiymətləndirilcək əməkdaşları seçin və ya təsadüfi təyin edin.
              </p>
              <Badge variant={revieweeIds.length >= 1 ? "default" : "secondary"}>{revieweeIds.length}/{revieweeCount}</Badge>
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1.5">
                <Label className="text-xs">Say</Label>
                <Input type="number" min={1} max={20} value={revieweeCount}
                  onChange={e => setRevieweeCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24" />
              </div>
              <Button onClick={performRandomPick} variant="outline" className="gap-2">
                <Shuffle className="w-4 h-4" /> Təsadüfi seç
              </Button>
              <p className="text-[11px] text-muted-foreground ml-auto">
                Qiymətləndirici kimi seçilmiş şəxslər boz görünür və seçilə bilməz.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Axtar..." className="pl-9" />
            </div>
            <div className="border border-border rounded-xl overflow-y-auto max-h-72 divide-y divide-border">
              {revieweePool.map(e => {
                const checked = revieweeIds.includes(e.id);
                const isReviewer = reviewerIds.includes(e.id);
                return (
                  <label key={e.id} className={`flex items-center gap-3 p-3 transition-colors ${
                    isReviewer ? "opacity-50 cursor-not-allowed bg-muted/20" :
                    checked ? "bg-primary/10 cursor-pointer" : "hover:bg-muted/40 cursor-pointer"
                  }`}>
                    <Checkbox checked={checked} disabled={isReviewer} onCheckedChange={() => toggleReviewee(e.id)} />
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${isReviewer ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>{getInitials(e.fullName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${isReviewer ? "text-muted-foreground italic" : "text-foreground"}`}>
                        {e.fullName}{isReviewer && " (qiymətləndirici)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{e.department} — {e.position}</p>
                    </div>
                  </label>
                );
              })}
              {revieweePool.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sərbəst əməkdaş yoxdur</div>}
            </div>
          </div>
        )}

        {/* STEP 3: per-reviewee criteria (auto from competency matrix) + scale */}
        {step === 3 && (() => {
          const activeMatrices = getCompetencyMatrices().filter(m => m.status === "aktiv");
          const matrixFor = (position: string) =>
            activeMatrices.find(m => m.positions.some(p => p.toLowerCase() === (position || "").toLowerCase()));
          return (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Meyarlar hər əməkdaşın vəzifəsinə uyğun <span className="font-semibold text-foreground">Səriştə Matrisindən</span> avtomatik gətirilir.
            </p>
            {revieweeIds.map(rid => {
              const emp = mockEmployees.find(e => e.id === rid);
              if (!emp) return null;
              const matrix = matrixFor(emp.position);
              const empCriteria = matrix ? matrix.questions.map(q => q.text) : [];
              // Auto-sync into state so submit passes
              const stored = criteriaByReviewee[rid] || [];
              if (matrix && (stored.length !== empCriteria.length || !empCriteria.every(c => stored.includes(c)))) {
                setTimeout(() => setCriteriaByReviewee(prev => ({ ...prev, [rid]: empCriteria })), 0);
              }
              const selectedForEmp = empCriteria;
              const activeScale = getScaleById(scaleByReviewee[rid]) || defaultScale;
              return (
                <div key={rid} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">{getInitials(emp.fullName)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.department} — {emp.position}</p>
                    </div>
                    <Badge variant={selectedForEmp.length > 0 ? "default" : "secondary"}>
                      {selectedForEmp.length} meyar
                    </Badge>
                  </div>

                  {/* Scale row */}
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background">
                    <div className="flex items-center gap-2 min-w-0">
                      <Star className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">Bal sistemi:</span>
                      <span className="text-sm font-medium text-foreground">{activeScale.label}</span>
                      <span className="text-[11px] text-muted-foreground">({activeScale.min}–{activeScale.max})</span>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Dəyiş
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-1">
                        <div className="max-h-60 overflow-y-auto">
                          {allScales.map(s => {
                            const isActive = activeScale.id === s.id;
                            return (
                              <button key={s.id} onClick={() => setScaleFor(rid, s.id)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground"}`}>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium">{s.label}</span>
                                  {s.isDefault && <Badge variant="secondary" className="h-4 text-[9px]">default</Badge>}
                                </span>
                                <span className="text-[11px] text-muted-foreground">{s.min}–{s.max}</span>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {matrix ? (
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <Target className="w-3.5 h-3.5 text-primary" />
                        Səriştə matrisi: <span className="font-medium text-foreground">{matrix.name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {empCriteria.map(c => (
                          <div key={c} className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/40 bg-primary/5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm text-foreground">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="m-3 p-3 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-500/10 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">Aktiv səriştə matrisi tapılmadı</p>
                        <p className="text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                          "{emp.position}" vəzifəsi üçün aktiv Səriştə Matrisi mövcud deyil. Zəhmət olmasa Səriştə Matrisi bölməsində uyğun matris yaradın.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })()}

        <DialogFooter className="flex !justify-between">
          <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1) as 1 | 2 | 3)} disabled={step === 1} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)} disabled={nextDisabled} className="gap-1">
              Növbəti <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={nextDisabled} className="gap-1">
              <CheckCircle2 className="w-4 h-4" /> Qiymətləndirəni təyin et
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};


// =============== Manual Assignments List ===============
const AssignmentsTab = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const r = () => force(t => t + 1);
    window.addEventListener("manual-assignments-updated", r);
    return () => window.removeEventListener("manual-assignments-updated", r);
  }, []);
  const items = getManualAssignments().filter(a => a.cycleId === CURRENT_CYCLE_ID);

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Hələ qiymətləndirən yoxdur</p>
          <p className="text-xs text-muted-foreground mt-1">Yuxarıdakı "Qiymətləndirən təyin et" düyməsindən başlayın</p>
        </div>

      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(a => {
            const reviewer = mockEmployees.find(e => e.id === a.reviewerId);
            const reviewees = a.revieweeIds.map(id => mockEmployees.find(e => e.id === id)).filter(Boolean) as MockEmployee[];
            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                      {reviewer ? getInitials(reviewer.fullName) : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{reviewer?.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{reviewer?.position}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { removeManualAssignment(a.id); toast.success("Silindi"); }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-semibold">Qiymətləndirəcək (meyarlarla)</div>
                <div className="space-y-3">
                  {reviewees.map(r => {
                    const perCrit = a.criteriaByReviewee?.[r.id] ?? a.criteria ?? [];
                    return (
                      <div key={r.id} className="rounded-lg bg-muted/40 border border-border p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold">{getInitials(r.fullName)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{r.fullName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{r.position}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] h-5">{perCrit.length}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {perCrit.map(c => (
                            <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =============== Criteria catalog ===============
const CriteriaTab = () => {
  const [, force] = useState(0);
  const [val, setVal] = useState("");
  useEffect(() => {
    const r = () => force(t => t + 1);
    window.addEventListener("catalog-updated", r);
    return () => window.removeEventListener("catalog-updated", r);
  }, []);
  const items = getCriteria();
  const submit = () => {
    if (!val.trim()) return;
    addCriterion(val.trim());
    toast.success("Meyar əlavə edildi");
    setVal("");
  };
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden max-w-2xl">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/30">
        <ListChecks className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Qiymətləndirmə meyarları</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="məs: Liderlik" />
          <Button onClick={submit} className="gap-1"><Plus className="w-4 h-4" /> Əlavə et</Button>
        </div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Boşdur</p>}
          {items.map(it => (
            <div key={it} className="flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-border bg-background">
              <span className="text-foreground">{it}</span>
              <button onClick={() => { removeCriterion(it); toast.success("Silindi"); }} className="p-1 rounded hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SettingsTab = () => {
  const [scales, setScales] = useState<ScoreScale[]>(getScoreScales());
  const [newMin, setNewMin] = useState<number>(1);
  const [newMax, setNewMax] = useState<number>(10);
  const [newLabel, setNewLabel] = useState<string>("");

  useEffect(() => {
    const r = () => setScales(getScoreScales());
    window.addEventListener("eval-config-updated", r);
    return () => window.removeEventListener("eval-config-updated", r);
  }, []);

  const handleAdd = () => {
    if (newMin >= newMax) { toast.error("Min < Max olmalıdır"); return; }
    if (scales.some(s => s.min === newMin && s.max === newMax)) {
      toast.error("Bu aralıq artıq mövcuddur"); return;
    }
    addScoreScale({
      label: newLabel.trim() || `${newMin} – ${newMax}`,
      min: newMin, max: newMax,
    });
    setNewLabel("");
    toast.success("Yeni bal aralığı əlavə olundu");
  };

  const handleMakeDefault = (id: string) => {
    setDefaultScale(id);
    toast.success("Default bal aralığı yeniləndi");
  };

  const handleRemove = (id: string) => {
    if (scales.length <= 1) { toast.error("Ən azı bir aralıq qalmalıdır"); return; }
    removeScoreScale(id);
    toast.success("Silindi");
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Bal aralıqları</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Default aralıq təyinat yaradılarkən hər əməkdaş üçün avtomatik tətbiq olunur. Lazım gəldikdə qiymətləndirici hər əməkdaş üçün başqa aralıq seçə bilər.
        </p>

        <div className="space-y-2">
          {scales.map(s => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <Star className={`w-4 h-4 ${s.isDefault ? "text-primary fill-primary" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.label}</span>
                  {s.isDefault && <Badge variant="default" className="h-5 text-[10px]">Default</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Aralıq: {s.min} – {s.max}</p>
              </div>
              {!s.isDefault && (
                <Button variant="outline" size="sm" onClick={() => handleMakeDefault(s.id)}>
                  Default et
                </Button>
              )}
              {!s.isDefault && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(s.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Yeni bal aralığı əlavə et</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Min</Label>
            <Input type="number" value={newMin} onChange={e => setNewMin(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Max</Label>
            <Input type="number" value={newMax} onChange={e => setNewMax(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Ad (ixtiyari)</Label>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={`${newMin} – ${newMax}`} />
          </div>
        </div>
        <Button onClick={handleAdd} className="gap-1"><Plus className="w-4 h-4" /> Əlavə et</Button>
      </div>
    </div>
  );
};


// =============== Status İzləmə — 3 sub-tab (Fərdi / Komanda / Struktur) ===============
// (imports moved to top)

type StatusScope = "individual" | "team" | "structure";

interface StatusGroup {
  key: string;
  name: string;
  subtitle?: string;
  cards: SharedKpiCard[];
  goalCount: number;
  members?: { id: string; name: string; position?: string }[];
  leaderName?: string;
  teamCount?: number;
}

const hash = (s: string) => {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const employeeName = (id: string): string => {
  const e = mockEmployees.find(x => x.id === id);
  return e?.fullName || id;
};
const employeePosition = (id: string): string => {
  const e = mockEmployees.find(x => x.id === id);
  return e?.position || "";
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Ad üzrə real əməkdaş id-si (tapılmasa adın özü qaytarılır). */
const employeeIdByName = (name: string): string =>
  mockEmployees.find(e => norm(e.fullName) === norm(name))?.id || name;

const buildGroups = (scope: StatusScope): StatusGroup[] => {
  const cards = getVisibleSharedKpiCards();
  if (scope === "individual") {
    // Fərdi: default olaraq bütün əməkdaşlar görünür; kart/hədəf sayları həmin əməkdaşa düşən KPI-lardan hesablanır.
    return mockEmployees.map(e => {
      const employeeCards = cards.filter(c => c.assigneeIds.includes(e.id));
      return {
        key: e.id,
        name: e.fullName,
        subtitle: e.position,
        cards: employeeCards,
        goalCount: employeeCards.reduce((sum, card) => sum + card.targets.length, 0),
      };
    });
  }

  if (scope === "team") {
    // Sistemdəki real komandalar (Komandalar modulu) — mock yoxdur.
    return getTeams().map(t => {
      const memberNames = Array.from(
        new Set([t.leader, ...(t.members || []).map(m => m.name)].filter(Boolean)),
      );
      const teamCards = cards.filter(c =>
        (c.teamIds || []).some(id => norm(id) === norm(t.id) || norm(id) === norm(t.name)),
      );
      return {
        key: String(t.id),
        name: t.name,
        subtitle: `${memberNames.length} üzv`,
        cards: teamCards,
        goalCount: teamCards.reduce((sum, card) => sum + card.targets.length, 0),
        leaderName: t.leader || "—",
        members: memberNames.map(n => {
          const id = employeeIdByName(n);
          return { id, name: n, position: employeePosition(id) };
        }),
      };
    });
  }

  // Struktur: real təşkilati struktur ağacı.
  const nodes = getFlatStructureNodes();
  const emps = getEmployees().filter(e => e.active !== false);
  return nodes.map(n => {
    const members = emps.filter(e => {
      const path = e.structurePath || "";
      return path === n.path || path.startsWith(`${n.path} › `);
    });
    const structureCards = cards.filter(c =>
      (c.structureIds || []).some(sidValue => {
        const s = norm(sidValue);
        return s === norm(n.id) || s === norm(n.path) || s === norm(n.name);
      }),
    );
    const leader = getStarHolderOfUnit(n.id);
    return {
      key: String(n.id),
      name: n.path,
      subtitle: `${members.length} əməkdaş`,
      cards: structureCards,
      goalCount: structureCards.reduce((sum, card) => sum + card.targets.length, 0),
      leaderName: leader ? `${leader.firstName} ${leader.lastName}`.trim() : "—",
      teamCount: nodes.filter(x => x.parentId === n.id).length,
      members: members.map(e => ({
        id: String(e.id),
        name: `${e.firstName} ${e.lastName}`.trim(),
        position: e.positionName || "",
      })),
    };
  });
};

// ---------- Multi-rater evaluation row ----------
interface RaterEval {
  evaluatorId: string;
  score: number | null;
  max: number;
  weight: number;
  date: string | null;
  done: boolean;
}

/** Real qiymətləndiricilər — bal yalnız sistemdə qeyd edildikdə görünür.
 *  Heç bir simulyasiya / təsadüfi dəyər yaradılmır. */
const buildRaters = (_seed: string, evaluatorIds: string[], scoreLimit: number): RaterEval[] => {
  if (evaluatorIds.length === 0) return [];
  const base = Math.floor(100 / evaluatorIds.length);
  return evaluatorIds.map((eid, ei) => ({
    evaluatorId: eid,
    score: null,
    max: scoreLimit,
    weight: ei === 0 ? base + (100 - base * evaluatorIds.length) : base,
    date: null,
    done: false,
  }));
};


const finalScore = (raters: RaterEval[]): number | null => {
  const done = raters.filter(r => r.done && r.score !== null);
  if (done.length === 0) return null;
  const totalWeight = done.reduce((sum, r) => sum + r.weight, 0) || done.length;
  const weighted = done.reduce((sum, r) => sum + ((r.score! / r.max) * 5 * r.weight), 0) / totalWeight;
  return Math.round(weighted * 10) / 10;
};

const RaterList = ({ raters }: { raters: RaterEval[] }) => (
  <div className="space-y-1.5">
    {raters.map((r, i) => (
      <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
          {getInitials(employeeName(r.evaluatorId))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate">{employeeName(r.evaluatorId)}</p>
          <p className="text-[10px] text-muted-foreground truncate">{employeePosition(r.evaluatorId)} · Çəki: {r.weight}%</p>
        </div>
        {r.done ? (
          <>
            <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/20 h-6">
              <Star className="w-3 h-3" /> {r.score}/{r.max}
            </Badge>
            <span className="text-[10px] text-muted-foreground shrink-0">{r.date}</span>
            <Badge variant="secondary" className="gap-1 h-6"><CheckCircle2 className="w-3 h-3 text-primary" /> Qiymətləndirib</Badge>
          </>
        ) : (
          <Badge variant="secondary" className="gap-1 h-6"><XCircle className="w-3 h-3" /> Gözləyir</Badge>
        )}
      </div>
    ))}
  </div>
);

const GroupDetailDialog = ({ group, scope, onClose }: { group: StatusGroup | null; scope: StatusScope; onClose: () => void }) => {
  const [showMembers, setShowMembers] = useState(false);
  const [openCardIds, setOpenCardIds] = useState<string[]>([]);
  useEffect(() => {
    setShowMembers(false);
    setOpenCardIds([]);
  }, [group?.key]);
  if (!group) return null;

  // Competencies from the criteria catalog
  const competencies = getCriteria().slice(0, 6);

  // Yalnız real qiymətləndiricilər: kartda təyin olunmuş şəxslər + komanda/struktur rəhbəri.
  const toggleCard = (cardId: string) => {
    setOpenCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
  };

  const getGoalEvaluatorIds = (card: SharedKpiCard, _targetIndex: number): string[] => {
    const base = card.evaluatorIds.length > 0 ? card.evaluatorIds : [card.ownerId];
    if (scope === "team" || scope === "structure") {
      const leaderId = group.leaderName ? employeeIdByName(group.leaderName) : "";
      return Array.from(new Set([leaderId, ...base].filter(Boolean)));
    }
    return base;
  };


  const renderGoalCards = (title: string, emptyText: string, badgeLabel?: string) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant="secondary" className="h-6">{badgeLabel || `${group.cards.length} kart`}</Badge>
      </div>
      {group.cards.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">{emptyText}</div>
      ) : group.cards.map(card => {
        const isOpen = openCardIds.includes(card.id);
        // Aggregate stats for header
        const cardStats = card.targets.map((t, ti) => {
          const evalIds = getGoalEvaluatorIds(card, ti);
          const raters = buildRaters(card.id + t.id, evalIds, t.scoreLimit);
          return { raters, finalS: finalScore(raters) };
        });
        const doneRaters = cardStats.flatMap(s => s.raters).filter(r => r.done).length;
        const totalRaters = cardStats.flatMap(s => s.raters).length;
        const avgFinal = (() => {
          const arr = cardStats.map(s => s.finalS).filter((v): v is number => v !== null);
          if (arr.length === 0) return null;
          return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
        })();
        const cardCompletePct = totalRaters ? Math.round((doneRaters / totalRaters) * 100) : 0;
        return (
          <div key={card.id} className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
            <button type="button" onClick={() => toggleCard(card.id)} className="w-full px-4 py-3.5 bg-gradient-to-r from-primary/5 via-card to-card hover:from-primary/10 transition-all text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{card.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {card.startDate} — {card.endDate} · {card.targets.length} hədəf
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="h-6 gap-1">
                    <Users className="w-3 h-3" /> {doneRaters}/{totalRaters}
                  </Badge>
                  <Badge className={`h-6 gap-1 ${avgFinal !== null ? "bg-primary/15 text-primary hover:bg-primary/20" : ""}`} variant={avgFinal !== null ? "default" : "secondary"}>
                    <Star className="w-3 h-3" /> {avgFinal !== null ? `${avgFinal}/5` : "—"}
                  </Badge>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Progress value={cardCompletePct} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{cardCompletePct}%</span>
              </div>
            </button>
            {isOpen && (
              <div className="divide-y divide-border">
                {card.targets.map((t, ti) => {
                  const { raters, finalS } = cardStats[ti];
                  const actual = 0;
                  const doneCount = raters.filter(r => r.done).length;
                  const latestDate = raters.filter(r => r.done && r.date).map(r => r.date!).sort().slice(-1)[0] || null;
                  const status = raters.length > 0 && doneCount === raters.length ? "Tamamlanıb" : doneCount === 0 ? "Gözləyir" : "Davam edir";

                  const statusTone = status === "Tamamlanıb" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : status === "Gözləyir" ? "bg-muted text-muted-foreground border-border" : "bg-amber-500/15 text-amber-600 border-amber-500/30";
                  return (
                    <div key={t.id} className="p-4 space-y-3 bg-background">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{t.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">{t.type}</span>
                            <span className="text-[11px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">Çəki: <span className="font-medium text-foreground">{t.weight}%</span></span>
                            <span className="text-[11px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">Nəticə: <span className="font-medium text-foreground">{actual}%</span></span>
                            {latestDate && <>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">Tarix: <span className="font-medium text-foreground">{latestDate}</span></span>
                            </>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`h-6 border ${statusTone}`}>{status}</Badge>
                          <Badge className={`h-6 gap-1 ${finalS !== null ? "bg-primary/15 text-primary hover:bg-primary/20" : ""}`} variant={finalS !== null ? "default" : "secondary"}>
                            <Star className="w-3 h-3" /> Yekun: {finalS !== null ? `${finalS}/5` : "—"}
                          </Badge>
                        </div>
                      </div>
                      <RaterList raters={raters} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );


  const renderIndividualGoals = () => renderGoalCards("Hədəflər", "Bu əməkdaş üçün KPI kartı yoxdur");

  const renderIndividualCompetencies = () => {
    // Simple category grouping: split criteria into 2 categories for a structured look.
    const half = Math.ceil(competencies.length / 2);
    const categories: { name: string; icon: typeof Sparkles; items: string[] }[] = [
      { name: "Peşəkar bacarıqlar", icon: Sparkles, items: competencies.slice(0, half) },
      { name: "Davranış və münasibət", icon: UserCheck, items: competencies.slice(half) },
    ].filter(c => c.items.length > 0);

    return (
      <div className="space-y-4">
        {categories.map(cat => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.name} className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 via-card to-card">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                    <CatIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                    <p className="text-[11px] text-muted-foreground">{cat.items.length} səriştə meyarı</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {cat.items.map((c, ci) => {
                  const evalIds = group.cards[0]?.evaluatorIds && group.cards[0].evaluatorIds.length > 0
                    ? group.cards[0].evaluatorIds
                    : [];

                  const raters = buildRaters(group.key + "-comp-" + c, evalIds, 5);
                  const finalS = finalScore(raters);
                  const weight = Math.round(100 / cat.items.length);
                  const doneCount = raters.filter(r => r.done).length;
                  const latestDate = raters.filter(r => r.done && r.date).map(r => r.date!).sort().slice(-1)[0] || null;
                  const status = doneCount === raters.length ? "Tamamlanıb" : doneCount === 0 ? "Gözləyir" : "Davam edir";
                  const statusTone = status === "Tamamlanıb" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : status === "Gözləyir" ? "bg-muted text-muted-foreground border-border" : "bg-amber-500/15 text-amber-600 border-amber-500/30";
                  return (
                    <div key={c} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{c}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">Çəki: <span className="font-medium text-foreground">{weight}%</span></span>
                            {latestDate && <>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">Tarix: <span className="font-medium text-foreground">{latestDate}</span></span>
                            </>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`h-6 border ${statusTone}`}>{status}</Badge>
                          <Badge className={`h-6 gap-1 ${finalS !== null ? "bg-primary/15 text-primary hover:bg-primary/20" : ""}`} variant={finalS !== null ? "default" : "secondary"}>
                            <Star className="w-3 h-3" /> Yekun: {finalS !== null ? `${finalS}/5` : "—"}
                          </Badge>
                        </div>
                      </div>
                      <RaterList raters={raters} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  const renderTeamDetail = () => {
    const members = group.members || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Komanda rəhbəri</p><p className="text-sm font-semibold text-foreground">{group.leaderName || "—"}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Üzv sayı</p><p className="text-sm font-semibold text-foreground">{members.length}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Qiymətləndirmə tipi</p><p className="text-sm font-semibold text-foreground">Hədəf əsaslı</p></div>
        </div>
        {renderGoalCards("Komanda hədəfləri üzrə qiymətləndirmələr", "Bu komanda üçün hədəf KPI kartı yoxdur", `${group.goalCount} hədəf`)}
      </div>
    );
  };

  const renderStructureDetail = () => {
    const members = group.members || [];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Struktur rəhbəri</p><p className="text-sm font-semibold text-foreground">{group.leaderName || "—"}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Alt struktur sayı</p><p className="text-sm font-semibold text-foreground">{group.teamCount ?? 0}</p></div>
          <div className="rounded-xl border border-border bg-card p-3"><p className="text-[11px] text-muted-foreground">Əməkdaş sayı</p><p className="text-sm font-semibold text-foreground">{members.length}</p></div>
        </div>
        {renderGoalCards("Struktur hədəfləri üzrə qiymətləndirmələr", "Bu struktur üçün hədəf KPI kartı yoxdur", `${group.goalCount} hədəf`)}
      </div>
    );
  };


  return (
    <Dialog open={!!group} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {group.name}
          </DialogTitle>
          <DialogDescription>
            {scope === "individual"
              ? `${group.cards.length} KPI kartı · ${group.goalCount} hədəf · səriştələr`
              : scope === "team"
                ? `Komanda üzrə hədəf əsaslı status · ${group.members?.length || 0} üzv`
                : `Struktur üzrə hədəf əsaslı status · ${group.members?.length || 0} əməkdaş`}
            {group.subtitle && ` · ${group.subtitle}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-3 flex-wrap">
          {scope !== "individual" && group.members && group.members.length > 0 && (
            <button onClick={() => setShowMembers(v => !v)}
              className="text-[11px] text-primary hover:underline">
              {showMembers ? "Qiymətləndirmələrə qayıt" : scope === "team" ? "Komanda üzvlərinə bax" : "Strukturdakı əməkdaşlara bax"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {showMembers ? (
            <div className="border border-border rounded-xl divide-y divide-border">
              {group.members?.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">{getInitials(m.name)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.position}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : scope === "individual" ? (
            <Tabs defaultValue="goals" className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="goals" className="gap-2">
                  <Target className="w-4 h-4" /> Hədəflər
                </TabsTrigger>
                <TabsTrigger value="comps" className="gap-2">
                  <Sparkles className="w-4 h-4" /> Səriştələr
                </TabsTrigger>
              </TabsList>
              <TabsContent value="goals" className="mt-4 space-y-3">
                {renderIndividualGoals()}
              </TabsContent>
              <TabsContent value="comps" className="mt-4">
                {renderIndividualCompetencies()}
              </TabsContent>
            </Tabs>
          ) : scope === "team" ? (
            renderTeamDetail()
          ) : (
            renderStructureDetail()
          )}
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bağla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StatusTab = () => {
  const [subTab, setSubTab] = useState<StatusScope>("individual");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<StatusGroup | null>(null);
  const [tick, force] = useState(0);
  useEffect(() => {
    const r = () => force(t => t + 1);
    const events = ["shared-kpi-cards-updated", "org-updated", "teams-updated", "teams-hydrated"];
    events.forEach(e => window.addEventListener(e, r));
    return () => events.forEach(e => window.removeEventListener(e, r));
  }, []);
  const groups = useMemo(() => buildGroups(subTab), [subTab, tick]);

  const filtered = groups.filter(g => !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()));

  const label = subTab === "individual" ? "Əməkdaş" : subTab === "team" ? "Komanda" : "Struktur";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border border-border rounded-xl bg-card p-1 w-fit">
        {[
          { k: "individual" as const, l: "Fərdi", icon: UserCheck },
          { k: "team" as const, l: "Komanda", icon: Users },
          { k: "structure" as const, l: "Struktur", icon: ListChecks },
        ].map(t => {
          const Icon = t.icon;
          const active = subTab === t.k;
          return (
            <button key={t.k} onClick={() => setSubTab(t.k)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" /> {t.l}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${label} axtar...`} className="pl-9 w-64" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{filtered.length} nəticə</Badge>
          <div className="flex items-center gap-1 border border-border rounded-lg bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              aria-label="Kart görünüşü"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "card" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kart
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="Siyahı görünüşü"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ListIcon className="w-3.5 h-3.5" /> Siyahı
            </button>
          </div>
        </div>
      </div>

      {viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(g => {
            const teamCount = subTab === "structure" ? (g.teamCount ?? 0) : 0;
            const metaChips: { label: string; value: string | number }[] =
              subTab === "individual"
                ? [
                    { label: "KPI kartı", value: g.cards.length },
                    { label: "Hədəf", value: g.goalCount },
                  ]
                : subTab === "team"
                  ? [
                      { label: "Üzv", value: g.members?.length || 0 },
                      { label: "Hədəf", value: g.goalCount },
                      { label: "Tip", value: "Hədəf əsaslı" },
                    ]
                  : [
                      { label: "Komanda", value: teamCount },
                      { label: "Əməkdaş", value: g.members?.length || 0 },
                      { label: "Hədəf", value: g.goalCount },
                    ];
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => setOpenGroup(g)}
                className="group relative text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-primary/10">
                    {getInitials(g.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                        {g.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{g.subtitle}</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                      {metaChips.map(chip => (
                        <Badge key={chip.label} variant="secondary" className="h-6 font-normal">
                          <span className="text-muted-foreground mr-1">{chip.label}:</span>
                          <span className="font-semibold text-foreground">{chip.value}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="md:col-span-2 py-16 text-center text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
              Nəticə yoxdur
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">{label}</th>
                <th className="px-4 py-2 text-left">Vəzifə / Alt-məlumat</th>
                <th className="px-4 py-2 text-left w-28">KPI kartı</th>
                <th className="px-4 py-2 text-left w-24">Hədəf</th>
                {subTab !== "individual" && <th className="px-4 py-2 text-left w-24">Üzv</th>}
                <th className="px-4 py-2 text-right w-24">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.key} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {getInitials(g.name)}
                      </div>
                      <span className="font-medium text-foreground">{g.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{g.subtitle || "—"}</td>
                  <td className="px-4 py-2">{g.cards.length}</td>
                  <td className="px-4 py-2">{g.goalCount}</td>
                  {subTab !== "individual" && <td className="px-4 py-2">{g.members?.length || 0}</td>}
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setOpenGroup(g)}>
                      <Eye className="w-3.5 h-3.5" /> Bax
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={subTab !== "individual" ? 6 : 5} className="py-10 text-center text-sm text-muted-foreground">
                    Nəticə yoxdur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      <GroupDetailDialog group={openGroup} scope={subTab} onClose={() => setOpenGroup(null)} />
    </div>
  );
};


const SeasonToggle = () => {
  const [open, setOpen] = useState(getSeasonOpen());
  const [confirm, setConfirm] = useState<null | boolean>(null);
  useEffect(() => {
    const r = () => setOpen(getSeasonOpen());
    window.addEventListener("season-updated", r);
    return () => window.removeEventListener("season-updated", r);
  }, []);
  const apply = () => {
    if (confirm === null) return;
    setSeasonOpen(confirm);
    toast.success(confirm ? "Qiymətləndirmə dövrü açıldı" : "Qiymətləndirmə dövrü bağlandı");
    setConfirm(null);
  };
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card">
        <span className={`text-xs font-medium ${open ? "text-primary" : "text-muted-foreground"}`}>
          Dövr: {open ? "Açıq" : "Bağlı"}
        </span>
        <Switch checked={open} onCheckedChange={(v) => setConfirm(Boolean(v))} />
      </div>
      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? "Dövrü açmaq istəyirsiniz?" : "Dövrü bağlamaq istəyirsiniz?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm
                ? "Bu dövrdə əməkdaşlar bir-birini qiymətləndirə biləcək."
                : "Dövr bağlanarsa, yeni qiymətləndirmələr qəbul edilməyəcək."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ləğv et</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Təsdiq et</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

type EvalSection = "teyinat" | "status" | "parametr" | "seriste";

const SECTIONS: { k: EvalSection; l: string; desc: string; icon: any; accent: string }[] = [
  { k: "teyinat",  l: "Qiymətləndirənlər", desc: "Qiymətləndirənləri təyin edin və idarə edin", icon: UserCheck,     accent: "from-primary/15 to-primary/5 text-primary" },
  { k: "status",   l: "Status izləmə",     desc: "Fərdi, komanda və struktur üzrə status",       icon: ListChecks,    accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600" },
  { k: "seriste",  l: "Səriştə Matrisi",   desc: "Davranış və kompetensiya matrislərini idarə edin", icon: Target,    accent: "from-violet-500/15 to-violet-500/5 text-violet-600" },
  { k: "parametr", l: "Parametrlər",       desc: "Bal aralıqları və digər parametrlər",          icon: Settings2,     accent: "from-sky-500/15 to-sky-500/5 text-sky-600" },
];

const EvaluationPage = () => {
  const [section, setSection] = useUrlView<EvalSection>("section", ["teyinat", "status", "parametr", "seriste"]);
  const [, force] = useState(0);
  const active = SECTIONS.find(s => s.k === section);
  return (
    <div className="min-h-screen">
      <Header title="Qiymətləndirmə" />
      <div className="p-6">
      <PageHero
        badge="HR · Qiymətləndirmə"
        title="Qiymətləndirmə"
        subtitle="Qiymətləndirənləri təyin edin, səriştə matrislərini idarə edin və statusu izləyin."
        icon={ClipboardList}
        right={
          section === "teyinat" ? (
            <div className="flex items-center gap-2">
              <ExportMenu
                getData={() => ({
                  title: `Qiymətləndirənlər (${CURRENT_CYCLE_ID})`,
                  headers: ["Ad", "Departament", "Vəzifə"],
                  rows: mockEmployees.map(e => [e.fullName, e.department, e.position]),
                  fileName: `qiymetlendirenler-${CURRENT_CYCLE_ID}`,
                })}
              />
              <ManualAssignmentDialog onCreated={() => force(t => t + 1)} />
            </div>
          ) : undefined
        }
      />

      {section === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.k} onClick={() => setSection(s.k)}
                className={`group text-left rounded-2xl border border-border bg-gradient-to-br ${s.accent} p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-xl bg-background/70 backdrop-blur flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-base font-semibold text-foreground">{s.l}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSection(null)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeftCircle className="w-4 h-4" /> Bütün bölmələr
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            {active?.icon && <active.icon className="w-5 h-5 text-primary" />}
            <h2 className="text-lg font-semibold text-foreground">{active?.l}</h2>
          </div>
          {section === "teyinat" && <AssignmentsTab />}
          {section === "status" && <StatusTab />}
          {section === "seriste" && <CompetencyMatrixTab />}
          
          {section === "parametr" && <SettingsTab />}
        </div>
      )}
      </div>
    </div>
  );
};

export default EvaluationPage;
