import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, Check, X, CheckCircle, XCircle, AlertCircle, ChevronDown, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHero } from "@/components/ui/page-hero";
import { decideApproval, useApprovals, type ApprovalItem } from "@/lib/approvalsStore";
import { useSharedKpiCards } from "@/lib/kpiCardStore";
import { getCurrentEmployeeId, getVisibleApprovals } from "@/lib/scope";
import { getEnrichedEmployee } from "@/data/mockExtras";

interface ApprovalStep {
  role: string; person: string; status: "pending" | "approved" | "rejected" | "waiting";
  date?: string; rejectReason?: string; comment?: string; createdDate?: string;
}

interface ApprovalRequest {
  id: string; kpiCode: string; kpiName: string; kpiType: string; createdDate: string; createdBy: string;
  kpiOwner: string; department: string; currentStep: number; approvalChain: ApprovalStep[];
  status: "pending" | "approved" | "rejected"; target: string; description: string;
  canAct: boolean;
  actionApproverId: string | null;
}

const PAGE_SIZE = 3;
const empName = (id?: string | null) => (id ? getEnrichedEmployee(id)?.fullName || id : "—");
const empDepartment = (id?: string | null) => (id ? getEnrichedEmployee(id)?.department || "—" : "—");
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("az-AZ") : "—";

const decisionNote = (d?: { note?: string; comment?: string }) => d?.note || d?.comment || undefined;
const aliasesFor = (id: string | null) => id ? [id, id.startsWith("e") ? id.slice(1) : `e${id}`] : [];
const findApprovalCard = (cards: ReturnType<typeof useSharedKpiCards>, kpiCardId: string) =>
  cards.find(c => c.id === kpiCardId || (c.numericId != null && (`kpi-${c.numericId}` === kpiCardId || String(c.numericId) === kpiCardId)));

const toApprovalRequest = (a: ApprovalItem, cards: ReturnType<typeof useSharedKpiCards>, meId: string | null): ApprovalRequest => {
  const card = findApprovalCard(cards, a.kpiCardId);
  const isDeletion = String(a.matrixId || "").startsWith("deletion:");
  const chain = a.stepsChain && a.stepsChain.length > 0 ? a.stepsChain : [a.approverIds];
  const currentStep = a.currentStep ?? Math.max(0, chain.findIndex(step => step.some(id => a.approverIds.includes(id))));
  const myAliases = new Set(aliasesFor(meId));
  const actionApproverId = a.approverIds.find(id => myAliases.has(id)) ?? null;
  const approvalChain: ApprovalStep[] = chain.map((ids, index) => {
    const stepDecisions = ids.map(id => a.decisions[id]);
    const rejected = stepDecisions.find(d => d?.decision === "rejected");
    const approved = ids.length > 0 && ids.every(id => a.decisions[id]?.decision === "approved");
    const pending = a.status === "pending" && index === currentStep;
    const decided = stepDecisions.find(d => d?.at);
    return {
      role: `Mərhələ ${index + 1}`,
      person: ids.map(empName).join(", ") || "—",
      status: rejected ? "rejected" : approved ? "approved" : pending ? "pending" : "waiting",
      date: decided?.at ? formatDate(decided.at) : undefined,
      rejectReason: rejected ? decisionNote(rejected as any) : undefined,
      comment: approved ? decisionNote(stepDecisions.find(d => decisionNote(d as any)) as any) : undefined,
      createdDate: formatDate(a.createdAt),
    };
  });
  const firstTarget = card?.targets?.[0];
  const currentDecision = actionApproverId ? a.decisions[actionApproverId]?.decision : undefined;
  return {
    id: a.id,
    kpiCode: a.id.slice(0, 12).toUpperCase(),
    kpiName: card?.name || a.kpiName,
    kpiType: isDeletion ? "KPI silinmə sorğusu" : "KPI təsdiq sorğusu",
    createdDate: formatDate(a.createdAt),
    createdBy: empName(a.createdBy),
    kpiOwner: empName(card?.ownerId || a.createdBy),
    department: empDepartment(card?.ownerId || a.createdBy),
    currentStep,
    approvalChain,
    status: a.status,
    target: firstTarget ? `${firstTarget.name}${firstTarget.targetValue ? ` — ${firstTarget.targetValue}${firstTarget.unit ? ` ${firstTarget.unit}` : ""}` : ""}` : "—",
    description: isDeletion ? "KPI kartı silinmə matrisi üzrə yoxlanılır." : "KPI kartı təsdiqləmə matrisi üzrə yoxlanılır.",
    canAct: a.status === "pending" && currentDecision === "pending",
    actionApproverId,
  };
};

