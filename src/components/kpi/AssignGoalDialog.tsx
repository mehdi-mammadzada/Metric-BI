// Rəhbər · "Məsul olduğum kartlar" — pending KpiSetEntry üçün hədəf təyinetmə pop-up-ı.
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target as TargetIcon, GitBranch, Star, Info, Sparkles, Save, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { HEDEF_TYPES, CASCADE_TYPES, type HedefType } from "@/components/kpi/CreateKpiWizard";
import {
  setEntryDetails, TIER_LABELS, ZERO_LIMITS,
  type KpiSetEntry, type LimitSet, type LimitTier, type DynamicTier, type ScoreDescRow,
} from "@/lib/kpiSetStore";
import { getScoreScales, getDefaultScale, type ScoreScale } from "@/lib/evaluationConfigStore";
import { getCompetencyMatrices, type CompetencyMatrix } from "@/lib/competencyMatrixStore";
import { getVisibleSharedKpiCards } from "@/lib/kpiCardStore";
import { Lock } from "lucide-react";
import { WeightInput } from "@/components/kpi/WeightInput";
import { useWeightLimits } from "@/lib/dropdownCatalogStore";
import { withKartSuffix } from "@/lib/utils";

// Yalnız Məbləğ üçün vahid seçilə bilər. Digərləri auto-unit.
const AMOUNT_UNITS = ["AZN", "USD", "EUR"];
const AUTO_UNIT: Partial<Record<HedefType, string>> = {
  "Say": "ədəd", "Faiz": "%", "Nisbət": "əmsal",
  "İcra": "bal", "Səriştə": "bal", "Fərdi İnkişaf": "bal",
  "Boolean": "bəli/xeyr", "Zaman": "gün",
};

// Aralıq (min-max) tələb edən növlər — "Qiymətlər" modalı ilə eyni məntiq.
const RANGE_TYPES: HedefType[] = ["Məbləğ", "Say", "Faiz", "Nisbət"];
const TIME_TYPE: HedefType = "Zaman";

const dynLabel = (score: number, max: number) => {
  const r = score / max;
  if (r >= 0.85) return "Əla";
  if (r >= 0.65) return "Yaxşı";
  if (r >= 0.45) return "Orta";
  if (r >= 0.25) return "Zəif";
  return "Çox zəif";
};

// KPI kartı yaradılarkən seçilmiş bal sistemini ScoreScale-ə çevirir.
const parseCardScoringSystem = (scoringSystem?: string | null): ScoreScale | null => {
  if (!scoringSystem) return null;
  const s = String(scoringSystem).toLowerCase();
  const m = s.match(/(\d+)\s*-\s*(\d+)/);
  if (m) {
    const min = Number(m[1]);
    const max = Number(m[2]);
    return { id: `scale_${min}_${max}`, label: `${min} – ${max}`, min, max };
  }
  if (s.includes("faiz")) {
    return { id: "scale_0_100", label: "Faiz (0 – 100)", min: 0, max: 100 };
  }
  return null;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: KpiSetEntry | null;
  /** Təyin edilmiş hədəf yalnız baxış rejimində açılır. */
  readOnly?: boolean;
  onSaved?: (saved: { entryId: string; name: string; value: number; unit: string; cascadable: boolean; type: HedefType; competencyMatrix?: string }) => void;
}

const partsOf = (r: ScoreDescRow) => {
  const [mn = "", mx = ""] = (r.description || "").split("-");
  return { mn, mx };
};

