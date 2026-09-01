import { useEffect, useMemo, useState } from "react";
import { Target, CheckCircle2, X, TrendingUp, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  SubKpi,
  useSubKpis,
  saveSubKpiEvaluation,
  calcCompletion,
  completionToScore,
  isEvaluated,
  USER_KPI_CARD,
} from "@/lib/kpiEvaluationStore";
import { RatingCircles } from "@/components/evaluation/RatingCircles";

interface Props {
  assigneeId: string;
}

const pctTone = (pct: number) => {
  if (pct >= 100) return "bg-zone-green-bg text-zone-green-text";
  if (pct >= 75) return "bg-zone-yellow-bg text-zone-yellow-text";
  return "bg-zone-red-bg text-zone-red-text";
};

const fmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString("az-AZ") : n.toLocaleString("az-AZ", { maximumFractionDigits: 2 });

export const KpiEvaluationSection = ({ assigneeId }: Props) => {
  const items = useSubKpis(assigneeId);
  const [editing, setEditing] = useState<SubKpi | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Sizin KPI kartınızda hədəf yoxdur.
      </div>
    );
  }

  const summary = useMemo(() => {
    const totalW = items.reduce((s, k) => s + k.weight, 0);
    const evaluated = items.filter(isEvaluated);
    const pending = items.length - evaluated.length;
    const weighted =
      evaluated.length === 0
        ? 0
        : evaluated.reduce((s, k) => s + (k.evaluatedScore ?? 0) * k.weight, 0) / Math.max(1, totalW);
    const avgPct =
      evaluated.length === 0
        ? 0
        : evaluated.reduce((s, k) => s + calcCompletion(k), 0) / evaluated.length;
    return { weighted, totalW, avgPct, done: evaluated.length, pending };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* KPI Kartı başlığı */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-700/10 text-blue-700 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sizin KPI Kartınız</p>
              <h3 className="text-base font-semibold text-foreground">{items[0]?.cardId || USER_KPI_CARD.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Dövr: {items[0]?.period || USER_KPI_CARD.period || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="w-3 h-3 text-zone-green-text" />
              {summary.done} qiymətləndirilmiş
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3 text-zone-yellow-text" />
              {summary.pending} gözləyir
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Kartdakı hədəf sayı</p>
          <p className="text-2xl font-bold text-foreground mt-1">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Orta yerinə yetirmə (qiymətləndirilmişlər)</p>
          <p className="text-2xl font-bold text-foreground mt-1">{summary.avgPct.toFixed(0)}%</p>
        </div>
        <div className="rounded-xl border border-blue-700/30 bg-blue-700/5 p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Çəkili yekun bal
          </p>
          <p className="text-2xl font-bold text-blue-700 mt-1">
            {summary.weighted.toFixed(2)} <span className="text-base text-muted-foreground font-normal">/ 5</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Hədəf</th>
                <th className="text-right px-4 py-3 font-medium">Hədəf</th>
                <th className="text-right px-4 py-3 font-medium">Faktiki</th>
                <th className="text-right px-4 py-3 font-medium">İcra %</th>
                <th className="text-center px-4 py-3 font-medium">Çəki</th>
                <th className="text-center px-4 py-3 font-medium">Yekun bal</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {items.map(k => {
                const evaluated = isEvaluated(k);
                const pct = calcCompletion(k);
                return (
                  <tr key={k.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{k.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{k.description}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">{fmt(k.target)} {k.unit}</td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {k.actual !== undefined ? `${fmt(k.actual)} ${k.unit}` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {evaluated ? (
                        <span className={`inline-flex items-center justify-end px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${pctTone(pct)}`}>
                          {pct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{k.weight}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        {evaluated ? (
                          <RatingCircles value={k.evaluatedScore ?? 0} size="sm" readOnly showLabel={false} />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {evaluated ? (
                        <Badge className="bg-zone-green-bg text-zone-green-text hover:bg-zone-green-bg gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Qiymətləndirilib
                        </Badge>
                      ) : (
                        <Badge className="bg-zone-yellow-bg text-zone-yellow-text hover:bg-zone-yellow-bg gap-1">
                          <Clock className="w-3 h-3" /> Gözləyir
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant={evaluated ? "outline" : "default"} onClick={() => setEditing(k)}>
                        {evaluated ? "Bax" : "Qiymətləndir"}
                      </Button>
                    </td>

                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Sizin KPI kartınızda hədəf yoxdur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
      </div>

      {editing && (
        <KpiEvalDialog item={editing} readOnly={isEvaluated(editing)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

export const KpiEvalDialog = ({
  item,
  onClose,
  readOnly = false,
}: { item: SubKpi; onClose: () => void; readOnly?: boolean }) => {
  const [actual, setActual] = useState<string>(item.actual !== undefined ? String(item.actual) : "");
  const [score, setScore] = useState<number>(item.evaluatedScore ?? 0);
  const [comment, setComment] = useState(item.selfComment || "");
  const [challenges, setChallenges] = useState(item.challenges || "");
  const [evidence, setEvidence] = useState(item.evidence || "");
  const [nextPlan, setNextPlan] = useState(item.nextPlan || "");


  const actualNum = actual === "" ? undefined : Number(actual.replace(",", ".")) || 0;
  const livePct = actualNum === undefined ? 0 : calcCompletion({ ...item, actual: actualNum });
  const autoScore = completionToScore(livePct);

  // İlk dəfə qiymətləndirmədə faktiki dəyişdikcə avtomatik balı təklif et
  useEffect(() => {
    if (item.evaluatedScore === undefined && actualNum !== undefined) {
      setScore(autoScore);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualNum]);

  const submit = () => {
    if (actualNum === undefined) {
      toast.error("Zəhmət olmasa faktiki nəticəni daxil edin");
      return;
    }
    saveSubKpiEvaluation(item.id, {
      actual: actualNum,
      evaluatedScore: score,
      selfComment: comment,
      challenges,
      evidence,
      nextPlan,
    }, item);
    toast.success("KPI qiymətləndirməsi yadda saxlandı");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-border sticky top-0 bg-card">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-700" /> {item.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{item.period} • Çəki {item.weight}%</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{item.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hədəf</label>
              <div className="mt-1 px-3 py-2 rounded-lg bg-secondary text-sm text-foreground tabular-nums">
                {fmt(item.target)} {item.unit}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Faktiki nəticə *</label>
              <input
                type="number"
                value={actual}
                disabled={readOnly}
                onChange={e => setActual(e.target.value)}
                placeholder={`Faktiki dəyəri daxil edin (${item.unit})`}
                className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
            <span className="text-sm text-muted-foreground">İcra faizi</span>
            <span className={`px-2 py-0.5 rounded-md text-sm font-semibold tabular-nums ${
              actualNum === undefined ? "bg-secondary text-muted-foreground" : pctTone(livePct)
            }`}>
              {actualNum === undefined ? "—" : `${livePct.toFixed(0)}%`}
            </span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-background">
            <label className="text-sm font-medium text-foreground">Yekun bal (0–5)</label>
            <div className="mt-2">
              <RatingCircles value={score} onChange={readOnly ? undefined : setScore} readOnly={readOnly} />
            </div>
            {actualNum !== undefined && (
              <p className="text-xs text-muted-foreground mt-2">
                Sistem icra faizinə əsasən <span className="font-medium text-foreground">{autoScore}</span> bal təklif edir.
                Yekun balı dəyişə bilərsiniz.
              </p>
            )}
          </div>

          {/* Hesablama bölməsi — çəki × bal formulu */}
          <div className="p-3 rounded-lg border border-blue-700/30 bg-blue-700/5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="w-4 h-4 text-blue-700" /> Hesablama
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-card border border-border rounded-md p-2">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Çəki</div>
                <div className="text-base font-bold text-foreground tabular-nums">{item.weight}%</div>
              </div>
              <div className="bg-card border border-border rounded-md p-2">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Bal</div>
                <div className="text-base font-bold text-foreground tabular-nums">{score} / 5</div>
              </div>
              <div className="bg-blue-700/10 border border-blue-700/30 rounded-md p-2">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Çəkili bal</div>
                <div className="text-base font-bold text-blue-700 tabular-nums">{((item.weight / 100) * score).toFixed(2)}</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground bg-card border border-border rounded-md p-2 font-mono">
              ({item.weight}% ÷ 100) × {score} bal = <span className="text-blue-700 font-semibold">{((item.weight / 100) * score).toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bu hədəf-nın yekun kartdakı çəkili balına töhfəsi yuxarıdakı düsturla hesablanır. Bütün hədəf-ların çəkili balları toplandıqda kartın ümumi balı alınır.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Nəticə ilə bağlı şərh</label>
            <Textarea
              value={comment}
              disabled={readOnly}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="Bu dövrdə əldə olunan əsas nəticələrin qısa izahı..."
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Qarşılaşılan çətinliklər</label>
            <Textarea
              value={challenges}
              disabled={readOnly}
              onChange={e => setChallenges(e.target.value)}
              rows={2}
              placeholder="Hədəfin yerinə yetirilməsinə mane olan amillər..."
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Dəstəkləyici sübut / istinad</label>
            <input
              type="text"
              value={evidence}
              disabled={readOnly}
              onChange={e => setEvidence(e.target.value)}
              placeholder="Hesabat nömrəsi, fayl adı və ya keçid..."
              className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Növbəti dövr üçün tədbir planı</label>
            <Textarea
              value={nextPlan}
              disabled={readOnly}
              onChange={e => setNextPlan(e.target.value)}
              rows={2}
              placeholder="Növbəti dövrdə nəticəni yaxşılaşdırmaq üçün konkret addımlar..."
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>{readOnly ? "Bağla" : "Ləğv et"}</Button>
          {!readOnly && <Button onClick={submit} className="gap-1 bg-blue-700 hover:bg-blue-800 text-white">
            <CheckCircle2 className="w-4 h-4" /> Təsdiqlə
          </Button>}
        </div>
      </div>
    </div>
  );
};

export default KpiEvaluationSection;
