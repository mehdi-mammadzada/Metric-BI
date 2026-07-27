// Shared widget: shows the slice of cross-panel KPI cards that's visible
import { withKartSuffix } from "@/lib/utils";
// to the currently logged-in user (HR / Manager / User). Lets the assignee
// update their execution status — the change reflects everywhere instantly.

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedKpiCards, updateExecution, type ExecutionStatus } from "@/lib/kpiCardStore";
import { getCurrentEmployeeId, getVisibleKpiCards } from "@/lib/scope";
import { getEnrichedEmployee } from "@/data/mockExtras";
import { Target } from "lucide-react";
import { TARGET_STATUS_BADGE, TARGET_STATUS_LABEL } from "@/lib/targetStatus";

// Hədəf statusları sistem üzrə yalnız 3-dür: İcrada / Hədəfə çatıb / Hədəfə çatmayıb
const STATUS_LABEL: Record<ExecutionStatus, string> = {
  icrada: TARGET_STATUS_LABEL.in_progress,
  tamamlandi: TARGET_STATUS_LABEL.achieved,
  gecikme: TARGET_STATUS_LABEL.not_achieved,
};
const STATUS_STYLE: Record<ExecutionStatus, string> = {
  icrada: TARGET_STATUS_BADGE.in_progress,
  tamamlandi: TARGET_STATUS_BADGE.achieved,
  gecikme: TARGET_STATUS_BADGE.not_achieved,
};

interface Props {
  title?: string;
  emptyText?: string;
  onlyAssignedToMe?: boolean;
  /** İstifadəçi status seçim dropdown-u dəyişə bilməsin — yalnız baxış */
  readOnlyStatus?: boolean;
}

export default function SharedKpiPanel({ title = "Sizə aid KPI kartları", emptyText = "Sizə təyin olunmuş aktiv KPI yoxdur.", onlyAssignedToMe, readOnlyStatus }: Props) {
  const { user } = useAuth();
  const all = useSharedKpiCards();
  const meId = getCurrentEmployeeId(user);

  const visible = useMemo(() => {
    const scoped = getVisibleKpiCards(user, all);
    return onlyAssignedToMe && meId
      ? scoped.filter(c => c.assigneeIds.includes(meId))
      : scoped;
  }, [user, all, onlyAssignedToMe, meId]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{visible.length} kart</span>
      </div>
      {visible.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map(card => {
            const owner = getEnrichedEmployee(card.ownerId);
            const myExecution: ExecutionStatus =
              meId && card.execution[meId] ? card.execution[meId] : "icrada";
            const canExecute = !readOnlyStatus && meId && card.assigneeIds.includes(meId) && card.status === "aktiv";
            return (
              <li key={card.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{withKartSuffix(card.name)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border border-border ${
                      card.status === "aktiv" ? "bg-emerald-500/15 text-emerald-700"
                      : card.status === "tesdiq_gozlenilir" ? "bg-blue-500/15 text-blue-700"
                      : card.status === "imtina" ? "bg-rose-500/15 text-rose-700"
                      : "bg-amber-500/15 text-amber-700"
                    }`}>
                      {card.status === "aktiv" ? "Aktiv" : card.status === "tesdiq_gozlenilir" ? "Təsdiq gözləyir" : card.status === "imtina" ? "İmtina" : "Qaralama"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Sahibi: {owner?.fullName || "—"} · {card.frequency} · {card.targets.length} hədəf
                  </div>
                </div>
                {canExecute ? (
                  <select
                    value={myExecution}
                    onChange={e => meId && updateExecution(card.id, meId, e.target.value as ExecutionStatus, meId)}
                    className={`text-xs px-2 py-1 rounded-md border border-border bg-background ${STATUS_STYLE[myExecution]}`}
                  >
                    {(Object.keys(STATUS_LABEL) as ExecutionStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-1 rounded-md ${STATUS_STYLE[myExecution]}`}>
                    {STATUS_LABEL[myExecution]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
