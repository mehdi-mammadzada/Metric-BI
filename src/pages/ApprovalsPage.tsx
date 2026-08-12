// Sistem Təsdiqləri — original card/kanban layout.
// HR (submits) and Manager (decides) share the same queue via approvalsStore.
import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Check, X, Clock, CheckCircle2, XCircle, Send, Eye, User, Calendar, MessageSquare,
  ChevronDown, ChevronUp, Hourglass, Trophy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useApprovals, decideApproval, type ApprovalItem } from "@/lib/approvalsStore";
import { useSharedKpiCards } from "@/lib/kpiCardStore";
import { getCurrentEmployeeId, getVisibleApprovals, getMyApprovalBucket } from "@/lib/scope";
import { getIdentityAliases, findMyRef } from "@/lib/identity";
import { getEmployeeDisplayName, getEnrichedEmployee } from "@/data/mockExtras";
import { toast } from "sonner";

const empName = (id: string) => getEmployeeDisplayName(id);



const ApprovalCard = ({
  a, canAct, onView, onApprove, onReject,
}: {
  a: ApprovalItem;
  canAct: boolean;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) => {
  const accent = a.status === "pending"
    ? "border-amber-300/60 bg-gradient-to-br from-amber-50 to-white"
    : a.status === "approved"
    ? "border-emerald-300/60 bg-gradient-to-br from-emerald-50 to-white"
    : "border-rose-300/60 bg-gradient-to-br from-rose-50 to-white";
  const badge = a.status === "pending"
    ? "bg-amber-500/15 text-amber-800 border-amber-400/40"
    : a.status === "approved"
    ? "bg-emerald-500/15 text-emerald-800 border-emerald-400/40"
    : "bg-rose-500/15 text-rose-800 border-rose-400/40";
  const StatusIcon = a.status === "pending" ? Clock : a.status === "approved" ? CheckCircle2 : XCircle;
  const label = a.status === "pending" ? "Gözləyir" : a.status === "approved" ? "Təsdiqləndi" : "İmtina";

  const firstNote = Object.values(a.decisions).find(d => d?.note)?.note;
  const requestType = String(a.matrixId || "").startsWith("deletion:") ? "Silinmə sorğusu" : "Təsdiq sorğusu";

  return (
    <div className={`rounded-xl border ${accent} p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground truncate">{a.kpiName}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <User className="h-3 w-3" /> {requestType} · {empName(a.createdBy)}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${badge} shrink-0`}>
          <StatusIcon className="h-3 w-3" /> {label}
        </span>
      </div>

      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
        <Calendar className="h-3 w-3" /> {new Date(a.createdAt).toLocaleDateString("az-AZ")}
      </div>

      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Təsdiqçilər</div>
        <div className="flex flex-wrap gap-1">
          {a.approverIds.map(id => {
            const d = a.decisions[id]?.decision || "pending";
            const dotColor = d === "approved" ? "bg-emerald-500" : d === "rejected" ? "bg-rose-500" : "bg-amber-500";
            return (
              <span key={id} className="text-xs px-2 py-0.5 rounded-full bg-white border border-border flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                {empName(id)}
              </span>
            );
          })}
        </div>
      </div>

      {firstNote && (
        <div className="text-xs bg-white/60 border border-border rounded-md px-2 py-1.5 mb-3 flex gap-1.5">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground/80">{firstNote}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
        <button onClick={onView} className="px-2.5 py-1 text-xs rounded-md border border-border bg-white hover:bg-muted/60 flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> Bax
        </button>
        {canAct && (
          <>
            <button onClick={onApprove} className="px-2.5 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Təsdiqlə
            </button>
            <button onClick={onReject} className="px-2.5 py-1 text-xs rounded-md bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> İmtina
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const ApprovalsPage = () => {
  const { user } = useAuth();
  const all = useApprovals();
  const cards = useSharedKpiCards();
  const meId = getCurrentEmployeeId(user);
  const myAliases = useMemo(() => getIdentityAliases(user), [user]);
  const visible = useMemo(() => getVisibleApprovals(user, all), [user, all]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailNote, setDetailNote] = useState("");

  const detail = visible.find(a => a.id === detailId) || null;
  const cardOf = (kpiCardId: string) => cards.find(c => c.id === kpiCardId || (c.numericId != null && (`kpi-${c.numericId}` === kpiCardId || String(c.numericId) === kpiCardId)));

  const isManagerActor = user?.role === "MANAGER";

  const closeDetail = () => { setDetailId(null); setDetailNote(""); };

  const handleApproveInDetail = async () => {
    if (!detail || !meId) return;
    const isDeletion = String(detail.matrixId || "").startsWith("deletion:");
    if (isDeletion && !detailNote.trim()) {
      toast.error("Silinmə təsdiqi üçün silinmə səbəbini yazın");
      return;
    }
    const approverId = findMyRef(myAliases, detail.approverIds ?? []) || meId;
    try {
      await decideApproval(detail.id, approverId, "approved", detailNote || undefined);
      toast.success("KPI təsdiqləndi");
      closeDetail();
    } catch (e) {
      toast.error((e as Error).message || "Qərar saxlanmadı");
    }
  };
  const handleRejectInDetail = async () => {
    if (!detail || !meId) return;
    if (!detailNote.trim()) {
      toast.error("İmtina üçün rəy yazın");
      return;
    }
    const approverId = findMyRef(myAliases, detail.approverIds ?? []) || meId;
    try {
      await decideApproval(detail.id, approverId, "rejected", detailNote);
      toast.success("İmtina qeyd olundu");
      closeDetail();
    } catch (e) {
      toast.error((e as Error).message || "Qərar saxlanmadı");
    }
  };


  const columns = [
    { key: "pending" as const, label: "Gözləyir", icon: Clock, color: "amber" },
    { key: "approved" as const, label: "Təsdiqlənmiş", icon: CheckCircle2, color: "emerald" },
    { key: "rejected" as const, label: "İmtina", icon: XCircle, color: "rose" },
  ];

  return (
    <>
      <Header title="Sistem Təsdiqləri" />
      <main className="p-6 space-y-6">
        <PageHero
          icon={Send}
          title="Sistem Təsdiqləri"
          subtitle={isManagerActor
            ? "Sizə yönləndirilmiş KPI kartlarını təsdiqləyin və ya imtina edin"
            : "KPI kartlarının matris üzrə təsdiqləmə vəziyyəti"}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {columns.map(col => {
            const items = visible.filter(a => getMyApprovalBucket(user, a) === col.key);
            const Icon = col.icon;
            const headerColor = col.color === "amber"
              ? "from-amber-500/10 to-amber-500/5 border-amber-400/40"
              : col.color === "emerald"
              ? "from-emerald-500/10 to-emerald-500/5 border-emerald-400/40"
              : "from-rose-500/10 to-rose-500/5 border-rose-400/40";
            const iconColor = col.color === "amber" ? "text-amber-600"
              : col.color === "emerald" ? "text-emerald-600" : "text-rose-600";
            return (
              <div key={col.key} className="rounded-xl border border-border bg-muted/20 overflow-hidden flex flex-col">
                <div className={`px-4 py-3 border-b bg-gradient-to-r ${headerColor} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                    <span className="font-semibold text-sm">{col.label}</span>
                  </div>
                  <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-white border border-border">
                    {items.length}
                  </span>
                </div>
                <div className="p-3 space-y-3 min-h-[400px]">
                  {items.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-10">Boş</div>
                  )}
                  {items.map(a => {
                    const actionApproverId = findMyRef(myAliases, a.approverIds ?? []);
                    const myDecision = actionApproverId ? a.decisions[actionApproverId]?.decision : undefined;
                    const canActMe = !!actionApproverId && a.status === "pending" && myDecision === "pending";
                    const liveName = cardOf(a.kpiCardId)?.name || a.kpiName;
                    return (
                      <ApprovalCard
                        key={a.id}
                        a={{ ...a, kpiName: liveName }}
                        canAct={canActMe}
                        onView={() => { setDetailId(a.id); setDetailNote(""); }}
                        onApprove={() => { setDetailId(a.id); setDetailNote(""); }}
                        onReject={() => { setDetailId(a.id); setDetailNote(""); }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (() => {
            const c = cardOf(detail.kpiCardId);
            const actionApproverId = findMyRef(myAliases, detail.approverIds ?? []);
            const myDecision = actionApproverId ? detail.decisions[actionApproverId]?.decision : undefined;
            const canAct = !!actionApproverId && detail.status === "pending" && myDecision === "pending";
            const statusBadge = detail.status === "pending"
              ? { text: "Təsdiq gözləyir", cls: "bg-amber-100 text-amber-800 border-amber-300" }
              : detail.status === "approved"
              ? { text: "Təsdiqləndi", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" }
              : { text: "İmtina", cls: "bg-rose-100 text-rose-800 border-rose-300" };

            const firstTargetVal = c?.targets?.[0]
              ? `${c.targets[0].name || "—"}`
              : "—";
            const totalWeight = c?.targets?.reduce((s, t) => s + (t.weight || 0), 0) || 0;

            return (
              <div className="space-y-4">
                <DialogHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg flex items-center gap-2">
                        {detail.kpiName}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>{statusBadge.text}</span>
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Kartın matris üzrə təsdiqləmə prosesinin cari vəziyyəti və mərhələ detalları.
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* KPI Məlumatları */}
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs font-semibold text-foreground mb-2">KPI Məlumatları</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <InfoRow k="Sorğu növü" v={String(detail.matrixId || "").startsWith("deletion:") ? "KPI silinmə sorğusu" : "KPI təsdiq sorğusu"} />
                    <InfoRow k="Göndərilmə tarixi" v={new Date(detail.createdAt).toLocaleDateString("az-AZ")} />
                    <InfoRow k="Yaradan" v={empName(detail.createdBy)} />
                  </div>

                </div>

                {/* Hədəflər */}
                {c && c.targets.length > 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-primary" /> Hədəflər ({c.targets.length})
                    </div>
                    <ul className="space-y-1">
                      {c.targets.map(t => (
                        <li key={t.id} className="flex justify-between rounded bg-muted/40 px-3 py-2 text-xs">
                          <span>{t.name || "Hədəf"} <span className="text-muted-foreground">({t.type})</span></span>
                          <span className="text-muted-foreground">Çəki: {t.weight}% · Bal: {t.scoreLimit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Təsdiqləmə Zənciri */}
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold text-foreground mb-2">Təsdiqləmə Zənciri</div>
                  <ApprovalChain detail={detail} />
                </div>

                {/* Rəy + Aksiyalar */}
                {canAct ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground">Təsdiq / İmtina Şərhi <span className="text-muted-foreground">(imtina üçün məcburi)</span></label>
                    <textarea
                      value={detailNote}
                      onChange={e => setDetailNote(e.target.value)}
                      rows={3}
                      placeholder="Şərh əlavə edin..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleApproveInDetail}
                        className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                      >
                        <Check className="h-4 w-4" /> Təsdiq Et
                      </button>
                      <button
                        onClick={handleRejectInDetail}
                        className="px-3 py-2 rounded-md border border-rose-300 hover:bg-rose-50 text-rose-700 text-sm font-medium flex items-center justify-center gap-1.5"
                      >
                        <X className="h-4 w-4" /> Ləğv Et
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                    {isManagerActor
                      ? "Bu kart üçün sizin qərarınız artıq verilib və ya təsdiq mərhələsi tamamlanıb."
                      : "Yalnız təsdiqləyici rəhbər bu kartı təsdiq / imtina edə bilər."}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
};

const InfoRow = ({ k, v }: { k: string; v: string }) => (
  <>
    <div className="text-muted-foreground">{k}:</div>
    <div className="font-medium text-foreground text-right">{v}</div>
  </>
);

const ApprovalChain = ({ detail }: { detail: ApprovalItem }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <ol className="space-y-1.5">
      {detail.approverIds.map((id, i) => {
        const dec = detail.decisions[id];
        const state = dec?.decision || "pending";
        const isOpen = openIdx === i;
        const emp = getEnrichedEmployee(id);
        const stateBadge = state === "approved"
          ? { text: "Təsdiq edildi", cls: "text-emerald-700", icon: CheckCircle2 }
          : state === "rejected"
          ? { text: "İmtina edildi", cls: "text-rose-700", icon: XCircle }
          : i === detail.approverIds.findIndex(x => (detail.decisions[x]?.decision || "pending") === "pending")
          ? { text: "Gözləyir", cls: "text-amber-700", icon: Hourglass }
          : { text: "Növbədə", cls: "text-muted-foreground", icon: Clock };
        const StateIcon = stateBadge.icon;
        const stepNumCls = state === "approved"
          ? "bg-emerald-100 text-emerald-700 border-emerald-300"
          : state === "rejected"
          ? "bg-rose-100 text-rose-700 border-rose-300"
          : "bg-amber-100 text-amber-700 border-amber-300";
        return (
          <li key={id} className="rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-semibold ${stepNumCls}`}>
                  {state === "approved" ? "✓" : i + 1}
                </span>
                <div className="text-left">
                  <div className="text-sm font-medium text-foreground">{emp?.position || "Təsdiqləyici"}</div>
                  <div className="text-xs text-muted-foreground">{empName(id)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs flex items-center gap-1 ${stateBadge.cls}`}>
                  <StateIcon className="w-3.5 h-3.5" /> {stateBadge.text}
                  {dec?.at && ` — ${new Date(dec.at).toLocaleDateString("az-AZ")}`}
                </span>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border bg-muted/20 px-3 py-2.5 text-xs space-y-1.5">
                <div className="font-medium text-foreground">
                  {emp?.position || "—"} təsdiqi — Mərhələ Detalları
                </div>
                <div className="grid grid-cols-2 gap-y-1">
                  <div><span className="text-muted-foreground">Təsdiqləyən:</span> <span className="font-medium">{empName(id)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <span className={stateBadge.cls}>{stateBadge.text}</span></div>
                  {dec?.at && (
                    <>
                      <div><span className="text-muted-foreground">Təsdiq tarixi:</span> <span className="font-medium">{new Date(dec.at).toLocaleDateString("az-AZ")}</span></div>
                      <div><span className="text-muted-foreground">Cavab tarixi:</span> <span className="font-medium">{new Date(dec.at).toLocaleDateString("az-AZ")}</span></div>
                    </>
                  )}
                </div>
                {dec?.note && (
                  <div className={`mt-1 rounded px-2 py-1.5 border ${
                    state === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : state === "rejected" ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-white border-border text-foreground/80"
                  }`}>
                    <span className="font-medium">Şərh: </span>{dec.note}
                  </div>
                )}
                {state === "pending" && !dec?.note && (
                  <div className="text-muted-foreground italic">Hələ cavab yoxdur.</div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default ApprovalsPage;