const UserApprovalsPage = () => {
  const { user } = useAuth();
  const approvals = useApprovals();
  const cards = useSharedKpiCards();
  const meId = getCurrentEmployeeId(user);
  const visibleApprovals = useMemo(() => getVisibleApprovals(user, approvals), [user, approvals]);
  const requests = useMemo(
    () => visibleApprovals.map(a => toApprovalRequest(a, cards, meId)),
    [visibleApprovals, cards, meId],
  );

  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showApproveInput, setShowApproveInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);

  const pendingRequests = requests.filter(r => r.status === "pending" && r.canAct);
  const approvedRequests = requests.filter(r => r.status === "approved");
  const rejectedRequests = requests.filter(r => r.status === "rejected");

  const handleApprove = async (req: ApprovalRequest) => {
    if (!req.actionApproverId) return;
    try {
      await decideApproval(req.id, req.actionApproverId, "approved", approveComment || undefined);
      setApproveComment(""); setShowApproveInput(false); setSelectedRequest(null);
      toast.success("Sorğu təsdiqləndi");
    } catch (e) {
      toast.error((e as Error).message || "Qərar saxlanmadı");
    }
  };

  const handleReject = async (req: ApprovalRequest) => {
    if (!rejectReason.trim() || !req.actionApproverId) return;
    try {
      await decideApproval(req.id, req.actionApproverId, "rejected", rejectReason);
      setRejectReason(""); setShowRejectInput(false); setSelectedRequest(null);
      toast.error("Sorğu imtina edildi");
    } catch (e) {
      toast.error((e as Error).message || "Qərar saxlanmadı");
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <span className="text-xs px-2 py-0.5 rounded-full bg-zone-green-bg text-zone-green-text font-medium">Təsdiq edilib</span>;
      case "rejected": return <span className="text-xs px-2 py-0.5 rounded-full bg-zone-red-bg text-zone-red-text font-medium">İmtina edilib</span>;
      case "pending": return <span className="text-xs px-2 py-0.5 rounded-full bg-zone-yellow-bg text-zone-yellow-text font-medium">Təsdiq gözləyir</span>;
      default: return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Gözləyir</span>;
    }
  };

  const variantStyles = {
    pending: {
      panel: "bg-[hsl(217_40%_94%)] border-[hsl(217_30%_82%)] dark:bg-[hsl(217_35%_14%)] dark:border-[hsl(217_30%_24%)]",
      card: "bg-[hsl(217_55%_62%)] border-[hsl(217_45%_55%)] text-white dark:bg-[hsl(217_50%_42%)] dark:border-[hsl(217_45%_35%)]",
      title: "bg-[hsl(217_50%_55%)] border-b border-[hsl(217_45%_50%)] dark:bg-[hsl(217_50%_32%)] dark:border-[hsl(217_45%_28%)]",
      iconBg: "bg-[hsl(217_65%_55%)] dark:bg-[hsl(217_65%_45%)]",
      pageBtn: "bg-[hsl(217_65%_55%)] text-white dark:bg-[hsl(217_65%_45%)]",
      headerText: "text-[hsl(217_45%_25%)] dark:text-[hsl(217_60%_80%)]",
    },
    approved: {
      panel: "bg-[hsl(152_40%_94%)] border-[hsl(152_30%_80%)] dark:bg-[hsl(152_30%_12%)] dark:border-[hsl(152_25%_22%)]",
      card: "bg-[hsl(152_40%_55%)] border-[hsl(152_35%_48%)] text-white dark:bg-[hsl(152_40%_35%)] dark:border-[hsl(152_35%_28%)]",
      title: "bg-[hsl(152_38%_48%)] border-b border-[hsl(152_35%_42%)] dark:bg-[hsl(152_38%_28%)] dark:border-[hsl(152_35%_22%)]",
      iconBg: "bg-[hsl(152_50%_48%)] dark:bg-[hsl(152_50%_38%)]",
      pageBtn: "bg-[hsl(152_50%_48%)] text-white dark:bg-[hsl(152_50%_38%)]",
      headerText: "text-[hsl(152_45%_22%)] dark:text-[hsl(152_55%_75%)]",
    },
    rejected: {
      panel: "bg-[hsl(0_45%_95%)] border-[hsl(0_30%_82%)] dark:bg-[hsl(0_30%_14%)] dark:border-[hsl(0_25%_24%)]",
      card: "bg-[hsl(0_55%_65%)] border-[hsl(0_45%_58%)] text-white dark:bg-[hsl(0_50%_42%)] dark:border-[hsl(0_45%_35%)]",
      title: "bg-[hsl(0_50%_58%)] border-b border-[hsl(0_45%_52%)] dark:bg-[hsl(0_50%_35%)] dark:border-[hsl(0_45%_28%)]",
      iconBg: "bg-[hsl(0_60%_58%)] dark:bg-[hsl(0_60%_45%)]",
      pageBtn: "bg-[hsl(0_60%_58%)] text-white dark:bg-[hsl(0_60%_45%)]",
      headerText: "text-[hsl(0_50%_30%)] dark:text-[hsl(0_65%_78%)]",
    },
  } as const;

  const RequestCard = ({ req, variant }: { req: ApprovalRequest; variant: "pending" | "approved" | "rejected" }) => {
    const styles = variantStyles[variant];
    const datedSteps = req.approvalChain.filter(s => s.date);
    const lastDate = datedSteps.length ? datedSteps[datedSteps.length - 1].date : null;
    const firstApprover = req.approvalChain[0]?.person ?? "";
    return (
      <div className={`${styles.card} rounded-lg border overflow-hidden`}>
        <div className={`${styles.title} px-4 py-2 text-center font-semibold text-sm`}>
          {req.kpiName}
        </div>
        <div className="px-4 py-3 space-y-1 text-sm">
          <div><span className="opacity-90">Sorğu NO</span> - {req.kpiCode}</div>
          <div><span className="opacity-90">Sorğu Növü</span> - {req.kpiType || "—"}</div>
          <div><span className="opacity-90">Sorğunun Yaradılma Tarixi</span> - {req.createdDate}</div>
          {variant === "pending" && (
            <div><span className="opacity-90">İlk təsdiqləyici şəxs</span> - {firstApprover || "—"}</div>
          )}
          {variant === "approved" && (
            <div><span className="opacity-90">Sorğunun Təsdiq Tarixi</span> - {lastDate || "—"}</div>
          )}
          {variant === "rejected" && (
            <div><span className="opacity-90">Sorğunun imtina tarixi</span> - {lastDate || "—"}</div>
          )}
          <div><span className="opacity-90">Sorğu Yaradan</span> - {req.createdBy}</div>
          <div><span className="opacity-90">Subyektin adı soyadı</span> - {req.kpiOwner || "—"}</div>
          <div><span className="opacity-90">Struktur</span> - {req.department || "—"}</div>
        </div>
        <div className="flex justify-end px-4 pb-3">
          <button
            onClick={() => { setSelectedRequest(req); setShowRejectInput(false); setShowApproveInput(false); setRejectReason(""); setApproveComment(""); setSelectedStepIndex(null); }}
            className="text-white/90 hover:text-white"
            title="Ətraflı bax"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  };

  const Pagination = ({ page, setPage, total, variant }: { page: number; setPage: (n: number) => void; total: number; variant: "pending" | "approved" | "rejected" }) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const styles = variantStyles[variant];
    return (
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-8 h-8 rounded-md border border-border bg-card text-foreground flex items-center justify-center disabled:opacity-40"
        >‹</button>
        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`w-8 h-8 rounded-md text-sm font-medium ${n === page ? styles.pageBtn : "border border-border bg-card text-foreground"}`}
          >{n}</button>
        ))}
        <button
          onClick={() => setPage(Math.min(pages, page + 1))}
          disabled={page >= pages}
          className="w-8 h-8 rounded-md border border-border bg-card text-foreground flex items-center justify-center disabled:opacity-40"
        >›</button>
      </div>
    );
  };

  const Column = ({
    title, icon: Icon, variant, items, page, setPage, emptyText,
  }: {
    title: string;
    icon: typeof AlertCircle;
    variant: "pending" | "approved" | "rejected";
    items: ApprovalRequest[];
    page: number;
    setPage: (n: number) => void;
    emptyText: string;
  }) => {
    const styles = variantStyles[variant];
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    return (
      <div className={`${styles.panel} border rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${styles.headerText} font-semibold text-lg`}>{title}</h3>
          <div className={`${styles.iconBg} w-8 h-8 rounded-full flex items-center justify-center text-white`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="mb-4">
          <Pagination page={page} setPage={setPage} total={items.length} variant={variant} />
        </div>
        <div className="space-y-4 min-h-[200px]">
          {pageItems.length === 0 ? (
            <div className={`text-center ${styles.headerText} opacity-60 py-10 text-sm`}>{emptyText}</div>
          ) : (
            pageItems.map(req => <RequestCard key={req.id} req={req} variant={variant} />)
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header title="Sistem Təsdiqləri" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Təsdiqləmə Mərkəzi"
          icon={Sparkles}
          title="Sistem Təsdiqləri"
          subtitle="KPI təsdiqləmə zənciri və sorğuların idarə edilməsi"
        />

        <div className="grid grid-cols-3 gap-6">
          <Column
            title="Yeni Sorğular"
            icon={AlertCircle}
            variant="pending"
            items={pendingRequests}
            page={pendingPage}
            setPage={setPendingPage}
            emptyText="Təsdiq gözləyən sorğu yoxdur"
          />
          <Column
            title="Təsdiq edilmiş sorğular"
            icon={CheckCircle}
            variant="approved"
            items={approvedRequests}
            page={approvedPage}
            setPage={setApprovedPage}
            emptyText="Təsdiq edilmiş sorğu yoxdur"
          />
          <Column
            title="İmtina edilmiş sorğular"
            icon={XCircle}
            variant="rejected"
            items={rejectedRequests}
            page={rejectedPage}
            setPage={setRejectedPage}
            emptyText="İmtina edilmiş sorğu yoxdur"
          />
        </div>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-lg">{selectedRequest.kpiName}</DialogTitle>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-secondary rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-3 text-sm">KPI Məlumatları</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">KPI Kodu:</span><span className="font-medium">{selectedRequest.kpiCode}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">KPI Növü:</span><span className="font-medium">{selectedRequest.kpiType}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Hədəf:</span><span className="font-medium">{selectedRequest.target}</span></div>
                    {(() => {
                      const ds = selectedRequest.approvalChain.filter(s => s.date);
                      const respDate = ds.length ? ds[ds.length - 1].date : null;
                      const apprDate = selectedRequest.status === "approved" && ds.length ? ds[ds.length - 1].date : null;
                      return (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Cavab tarixi:</span><span className="font-medium">{respDate || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Təsdiq tarixi:</span><span className="font-medium">{apprDate || "—"}</span></div>
                        </>
                      );
                    })()}
                    <div className="flex justify-between"><span className="text-muted-foreground">Yaradan:</span><span className="font-medium">{selectedRequest.createdBy}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">KPI Sahibi:</span><span className="font-medium">{selectedRequest.kpiOwner}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Struktur:</span><span className="font-medium">{selectedRequest.department}</span></div>
                  </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-4">
                  <h4 className="font-semibold text-foreground mb-4 text-sm">Təsdiqləmə Zənciri</h4>
                  <div className="space-y-3">
                    {selectedRequest.approvalChain.map((step, i) => (
                      <div key={i}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step.status === "approved" ? "bg-zone-green-bg text-zone-green-text" : step.status === "rejected" ? "bg-zone-red-bg text-zone-red-text" : step.status === "pending" ? "bg-zone-yellow-bg text-zone-yellow-text" : "bg-muted text-muted-foreground"}`}>
                            {step.status === "approved" ? <Check className="w-4 h-4" /> : step.status === "rejected" ? <X className="w-4 h-4" /> : i + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div><p className="text-sm font-medium text-foreground">{step.role}</p><p className="text-xs text-muted-foreground">{step.person}</p></div>
                              <div className="text-right">
                                {step.status === "approved" && <span className="text-xs text-zone-green-text">✓ Təsdiq — {step.date}</span>}
                                {step.status === "rejected" && <span className="text-xs text-zone-red-text">✗ İmtina — {step.date}</span>}
                                {step.status === "pending" && <span className="text-xs text-zone-yellow-text">⏳ Gözləyir</span>}
                                {step.status === "waiting" && <span className="text-xs text-muted-foreground">Növbədə</span>}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setSelectedStepIndex(selectedStepIndex === i ? null : i)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-secondary transition-colors shrink-0">
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${selectedStepIndex === i ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                        {selectedStepIndex === i && (
                          <div className="ml-11 mt-2 p-3 bg-secondary rounded-lg border border-border space-y-2">
                            <h5 className="text-sm font-semibold text-foreground">{step.role} təsdiqi — Mərhələ Detalları</h5>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-muted-foreground">Təsdiqləyən:</span> <span className="font-medium text-foreground">{step.person}</span></div>
                              <div><span className="text-muted-foreground">Status:</span> <span className={`font-medium ${step.status === "approved" ? "text-zone-green-text" : step.status === "rejected" ? "text-zone-red-text" : step.status === "pending" ? "text-zone-yellow-text" : "text-muted-foreground"}`}>{step.status === "approved" ? "Təsdiq edilib" : step.status === "rejected" ? "İmtina edilib" : step.status === "pending" ? "Gözləyir" : "Növbədə"}</span></div>
                              {step.date && step.status === "approved" && <div><span className="text-muted-foreground">Təsdiq tarixi:</span> <span className="font-medium text-foreground">{step.date}</span></div>}
                              {step.date && <div><span className="text-muted-foreground">Cavab tarixi:</span> <span className="font-medium text-foreground">{step.date}</span></div>}
                            </div>
                            {step.status === "approved" && step.comment && (
                              <div className="p-2 bg-zone-green-bg rounded text-xs text-zone-green-text">
                                <span className="font-medium">Təsdiq şərhi: </span>{step.comment}
                              </div>
                            )}
                            {step.status === "rejected" && step.rejectReason && (
                              <div className="p-2 bg-zone-red-bg rounded text-xs text-zone-red-text">
                                <span className="font-medium">İmtina səbəbi: </span>{step.rejectReason}
                              </div>
                            )}
                            {step.status === "pending" && selectedRequest.canAct && i === selectedRequest.currentStep && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => { setShowApproveInput(true); setShowRejectInput(false); setSelectedStepIndex(null); }}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg bg-success text-success-foreground font-medium"
                                >
                                  <Check className="w-3 h-3" /> Təsdiq Et
                                </button>
                                <button
                                  onClick={() => { setShowRejectInput(true); setShowApproveInput(false); setSelectedStepIndex(null); }}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg bg-destructive text-destructive-foreground font-medium"
                                >
                                  <X className="w-3 h-3" /> İmtina Et
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                {selectedRequest.status === "pending" && selectedRequest.canAct && (
                  <div className="space-y-3 pt-2">
                    {showApproveInput ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">Təsdiq Şərhi (ixtiyari)</label>
                          <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} placeholder="Şərh əlavə edin..." rows={2} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background resize-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => handleApprove(selectedRequest)} className="flex-1 py-2.5 text-sm rounded-lg bg-success text-success-foreground font-medium">Təsdiq Et</button>
                          <button onClick={() => { setShowApproveInput(false); setApproveComment(""); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
                        </div>
                      </div>
                    ) : showRejectInput ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-foreground">İmtina Səbəbi</label>
                          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="İmtina səbəbini yazın..." rows={3} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background resize-none focus:ring-2 focus:ring-ring" />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => handleReject(selectedRequest)} disabled={!rejectReason.trim()} className="flex-1 py-2.5 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium disabled:opacity-50">İmtina Et</button>
                          <button onClick={() => { setShowRejectInput(false); setRejectReason(""); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button onClick={() => setShowApproveInput(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg bg-success text-success-foreground font-medium">
                          <Check className="w-4 h-4" /> Təsdiq Et
                        </button>
                        <button onClick={() => setShowRejectInput(true)} className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium">
                          <X className="w-4 h-4" /> İmtina Et
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserApprovalsPage;