const AssignGoalDialog = ({ open, onOpenChange, entry, readOnly = false, onSaved }: Props) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<HedefType>("Məbləğ");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("AZN");
  const [weight, setWeight] = useState<string>("");
  const weightLimits = useWeightLimits();
  const [cascadable, setCascadable] = useState(false);
  const [rows, setRows] = useState<ScoreDescRow[]>([]);
  const [scales, setScales] = useState<ScoreScale[]>([]);
  const [scaleId, setScaleId] = useState<string>("");
  const [lockedScale, setLockedScale] = useState<ScoreScale | null>(null);
  const [competencyMatrix, setCompetencyMatrix] = useState<string>("");
  const [competencyMatrices, setCompetencyMatrices] = useState<CompetencyMatrix[]>([]);
  const [questionsDlgMatrix, setQuestionsDlgMatrix] = useState<CompetencyMatrix | null>(null);

  useEffect(() => {
    if (!open || !entry) return;
    const entryType = (entry.type as HedefType) || "Məbləğ";
    setName(entry.subKpiName || "");
    setType(entryType);
    setTarget(entry.target || "");
    // Vahid növə uyğun götürülür: Məbləğ üçün seçilmiş valyuta, digərləri auto-unit.
    // Boş saxlanmış vahid heç vaxt "AZN" ilə əvəz olunmur.
    setUnit(entryType === "Məbləğ" ? (AMOUNT_UNITS.includes(entry.unit) ? entry.unit : "AZN") : (AUTO_UNIT[entryType] || entry.unit || ""));
    setWeight(entry.weight != null ? String(entry.weight) : "");
    setCascadable(!!entry.cascadable);
    const allScales = getScoreScales();
    setScales(allScales);
    // Müvafiq KPI kartının yaradılarkən seçilmiş bal sistemini tap və kilidlə.
    const card = getVisibleSharedKpiCards().find(
      c => c.numericId === entry.cardId || c.name === entry.cardName
    );
    const cardScale = parseCardScoringSystem(card?.scoringSystem);
    if (cardScale) {
      const existing = allScales.find(s => s.min === cardScale.min && s.max === cardScale.max);
      const chosen = existing || cardScale;
      setLockedScale(chosen);
      setScaleId(chosen.id);
    } else {
      setLockedScale(null);
      setScaleId(getDefaultScale().id);
    }
    setCompetencyMatrix(entry.competencyMatrix || "");
    setCompetencyMatrices(getCompetencyMatrices());
    // mövcud məlumatı sətirlərə çevir
    if (entry.scoreDescriptions?.length) {
      setRows(entry.scoreDescriptions.map(r => ({ ...r })));
    } else if (entry.dynamicLimits?.length) {
      setRows(entry.dynamicLimits.map(d => ({ score: d.score, description: `${d.min}-${d.max}` })));
    } else if (entry.limits) {
      setRows(TIER_LABELS.map(({ tier, score }) => ({
        score: score as number,
        description: `${entry.limits![tier as LimitTier].min}-${entry.limits![tier as LimitTier].max}`,
      })));
    } else {
      setRows([]);
    }
  }, [open, entry?.id]);

  // Növ dəyişdikdə unit-i uyğunlaşdır
  useEffect(() => {
    if (type === "Məbləğ") {
      if (!AMOUNT_UNITS.includes(unit)) setUnit("AZN");
    } else {
      setUnit(AUTO_UNIT[type] || "");
    }
    if (!CASCADE_TYPES.includes(type)) setCascadable(false);
    if (type !== "Səriştə") setCompetencyMatrix("");
  }, [type]);

  const scale = useMemo(() => scales.find(s => s.id === scaleId), [scales, scaleId]);
  const scaleMax = scale?.max ?? 5;
  const scaleMin = scale?.min ?? 1;

  const needsMinMax = RANGE_TYPES.includes(type);
  const isTime = type === TIME_TYPE;
  // "Zaman" növü üçün hədəf dəyəri "başlama – bitmə" formatında saxlanılır.
  const [timeStart, timeEnd] = useMemo(() => {
    const parts = String(target || "").split("–").map(s => s.trim());
    return [parts[0] || "", parts[1] || ""];
  }, [target]);


  // Skala/növ dəyişdikdə sətirləri qur (mövcud dəyərləri saxlayaraq)
  useEffect(() => {
    if (!scale) return;
    setRows(prev => {
      const out: ScoreDescRow[] = [];
      for (let s = scale.min; s <= scale.max; s++) {
        const ex = prev.find(p => Number(p.score) === s);
        out.push(ex || { score: s, description: "", timeStart: "", timeEnd: "" });
      }
      return out;
    });
  }, [scaleId, type, scale?.min, scale?.max]);

  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.score) - Number(b.score)), [rows]);
  const minBonusScore = ordered.find(r => r.isMinBonus)?.score ?? null;

  // Interval validasiyası — Min ≤ Max, ardıcıllıq, boşluq/üst-üstə düşmə yoxdur.
  const errors = useMemo(() => {
    const e: Record<number, string> = {};
    if (!needsMinMax) return e;
    let prevMax: number | null = null;
    ordered.forEach(r => {
      const { mn, mx } = partsOf(r);
      if (mn === "" && mx === "") { prevMax = null; return; }
      const nMin = Number(mn);
      const nMax = Number(mx);
      if (mn === "" || mx === "" || isNaN(nMin) || isNaN(nMax)) {
        e[r.score] = "Min və Max daxil edilməlidir";
      } else if (nMin > nMax) {
        e[r.score] = "Min dəyər Max dəyərdən böyük ola bilməz";
      } else if (prevMax !== null && nMin !== prevMax + 1) {
        e[r.score] = nMin <= prevMax
          ? `İntervallar üst-üstə düşür — Min ${prevMax + 1} olmalıdır`
          : `Boşluq var — Min ${prevMax + 1} olmalıdır`;
      }
      if (!e[r.score]) prevMax = nMax;
    });
    return e;
  }, [ordered, needsMinMax]);

  const midRequired = Math.max(scaleMin, Math.floor(scaleMax * 0.4));

  const targetNumber = useMemo(() => {
    const raw = String(target ?? "").replace(/[^0-9.,-]/g, "").replace(/\s/g, "").replace(",", ".");
    const n = Number(raw);
    return isFinite(n) && n > 0 ? n : null;
  }, [target]);

  const autoFill = () => {
    if (!needsMinMax) return;
    if (targetNumber === null) { toast.error("Əvvəlcə hədəf dəyərini daxil edin"); return; }
    const count = ordered.length || scaleMax;
    const bounds: number[] = [];
    for (let i = 1; i <= count; i++) {
      let b = Math.round((targetNumber * i) / count);
      const prev = i === 1 ? -1 : bounds[i - 2];
      if (b <= prev) b = prev + 1;
      bounds.push(b);
    }
    bounds[count - 1] = Math.max(targetNumber, (bounds[count - 2] ?? -1) + 1);
    const byScore = new Map<number, { mn: number; mx: number }>();
    ordered.forEach((r, i) => {
      const mn = i === 0 ? 0 : bounds[i - 1] + 1;
      const mx = Math.max(bounds[i], mn);
      byScore.set(Number(r.score), { mn, mx });
    });
    setRows(rows.map(x => {
      const v = byScore.get(Number(x.score));
      return v ? { ...x, description: `${v.mn}-${v.mx}` } : x;
    }));
    toast.success("Bal intervalları hədəf dəyərinə uyğun dolduruldu");
  };

  const updMinMax = (score: number, side: "min" | "max", val: string) => {
    setRows(rows.map(x => {
      if (Number(x.score) !== score) return x;
      const [mn = "", mx = ""] = (x.description || "").split("-");
      return { ...x, description: side === "min" ? `${val}-${mx}` : `${mn}-${val}` };
    }));
  };

  const setSD = (score: number, patch: Partial<ScoreDescRow>) =>
    setRows(prev => prev.map(r => Number(r.score) === score ? { ...r, ...patch } : r));

  const validate = (): string | null => {
    if (!name.trim()) return "Hədəfin adı tələb olunur";
    if (type === "Səriştə" && !competencyMatrix) return "Səriştə matrisi seçilməlidir";
    if (isTime) {
      if (!timeStart || !timeEnd) return "Zaman aralığı (başlama və bitmə tarixi) tələb olunur";
    } else if (type !== "Səriştə" && !target.trim()) return "Hədəf dəyəri tələb olunur";
    if (type === "Səriştə") return null; // bal/izah səriştə üçün matrisdədir
    if (needsMinMax) {
      const firstErr = ordered.find(r => errors[r.score]);
      if (firstErr) return `Bal ${firstErr.score}: ${errors[firstErr.score]}`;
      const filled = ordered.filter(r => { const { mn, mx } = partsOf(r); return mn !== "" && mx !== ""; });
      if (filled.length !== ordered.length) return "Bütün ballar üçün Min və Max dəyər daxil edin";
      if (!minBonusScore) return "Minimum Bonus Bal seçilməlidir";
    } else {
      for (const s of [scaleMax, midRequired]) {
        const row = ordered.find(x => Number(x.score) === s);
        if (!row) return `${s} balı tələb olunur`;
        if (isTime) {
          if (!row.timeStart || !row.timeEnd) return `Zaman: ${s} balı üçün zaman aralığı tələb olunur`;
        } else if (!row.description?.trim()) {
          return `${s} balı üçün izah məcburidir`;
        }
      }
    }
    return null;
  };

  const handleSave = () => {
    if (!entry) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    if (weight !== "") {
      const w = Number(weight);
      if (w < weightLimits.min) { toast.error(`Hədəf çəkisi minimum ${weightLimits.min}%-dən aşağı ola bilməz`); return; }
      if (w > weightLimits.max) { toast.error(`Hədəf çəkisi maksimum ${weightLimits.max}%-dən yuxarı ola bilməz`); return; }
    }

    let limits: LimitSet | undefined;
    let dynamicLimits: DynamicTier[] | undefined;
    if (needsMinMax) {
      dynamicLimits = ordered.map(r => {
        const { mn, mx } = partsOf(r);
        return { score: Number(r.score), label: dynLabel(Number(r.score), scaleMax), min: Number(mn) || 0, max: Number(mx) || 0 };
      });
      if (scaleMin === 1 && scaleMax === 5) {
        const ls: LimitSet = { ...ZERO_LIMITS };
        TIER_LABELS.forEach(({ tier, score }) => {
          const d = dynamicLimits!.find(x => x.score === score);
          if (d) ls[tier as LimitTier] = { min: d.min, max: d.max };
        });
        limits = ls;
      }
    }

    setEntryDetails(entry.id, {
      subKpiName: name.trim(),
      type: type as any,
      target: type === "Səriştə" ? competencyMatrices.find(m => m.id === competencyMatrix)?.name || target.trim() : target.trim(),
      unit,
      cascadable: cascadable && CASCADE_TYPES.includes(type),
      weight: weight ? Number(weight) : undefined,
      limits,
      dynamicLimits,
      scoreDescriptions: ordered,
      competencyMatrix: type === "Səriştə" ? competencyMatrix : undefined,
    });
    onSaved?.({
      entryId: entry.id,
      name: name.trim(),
      value: parseFloat(String(target).replace(/[^\d.\-]/g, "")) || 0,
      unit,
      cascadable: cascadable && CASCADE_TYPES.includes(type),
      type,
      competencyMatrix: type === "Səriştə" ? competencyMatrix : undefined,
    });
    onOpenChange(false);
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <TargetIcon className="w-5 h-5 text-primary" />
              {readOnly ? "Hədəf detalları" : "Hədəf təyin et"} — {entry ? withKartSuffix(entry.cardName) : ""}
            </DialogTitle>
            {needsMinMax && !readOnly && (
              <button
                type="button"
                onClick={autoFill}
                className="shrink-0 mr-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                title="Hədəf dəyərinə əsasən intervalları avtomatik hesabla"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Avtomatik
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Əməkdaş: <span className="font-medium text-foreground">{entry?.assigneeName}</span>
          </p>
        </DialogHeader>

        <fieldset disabled={readOnly} className="contents">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12">
              <label className="text-[11px] text-muted-foreground">Hədəfin adı *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Məs: Online Satış Həcmi"
                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-border rounded bg-background" />
            </div>
            <div className={type === "Məbləğ" ? "col-span-6 md:col-span-4" : "col-span-6 md:col-span-5"}>
              <label className="text-[11px] text-muted-foreground">Hədəf növü *</label>
              <select value={type} onChange={e => setType(e.target.value as HedefType)}
                className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background">
                {HEDEF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={type === "Məbləğ" ? "col-span-6 md:col-span-4" : "col-span-6 md:col-span-5"}>
              <label className="text-[11px] text-muted-foreground">
                {type === "Zaman" ? "Zaman aralığı *" : type === "Səriştə" ? "Səriştə matrisi *" : "Hədəf dəyəri *"}
              </label>
              {type === "Zaman" ? (
                <div className="mt-0.5 flex gap-1">
                  <input type="date" value={timeStart} title="Başlama tarixi"
                    onChange={e => setTarget(`${e.target.value} – ${timeEnd}`)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" />
                  <input type="date" value={timeEnd} title="Bitmə tarixi"
                    onChange={e => setTarget(`${timeStart} – ${e.target.value}`)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" />
                </div>
              ) : type === "Boolean" ? (
                <select value={target} onChange={e => setTarget(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background">
                  <option value="">— Seçin —</option>
                  <option value="Bəli">Bəli</option>
                  <option value="Xeyr">Xeyr</option>
                </select>
              ) : type === "Səriştə" ? (
                <div className="mt-0.5 flex gap-1 items-center">
                  <select value={competencyMatrix} onChange={e => setCompetencyMatrix(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background">
                    <option value="">— Matris seçin —</option>
                    {competencyMatrices.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <button type="button"
                    onClick={() => setQuestionsDlgMatrix(competencyMatrices.find(m => m.id === competencyMatrix) || null)}
                    disabled={!competencyMatrix}
                    className="shrink-0 px-2 py-1.5 text-xs font-medium rounded border border-primary/60 text-primary hover:bg-primary/10 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ClipboardList className="w-3.5 h-3.5" /> Suallara bax
                  </button>
                </div>
              ) : (type === "İcra" || type === "Fərdi İnkişaf") ? (
                <input value={target} onChange={e => setTarget(e.target.value)}
                  placeholder="Hədəf təsviri"
                  className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-border rounded bg-background" />
              ) : (
                <div className="mt-0.5 flex gap-1 items-center">
                  <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                    placeholder={type === "Faiz" ? "0-100" : "0"}
                    className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-background" />
                  {type === "Faiz" && <span className="px-1.5 text-xs text-muted-foreground">%</span>}
                  {type === "Say" && <span className="px-1.5 text-xs text-muted-foreground whitespace-nowrap">ədəd</span>}
                </div>
              )}
            </div>
            {type === "Məbləğ" && (
              <div className="col-span-6 md:col-span-2">
                <label className="text-[11px] text-muted-foreground">Vahid</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background">
                  {AMOUNT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}

            <div className="col-span-6 md:col-span-2">
              <label className="text-[11px] text-muted-foreground">Çəki (%)</label>
              <WeightInput value={weight === "" ? 0 : Number(weight)} onChange={n => setWeight(String(n))}
                min={weightLimits.min} max={weightLimits.max}
                className="mt-0.5" />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Limit: min {weightLimits.min}% – maks {weightLimits.max}%
              </p>
              {weight !== "" && Number(weight) > 0 && (Number(weight) < weightLimits.min || Number(weight) > weightLimits.max) && (
                <p className="text-[10px] text-destructive mt-0.5">
                  Çəki {weightLimits.min}%–{weightLimits.max}% aralığında olmalıdır
                </p>
              )}
            </div>
            {scales.length > 0 && (
              <div className="col-span-12 md:col-span-5">
                <label className="text-[11px] text-muted-foreground">Bal aralığı şablonu</label>
                {lockedScale ? (
                  <div className="mt-0.5 flex items-center gap-2 px-2.5 py-1.5 text-sm rounded border border-border bg-secondary/40 text-foreground">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{lockedScale.label}</span>
                    <span className="text-xs text-muted-foreground">({lockedScale.min}–{lockedScale.max})</span>
                  </div>
                ) : (
                  <select value={scaleId} onChange={e => setScaleId(e.target.value)}
                    className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background">
                    {scales.map(s => <option key={s.id} value={s.id}>{s.label} ({s.min}–{s.max})</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {type !== "Səriştə" && (
            <>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                {needsMinMax
                  ? "Minimum bal yalnız bir qiymət üçün seçilə bilər. \"Avtomatik\" hədəf dəyərinə əsasən intervalları doldurur — sonradan əl ilə dəyişə bilərsiniz."
                  : `${scaleMax} və ${midRequired} ballarının ${isTime ? "zaman aralığı" : "izahı"} məcburidir.`}
              </p>

              {/* Bal intervalları cədvəli — "Qiymətlər" modalı ilə eyni struktur */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-secondary/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {needsMinMax && <div className="col-span-2">Minimum</div>}
                  <div className={needsMinMax ? "col-span-1" : "col-span-2"}>Bal</div>
                  {needsMinMax ? (
                    <>
                      <div className="col-span-4">Min dəyər</div>
                      <div className="col-span-5">Max dəyər</div>
                    </>
                  ) : isTime ? (
                    <>
                      <div className="col-span-5">Başlama</div>
                      <div className="col-span-5">Bitmə</div>
                    </>
                  ) : (
                    <div className="col-span-10">İzah</div>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {ordered.map((r) => {
                    const { mn, mx } = partsOf(r);
                    const selected = !!r.isMinBonus;
                    const err = errors[r.score];
                    return (
                      <div
                        key={r.score}
                        className={`grid grid-cols-12 gap-3 px-4 py-3 items-center transition-colors ${
                          selected ? "bg-amber-500/10" : "hover:bg-secondary/20"
                        }`}
                      >
                        {needsMinMax && (
                          <div className="col-span-2">
                            <input
                              type="radio"
                              name="assign-min-bonus-score"
                              checked={selected}
                              onChange={() => setRows(rows.map(x => ({ ...x, isMinBonus: Number(x.score) === Number(r.score) })))}
                              className="w-4 h-4 accent-amber-500 cursor-pointer"
                              aria-label={`Bal ${r.score} minimum bonus balı`}
                            />
                          </div>
                        )}
                        <div className={`${needsMinMax ? "col-span-1" : "col-span-2"} text-base font-bold text-foreground tabular-nums`}>
                          {r.score}
                        </div>
                        {needsMinMax ? (
                          <>
                            <div className="col-span-4">
                              <input type="number" value={mn} onChange={e => updMinMax(Number(r.score), "min", e.target.value)}
                                placeholder="0" className={inputCls} />
                            </div>
                            <div className="col-span-5 flex items-center gap-2">
                              <input type="number" value={mx} onChange={e => updMinMax(Number(r.score), "max", e.target.value)}
                                placeholder="100" className={inputCls} />
                              {selected && (
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                  <Star className="w-3 h-3 fill-current" /> Minimum Bonus Balı
                                </span>
                              )}
                            </div>
                            {err && <div className="col-span-12 text-[11px] text-destructive">{err}</div>}
                          </>
                        ) : isTime ? (
                          <>
                            <div className="col-span-5">
                              <input type="date" value={r.timeStart || ""}
                                onChange={e => setSD(Number(r.score), { timeStart: e.target.value })}
                                className={inputCls} />
                            </div>
                            <div className="col-span-5">
                              <input type="date" value={r.timeEnd || ""}
                                onChange={e => setSD(Number(r.score), { timeEnd: e.target.value })}
                                className={inputCls} />
                            </div>
                          </>
                        ) : (
                          <div className="col-span-10">
                            <input value={r.description || ""}
                              onChange={e => setSD(Number(r.score), { description: e.target.value })}
                              placeholder="Bu balı qazanmaq üçün şərt..." className={inputCls} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {needsMinMax && (
                <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">Bonus yalnız seçilmiş minimum baldan etibarən hesablanacaq.</p>
                </div>
              )}
            </>
          )}

          {/* Cascadable */}
          {CASCADE_TYPES.includes(type) && (
            <label className="flex items-start gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 cursor-pointer">
              <input type="checkbox" checked={cascadable} onChange={e => setCascadable(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary" />
              <div>
                <div className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-primary" /> Bu hədəf kaskadlana bilər
                </div>
                <div className="text-[11px] text-muted-foreground">
                  İşarələndikdə bu kartın aid olduğu rəhbər şəxslər hədəfi öz tabeliyindəki əməkdaşlar arasında paylaya bilər.
                </div>
              </div>
            </label>
          )}
        </fieldset>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{readOnly ? "Bağla" : "Ləğv et"}</Button>
          {!readOnly && (
            <Button onClick={handleSave} className="gap-1">
              <Save className="w-4 h-4" /> Yadda saxla
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Səriştə matrisi sualları */}
    <Dialog open={!!questionsDlgMatrix} onOpenChange={() => setQuestionsDlgMatrix(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{questionsDlgMatrix?.name || "Səriştə sualları"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {(questionsDlgMatrix?.questions || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Bu matrisdə sual yoxdur.</p>
          ) : (
            questionsDlgMatrix!.questions.map((q, idx) => (
              <div key={q.id || idx} className="p-3 rounded-lg border border-border bg-background/50">
                <p className="text-sm font-medium text-foreground">{idx + 1}. {q.text}</p>
                {q.weight ? <p className="text-[11px] text-muted-foreground mt-1">Çəki: {q.weight}%</p> : null}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setQuestionsDlgMatrix(null)}>Bağla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AssignGoalDialog;
