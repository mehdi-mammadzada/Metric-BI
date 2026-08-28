// Vahid hədəf birləşdirmə məntiqi.
// KPI kartının öz hədəfləri (subKpis) ilə başqa əməkdaşın təyin etdiyi
// KPI Set entry-lərini bir siyahıya çevirir. Bütün tablar (Ümumi, Balanced
// Scorecard, Performans dinamikası, Təyin Statusu) eyni nəticəni göstərsin.

import { getEntriesForCard, type KpiSetEntry, type LimitSet, type ScoreDescRow } from "@/lib/kpiSetStore";

export interface MergedTarget {
  id: number;
  name: string;
  target: string;
  unit: string;
  weight: number;
  type?: string;
  limits?: LimitSet;
  scoreDescriptions?: ScoreDescRow[];
  /** Dəyəri/çəkisi başqa əməkdaş tərəfindən təyin olunur. */
  delegated: boolean;
  /** Təyin edən əməkdaşın adı (varsa). */
  assignerName?: string;
  /** KPI Set-dən gələn entry id (varsa). */
  entryId?: string;
  /** Təyin olunmuş dəyər mövcuddur? */
  assigned: boolean;
  /** Orijinal subKpi (evaluator və s. üçün). */
  source?: any;
}

const nrm = (v: unknown) =>
  String(v ?? "").split(" — ")[0].trim().toLowerCase().replace(/\s+/g, " ");

const hasVal = (v: unknown) => String(v ?? "").trim() !== "" && String(v ?? "").trim() !== "—";

/** Placeholder hədəf: başqasına təyin edilib, hələ dəyəri yoxdur. */
const isPlaceholder = (s: any) =>
  (s?.assignerMode === "other" || !!s?.assigner) && !hasVal(s?.target);

export const mergeCardTargets = (cardId: number | undefined, own: any[] = []): MergedTarget[] => {
  const entries: KpiSetEntry[] = cardId ? (getEntriesForCard(cardId) as KpiSetEntry[]) : [];
  const remaining = [...entries];

  const take = (pred: (e: KpiSetEntry) => boolean): KpiSetEntry | undefined => {
    const idx = remaining.findIndex(pred);
    if (idx < 0) return undefined;
    return remaining.splice(idx, 1)[0];
  };

  // 1) id → 2) ad üzrə uyğunlaşdırma
  const matched: (KpiSetEntry | undefined)[] = own.map(s =>
    take(e => e.subKpiId === s.id) ||
    take(e => nrm(e.subKpiName) !== "" && nrm(e.subKpiName) === nrm(s.name))
  );

  // 3) Təyinedici hədəfin adını dəyişə bilər — qalan entry-lər sırayla
  //    boş qalmış "başqası təyin edir" placeholder-lərə bağlanır.
  own.forEach((s, i) => {
    if (matched[i] || !isPlaceholder(s) || remaining.length === 0) return;
    matched[i] = remaining.shift();
  });

  const rows: MergedTarget[] = own.map((s, i) => {
    const e = matched[i];
    const entryAssigned = hasVal(e?.target);
    const name = (e?.subKpiName && String(e.subKpiName).trim()) || s.name || "Hədəf";
    const target = entryAssigned ? String(e!.target) : (hasVal(s.target) ? String(s.target) : "");
    // Vahid dəyərin mənbəyi ilə birlikdə gəlir — dəyər KPI Set-dəndirsə,
    // vahid də KPI Set-dən götürülür (əks halda "ədəd" → "AZN" olur).
    const unit = entryAssigned ? (e?.unit || s.unit || "") : (s.unit || e?.unit || "");
    const weight = Number(s.weight) > 0 ? Number(s.weight) : Number(e?.weight || 0);
    return {
      ...s,
      id: s.id,
      name,
      target,
      unit,
      weight,
      type: (e?.type as string) || s.type,
      limits: (e?.limits as LimitSet | undefined) ?? s.limits,
      scoreDescriptions: (e?.scoreDescriptions as ScoreDescRow[] | undefined) ?? s.scoreDescriptions,
      delegated: isPlaceholder(s) || (!!e && !hasVal(s.target)),
      assignerName: e?.assigneeName || s.assigner || undefined,
      entryId: e?.id,
      assigned: hasVal(target),
      source: s,
    };
  });

  // Kartda ümumiyyətlə olmayan hədəflər (yalnız KPI Set-də mövcuddur)
  remaining.forEach(e => {
    if (!nrm(e.subKpiName)) return;
    rows.push({
      id: e.subKpiId,
      name: e.subKpiName,
      target: hasVal(e.target) ? String(e.target) : "",
      unit: e.unit || "",
      weight: Number(e.weight || 0),
      type: e.type as string,
      limits: e.limits as LimitSet | undefined,
      scoreDescriptions: e.scoreDescriptions as ScoreDescRow[] | undefined,
      delegated: true,
      assignerName: e.assigneeName,
      entryId: e.id,
      assigned: hasVal(e.target),
    });
  });

  // Eyni ad iki dəfə görünməsin.
  const seen = new Set<string>();
  return rows.filter(r => {
    const key = nrm(r.name);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
