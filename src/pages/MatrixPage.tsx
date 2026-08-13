import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { Plus, Pencil, X, Shield, GripVertical, Check, Search, ShieldCheck, AlertTriangle, Sparkles, ClipboardList, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExportMenu from "@/components/common/ExportMenu";
import { PageHero } from "@/components/ui/page-hero";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  getApprovalMatrices, saveApprovalMatrix, deleteApprovalMatrix, getDeletionMatrices, saveDeletionMatrix, deleteDeletionMatrix,
  formatAssignee,
  type ApprovalStep, type ApprovalMatrix, type DeletionMatrix,
} from "@/lib/matrixStore";
import { getOperationsLog, addOperationLog, type OperationLogEntry } from "@/lib/operationsLogStore";
import ColumnSearchHeader from "@/components/common/ColumnSearchHeader";
import { DataTable } from "@/components/common/DataTable";
import { usePositions } from "@/lib/usePositions";
import { useCatalogValues } from "@/lib/dropdownCatalogStore";
import { getEmployees as getLiveEmployees } from "@/lib/orgStore";



const LEGACY_DEMO_USERS = [];

// DB-synced live employee names unioned with legacy demo names so the
// approval / deletion matrix picker always shows the latest staff.
const useAllUsers = (): string[] => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(x => x + 1);
    window.addEventListener("org-updated", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("org-updated", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
  return useMemo(() => {
    const live = getLiveEmployees().map(e =>
      `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim() || (e.email ?? ""),
    ).filter(Boolean);
    const seen = new Set(live.map(n => n.toLowerCase()));
    const demo = LEGACY_DEMO_USERS.filter(n => !seen.has(n.toLowerCase()));
    return [...live, ...demo];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
};

const MatrixPage = () => {
  const [approvals, setApprovals] = useState<ApprovalMatrix[]>([]);
  const [deletions, setDeletions] = useState<DeletionMatrix[]>([]);
  const [operations, setOperations] = useState<OperationLogEntry[]>([]);
  const [showOperationsDialog, setShowOperationsDialog] = useState(false);

  const [editingApproval, setEditingApproval] = useState<ApprovalMatrix | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [editingDeletion, setEditingDeletion] = useState<DeletionMatrix | null>(null);
  const [showDeletionDialog, setShowDeletionDialog] = useState(false);

  const reload = () => {
    setApprovals(getApprovalMatrices());
    setDeletions(getDeletionMatrices());
    setOperations(getOperationsLog());
  };

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener("matrix:updated", h);
    window.addEventListener("operations:updated", h);
    return () => {
      window.removeEventListener("matrix:updated", h);
      window.removeEventListener("operations:updated", h);
    };
  }, []);

  const openNewApproval = () => { setEditingApproval(null); setShowApprovalDialog(true); };
  const openEditApproval = (m: ApprovalMatrix) => { setEditingApproval(m); setShowApprovalDialog(true); };
  const openNewDeletion = () => { setEditingDeletion(null); setShowDeletionDialog(true); };
  const openEditDeletion = (m: DeletionMatrix) => { setEditingDeletion(m); setShowDeletionDialog(true); };

  const [confirmDelete, setConfirmDelete] = useState<{ kind: "approval" | "deletion"; id: string; name: string } | null>(null);
  const performDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "approval") deleteApprovalMatrix(confirmDelete.id);
    else deleteDeletionMatrix(confirmDelete.id);
    toast.success(`"${confirmDelete.name}" silindi`);
    setConfirmDelete(null);
  };

  const [approvalPage, setApprovalPage] = useState(1);
  const [deletionPage, setDeletionPage] = useState(1);
  const PAGE_SIZE = 3;

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

  type Variant = keyof typeof variantStyles;

  const Pagination = ({ page, setPage, total, variant }: { page: number; setPage: (n: number) => void; total: number; variant: Variant }) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const styles = variantStyles[variant];
    return (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
          className="w-8 h-8 rounded-md border border-border bg-card text-foreground flex items-center justify-center disabled:opacity-40">‹</button>
        {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => setPage(n)}
            className={`w-8 h-8 rounded-md text-sm font-medium ${n === page ? styles.pageBtn : "border border-border bg-card text-foreground"}`}>{n}</button>
        ))}
        <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages}
          className="w-8 h-8 rounded-md border border-border bg-card text-foreground flex items-center justify-center disabled:opacity-40">›</button>
      </div>
    );
  };

  const Panel = ({
    title, icon: Icon, variant, count, action, children, page, setPage, total,
  }: {
    title: string; icon: any; variant: Variant; count: number;
    action?: React.ReactNode; children: React.ReactNode;
    page: number; setPage: (n: number) => void; total: number;
  }) => {
    const styles = variantStyles[variant];
    return (
      <div className={`${styles.panel} border rounded-2xl p-5 flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`${styles.headerText} font-semibold text-lg leading-tight`}>{title}</h3>
            <p className={`${styles.headerText} opacity-70 text-xs mt-0.5`}>Ümumi: {count}</p>
          </div>
          <div className="flex items-center gap-2">
            {action}
            <div className={`${styles.iconBg} w-8 h-8 rounded-full flex items-center justify-center text-white`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </div>
        {total > 0 && (
          <div className="mb-4">
            <Pagination page={page} setPage={setPage} total={total} variant={variant} />
          </div>
        )}
        <div className="space-y-3 min-h-[200px]">{children}</div>
      </div>
    );
  };

  const AddButton = ({ onClick, variant, title }: { onClick: () => void; variant: Variant; title: string }) => {
    const styles = variantStyles[variant];
    return (
      <button onClick={onClick} title={title}
        className={`${styles.iconBg} w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-90`}>
        <Plus className="w-4 h-4" />
      </button>
    );
  };

  const paged = <T,>(arr: T[], page: number) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Təsdiqləmə Matrisi" />
      <main className="p-6 pb-24 space-y-6">
        <PageHero
          badge="Matris Mərkəzi"
          icon={Sparkles}
          title="Təsdiqləmə Matrisi"
          subtitle="Təsdiqləmə və silinmə matrislərini yaradın və idarə edin"
        />


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Approval Matrices — pending (blue) */}
          <Panel
            title="Təsdiqləmə Matrisləri"
            icon={ShieldCheck}
            variant="pending"
            count={approvals.length}
            total={approvals.length}
            page={approvalPage}
            setPage={setApprovalPage}
            action={<AddButton onClick={openNewApproval} variant="pending" title="Yeni Təsdiqləmə Matrisi" />}
          >
            {approvals.length === 0 ? (
              <div className={`text-center ${variantStyles.pending.headerText} opacity-60 py-10 text-sm`}>Hələ matris yaradılmayıb</div>
            ) : (
              paged(approvals, approvalPage).map(m => (
                <div key={m.id} className={`${variantStyles.pending.card} rounded-lg border overflow-hidden`}>
                  <div className={`${variantStyles.pending.title} px-4 py-2 flex items-center justify-between`}>
                    <span className="font-semibold text-sm truncate">{m.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditApproval(m)} className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center" title="Redaktə et">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete({ kind: "approval", id: m.id, name: m.name })} className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center" title="Sil">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    <div><span className="opacity-90">Mərhələ sayı</span> - {m.steps.length}</div>
                    <div><span className="opacity-90">Rejim</span> - {m.mode === "position" ? "Vəzifəyə görə" : "Şəxsə görə"}</div>
                    <div className="space-y-1 pt-1">
                      {m.steps.map((s, i) => (
                        <div key={s.id} className="bg-white/15 rounded px-2 py-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white/25 text-white text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                            <span className="text-xs font-medium truncate">{s.label}</span>
                          </div>
                          {s.assignees.length > 0 && (
                            <div className="ml-7 mt-1 text-[11px] opacity-90 truncate">
                              {s.assignees.map(a => m.mode === "position" && a.type === "role" ? a.name : formatAssignee(a)).join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Panel>

          {/* Deletion Matrices — red */}
          <Panel
            title="Silinmə Matrisləri"
            icon={Shield}
            variant="rejected"
            count={deletions.length}
            total={deletions.length}
            page={deletionPage}
            setPage={setDeletionPage}
            action={<AddButton onClick={openNewDeletion} variant="rejected" title="Yeni Silinmə Matrisi" />}
          >
            {deletions.length === 0 ? (
              <div className={`text-center ${variantStyles.rejected.headerText} opacity-60 py-10 text-sm`}>Hələ matris yaradılmayıb</div>
            ) : (
              paged(deletions, deletionPage).map(m => (
                <div key={m.id} className={`${variantStyles.rejected.card} rounded-lg border overflow-hidden`}>
                  <div className={`${variantStyles.rejected.title} px-4 py-2 flex items-center justify-between`}>
                    <span className="font-semibold text-sm truncate">{m.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditDeletion(m)} className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center" title="Redaktə et">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete({ kind: "deletion", id: m.id, name: m.name })} className="w-7 h-7 rounded-md hover:bg-white/15 flex items-center justify-center" title="Sil">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-sm">
                    <div><span className="opacity-90">Rejim</span> - {m.mode === "position" ? "Vəzifəyə görə" : "Şəxsə görə"}</div>
                    {m.approver ? (
                      <>
                        <div><span className="opacity-90">Təsdiqləyici</span> - {m.mode === "position" && m.approver.type === "role" ? m.approver.name : formatAssignee(m.approver)}</div>
                        <div><span className="opacity-90">Tip</span> - {m.approver.type === "role" ? "Vəzifə əsaslı" : "Konkret istifadəçi"}</div>
                      </>
                    ) : (
                      <div className="opacity-80">Təyinat yoxdur</div>
                    )}
                    <p className="text-[11px] opacity-80 pt-1 italic">
                      Bu matris ilə yaradılan silinmə sorğuları "Sistem Təsdiqləri" modulunda görünür.
                    </p>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
      </main>



      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Matrisi silmək istəyirsiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" matrisini silirsiniz. Bu əməliyyat geri qaytarıla bilməz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ləğv et</AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ApprovalDialog open={showApprovalDialog} onClose={() => setShowApprovalDialog(false)} initial={editingApproval} onSaved={reload} />
      <DeletionDialog open={showDeletionDialog} onClose={() => setShowDeletionDialog(false)} initial={editingDeletion} onSaved={reload} />

      <Dialog open={showOperationsDialog} onOpenChange={setShowOperationsDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" /> Əməliyyatlar reyestri
              </DialogTitle>
              <ExportMenu
                size="sm"
                className="mr-6"
                getData={() => ({
                  title: "Əməliyyatlar reyestri",
                  fileName: `emeliyyatlar-reyestri-${new Date().toISOString().slice(0, 10)}`,
                  headers: ["KPI Kartının Adı", "Komanda", "Dövr", "Status", "Tarix"],
                  rows: operations.map(o => [
                    o.kpiName, o.team, o.period,
                    o.status === "approved" ? "Təsdiqlənib" : "Silinib",
                    new Date(o.at).toLocaleString("az-AZ"),
                  ]),
                })}
              />
            </div>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Təsdiqlənən və silinən KPI kartlarının tarixçəsi</p>
          {operations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Hələ əməliyyat qeydə alınmayıb</p>
          ) : (
            <OperationsTable operations={operations} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const OperationsTable = ({ operations }: { operations: OperationLogEntry[] }) => {
  return (
    <DataTable<OperationLogEntry>
      rows={operations}
      rowKey={(o) => o.id}
      storageKey="ops-table"
      emptyMessage="Əməliyyat tapılmadı"
      columns={[
        { key: "kpi", label: "KPI Kartının Adı", filterType: "text", accessor: (o) => o.kpiName, render: (o) => <span className="font-medium text-foreground">{o.kpiName}</span> },
        { key: "team", label: "Komanda", filterType: "text", accessor: (o) => o.team, render: (o) => <span className="text-muted-foreground">{o.team}</span> },
        { key: "period", label: "Dövr", filterType: "text", accessor: (o) => o.period, render: (o) => <span className="text-muted-foreground">{o.period}</span> },
        {
          key: "status", label: "Status", filterType: "select", selectOptions: ["Təsdiqlənib", "Silinib"],
          accessor: (o) => o.status === "approved" ? "Təsdiqlənib" : "Silinib",
          render: (o) => (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.status === "approved" ? "bg-zone-green-bg text-zone-green-text" : "bg-zone-red-bg text-zone-red-text"}`}>
              {o.status === "approved" ? "Təsdiqlənib" : "Silinib"}
            </span>
          ),
        },
      ]}
    />
  );
};

const EmptyState = ({ icon: Icon, text, hint }: { icon: any; text: string; hint: string }) => (
  <div className="border border-dashed border-border rounded-lg p-6 text-center">
    <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
    <p className="text-sm text-foreground">{text}</p>
    <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
  </div>
);

// ===== Approval Matrix Dialog =====
const ApprovalDialog = ({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: ApprovalMatrix | null; onSaved: () => void }) => {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"position" | "user">("user");
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [search, setSearch] = useState<Record<string, string>>({});

  const ordinal = (n: number) => `${n}-ci təsdiqləyici`;
  const positionRoles = usePositions();
  const allUsers = useAllUsers();

  useEffect(() => {
    if (open) {
      setName(initial?.name || "Yeni Təsdiqləmə Matrisi");
      setMode((initial?.mode as any) || "user");
      setSteps(initial?.steps?.length ? initial.steps.map(s => ({ ...s, minApprovals: s.minApprovals || 1 })) : [
        { id: crypto.randomUUID(), label: ordinal(1), assignees: [], minApprovals: 1 },
      ]);
    }
  }, [open, initial]);

  const addStep = () => setSteps(s => [...s, { id: crypto.randomUUID(), label: ordinal(s.length + 1), assignees: [], minApprovals: 1 }]);
  const removeStep = (id: string) => setSteps(s => relabel(s.filter(x => x.id !== id)));
  const updateStep = (id: string, patch: Partial<ApprovalStep>) => setSteps(s => s.map(x => x.id === id ? { ...x, ...patch } : x));

  // Auto re-number any step whose label still follows the default ordinal pattern.
  const relabel = (arr: ApprovalStep[]) =>
    arr.map((st, i) => /^\d+-ci təsdiqləyici$/.test(st.label) ? { ...st, label: ordinal(i + 1) } : st);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [grabId, setGrabId] = useState<string | null>(null);
  const moveStep = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setSteps(s => {
      const next = [...s];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return relabel(next);
    });
  };

  const toggleAssignee = (stepId: string, type: "user" | "role", name: string) => {
    setSteps(s => s.map(x => {
      if (x.id !== stepId) return x;
      const exists = x.assignees.find(a => a.type === type && a.name === name);
      const next = exists ? x.assignees.filter(a => !(a.type === type && a.name === name)) : [...x.assignees, { type, name }];
      const min = Math.min(x.minApprovals || 1, Math.max(1, next.length || 1));
      return { ...x, assignees: next, minApprovals: min };
    }));
  };

  const save = () => {
    if (!name.trim()) return toast.error("Matris adı boş ola bilməz");
    if (steps.some(s => s.assignees.length === 0)) return toast.error("Hər mərhələdə ən azı 1 təyinat olmalıdır");
    saveApprovalMatrix({ id: initial?.id, name: name.trim(), mode, steps });
    toast.success(initial ? "Matris yeniləndi" : "Yeni matris yaradıldı");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Təsdiqləmə Matrisini Redaktə Et" : "Yeni Təsdiqləmə Matrisi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Matris Adı</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Matris Rejimi</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("position")} className={`px-3 py-2 text-sm rounded-lg border ${mode === "position" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card text-foreground"}`}>
                Vəzifəyə görə
              </button>
              <button type="button" onClick={() => setMode("user")} className={`px-3 py-2 text-sm rounded-lg border ${mode === "user" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card text-foreground"}`}>
                Şəxsə görə
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {mode === "position" ? "Təsdiqləyicilər vəzifə əsasında seçilir; KPI tətbiq olunduqda aid strukturun rəhbəri avtomatik rezolv olunur." : "Konkret əməkdaşlar təsdiqləyici kimi seçilir."}
            </p>
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => {
              const q = (search[step.id] || "").toLowerCase();
              const filteredUsers = allUsers.filter(u => u.toLowerCase().includes(q) || (formatAssignee({ type: "user", name: u }).toLowerCase().includes(q)));
              const filteredRoles = positionRoles.filter(r => r.toLowerCase().includes(q));
              const maxMin = Math.max(1, step.assignees.length || 1);
              return (
                <div
                  key={step.id}
                  draggable={grabId === step.id}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => { if (dragIdx !== null) moveStep(dragIdx, i); setDragIdx(null); setGrabId(null); }}
                  onDragEnd={() => { setDragIdx(null); setGrabId(null); }}
                  className={`border border-border rounded-lg p-3 bg-secondary/30 transition-opacity ${dragIdx === i ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      onMouseDown={() => setGrabId(step.id)}
                      onMouseUp={() => setGrabId(null)}
                      title="Sürüşdürərək yerini dəyiş"
                      className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-secondary"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </span>
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                    <input value={step.label} onChange={e => updateStep(step.id, { label: e.target.value })} className="flex-1 px-2 py-1 text-sm border border-border rounded bg-background font-medium" />
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveStep(i, i - 1)} disabled={i === 0} title="Yuxarı" className="w-6 h-7 rounded border border-border bg-background disabled:opacity-30 flex items-center justify-center hover:bg-secondary">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => moveStep(i, i + 1)} disabled={i === steps.length - 1} title="Aşağı" className="w-6 h-7 rounded border border-border bg-background disabled:opacity-30 flex items-center justify-center hover:bg-secondary">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-background" title="Minimal təsdiq sayı">
                      <Check className="w-3 h-3 text-primary" />
                      <input
                        type="number"
                        min={1}
                        max={maxMin}
                        value={step.minApprovals || 1}
                        onChange={e => updateStep(step.id, { minApprovals: Math.min(maxMin, Math.max(1, parseInt(e.target.value) || 1)) })}
                        className="w-10 text-xs bg-transparent outline-none text-center"
                      />
                      <span className="text-[10px] text-muted-foreground">/ {maxMin}</span>
                    </div>
                    {steps.length > 1 && (
                      <button onClick={() => removeStep(step.id)} className="w-7 h-7 rounded bg-zone-red-bg text-zone-red-text flex items-center justify-center"><X className="w-3 h-3" /></button>
                    )}
                  </div>

                  <div className="ml-8 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input value={search[step.id] || ""} onChange={e => setSearch(p => ({ ...p, [step.id]: e.target.value }))} placeholder={mode === "position" ? "Vəzifə axtar..." : "Əməkdaş axtar..."} className="w-full pl-7 pr-3 py-1.5 text-xs border border-border rounded bg-background" />
                    </div>
                    {step.assignees.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {step.assignees.map((a, j) => (
                          <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                            {mode === "position" && a.type === "role" ? a.name : formatAssignee(a)}
                            <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => toggleAssignee(step.id, a.type, a.name)} />
                          </span>
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{mode === "position" ? "Vəzifələr" : "Əməkdaşlar"}</p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5 border border-border rounded-md p-1 bg-background">
                        {mode === "position" ? (
                          <>
                            {filteredRoles.map(r => {
                              const sel = step.assignees.some(a => a.type === "role" && a.name === r);
                              return (
                                <div key={r} onClick={() => toggleAssignee(step.id, "role", r)} className={`px-2 py-1 text-xs rounded cursor-pointer flex items-center justify-between hover:bg-secondary ${sel ? "bg-primary/5" : ""}`}>
                                  <span>{r}</span>{sel && <Check className="w-3 h-3 text-primary" />}
                                </div>
                              );
                            })}
                            {filteredRoles.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground text-center">Tapılmadı</p>}
                          </>
                        ) : (
                          <>
                            {filteredUsers.map(u => {
                              const sel = step.assignees.some(a => a.type === "user" && a.name === u);
                              return (
                                <div key={u} onClick={() => toggleAssignee(step.id, "user", u)} className={`px-2 py-1 text-xs rounded cursor-pointer flex items-center justify-between hover:bg-secondary ${sel ? "bg-primary/5" : ""}`}>
                                  <span>{formatAssignee({ type: "user", name: u })}</span>{sel && <Check className="w-3 h-3 text-primary" />}
                                </div>
                              );
                            })}
                            {filteredUsers.length === 0 && <p className="px-2 py-2 text-[11px] text-muted-foreground text-center">Tapılmadı</p>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button onClick={addStep} className="text-xs text-primary font-medium">+ Yeni təsdiqləyici əlavə et</button>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">Yadda saxla</button>
            <button onClick={onClose} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ===== Deletion Matrix Dialog =====
const DeletionDialog = ({ open, onClose, initial, onSaved }: { open: boolean; onClose: () => void; initial: DeletionMatrix | null; onSaved: () => void }) => {
  const allUsers = useAllUsers();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "Yeni Silinmə Matrisi");
      setSelected(initial?.approver?.type === "user" ? initial.approver.name : "");
      setSearch("");
    }
  }, [open, initial]);

  const baseOptions = allUsers;
  const options = useMemo(() => {
    const q = search.toLowerCase();
    return baseOptions.filter(u => u.toLowerCase().includes(q) || formatAssignee({ type: "user", name: u }).toLowerCase().includes(q));
  }, [search, baseOptions]);

  const save = () => {
    if (!name.trim()) return toast.error("Matris adı boş ola bilməz");
    if (!selected) return toast.error("Təsdiqləyici seçməlisiniz");
    saveDeletionMatrix({ id: initial?.id, name: name.trim(), mode: "user", approver: { type: "user", name: selected } });
    toast.success(initial ? "Matris yeniləndi" : "Yeni matris yaradıldı");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Silinmə Matrisini Redaktə Et" : "Yeni Silinmə Matrisi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">Silinmə matrisi yalnız 1 təsdiqləyicidən ibarət ola bilər.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Matris Adı</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Matris Rejimi</label>
            <div className="px-3 py-2 text-sm rounded-lg border border-primary bg-primary/10 text-primary font-medium text-center">Şəxsə görə</div>
            <p className="text-[11px] text-muted-foreground mt-1">Konkret əməkdaş seçilir.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Təsdiqləyici (Əməkdaş)</label>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Əməkdaş axtar..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded bg-background" />
            </div>
            <div className="max-h-56 overflow-y-auto border border-border rounded-lg">
              {options.map(o => (
                <div key={o} onClick={() => setSelected(o)} className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${selected === o ? "bg-primary/5" : ""}`}>
                  <span>{formatAssignee({ type: "user", name: o })}</span>{selected === o && <Check className="w-4 h-4 text-primary" />}
                </div>
              ))}
              {options.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">Tapılmadı</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">Yadda saxla</button>
            <button onClick={onClose} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default MatrixPage;
