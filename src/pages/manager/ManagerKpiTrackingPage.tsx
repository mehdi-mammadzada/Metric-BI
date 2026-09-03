// Rəhbər · KPI İzlənməsi — 3 kart: Mənim KPI-larım / Komanda KPI-ları / Tabeçilikdəkilərin KPI-ları.
import { withKartSuffix } from "@/lib/utils";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import KpiCommentThread from "@/components/kpi/KpiCommentThread";
import { getEmployees, getStructures, type OrgStructure } from "@/lib/orgStore";
import {
  getRealKpiCardsForEmployee,
  getRealTeamKpiCards,
  findEmployeeByUser,
  type RealKpiCard,
} from "@/lib/managerKpiData";

import { useCascadeTree, type CascadeTreeNode } from "@/lib/cascadeTreeStore";
import { useVisibleSharedKpiCards, type SharedKpiCard, type ExecutionStatus } from "@/lib/kpiCardStore";
import { TARGET_STATUS_BADGE, TARGET_STATUS_LABEL, normalizeTargetStatus, type TargetStatus } from "@/lib/targetStatus";
import { computeReviewStatus, setReviewOutcome, useKpiLifecycles, type CardLifecycle, type LifecycleReview, type ReviewComputedStatus } from "@/lib/kpiLifecycleStore";
import CascadeDistributeDialog from "@/components/kpi/CascadeDistributeDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import KpiScoresPage from "@/pages/KpiScoresPage";
import KpiDetailView from "@/components/kpi/KpiDetailView";
import { REVIEW_STATUS_STYLES } from "@/components/kpi/LifecycleView";
import { useCatalogValues } from "@/lib/dropdownCatalogStore";
import type { KpiCard as KpiCardShape } from "@/lib/kpiCardTypes";
import { useAuth } from "@/contexts/AuthContext";
import {
  Activity, User, Users, Network, ChevronLeft, ChevronRight, ChevronDown, Search, Bell, Check, X, Clock,
  MoreVertical, Eye, LineChart, MessageSquare, Filter, Send, Paperclip, AlertTriangle, Building2,
  TrendingUp, TrendingDown, Minus, MapPin, Layers, ShieldAlert, Target as TargetIcon, GitBranch, RefreshCw,
} from "lucide-react";
import KpiAccordionList, { type AccordionKpi, type AccordionKpiStatus } from "@/components/kpi/KpiAccordionList";
import ReviewOverviewDialog, { type ReviewOverviewData } from "@/components/kpi/ReviewOverviewDialog";
import ReviewStatusChangeDialog, { type ReviewStatusValue } from "@/components/kpi/ReviewStatusChangeDialog";
import PerformanceDynamicsDrilldownTab from "@/components/kpi/PerformanceDynamicsDrilldownTab";
import ColumnSearchHeader from "@/components/common/ColumnSearchHeader";
import { employeeCommentRef } from "@/components/kpi/EmployeeCardTabs";
import { reviewCommentRef } from "@/lib/kpiCommentsService";
import PeriodRangePicker, { emptyPeriodSelection, overlapsPeriod, resolvePeriod, type PeriodSelection, type ResolvedPeriod } from "@/components/kpi/PeriodRangePicker";


type Stage = "assigned" | "evaluated" | "pending_assign";
type KpiStatus = TargetStatus;
interface Kpi {
  id: string; name: string; description: string; period: string;
  target: number; actual: number; unit: string; stage: Stage;
  status: KpiStatus; deadline: string; createdAt: string; updatedAt: string;
  responsible: { name: string; role: string };
  measure: string; type: string; method: string; weight: number;
  cascadeNodeId?: string;
  /** Real (DB/store) hədəflər — mock generatorlar əvəzinə istifadə olunur. */
  realTargets?: CardTarget[];
}

interface Person { id: string; name: string; position: string; parent?: string; level: number; assigned: boolean; stage: Stage; }

const MY_KPIS: Kpi[] = [];

const TEAM_KPIS: Kpi[] = [];

const HIERARCHY: Person[] = [];

const fmt = (n: number) => new Intl.NumberFormat("az-AZ").format(n);
const parseNumber = (value: unknown): number => {
  const n = parseFloat(String(value ?? "").replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const pctOf = (k: Kpi) => k.target ? Math.round((k.actual / k.target) * 100) : 0;
/** Plan 0 və ya etibarsız olduqda faiz həmişə 0 (NaN/Infinity göstərilmir). */
const safePct = (fakt: number, plan: number) => {
  const p = Number(plan) || 0;
  const f = Number(fakt) || 0;
  if (p <= 0) return 0;
  const v = Math.round((f / p) * 100);
  return Number.isFinite(v) ? v : 0;
};

const tone = (p: number) => p >= 100 ? "bg-zone-green-bg text-zone-green-text" : p >= 75 ? "bg-zone-yellow-bg text-zone-yellow-text" : "bg-zone-red-bg text-zone-red-text";

const statusMeta: Record<KpiStatus, { label: string; cls: string }> = {
  in_progress:  { label: TARGET_STATUS_LABEL.in_progress,  cls: TARGET_STATUS_BADGE.in_progress },
  achieved:     { label: TARGET_STATUS_LABEL.achieved,     cls: TARGET_STATUS_BADGE.achieved },
  not_achieved: { label: TARGET_STATUS_LABEL.not_achieved, cls: TARGET_STATUS_BADGE.not_achieved },
};

const targetsForKpi = (k: Kpi) => {
  if (k.realTargets?.length) {
    return k.realTargets.map(t => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      fakt: t.fakt,
      unit: t.unit,
      status: t.status as AccordionKpiStatus,
    }));
  }
  if (!k.target && !k.actual) return [];
  return [{
    id: `${k.id}-t1`,
    name: k.method || k.name,
    plan: k.target,
    fakt: k.actual,
    unit: k.unit,
    status: k.status as AccordionKpiStatus,
  }];
};




const dedupeKpis = <T extends Kpi>(rows: T[]): T[] => {
  const norm = (value?: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const keyOf = (k: Kpi) => [norm(k.name), norm(k.responsible?.name), norm(k.deadline), norm(k.method)].join("::");
  const map = new Map<string, T>();
  rows.forEach(row => {
    const key = keyOf(row);
    const prev = map.get(key);
    if (!prev || Date.parse(row.updatedAt || "") >= Date.parse(prev.updatedAt || "")) map.set(key, row);
  });
  return Array.from(map.values());
};


type View = "hub" | "own" | "team" | "sub" | "reviews";

const ManagerKpiTrackingPage = () => {
  const [view, setView] = useState<View>("hub");
  const { user } = useAuth();
  const tree = useCascadeTree();
  const sharedCards = useVisibleSharedKpiCards();

  const me = useMemo(() => findEmployeeByUser(user), [user?.email, user?.name, sharedCards, tree]);

  const realToKpi = (c: RealKpiCard, ownerName: string, ownerRole: string): Kpi => {
    const plan = c.targets.reduce((s, t) => s + t.plan, 0);
    const fakt = c.targets.reduce((s, t) => s + t.fakt, 0);
    return {
      id: c.id,
      name: c.name,
      description: "",
      period: c.frequency || "—",
      target: plan,
      actual: fakt,
      unit: c.targets[0]?.unit || "",
      stage: "assigned",
      status: "in_progress",
      deadline: c.deadline,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      responsible: { name: ownerName, role: ownerRole },
      measure: c.targets[0]?.unit || "—",
      type: c.frequency || "—",
      method: "—",
      weight: 0,
      realTargets: c.targets.map(t => ({ ...t, status: "in_progress" as KpiStatus })),
    };
  };

  // Mənim KPI-larım — yalnız REAL kartlar (shared_kpi_cards + cascade_tree).
  const myKpis = useMemo<Kpi[]>(() => {
    if (!me) return [];
    return getRealKpiCardsForEmployee(me.id).map(c =>
      realToKpi(c, `${me.firstName} ${me.lastName}`, me.positionName || "İcraçı"),
    );
  }, [me, sharedCards, tree]);

  // Komanda KPI-ları — istifadəçinin üzv olduğu komandalara TOPLU verilmiş kartlar.
  const teamKpis = useMemo<Kpi[]>(() => {
    if (!me) return [];
    return getRealTeamKpiCards(me.id).map(c =>
      realToKpi(c, `${me.firstName} ${me.lastName}`, me.positionName || "İcraçı"),
    );
  }, [me, sharedCards]);


  // Rəhbər yalnız öz strukturunu görməlidir, HR/SUPER_ADMIN isə bütün şirkəti.
  const subScopePath = useMemo<string | null>(() => {
    if (!user) return null;
    if (user.role === "HR" || user.role === "SUPER_ADMIN") return null;
    const emps = getEmployees().filter(e => e.active);
    const me = emps.find(e => e.email === user.email) || emps.find(e => `${e.firstName} ${e.lastName}` === user.name);
    return me?.structurePath || null;
  }, [user?.email, user?.name, user?.role]);


  return (
    <div className="min-h-screen">
      <Header title="KPI İzlənməsi" />
      <main className="p-6 pb-24">
        {view !== "hub" && (
          <button onClick={() => setView("hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
        )}
        {view === "hub" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={Activity} title="KPI İzlənməsi" subtitle="Fərdi, komanda və tabeçilik KPI-larını fərqli baxış bucaqlarından izləyin." />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mt-2">
              <HubCard icon={User} title="Mənim KPI-larım" subtitle="Sizə aid fərdi hədəflər və onların icra vəziyyəti." count={myKpis.length} gradient="from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/40" onClick={() => setView("own")} />
              <HubCard icon={Users} title="Komanda KPI-ları" subtitle="Toplu (kollektiv) hədəflər — komanda olaraq eyni nəticə." count={teamKpis.length} gradient="from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40" onClick={() => setView("team")} />
              <HubCard icon={Network} title="Tabeçiliyimdəkilərin KPI-ları" subtitle="İyerarxik görünüş, mərhələ nəzarəti və gecikmə bildirişləri." count={<SubordinatesCount scopePath={subScopePath} />} gradient="from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/40" onClick={() => setView("sub")} />
              <HubCard icon={RefreshCw} title="Reviewlar" subtitle="Hazırda Review mərhələsində olan bütün KPI kartları — bir ekrandan izləyin." count={<ReviewsCount />} gradient="from-sky-500/15 via-sky-500/5 to-transparent border-sky-400/40" onClick={() => setView("reviews")} />
            </div>
          </>
        )}
        {view === "own" && <OwnKpisView title="Mənim KPI-larım" subtitle="Sizə aid fərdi hədəflər və onların icra vəziyyəti." data={myKpis} cascadeNodes={tree} />}
        {view === "team" && <OwnKpisView title="Komanda KPI-ları" subtitle="Toplu (kollektiv) hədəflər — komanda olaraq eyni nəticə." data={teamKpis} />}

        {view === "sub" && <SubordinatesView scopePath={subScopePath} />}
        {view === "reviews" && <ReviewsView />}
      </main>
    </div>
  );
};

const HubCard = ({ icon: Icon, title, subtitle, count, gradient, onClick }: any) => (
  <button onClick={onClick} className={`text-left rounded-2xl border bg-gradient-to-br ${gradient} p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group`}>
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-white/70 backdrop-blur border border-white flex items-center justify-center shadow-sm">
        <Icon className="w-7 h-7 text-foreground/80" />
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-white text-foreground/70 font-medium">{count}</span>
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 group-hover:text-foreground">Aç <ChevronRight className="w-4 h-4" /></div>
  </button>
);

// ============================================================
// OWN KPIs VIEW — full featured
// ============================================================
type DrawerTab = "general" | "targets" | "bsc" | "lifecycle" | "history" | "team" | "comments" | "status" | "setStatus" | "review";

interface CommentItem { id: string; author: string; role: string; date: string; text: string; }
interface HistoryItem { id: string; date: string; time: string; author: string; field: string; from: string; to: string; }
interface ReminderItem { id: string; date: string; time: string; author: string; text: string; read: boolean; }

// Real data yoxdursa — boş siyahı (mock şərh/tarixçə/xatırlatma yaradılmır).
const initialComments = (_kpiId: string): CommentItem[] => [];

const initialHistory = (_kpiId: string): HistoryItem[] => [];

const initialReminders = (_kpiId: string): ReminderItem[] => [];


const OwnKpisView = ({ title, subtitle, data, cascadeNodes = [] }: { title: string; subtitle: string; data: Kpi[]; cascadeNodes?: CascadeTreeNode[] }) => {
  const [period, setPeriod] = useState<PeriodSelection>(() => emptyPeriodSelection("monthly"));
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const total = data.length;
    const avg = total ? Math.round(data.reduce((a, k) => a + pctOf(k), 0) / total) : 0;
    const done = data.filter(k => k.status === "achieved" || pctOf(k) >= 100).length;
    const late = data.filter(k => k.status === "not_achieved").length;
    return { total, avg, done, late };
  }, [data]);

  const openDrawer = (k: Kpi, tab: DrawerTab) => {
    setDrawerKpi(k); setDrawerTab(tab); setOpenMenu(null);
  };

  return (
    <>
      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border border-primary/20">{data.length} KPI</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <StatCard icon={Users} label="Ümumi KPI sayı" value={String(stats.total)} tone="indigo" />
          <StatCard icon={LineChart} label="Ortalama icra faizi" value={`${stats.avg}%`} tone="violet" />
          <StatCard icon={Check} label="Hədəfə çatanlar" value={String(stats.done)} tone="green" />
          <StatCard icon={Clock} label="Hədəfə çatmayanlar" value={String(stats.late)} tone="red" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Status</label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-44 h-9 mt-0.5"><SelectValue placeholder="Bütün statuslar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün statuslar</SelectItem>
                <SelectItem value="in_progress">İcrada</SelectItem>
                <SelectItem value="achieved">Hədəfə çatıb</SelectItem>
                <SelectItem value="not_achieved">Hədəfə çatmayıb</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Dövr</label>
            <Select value={periodF} onValueChange={setPeriodF}>
              <SelectTrigger className="w-44 h-9 mt-0.5"><SelectValue placeholder="Bütün dövrlər" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün dövrlər</SelectItem>
                {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Axtarış..."
            className="w-64 pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      {/* KPI Cards — accordion */}
      <KpiAccordionList
        items={rows.map<AccordionKpi>(k => ({
          id: k.id,
          name: k.name,
          createdAt: k.createdAt,
          deadline: k.deadline,
          status: k.status as AccordionKpiStatus,
          targets: targetsForKpi(k),
        }))}
        onAction={(item, _t, a) => {
          const k = rows.find(r => r.id === item.id);
          if (!k) return;
          const tab: DrawerTab = a === "history" ? "history" : a === "comments" ? "comments" : "general";
          if (a === "reminders") {
            openDrawer(k, "general");
            setTimeout(() => setDrawerTab("history" as DrawerTab), 0);
            return;
          }
          openDrawer(k, tab);
        }}
      />



      <KpiDrawer kpi={drawerKpi} tab={drawerTab} setTab={setDrawerTab} onClose={() => setDrawerKpi(null)} />
      <CascadeDistributeDialog
        open={!!distributeNode}
        onOpenChange={(o) => !o && setDistributeNode(null)}
        existingNode={distributeNode || undefined}
        onDistributed={() => setDistributeNode(null)}
      />
    </>
  );
};

const MenuItem = ({ icon: Icon, label, onClick }: any) => (
  <button onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-secondary text-foreground focus:outline-none focus:bg-secondary transition-colors">
    <Icon className="w-4 h-4 text-muted-foreground" />
    <span>{label}</span>
  </button>
);

const StatCard = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "indigo" | "violet" | "green" | "red" }) => {
  const map = {
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    green:  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    red:    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${map}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground tabular-nums">{value}</div>
      </div>
    </div>
  );
};

// ============================================================
// DRAWER — no backdrop, right-side, ~440px
// ============================================================
const initialsOf = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
const kpiToKpiCard = (k: Kpi): KpiCardShape => ({
  id: (hashStr(k.id) % 100000) + 1,
  name: k.name,
  icon: null,
  zone: "green",
  target: String(k.target),
  current: String(k.actual),
  unit: k.unit,
  progress: pctOf(k),
  minTarget: 0,
  responsible: k.responsible.name,
  period: k.period,
  type: k.type,
  formula: "",
  generalTarget: `${fmt(k.target)} ${k.unit}`,
  department: "",
  group: "",
  subdivision: "",
  startDate: k.createdAt,
  endDate: k.deadline,
  frequency: k.type,
  team: [{ name: k.responsible.name, role: k.responsible.role, avatar: initialsOf(k.responsible.name) }],
  history: [],
  description: k.description,
  weight: k.weight,
  approvalStatus: "approved",
  subKpis: [],
  matrixId: null,
});

const KpiDrawer = ({ kpi, tab, setTab, onClose, onOpenTarget, reviewMeta, tabsFilter }: {
  kpi: Kpi | null; tab: DrawerTab; setTab: (t: DrawerTab) => void; onClose: () => void;
  onOpenTarget?: (t: CardTarget) => void;
  reviewMeta?: { reviewLabel: string; reviewStart: string; reviewNumber?: number; evaluator?: string; nextReview?: string; reviewStatusLabel?: string; reviewStatusClass?: string; outcomeComment?: string };
  tabsFilter?: DrawerTab[];
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!kpi) return null;
  const p = pctOf(kpi);
  const history = initialHistory(kpi.id);
  const reminders = initialReminders(kpi.id);



  return (
    <aside className="fixed top-0 right-0 h-screen w-full sm:w-[640px] bg-card border-l border-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">KPI-yə bax</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!tabsFilter && (
        <KpiDetailView kpi={kpiToKpiCard(kpi)} compact />
      )}
      {tabsFilter && (
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-5">
          {/* Title */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-base font-semibold text-foreground">{withKartSuffix(kpi.name)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.description}</div>
            </div>
            <Badge className={statusMeta[kpi.status].cls}>{statusMeta[kpi.status].label}</Badge>
          </div>

          {/* Card 1 */}
          <div className="rounded-xl border border-border bg-background p-4 mb-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <MetaRow label="Dövr" value={kpi.period} />
            <MetaRow label="Plan" value={`${fmt(kpi.target)} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
            <MetaRow label="Status" value={<span className="text-rose-500">{statusMeta[kpi.status].label}</span>} />
            <MetaRow label="Fakt" value={`${fmt(kpi.actual)} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
            <MetaRow label="Deadline" value={kpi.deadline} />
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">İcra faizi</div>
              <div className="flex items-center gap-2">
                <Progress value={Math.min(p, 100)} className="h-1.5 flex-1" />
                <span className="text-xs font-medium tabular-nums">{p}%</span>
              </div>
            </div>
            <MetaRow label="Məsul rəhbər" value={<span>{kpi.responsible.name}<div className="text-[11px] text-muted-foreground">{kpi.responsible.role}</div></span>} />
            <MetaRow label="Yaradılma" value={kpi.createdAt} />
            <div />
            <MetaRow label="Son yenilənmə" value={kpi.updatedAt} />
          </div>

          {/* Tabs — KPI Detail: 8 fixed tab (spec üzrə) */}
          <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1 mb-3">
            {([
              ["general", "Ümumi"],
              ["targets", "Hədəflər"],
              ["bsc", "Balanced Scorecard"],
              ["lifecycle", "Lifecycle"],
              ["history", "Tarixçə"],
              ["team", "KPI Üzvləri"],
              ["comments", "Şərhlər"],
              ["status", "Təsdiqləmə Zənciri"],
              ["setStatus", "Set Statusu"],
              ["review", "Review"],
            ] as [DrawerTab, string][])
              .filter(([key]) => !tabsFilter || tabsFilter.includes(key))
              .map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key as DrawerTab)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "general" && (
            <div className="rounded-xl border border-border p-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <MetaRow label="Ölçü vahidi" value={kpi.measure} />
              <MetaRow label="Hədəf tipi" value={kpi.type} />
              <MetaRow label="Hesablama üsulu" value={kpi.method} />
              <MetaRow label="Çəki" value={`${kpi.weight}%`} />
              <MetaRow label="Cari nəticə" value={`${fmt(kpi.actual)} / ${fmt(kpi.target)}`} />
              <MetaRow label="Qalan hədəf" value={`${fmt(Math.max(kpi.target - kpi.actual, 0))} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
              <MetaRow label="Növbəti icmal" value="05.06.2025" />
              <MetaRow label="Trend" value={p >= 100 ? "Tamamlanıb" : "Artan (↑) daha yaxşıdır"} />
            </div>
          )}

          {tab === "bsc" && (
            <div className="rounded-xl border border-border p-4">
              <div className="text-sm font-semibold text-foreground mb-2">Balanced Scorecard</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetaRow label="Perspektiv" value="Maliyyə" />
                <MetaRow label="Strateji hədəf" value={kpi.name} />
                <MetaRow label="Ölçü (KPI)" value={`${kpi.measure}`} />
                <MetaRow label="Hədəf dəyəri" value={`${fmt(kpi.target)} ${kpi.unit}`} />
                <MetaRow label="Cari nəticə" value={`${fmt(kpi.actual)} ${kpi.unit}`} />
                <MetaRow label="İcra faizi" value={`${p}%`} />
              </div>
            </div>
          )}

          {tab === "lifecycle" && (
            <ol className="relative border-l border-border pl-4 space-y-4">
              {[
                { name: "Planlama", date: kpi.createdAt, done: true },
                { name: "Təsdiqləmə", date: kpi.createdAt, done: true },
                { name: "İcra", date: kpi.updatedAt, done: p < 100 },
                { name: "Qiymətləndirmə", date: kpi.deadline, done: p >= 100 },
              ].map((s, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${s.done ? "bg-emerald-500 ring-emerald-500/15" : "bg-muted ring-muted"}`} />
                  <div className="text-sm font-medium text-foreground">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{s.date}</div>
                </li>
              ))}
            </ol>
          )}

          {tab === "history" && (
            <ol className="relative border-l border-border pl-4 space-y-4">
              {history.map(h => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                  <div className="text-[11px] text-muted-foreground">{h.date} {h.time}</div>
                  <div className="text-sm font-medium text-foreground">{h.author}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.field}: <span className="text-foreground">{h.from}</span> → <span className="text-primary font-medium">{h.to}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {tab === "team" && (
            <div className="space-y-2">
              {[
                { name: kpi.responsible.name, role: kpi.responsible.role, tag: "Məsul" },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                    {m.name.split(" ").map(x => x[0]).join("").slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.role}</div>
                  </div>
                  <Badge className="bg-secondary text-secondary-foreground">{m.tag}</Badge>
                </div>
              ))}
            </div>
          )}

          {tab === "comments" && (
            <KpiCommentThread refId={`card:${kpi.id}`} />
          )}


          {tab === "status" && (
            <ol className="space-y-2">
              {([
                { role: kpi.responsible.role, name: kpi.responsible.name, state: "wait" as const },
              ] as { role: string; name: string; state: "ok" | "wait" }[]).map((r, i) => (
                <li key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${r.state === "ok" ? "border-emerald-500/30 bg-emerald-500/10" : "border-blue-500/30 bg-blue-500/10"}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{i + 1}. {r.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.role}</div>
                  </div>
                  <span className="text-xs font-medium shrink-0 ml-2">{r.state === "ok" ? "Təsdiqləndi" : "Gözlənilir"}</span>
                </li>
              ))}
            </ol>
          )}

          {tab === "setStatus" && (
            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cari set statusu</span>
                <Badge className={statusMeta[kpi.status].cls}>{statusMeta[kpi.status].label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">İcra faizi</span>
                <span className="text-sm font-medium tabular-nums">{p}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Deadline</span>
                <span className="text-sm">{kpi.deadline}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Son yenilənmə</span>
                <span className="text-sm">{kpi.updatedAt}</span>
              </div>
            </div>
          )}

          {tab === "targets" && (() => {
            const targets = buildCardTargets(kpi);
            return (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Hədəf</th>
                      <th className="text-right px-3 py-2 font-medium">Plan</th>
                      <th className="text-right px-3 py-2 font-medium">Fakt</th>
                      <th className="text-left px-3 py-2 font-medium w-24">İcra %</th>
                      <th className="text-center px-3 py-2 font-medium">Status</th>
                      {onOpenTarget && <th className="text-right px-3 py-2 font-medium w-12">Bax</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map(t => {
                      const pct = safePct(t.fakt, t.plan);
                      const bar = pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";
                      return (
                        <tr key={t.id} className="border-t border-border align-top hover:bg-secondary/20">
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-foreground">{t.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Çəki: {t.weight}%</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmt(t.plan)} {t.unit}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{fmt(t.fakt)} {t.unit}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div className={`h-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="tabular-nums font-medium w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge className={`${statusMeta[t.status].cls} text-[10px] px-1.5 py-0.5`}>{statusMeta[t.status].label}</Badge>
                          </td>
                          {onOpenTarget && (
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => onOpenTarget(t)} className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" aria-label="Bax" title="Hədəf detalı">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {tab === "review" && (() => {
            const targets = buildCardTargets(kpi);
            const completed = targets.filter(t => t.status === "achieved").length;
            const atRisk = targets.filter(t => t.status === "not_achieved").length;
            const avgProg = targets.length ? Math.round(targets.reduce((s, t) => s + safePct(t.fakt, t.plan), 0) / targets.length) : 0;
            return (
              <div className="space-y-4">
                {/* Review Status */}
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold text-foreground mb-3">Review Statusu</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <MetaRow label="Status" value={<Badge className={reviewMeta?.reviewStatusClass || "bg-sky-500/15 text-sky-700"}>{reviewMeta?.reviewStatusLabel || "İcrada"}</Badge>} />
                    <MetaRow label="Review növü" value={reviewMeta?.reviewLabel || "Həftəlik Review"} />
                    <MetaRow label="Review #" value={reviewMeta?.reviewNumber ?? 2} />
                    <MetaRow label="Plan tarixi" value={reviewMeta?.reviewStart || kpi.deadline} />
                    <MetaRow label="Son yenilənmə" value={kpi.updatedAt} />
                    <MetaRow label="Qiymətləndirici" value={reviewMeta?.evaluator || kpi.responsible.name} />
                    <MetaRow label="Qiymətləndirilən əməkdaş" value={kpi.responsible.name} />
                  </div>
                </div>

                {/* Review Xülasəsi */}
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Review Xülasəsi</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <SummaryStat label="Ortalama Progress" value={`${avgProg}%`} tone="indigo" />
                    <SummaryStat label="Hədəfə çatan KPI" value={`${completed} / ${targets.length}`} tone="green" />
                    <SummaryStat label="Hədəfə çatmayan KPI" value={`${atRisk}`} tone="red" />
                    <SummaryStat label="Son qiymətləndirmə" value="—" tone="amber" />
                    <SummaryStat label="Növbəti Review" value={reviewMeta?.nextReview || "—"} tone="blue" />
                  </div>
                </div>

                {/* Hədəflərin Review vəziyyəti */}
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Hədəflərin Review vəziyyəti</div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/40 text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">KPI / Hədəf</th>
                          <th className="text-left px-3 py-2 font-medium w-24">Progress</th>
                          <th className="text-center px-3 py-2 font-medium">Status</th>
                          <th className="text-right px-3 py-2 font-medium">Son nəticə</th>
                          <th className="text-left px-3 py-2 font-medium">Review qeydi</th>
                          {onOpenTarget && <th className="text-right px-3 py-2 font-medium w-12">Bax</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {targets.map((t, i) => {
                          const pct = safePct(t.fakt, t.plan);
                          const bar = pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";
                          return (
                            <tr key={t.id} className="border-t border-border hover:bg-secondary/20">
                              <td className="px-3 py-2.5 font-medium text-foreground">{t.name}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div className={`h-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className="tabular-nums font-medium w-8 text-right">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge className={`${statusMeta[t.status].cls} text-[10px] px-1.5 py-0.5`}>{statusMeta[t.status].label}</Badge>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{(pct / 20).toFixed(1)} / 5</td>
                              <td className="px-3 py-2.5 text-muted-foreground">—</td>
                              {onOpenTarget && (
                                <td className="px-3 py-2.5 text-right">
                                  <button onClick={() => onOpenTarget(t)} className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" aria-label="Bax" title="Hədəf detalı">
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      )}
    </aside>
  );
};

const MetaRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="text-sm text-foreground mt-0.5">{value}</div>
  </div>
);

const SummaryStat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone: "indigo" | "green" | "red" | "amber" | "blue" }) => {
  const map = {
    indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    green:  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    red:    "bg-rose-500/10 text-rose-600 border-rose-500/20",
    amber:  "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blue:   "bg-sky-500/10 text-sky-600 border-sky-500/20",
  } as const;
  return (
    <div className={`rounded-lg border p-2.5 ${map[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
};

// ============================================================
// SUBORDINATES VIEW — Dynamic tree from real org data
// ============================================================
type SubTab = "info" | "history" | "comments" | "reminders" | "notify" | "risk";
type NodeKind = "company" | "region" | "department" | "division" | "team" | "employee";

interface TreeNode {
  id: string;
  name: string;
  kind: NodeKind;
  parent?: string;
  employees: number;
  avgPct: number;
  completed: number;
  notAchieved: number;
  trend: "up" | "down" | "flat";
  position?: string;
  team?: string;
  division?: string;
  status?: KpiStatus;
  empId?: number;
  riskReasons?: string[];
  managerNote?: string;
}

const kindIcon: Record<NodeKind, any> = {
  company: Building2, region: MapPin, department: Layers, division: Layers, team: Users, employee: User,
};
const kindLabel: Record<NodeKind, string> = {
  company: "Şirkət", region: "Region", department: "Departament", division: "Şöbə", team: "Komanda", employee: "Əməkdaş",
};

const hashStr = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
};

const buildOrgTree = (scopePath?: string | null): TreeNode[] => {
  const emps = getEmployees().filter(e => e.active);
  const structs = getStructures();

  const empByPath = new Map<string, typeof emps>();
  emps.forEach(e => {
    const p = e.structurePath ?? "";
    if (!empByPath.has(p)) empByPath.set(p, []);
    empByPath.get(p)!.push(e);
  });

  const nodes: TreeNode[] = [];

    const makeEmp = (e: (typeof emps)[number], parentId: string, pathLabel: string): TreeNode => {
    const realCards = getRealKpiCardsForEmployee(e.id);
    const targets = realCards.flatMap(c => c.targets || []);
    const avgPct = targets.length
      ? Math.round(targets.reduce((sum, t) => sum + (t.plan ? safePct(t.fakt, t.plan) : 0), 0) / targets.length)
      : 0;
    return {
      id: `e${e.id}`, empId: e.id, kind: "employee", parent: parentId,
      name: `${e.firstName} ${e.lastName}`,
      position: e.positionName ?? "Əməkdaş",
      team: pathLabel.split(" › ").slice(-1)[0] || "—",
      division: pathLabel || "—",
      employees: 1,
      avgPct,
      completed: targets.filter(t => normalizeTargetStatus(t.status) === "achieved").length,
      notAchieved: targets.filter(t => normalizeTargetStatus(t.status) === "not_achieved").length,
      trend: "flat",
      status: avgPct >= 100 ? "achieved" : "in_progress",
    };
  };

  const countSub = (s: OrgStructure, path: string): number => {
    let c = (empByPath.get(path) ?? []).length;
    s.children.forEach(ch => { c += countSub(ch, `${path} › ${ch.name}`); });
    return c;
  };

  const walk = (s: OrgStructure, parentPath: string, parentId: string) => {
    const path = parentPath ? `${parentPath} › ${s.name}` : s.name;
    const id = `s${s.id}`;
    const t = s.type.toLowerCase();
    const kind: NodeKind = t.includes("depart") ? "department"
      : (t.includes("komanda") || t.includes("team")) ? "team"
      : "division";
    const empCount = countSub(s, path);
    nodes.push({
      id, name: s.name, kind, parent: parentId || undefined,
      employees: empCount,
      avgPct: 0,
      completed: 0,
      notAchieved: 0,
      trend: "flat",
    });
    // Employees first (direct), then sub-structures
    (empByPath.get(path) ?? []).forEach(e => nodes.push(makeEmp(e, id, path)));
    s.children.forEach(ch => walk(ch, path, id));
  };

  // Manager scope: root the tree at the manager's own structure unit
  if (scopePath) {
    let target: OrgStructure | null = null;
    const search = (list: OrgStructure[], parentArr: string[]) => {
      for (const n of list) {
        if (target) return;
        const cur = [...parentArr, n.name];
        if (cur.join(" › ") === scopePath) { target = n; return; }
        if (n.children.length) search(n.children, cur);
      }
    };
    search(structs, []);
    if (target) {
      const parentPath = scopePath.split(" › ").slice(0, -1).join(" › ");
      walk(target, parentPath, "");
      return nodes;
    }
    // scope path not found → return empty
    return nodes;
  }

  const rootId = "all";
  const rootEmpCount = emps.length;
  nodes.push({
    id: rootId, name: "Bütün şirkət", kind: "company",
    employees: rootEmpCount,
    avgPct: 0,
    completed: 0,
    notAchieved: 0,
    trend: "flat",
  });
  (empByPath.get("") ?? []).forEach(e => nodes.push(makeEmp(e, rootId, "Bütün şirkət")));
  structs.forEach(s => walk(s, "", rootId));
  return nodes;
};


// Per-employee KPI list (deterministic subset of MY_KPIS variants)
interface EmpKpi { id: string; name: string; desc: string; plan: number; fakt: number; unit: string; status: KpiStatus; }
const BASE_KPIS: Omit<EmpKpi, "id" | "fakt" | "status">[] = [];
const buildEmpKpis = (_empId: number): EmpKpi[] => [];

interface SubordinatesViewProps {
  scopePath?: string | null;
  actionsMode?: "tracking" | "results";
  onOpenEmployee?: (empId: number, name: string) => void;
  title?: string;
  subtitle?: string;
}

export const SubordinatesView = ({
  scopePath,
  actionsMode = "tracking",
  onOpenEmployee,
  title = "Tabeçiliyimdəkilərin KPI-ları",
  subtitle = "Əsas səhifə / KPI İzlənməsi / Tabeçiliyimdəkilərin KPI-ları",
}: SubordinatesViewProps = {}) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick(t => t + 1);
    window.addEventListener("org-updated", h);
    return () => window.removeEventListener("org-updated", h);
  }, []);
  const tree = useMemo(() => buildOrgTree(scopePath), [tick, scopePath]);

  const childrenOf = (id: string) => tree.filter(n => n.parent === id);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<SubTab>("info");
  const [period, setPeriod] = useState("2025 / 1-ci rüb");
  const [metric, setMetric] = useState("avg");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [empKpiListFor, setEmpKpiListFor] = useState<{ empId: number; name: string; position?: string; division?: string } | null>(null);
  const [viewKpi, setViewKpi] = useState<Kpi | null>(null);
  const [viewKpiTab, setViewKpiTab] = useState<DrawerTab>("general");
  const [cardDrawer, setCardDrawer] = useState<{ card: Kpi & { progress: number; createdAt: string; updatedAt: string }; employee: { empId: number; name: string; position?: string; division?: string } } | null>(null);
  const [targetDetail, setTargetDetail] = useState<{ cardId: string; cardName: string; target: CardTarget } | null>(null);

  // Deterministic period/date helpers for the employee's KPI card list
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const dateFromHash = (h: number, base = 2025) => {
    const day = 1 + (Math.abs(h) % 28);
    const mo = 1 + (Math.abs(h >> 3) % 12);
    return `${pad2(day)}.${pad2(mo)}.${base}`;
  };
  const PERIODS = ["2025 / 1-ci rüb", "2025 / 2-ci rüb", "2025 / 3-cü rüb", "2025 / 4-cü rüb"];
  const empKpiCards = useMemo(() => {
    if (!empKpiListFor) return [] as (Kpi & { progress: number; createdAt: string; updatedAt: string })[];
    return getRealKpiCardsForEmployee(empKpiListFor.empId).map(c => {
      const plan = c.targets.reduce((s, t) => s + t.plan, 0);
      const fakt = c.targets.reduce((s, t) => s + t.fakt, 0);
      const pct = plan ? Math.round((fakt / plan) * 100) : 0;
      const kpi: Kpi = {
        id: c.id, name: c.name, description: "", period: c.frequency || "—",
        target: plan, actual: fakt, unit: c.targets[0]?.unit || "", stage: "assigned",
        status: "in_progress", deadline: c.deadline, createdAt: c.createdAt, updatedAt: c.createdAt,
        responsible: { name: empKpiListFor.name, role: empKpiListFor.position || "Əməkdaş" },
        measure: c.targets[0]?.unit || "—", type: c.frequency || "—", method: "—", weight: 0,
        realTargets: c.targets.map(t => ({ ...t, status: "in_progress" as KpiStatus })),
      };
      return { ...kpi, progress: Math.min(pct, 100), createdAt: c.createdAt, updatedAt: c.createdAt };
    });
  }, [empKpiListFor]);


  const selected = selectedId ? tree.find(n => n.id === selectedId) ?? null : null;

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const openTab = (nodeId: string, t: SubTab) => {
    setSelectedId(nodeId);
    setTab(t);
    setPanelOpen(true);
    setOpenMenu(null);
  };

  // Flatten visible rows respecting expand state + search filter, employees first
  const rows = useMemo(() => {
    const out: { node: TreeNode; depth: number }[] = [];
    const s = q.trim().toLowerCase();
    const sortChildren = (arr: TreeNode[]) => {
      const emp = arr.filter(n => n.kind === "employee");
      const rest = arr.filter(n => n.kind !== "employee");
      return [...emp, ...rest];
    };
    const walk = (parentId: string | undefined, depth: number) => {
      sortChildren(tree.filter(n => n.parent === parentId)).forEach(n => {
        const match = !s || n.name.toLowerCase().includes(s);
        if (match) out.push({ node: n, depth });
        if (expanded.has(n.id)) walk(n.id, depth + 1);
      });
    };
    tree.filter(n => !n.parent).forEach(root => {
      out.push({ node: root, depth: 0 });
      if (expanded.has(root.id)) walk(root.id, 1);
    });
    return out;
  }, [expanded, q, tree]);

  const totals = useMemo(() => {
    const rootFull = tree.find(n => n.id === "all");
    if (rootFull) return rootFull;
    // Scoped tree: aggregate top-level roots
    const roots = tree.filter(n => !n.parent);
    const sum = (k: keyof TreeNode) => roots.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const employees = sum("employees");
    const completed = sum("completed");
    const notAchieved = sum("notAchieved");
    const avgPct = roots.length ? Math.round(roots.reduce((a, r) => a + r.avgPct, 0) / roots.length) : 0;
    return { employees, avgPct, completed, notAchieved } as TreeNode;
  }, [tree]);
  const deptCount = tree.filter(n => n.kind === "department").length;


  return (
    <div className="flex gap-4">
      {/* LEFT */}
      <div className={`flex-1 min-w-0 ${panelOpen && selected ? "lg:pr-2" : ""}`}>
        <PageHero
          badge="Rəhbər Paneli"
          icon={Network}
          title={title}
          subtitle={subtitle}
        />


        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <SumCard icon={MapPin} label="Əhatə dairəsi" primary={`${deptCount} Departament`} secondary={`${tree.filter(n => n.kind === "division").length} Şöbə`} tone="indigo" />
          <SumCard icon={Users} label="Ümumi əməkdaş" primary={fmt(totals.employees)} tone="violet" />
          <SumCard icon={LineChart} label="Ortalama icra faizi" primary={`${totals.avgPct}%`} tone="blue" />
          <SumCard icon={Check} label="Hədəfə çatan KPI" primary={fmt(totals.completed)} tone="green" />
          <SumCard icon={AlertTriangle} label="Hədəfə çatmayan KPI" primary={fmt(totals.notAchieved)} tone="red" />
        </div>

        {/* Filter row */}
        <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-[11px] text-muted-foreground">Dövr</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-44 h-9 mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025 / 1-ci rüb">2025 / 1-ci rüb</SelectItem>
                <SelectItem value="2025 / 2-ci rüb">2025 / 2-ci rüb</SelectItem>
                <SelectItem value="2025 / il">2025 / il</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>

            <label className="text-[11px] text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 h-9 mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün statuslar</SelectItem>
                <SelectItem value="in_progress">İcrada</SelectItem>
                <SelectItem value="achieved">Hədəfə çatıb</SelectItem>
                <SelectItem value="not_achieved">Hədəfə çatmayıb</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Axtarış..."
              className="w-56 pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          </div>

        {/* Tree grid */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Səviyyə</th>
                  <th className="text-right px-4 py-3 font-medium">Əhatə dairəsi</th>
                  <th className="text-left px-4 py-3 font-medium w-56">Ortalama icra faizi</th>
                  <th className="text-center px-4 py-3 font-medium">Hədəfə çatan KPI</th>
                  <th className="text-center px-4 py-3 font-medium">Hədəfə çatmayan KPI</th>
                  <th className="text-center px-4 py-3 font-medium">Trend</th>
                  <th className="text-right px-4 py-3 font-medium w-24">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ node, depth }) => {
                  const Icon = kindIcon[node.kind];
                  const hasChildren = childrenOf(node.id).length > 0;
                  const isOpen = expanded.has(node.id);
                  const isSel = node.id === selectedId;
                  const isEmp = node.kind === "employee";
                  return (
                    <tr key={node.id}
                      onClick={() => !isEmp && hasChildren && toggle(node.id)}
                      className={`border-t border-border transition-colors ${isSel ? "bg-primary/5" : "hover:bg-secondary/20"} ${(!isEmp && hasChildren) ? "cursor-pointer" : ""}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5" style={{ paddingLeft: `${depth * 20}px` }}>
                          {hasChildren ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
                              className="w-5 h-5 rounded hover:bg-secondary inline-flex items-center justify-center text-muted-foreground transition-transform"
                              aria-label="Aç/bağla"
                            >
                              <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                          ) : <span className="w-5" />}
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center border ${isEmp ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary/60 border-border text-muted-foreground"}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{node.name}</div>
                            {isEmp && <div className="text-[11px] text-muted-foreground truncate">{node.position}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{isEmp ? "—" : fmt(node.employees)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${node.avgPct >= 90 ? "bg-emerald-500" : node.avgPct >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
                              style={{ width: `${Math.min(node.avgPct, 100)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums font-medium w-9 text-right">{node.avgPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{fmt(node.completed)}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-rose-600">{fmt(node.notAchieved)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {node.trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500 inline" />}
                        {node.trend === "down" && <TrendingDown className="w-4 h-4 text-rose-500 inline" />}
                        {node.trend === "flat" && <Minus className="w-4 h-4 text-muted-foreground inline" />}
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        {isEmp ? (
                          actionsMode === "results" ? (
                            <button
                              onClick={() => { if (node.empId != null) onOpenEmployee?.(node.empId, node.name); }}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Nəticələrə bax"
                              title="Nəticələrə bax"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => { if (node.empId != null) setEmpKpiListFor({ empId: node.empId, name: node.name, position: node.position, division: node.division }); }}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="KPI-yə bax"
                              title="KPI-yə bax"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>Cəmi: {fmt(totals.employees)} əməkdaş, {fmt(totals.completed + totals.notAchieved)} KPI</span>
            <span>Səhifə 1 / 1</span>
          </div>
        </div>
      </div>

      {/* RIGHT: sticky panel (yalnız tracking rejimində) */}
      {actionsMode === "tracking" && panelOpen && selected && (
        <SubDetailPanel node={selected} tab={tab} setTab={setTab} onClose={() => setPanelOpen(false)} />
      )}
      {actionsMode === "tracking" && !panelOpen && selected && (
        <button onClick={() => setPanelOpen(true)}
          className="fixed right-4 top-24 z-30 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2 text-sm font-medium inline-flex items-center gap-1.5 hover:opacity-90">
          <ChevronLeft className="w-4 h-4" /> Detal paneli
        </button>
      )}

      {/* Əməkdaşın KPI kartları siyahısı — Nəticələr modulu ilə eyni sadə cədvəl */}
      <Dialog open={!!empKpiListFor} onOpenChange={(o) => { if (!o) { setEmpKpiListFor(null); } }}>
        <DialogContent className="w-[90vw] max-w-[1200px] h-[80vh] max-h-[80vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle className="text-xl">KPI Kartları — {empKpiListFor?.name ?? "—"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">KPI kartının adı</th>
                    <th className="text-left px-4 py-3 font-medium">Dövr</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium w-44">Progress</th>
                    <th className="text-left px-4 py-3 font-medium">Yaradılma tarixi</th>
                    <th className="text-left px-4 py-3 font-medium">Son yenilənmə tarixi</th>
                    <th className="text-right px-4 py-3 font-medium w-24">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {empKpiCards.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">Bu əməkdaş üçün KPI kartı yoxdur.</td></tr>
                  ) : empKpiCards.map(k => (
                    <tr key={k.id} className="border-t border-border hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{withKartSuffix(k.name)}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{k.description}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{k.period}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={statusMeta[k.status].cls}>{statusMeta[k.status].label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={k.progress} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums font-medium w-9 text-right">{k.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{k.createdAt}</td>
                      <td className="px-4 py-3 text-muted-foreground">{k.updatedAt}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (!empKpiListFor) return;
                            setCardDrawer({ card: k, employee: empKpiListFor });
                            setEmpKpiListFor(null);
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Bax"
                          title="Bax"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KPI Detail — mövcud KpiDrawer komponenti reuse edilir */}
      <KpiDrawer kpi={viewKpi} tab={viewKpiTab} setTab={setViewKpiTab} onClose={() => setViewKpi(null)} />

      {/* Kartın hədəfləri drawer */}
      <CardTargetsDrawer
        data={cardDrawer}
        onClose={() => setCardDrawer(null)}
        onOpenTarget={(t) => cardDrawer && setTargetDetail({ cardId: cardDrawer.card.id, cardName: cardDrawer.card.name, target: t })}
      />

      {/* Hədəf tarixçəsi drawer (nested) */}
      <TargetDetailDrawer data={targetDetail} onClose={() => setTargetDetail(null)} />

    </div>
  );
};

const SumCard = ({ icon: Icon, label, primary, secondary, tone }: {
  icon: any; label: string; primary: string; secondary?: string; tone: "indigo" | "violet" | "blue" | "green" | "amber" | "red";
}) => {
  const map = {
    indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    blue:   "bg-sky-500/10 text-sky-600 border-sky-500/20",
    green:  "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber:  "bg-amber-500/10 text-amber-600 border-amber-500/20",
    red:    "bg-rose-500/10 text-rose-600 border-rose-500/20",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${map}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-semibold text-foreground tabular-nums leading-tight">{primary}</div>
        {secondary && <div className="text-[11px] text-muted-foreground truncate">{secondary}</div>}
      </div>
    </div>
  );
};

// ============================================================
// SUB DETAIL PANEL
// ============================================================
const subTabLabels: Record<SubTab, string> = {
  info: "İcra məlumatı", history: "İcra tarixçəsi", comments: "Şərhlər",
  reminders: "Xatırlatmalar", notify: "Bildiriş göndər", risk: "Risk səbəbi",
};

const SubDetailPanel = ({ node, tab, setTab, onClose }: {
  node: TreeNode; tab: SubTab; setTab: (t: SubTab) => void; onClose: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyPri, setNotifyPri] = useState("normal");

  const history = initialHistory(node.id);
  const reminders = initialReminders(node.id);

  const empKpis = useMemo<EmpKpi[]>(() => {
    if (!node.empId) return [];
    return getRealKpiCardsForEmployee(node.empId).flatMap(c =>
      c.targets.map(t => ({
        id: t.id,
        name: `${c.name} — ${t.name}`,
        desc: t.unit ? `Ölçü vahidi: ${t.unit}` : "",
        plan: t.plan,
        fakt: t.fakt,
        unit: t.unit || "",
        status: "in_progress" as KpiStatus,
      })),
    );
  }, [node.empId]);




  const sendNotify = () => {
    if (!notifyTitle.trim() || !notifyMsg.trim()) { toast({ title: "Başlıq və mesaj tələb olunur", variant: "destructive" }); return; }
    toast({ title: "Bildiriş göndərildi", description: `${node.name} → ${notifyTitle} (${notifyPri})` });
    setNotifyTitle(""); setNotifyMsg(""); setNotifyPri("normal");
  };

  const isEmp = node.kind === "employee";
  const stampBadge = node.status ? statusMeta[node.status] : { label: kindLabel[node.kind], cls: "bg-secondary text-secondary-foreground" };

  const riskLevel = node.notAchieved > 0 ? "high" : "low";
  const riskColor = riskLevel === "high" ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  const riskLabel = riskLevel === "high" ? "Yüksək" : "Aşağı";

  return (
    <aside className="hidden lg:flex sticky top-4 h-[calc(100vh-2rem)] w-[440px] shrink-0 flex-col rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{subTabLabels[tab]}</h3>
        <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {/* Person header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center text-sm shrink-0">
              {node.name.split(" ").map(x => x[0]).join("").slice(0,2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">{node.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {isEmp ? `${node.position} · ${node.division}` : kindLabel[node.kind]}
              </div>
            </div>
            <Badge className={stampBadge.cls}>{stampBadge.label}</Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
            <TabsList className="w-full grid grid-cols-4 mb-3">
              <TabsTrigger value="info" className="text-xs">İcra məlumatı</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">Tarixçə</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">Şərhlər</TabsTrigger>
              <TabsTrigger value="reminders" className="text-xs">Xatırlat.</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border bg-secondary/30">
                  <div className="text-sm font-semibold text-foreground">KPI-ların siyahısı</div>
                </div>
                {isEmp && empKpis.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/20 text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">KPI</th>
                          <th className="text-right px-3 py-2 font-medium">Plan</th>
                          <th className="text-right px-3 py-2 font-medium">Fakt</th>
                          <th className="text-left px-3 py-2 font-medium w-24">İcra %</th>
                          <th className="text-center px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empKpis.map(k => {
                          const pct = safePct(k.fakt, k.plan);
                          const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";
                          return (
                            <tr key={k.id} className="border-t border-border align-top">
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-foreground">{withKartSuffix(k.name)}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{k.desc}</div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(k.plan)} {k.unit}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">{fmt(k.fakt)} {k.unit}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div className={`h-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className="tabular-nums font-medium w-8 text-right">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge className={`${statusMeta[k.status].cls} text-[10px] px-1.5 py-0.5`}>{statusMeta[k.status].label}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                ) : (
                  <div className="p-4 text-xs text-muted-foreground text-center">Bu səviyyə üçün KPI siyahısı yalnız əməkdaş səviyyəsində göstərilir.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <ol className="relative border-l-2 border-border pl-4 space-y-4">
                {history.map(h => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[9px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
                    <div className="text-[11px] text-muted-foreground">{h.date} {h.time}</div>
                    <div className="text-sm font-medium text-foreground">{h.author}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.field}: <span className="text-foreground">{h.from}</span> → <span className="text-primary font-medium">{h.to}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </TabsContent>

            <TabsContent value="comments">
              <KpiCommentThread refId={`node:${node.id}`} />
            </TabsContent>


            <TabsContent value="reminders">
              <ol className="relative border-l-2 border-border pl-4 space-y-4">
                {reminders.map(r => (
                  <li key={r.id} className="relative">
                    <span className={`absolute -left-[9px] top-1 w-3 h-3 rounded-full ring-4 ${r.read ? "bg-emerald-500 ring-emerald-500/15" : "bg-amber-500 ring-amber-500/15"}`} />
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-muted-foreground">{r.date} {r.time}</div>
                        <div className="text-sm font-medium text-foreground">{r.author}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{r.text}</div>
                      </div>
                      <Badge className={r.read ? "bg-zone-green-bg text-zone-green-text hover:bg-zone-green-bg" : "bg-zone-yellow-bg text-zone-yellow-text hover:bg-zone-yellow-bg"}>
                        {r.read ? "Oxundu" : "Oxunmayıb"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-muted-foreground border-t border-border pt-2">Yalnız rəhbər tərəfindən göndərilən xatırlatmalar göstərilir.</p>
            </TabsContent>
          </Tabs>

          {tab === "notify" && (
            <div className="mt-3 rounded-lg border border-border p-3 space-y-3">
              <div className="text-xs font-semibold text-foreground">Bildiriş göndər — {node.name}</div>
              <div>
                <label className="text-[11px] text-muted-foreground">Başlıq</label>
                <input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="Məs: KPI yeniləməsi tələb olunur"
                  className="w-full mt-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Mesaj</label>
                <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} rows={4} placeholder="Mesaj mətni..."
                  className="w-full mt-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Prioritet</label>
                <div className="flex gap-1.5 mt-1">
                  {[["normal", "Normal"], ["important", "Vacib"], ["urgent", "Təcili"]].map(([v, l]) => (
                    <button key={v} onClick={() => setNotifyPri(v)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${notifyPri === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">Alıcı: <span className="text-foreground font-medium">{node.name}</span></div>
              <Button onClick={sendNotify} className="w-full gap-1.5"><Send className="w-3.5 h-3.5" /> Göndər</Button>
            </div>
          )}

          {tab === "risk" && (
            <div className="mt-3 space-y-3">
              <div className={`rounded-lg border p-3 ${riskColor}`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <div className="text-xs font-semibold">Risk səviyyəsi: {riskLabel}</div>
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-foreground mb-2">Risk səbəbləri</div>
                <ul className="space-y-1.5 text-sm">
                  {(node.riskReasons ?? ["Deadline gecikməsi", "Plan geriliyi", "Məlumat daxil edilməyib"]).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs font-semibold text-foreground mb-1">Rəhbər qeydi</div>
                <p className="text-sm text-muted-foreground">{node.managerNote ?? "Rəhbər qeydi qeyd edilməyib."}</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <TargetIcon className="w-3.5 h-3.5 text-primary" /> Tövsiyə olunan tədbirlər
                </div>
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" /> Həftəlik status görüşü təyin et</li>
                  <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" /> Plan-fakt fərqinə görə qısamüddətli tədbir planı</li>
                  <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-primary mt-1 shrink-0" /> Əlavə resurs və ya mentorluq təyin et</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

// ============================================================
// CARD TARGETS DRAWER — Bir KPI kartına aid hədəflər siyahısı
// ============================================================
interface CardTarget {
  id: string;
  name: string;
  plan: number;
  fakt: number;
  unit: string;
  weight: number;
  status: KpiStatus;
}

const buildCardTargets = (card: Kpi | string, planTotal = 0, unit = ""): CardTarget[] => {
  if (typeof card !== "string") {
    if (card.realTargets?.length) return card.realTargets;
    if (!card.target && !card.actual) return [];
    return [{ id: `${card.id}-target`, name: card.method || card.name, plan: card.target, fakt: card.actual, unit: card.unit, weight: card.weight || 100, status: card.status }];
  }
  if (!planTotal) return [];
  return [{ id: `${card}-target`, name: "Hədəf", plan: planTotal, fakt: 0, unit, weight: 100, status: "in_progress" }];
};

const CardTargetsDrawer = ({ data, onClose, onOpenTarget }: {
  data: { card: Kpi & { progress: number; createdAt: string; updatedAt: string }; employee: { empId: number; name: string; position?: string; division?: string } } | null;
  onClose: () => void;
  onOpenTarget: (t: CardTarget) => void;
}) => {
  if (!data) return null;
  const { card, employee } = data;
  const targets = buildCardTargets(card);
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30 animate-in fade-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-full sm:w-[640px] bg-card border-l border-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{withKartSuffix(card.name)}</h3>
            <p className="text-xs text-muted-foreground truncate">{employee.name} · {employee.position || "—"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Card meta */}
          <div className="rounded-xl border border-border bg-background p-4 mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <MetaRow label="Dövr" value={card.period} />
            <MetaRow label="Status" value={<Badge className={statusMeta[card.status].cls}>{statusMeta[card.status].label}</Badge>} />
            <MetaRow label="Departament / Şöbə" value={employee.division || "—"} />
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Ümumi icra</div>
              <div className="flex items-center gap-2">
                <Progress value={Math.min(card.progress, 100)} className="h-1.5 flex-1" />
                <span className="text-xs font-medium tabular-nums">{card.progress}%</span>
              </div>
            </div>
          </div>

          {/* Targets list */}
          <div className="text-sm font-semibold text-foreground mb-2">Hədəflər</div>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Hədəf</th>
                  <th className="text-right px-3 py-2 font-medium">Plan</th>
                  <th className="text-right px-3 py-2 font-medium">Fakt</th>
                  <th className="text-left px-3 py-2 font-medium w-24">İcra %</th>
                  <th className="text-center px-3 py-2 font-medium">Status</th>
                  <th className="text-right px-3 py-2 font-medium w-12">Bax</th>
                </tr>
              </thead>
              <tbody>
                {targets.map(t => {
                  const pct = safePct(t.fakt, t.plan);
                  const bar = pct >= 100 ? "bg-emerald-500" : pct >= 90 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <tr key={t.id} className="border-t border-border align-top hover:bg-secondary/20">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Çəki: {t.weight}%</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(t.plan)} {t.unit}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(t.fakt)} {t.unit}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full ${bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="tabular-nums font-medium w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge className={`${statusMeta[t.status].cls} text-[10px] px-1.5 py-0.5`}>{statusMeta[t.status].label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => onOpenTarget(t)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Hədəfə bax"
                          title="Tarixçə, şərhlər, xatırlatmalar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </>
  );
};

// ============================================================
// TARGET DETAIL DRAWER — Bir hədəfə aid tarixçə / şərhlər / xatırlat.
// ============================================================
type TargetDrawerTab = "general" | "execution" | "fact" | "evaluation" | "history" | "review" | "comments" | "attachments" | "performance";
const TargetDetailDrawer = ({ data, onClose, tabsFilter }: {
  data: { cardId: string; cardName: string; target: CardTarget } | null;
  onClose: () => void;
  tabsFilter?: TargetDrawerTab[];
}) => {
  const initialTab: TargetDrawerTab = (tabsFilter && tabsFilter[0]) || "general";
  const [tab, setTab] = useState<TargetDrawerTab>(initialTab);

  if (!data) return null;
  const { target, cardName } = data;
  const history = initialHistory(target.id);
  const reminders = initialReminders(target.id);
  const pct = safePct(target.fakt, target.plan);


  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80] animate-in fade-in" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-screen w-full sm:w-[520px] bg-card border-l border-border shadow-2xl z-[90] flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{target.name}</h3>
            <p className="text-[11px] text-muted-foreground truncate">{withKartSuffix(cardName)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-border grid grid-cols-4 gap-2 text-center">
          <div><div className="text-[10px] text-muted-foreground">Plan</div><div className="text-sm font-semibold tabular-nums">{fmt(target.plan)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">Fakt</div><div className="text-sm font-semibold tabular-nums">{fmt(target.fakt)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">İcra %</div><div className="text-sm font-semibold tabular-nums">{pct}%</div></div>
          <div><div className="text-[10px] text-muted-foreground">Status</div><Badge className={`${statusMeta[target.status].cls} text-[10px]`}>{statusMeta[target.status].label}</Badge></div>
        </div>

        <div className="px-4 pt-3 flex-1 overflow-hidden flex flex-col">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex flex-col flex-1 min-h-0">
            {(() => {
              const ALL_TABS: [typeof tab, string][] = [
                ["general", "Ümumi"], ["execution", "İcra"], ["fact", "Fakt"],
                ["evaluation", "Qiymət."], ["history", "Tarixçə"], ["review", "Review"],
                ["performance", "Performans"], ["attachments", "Əlavələr"],
              ];
              const visible = ALL_TABS.filter(([k]) => !tabsFilter || tabsFilter.includes(k));
              return (
                <TabsList className={`w-full grid mb-3 h-auto`} style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
                  {visible.map(([k, l]) => (
                    <TabsTrigger key={k} value={k} className="text-[10px] px-1">{l}</TabsTrigger>
                  ))}
                </TabsList>
              );
            })()}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4">

              <TabsContent value="general" className="mt-0">
                <div className="rounded-xl border border-border p-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <MetaRow label="Hədəfin adı" value={target.name} />
                  <MetaRow label="KPI kartı" value={withKartSuffix(cardName)} />
                  <MetaRow label="Status" value={<Badge className={`${statusMeta[target.status].cls} text-[10px]`}>{statusMeta[target.status].label}</Badge>} />
                  <MetaRow label="Plan" value={`${fmt(target.plan)} ${target.unit}`} />
                  <MetaRow label="Fakt" value={`${fmt(target.fakt)} ${target.unit}`} />
                  <MetaRow label="Cari nəticə" value={`${pct}%`} />
                  <MetaRow label="Progress" value={<div className="flex items-center gap-1.5"><div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} /></div><span className="tabular-nums">{pct}%</span></div>} />
                  <MetaRow label="Çəki" value={`${target.weight}%`} />
                  <MetaRow label="Son qiymətləndirmə" value={`${(pct / 20).toFixed(1)} / 5`} />
                </div>
              </TabsContent>

              <TabsContent value="execution" className="mt-0">
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <MetaRow label="İcra vəziyyəti" value="Davam edir" />
                  <MetaRow label="Başlanma tarixi" value={history[0]?.date || "—"} />
                  <MetaRow label="Son yenilənmə" value={history[history.length - 1]?.date || "—"} />
                  <MetaRow label="Məsul şəxs" value="—" />
                </div>
              </TabsContent>

              <TabsContent value="fact" className="mt-0">
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Tarix</th>
                        <th className="text-right px-3 py-2 font-medium">Plan</th>
                        <th className="text-right px-3 py-2 font-medium">Fakt</th>
                        <th className="text-right px-3 py-2 font-medium">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 4).map((h, i) => {
                        const plan = Math.round(target.plan / 4);
                        const fakt = Math.round(target.fakt / (4 - i * 0.5));
                        return (
                          <tr key={h.id} className="border-t border-border">
                            <td className="px-3 py-2">{h.date}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmt(plan)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmt(fakt)}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${fakt >= plan ? "text-emerald-600" : "text-rose-600"}`}>{fakt >= plan ? "+" : ""}{fmt(fakt - plan)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="evaluation" className="mt-0">
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <MetaRow label="Qiymətləndirici" value="Rəhbər" />
                  <MetaRow label="Bal" value={`${(pct / 20).toFixed(1)} / 5`} />
                  <MetaRow label="Nəticə" value={pct >= 90 ? "Əla" : pct >= 75 ? "Yaxşı" : "Təkmilləşdirilməli"} />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <ol className="relative border-l-2 border-border pl-4 space-y-4">
                  {history.map(h => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[9px] top-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
                      <div className="text-[11px] text-muted-foreground">{h.date} {h.time}</div>
                      <div className="text-sm font-medium text-foreground">{h.author}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.field}: <span className="text-foreground">{h.from}</span> → <span className="text-primary font-medium">{h.to}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="review" className="mt-0 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-foreground mb-1.5">Review Timeline</div>
                  <ol className="relative border-l-2 border-border pl-4 space-y-3">
                    <li className="relative text-xs text-muted-foreground">Review tarixçəsi qeyd edilməyib.</li>
                  </ol>
                </div>
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <MetaRow label="Qiymətləndiricinin qeydi" value="—" />
                  <MetaRow label="Əməkdaşın cavabı" value="—" />
                  <MetaRow label="Review qərarı" value={<Badge className="bg-sky-500/15 text-sky-700">Davam edir</Badge>} />
                  <MetaRow label="Növbəti Review tarixi" value="—" />
                </div>
              </TabsContent>



              <TabsContent value="performance" className="mt-0 space-y-3">
                <div className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <MetaRow label="Cari nəticə" value={`${fmt(target.fakt)} ${target.unit}`} />
                  <MetaRow label="Hədəf" value={`${fmt(target.plan)} ${target.unit}`} />
                  <MetaRow label="İcra faizi" value={`${pct}%`} />
                  <MetaRow label="Trend" value={<span className={pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-rose-600"}>{pct >= 90 ? "▲ Yüksəliş" : pct >= 70 ? "▬ Sabit" : "▼ Enmə"}</span>} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground mb-2">Dövr üzrə dinamika</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="col-span-4 rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      Performans dinamikası qeyd edilməyib.
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-0">
                <ul className="space-y-2 text-xs">
                  <li className="px-3 py-4 rounded-lg border border-dashed border-border text-center text-muted-foreground">Əlavə fayl yoxdur.</li>
                </ul>
              </TabsContent>
            </div>
          </Tabs>


        </div>
      </aside>
    </>
  );
};


// ============================================================
// REVIEWS VIEW — Lifecycle Status = Review olan KPI kartları
// ============================================================
type ReviewRow = {
  key: string;
  cardId: number;
  reviewId: string;
  cardName: string;
  empId: number | null;
  empName: string;
  department: string;
  division: string;
  position: string;
  progress: number;
  reviewLabel: string;
  reviewStart: string;
  reviewEnd: string;
  reviewStatus: ReviewComputedStatus;
  outcomeComment?: string;
  updatedAt: string;
  execution: ExecutionStatus | null;
  targets: CardTarget[];
  /** Review-u keçirən şəxs(lər) — iştirakçılar/qiymətləndiricilər. */
  reviewers: { name: string; position: string }[];
  assignmentMode: "individual" | "bulk";

};


const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s?: string) => {
  if (!s) return "—";
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
};
const progressFromExec = (e: ExecutionStatus | null): number => {
  switch (e) {
    case "tamamlandi": return 100;
    case "icrada": return 60;
    case "gecikme": return 30;
    default: return 0;
  }
};
const execLabel: Record<ExecutionStatus, { label: string; cls: string }> = {
  icrada: { label: TARGET_STATUS_LABEL.in_progress, cls: TARGET_STATUS_BADGE.in_progress },
  tamamlandi: { label: TARGET_STATUS_LABEL.achieved, cls: TARGET_STATUS_BADGE.achieved },
  gecikme: { label: TARGET_STATUS_LABEL.not_achieved, cls: TARGET_STATUS_BADGE.not_achieved },
};

const useReviewRows = (): ReviewRow[] => {
  const lifecycles = useKpiLifecycles();
  const sharedCards = useVisibleSharedKpiCards();
  return useMemo(() => {
    const employees = getEmployees();
    const rows: ReviewRow[] = [];

    lifecycles.forEach((lc: CardLifecycle) => {
      if (!lc.reviews || lc.reviews.length === 0) return;
      const sharedCard: SharedKpiCard | undefined = sharedCards.find(c => c.numericId === lc.cardId);
      const assigneeIds = sharedCard?.assigneeIds ?? [];
      // Review yalnız real təyin olunmuş əməkdaşlar üçün göstərilir — dublikat/demo sətir yaradılmır.
      if (assigneeIds.length === 0) return;

      const sorted = [...lc.reviews].sort((a, b) => (a.start || "").localeCompare(b.start || ""));

      // Yalnız icra dövrünə çatmış reviewlər görünsün; planlaşdırılanlar (bugün başlama tarixindən əvvəl) göstərilmir.
      sorted.forEach((active, activeIndex) => {
      const reviewStatus = computeReviewStatus(active);
      if (reviewStatus === "pending") return;
      const reviewName = (active as any).name || `Review #${activeIndex + 1}`;


      // Review-u keçirən şəxslər: kart yaradılarkən seçilmiş adlar, yoxdursa iştirakçılar/qiymətləndiricilər.
      const reviewerIds = (active.participantIds && active.participantIds.length
        ? active.participantIds
        : (sharedCard?.evaluatorIds ?? [])) as (string | number)[];
      const namedReviewers = ((active as any).reviewerNames as string[] | undefined || [])
        .map(n => String(n).replace(/\s*\(.*\)\s*$/, "").trim())
        .filter(Boolean)
        .map(n => {
          const emp = employees.find(e => `${e.firstName} ${e.lastName}`.toLowerCase() === n.toLowerCase());
          return { name: emp ? `${emp.firstName} ${emp.lastName}` : n, position: emp?.positionName || "—" };
        });
      const reviewersFromIds = reviewerIds
        .map(rid => {
          const n = Number(String(rid).replace(/^e/, ""));
          const emp = employees.find(e => e.id === n);
          return emp
            ? { name: `${emp.firstName} ${emp.lastName}`, position: emp.positionName || "—" }
            : null;
        })
        .filter((x): x is { name: string; position: string } => !!x);
      const reviewers = namedReviewers.length ? namedReviewers : reviewersFromIds;



      assigneeIds.forEach((aid) => {
        const empIdNum = Number(String(aid).replace(/^e/, ""));
        const emp = employees.find(e => e.id === empIdNum);
        const path = (emp?.structurePath || "").split("›").map(s => s.trim()).filter(Boolean);
        const execRaw: ExecutionStatus | null | undefined = sharedCard?.execution?.[aid];
        const exec: ExecutionStatus = execRaw || "icrada";
        const progress = execRaw ? progressFromExec(exec) : 0;
        const realTargets = (sharedCard?.targets || []).map((t, i) => {
          const plan = parseNumber(t.targetValue ?? t.scoreLimit);
          return {
            id: `${sharedCard?.id || lc.cardId}-${t.id ?? i}`,
            name: t.name || `Hədəf ${i + 1}`,
            plan,
            fakt: 0,
            unit: t.unit || "",
            weight: Number(t.weight) || 0,
            status: "in_progress" as KpiStatus,
          };
        });
        rows.push({
          key: `${lc.cardId}-${active.id}-${aid}`,
          cardId: lc.cardId,
          reviewId: active.id,
          cardName: lc.cardName,
          empId: emp?.id ?? null,
          empName: emp ? `${emp.firstName} ${emp.lastName}` : String(aid),
          department: path[0] || "—",
          division: path[1] || "—",
          position: emp?.positionName || "—",

          progress,
          reviewLabel: reviewName,
          reviewStart: fmtDate(active.start),
          reviewEnd: fmtDate(active.end),
          reviewStatus,
          outcomeComment: active.outcomeComment,
          updatedAt: (lc.updatedAt || "").slice(0, 10) ? fmtDate((lc.updatedAt || "").slice(0, 10)) : fmtDate(active.start),
          execution: exec,
          targets: realTargets,
          reviewers,

          assignmentMode: sharedCard?.assignmentMode === "bulk" ? "bulk" : "individual",
        });

      });
      });
    });


    return rows;
  }, [lifecycles, sharedCards]);
};

const ReviewsCount = () => {
  const rows = useReviewRows();
  return <>{rows.length}</>;
};

const SubordinatesCount = ({ scopePath }: { scopePath?: string | null }) => {
  const count = useMemo(
    () => buildOrgTree(scopePath).filter(n => n.kind === "employee").length,
    [scopePath],
  );
  return <>{count}</>;
};


type ReviewColKey = "cardName" | "reviewName" | "count" | "progress" | "status" | "start" | "end" | "updated";

/** Bir KPI kartı üzrə qruplaşdırılmış review sətri. */
type ReviewCardGroup = {
  groupKey: string;
  cardId: number;
  cardName: string;
  reviewId: string;
  reviewLabel: string;
  reviewStatus: ReviewComputedStatus;
  reviewStart: string;
  reviewEnd: string;
  updatedAt: string;
  outcomeComment?: string;
  employees: ReviewRow[];
  overallProgress: number;
};

const groupReviewRows = (rows: ReviewRow[], mode: "individual" | "bulk"): ReviewCardGroup[] => {
  // Hər KPI kartının hər review-u ayrı sətir kimi qruplaşdırılır.
  const map = new Map<string, ReviewCardGroup>();
  rows.filter(r => r.assignmentMode === mode).forEach(r => {
    const gk = `${r.cardId}:${r.reviewId}`;
    let g = map.get(gk);
    if (!g) {
      g = {
        groupKey: gk,
        cardId: r.cardId,
        cardName: r.cardName,
        reviewId: r.reviewId,
        reviewLabel: r.reviewLabel,
        reviewStatus: r.reviewStatus,
        reviewStart: r.reviewStart,
        reviewEnd: r.reviewEnd,
        updatedAt: r.updatedAt,
        outcomeComment: r.outcomeComment,
        employees: [],
        overallProgress: 0,
      };
      map.set(gk, g);
    }
    g.employees.push(r);
  });

  const list = Array.from(map.values());
  list.forEach(g => {
    g.overallProgress = g.employees.length
      ? Math.round(g.employees.reduce((s, e) => s + e.progress, 0) / g.employees.length)
      : 0;
  });
  return list;
};

/** Review statusu → "Review Statusları" kataloqundakı dəyər. */
const REVIEW_STATUS_CATALOG_LABEL: Record<ReviewComputedStatus, string> = {
  held: "Keçirildi",
  in_progress: "İcrada",
  missed: "Keçirilmədi",
  deferred: "Təxirə salındı",
  pending: "Planlaşdırılıb",
};

const ReviewsView = () => {
  const rows = useReviewRows();
  const { user } = useAuth();
  const [tab, setTab] = useState<"individual" | "bulk">("individual");
  const [q, setQ] = useState("");
  const reviewStatusValues = useCatalogValues("review_statuses", ["Keçirildi", "İcrada", "Keçirilmədi", "Təxirə salındı", "Planlaşdırılıb"]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [colF, setColF] = useState<Record<ReviewColKey, string>>({
    cardName: "", reviewName: "", count: "", progress: "", status: "", start: "", end: "", updated: "",
  });
  const setCol = (k: ReviewColKey) => (v: string) => setColF(p => ({ ...p, [k]: v }));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overview, setOverview] = useState<{ row: ReviewRow | null; group: ReviewCardGroup; data: ReviewOverviewData; commentRef: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ cardId: number; cardName: string; reviewId: string; status: ReviewComputedStatus } | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{ title: string; label: string; text: string } | null>(null);
  const [targetDetail, setTargetDetail] = useState<{ cardId: string; cardName: string; target: CardTarget } | null>(null);

  const individualGroups = useMemo(() => groupReviewRows(rows, "individual"), [rows]);
  const bulkGroups = useMemo(() => groupReviewRows(rows, "bulk"), [rows]);

  const filterGroups = (groups: ReviewCardGroup[]) => {
    const s = q.trim().toLowerCase();
    const m = (val: string, f: string) => !f.trim() || String(val ?? "").toLowerCase().includes(f.trim().toLowerCase());
    return groups.filter(g => {
      const global = !s || withKartSuffix(g.cardName).toLowerCase().includes(s)
        || g.employees.some(e => e.empName.toLowerCase().includes(s));
      if (!global) return false;
      if (statusFilter !== "all" && REVIEW_STATUS_CATALOG_LABEL[g.reviewStatus] !== statusFilter) return false;
      return m(withKartSuffix(g.cardName), colF.cardName)
        && m(g.reviewLabel, colF.reviewName)
        && m(`${g.employees.length}`, colF.count)
        && m(`${g.overallProgress}`, colF.progress)
        && m(REVIEW_STATUS_STYLES[g.reviewStatus]?.badgeLabel || "", colF.status)
        && m(g.reviewStart, colF.start)
        && m(g.reviewEnd, colF.end)
        && m(g.updatedAt, colF.updated);
    });
  };

  const filteredIndividual = useMemo(() => filterGroups(individualGroups), [individualGroups, q, colF, statusFilter]);
  const filteredBulk = useMemo(() => filterGroups(bulkGroups), [bulkGroups, q, colF, statusFilter]);

  const toOverviewStatus = (s: ReviewComputedStatus): ReviewStatusValue =>
    s === "held" ? "held" : s === "deferred" ? "deferred" : s === "missed" ? "missed" : "in_progress";

  const buildTargets = (row: ReviewRow, status: ReviewComputedStatus, note?: string) =>
    row.targets.map((t) => {
      const pct = safePct(t.fakt, t.plan);
      return { name: t.name, progress: Number.isFinite(pct) ? pct : 0, status: toOverviewStatus(status), lastScore: "—", note: note || "" };
    });

  /** Fərdi KPI → yalnız həmin əməkdaşın review-u. */
  const openIndividual = (g: ReviewCardGroup, row: ReviewRow) => {
    const data: ReviewOverviewData = {
      reviewType: row.reviewLabel,
      startDate: g.reviewStart,
      endDate: g.reviewEnd,
      updatedAt: g.updatedAt,
      status: toOverviewStatus(g.reviewStatus),
      overallProgress: row.progress,
      reviewers: row.reviewers.length
        ? row.reviewers.map(r => ({ name: r.name, position: r.position, badge: "Review keçirən" }))
        : [{ name: "—", position: "Təyin olunmayıb", badge: "Review keçirən" }],
      targets: buildTargets(row, g.reviewStatus, g.outcomeComment),
    };
    setOverview({
      row,
      group: g,
      data,
      commentRef: reviewCommentRef(employeeCommentRef(g.cardId, row.empName), g.reviewId),
    });
  };

  /** Toplu KPI → bütün üzvlər və vahid ümumi progress. */
  const openBulk = (g: ReviewCardGroup) => {
    const first = g.employees[0];
    const reviewers = first?.reviewers ?? [];
    const data: ReviewOverviewData = {
      reviewType: first?.reviewLabel || "Review",
      startDate: g.reviewStart,
      endDate: g.reviewEnd,
      updatedAt: g.updatedAt,
      status: toOverviewStatus(g.reviewStatus),
      overallProgress: g.overallProgress,
      reviewers: reviewers.length
        ? reviewers.map(r => ({ name: r.name, position: r.position, badge: "Review keçirən" }))
        : [{ name: "—", position: "Təyin olunmayıb", badge: "Review keçirən" }],
      targets: first ? buildTargets(first, g.reviewStatus, g.outcomeComment) : [],
    };
    setOverview({ row: null, group: g, data, commentRef: reviewCommentRef(`card:${g.cardId}`, g.reviewId) });
  };


  const saveStatus = (v: { status: ReviewStatusValue; comment: string }) => {
    if (!statusDialog) return;
    setReviewOutcome(statusDialog.cardId, statusDialog.cardName, undefined, statusDialog.reviewId, {
      status: v.status,
      comment: v.comment,
      by: user?.name || "Rəhbər",
    });
    toast({ title: "Review statusu yeniləndi" });
    setStatusDialog(null);
    if (overview) setOverview({ ...overview, data: { ...overview.data, status: v.status } });
  };

  const StatusBadge = ({ g }: { g: ReviewCardGroup }) => {
    const st = REVIEW_STATUS_STYLES[g.reviewStatus];
    const Icon = st.badgeIcon;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (g.outcomeComment) setReasonDialog({
            title: withKartSuffix(g.cardName),
            label: g.reviewStatus === "deferred" ? "Təxirə salınma səbəbi" : "Review nəticəsi",
            text: g.outcomeComment,
          });
        }}
        title={g.outcomeComment ? "Səbəbə bax" : undefined}
        className={g.outcomeComment ? "cursor-pointer" : "cursor-default"}
      >
        <span className={`${st.badge} inline-flex items-center justify-center gap-1.5 h-7 w-[150px] px-2 rounded-full border-0 text-xs font-medium leading-none whitespace-nowrap`}>
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{st.badgeLabel}</span>
        </span>
      </button>
    );
  };

  const emptyRow = (cols: number, label: string) => (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-muted-foreground">{label}</td>
    </tr>
  );

  return (
    <>
      <PageHero badge="Rəhbər Paneli" icon={RefreshCw} title="Reviewlar" subtitle="Hazırda Review mərhələsində olan bütün KPI kartlarının vahid izləmə cədvəli." />

      <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-3 flex-wrap mt-2">
        <div className="relative w-full sm:w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="KPI kartı və ya əməkdaş üzrə axtarış..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-[38px]">
            <SelectValue placeholder="Review statusu" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">Bütün statuslar</SelectItem>
            {reviewStatusValues.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Badge className="bg-sky-500/15 text-sky-700 hover:bg-sky-500/15">
          Review: {(tab === "individual" ? filteredIndividual : filteredBulk).length}
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as "individual" | "bulk"); setExpanded(null); }}>
        <TabsList className="mb-3">
          <TabsTrigger value="individual">Fərdi Reviewlər</TabsTrigger>
          <TabsTrigger value="bulk">Toplu Reviewlər</TabsTrigger>
        </TabsList>

        {/* ---------- FƏRDİ: kart başına 1 sətir + drill-down ---------- */}
        <TabsContent value="individual" className="mt-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="KPI Kartı" value={colF.cardName} onChange={setCol("cardName")} /></th>
                    <th className="text-left px-4 py-3 font-medium align-top w-[140px]"><ColumnSearchHeader label="Review adı" value={colF.reviewName} onChange={setCol("reviewName")} placeholder="Məs: Review #1" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top w-[140px]"><ColumnSearchHeader label="Əməkdaş sayı" value={colF.count} onChange={setCol("count")} placeholder="Məs: 3" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review statusu" value={colF.status} onChange={setCol("status")} /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review başlanma" value={colF.start} onChange={setCol("start")} placeholder="Məs: 01.08.2026" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review bitmə" value={colF.end} onChange={setCol("end")} placeholder="Məs: 31.08.2026" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Son yenilənmə" value={colF.updated} onChange={setCol("updated")} placeholder="Məs: 01.08.2026" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIndividual.length === 0 ? emptyRow(7, "Fərdi review mərhələsində olan KPI kartı yoxdur.") : filteredIndividual.map(g => (
                    <React.Fragment key={g.groupKey}>
                      <tr
                        key={g.groupKey}
                        onClick={() => setExpanded(expanded === g.groupKey ? null : g.groupKey)}
                        className="hover:bg-secondary/30 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            {expanded === g.groupKey ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            {withKartSuffix(g.cardName)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{g.reviewLabel}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{g.employees.length}</td>
                        <td className="px-4 py-3"><StatusBadge g={g} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{g.reviewStart}</td>
                        <td className="px-4 py-3 text-muted-foreground">{g.reviewEnd}</td>
                        <td className="px-4 py-3 text-muted-foreground">{g.updatedAt}</td>
                      </tr>
                      {expanded === g.groupKey && (
                        <tr key={`${g.groupKey}-drill`} className="bg-secondary/20">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="rounded-lg border border-border bg-card overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-secondary/40 text-muted-foreground text-[11px] uppercase">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-medium">Əməkdaş</th>
                                    <th className="text-left px-3 py-2 font-medium">Vəzifə</th>
                                    <th className="text-left px-3 py-2 font-medium">Struktur</th>
                                    <th className="text-left px-3 py-2 font-medium w-[180px]">Progress</th>
                                    <th className="text-right px-3 py-2 font-medium w-20">Əməliyyat</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {g.employees.map(e => (
                                    <tr key={e.key} className="hover:bg-secondary/30">
                                      <td className="px-3 py-2 font-medium text-foreground">{e.empName}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{e.position}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{[e.department, e.division].filter(v => v && v !== "—").join(" › ") || "—"}</td>
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Progress value={e.progress} className="h-2 flex-1" />
                                          <span className="text-xs tabular-nums font-medium w-9 text-right">{e.progress}%</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          onClick={() => openIndividual(g, e)}
                                          className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                          aria-label="Bax"
                                          title="Fərdi review-a bax"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ---------- TOPLU: kart başına 1 sətir, vahid ümumi progress ---------- */}
        <TabsContent value="bulk" className="mt-0">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="KPI Kartı" value={colF.cardName} onChange={setCol("cardName")} /></th>
                    <th className="text-left px-4 py-3 font-medium align-top w-[140px]"><ColumnSearchHeader label="Review adı" value={colF.reviewName} onChange={setCol("reviewName")} placeholder="Məs: Review #1" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top w-[180px]"><ColumnSearchHeader label="Ümumi Progress" value={colF.progress} onChange={setCol("progress")} placeholder="Məs: 60" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review statusu" value={colF.status} onChange={setCol("status")} /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review başlanma" value={colF.start} onChange={setCol("start")} placeholder="Məs: 01.08.2026" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Review bitmə" value={colF.end} onChange={setCol("end")} placeholder="Məs: 31.08.2026" /></th>
                    <th className="text-left px-4 py-3 font-medium align-top"><ColumnSearchHeader label="Son yenilənmə" value={colF.updated} onChange={setCol("updated")} placeholder="Məs: 01.08.2026" /></th>
                    <th className="text-right px-4 py-3 font-medium align-top">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBulk.length === 0 ? emptyRow(8, "Toplu review mərhələsində olan KPI kartı yoxdur.") : filteredBulk.map(g => (
                    <tr key={g.groupKey} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <span className="inline-flex items-center gap-2">
                          {withKartSuffix(g.cardName)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{g.reviewLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={g.overallProgress} className="h-2 flex-1" />
                          <span className="text-xs tabular-nums font-medium w-9 text-right">{g.overallProgress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge g={g} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{g.reviewStart}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.reviewEnd}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.updatedAt}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openBulk(g)}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Bax"
                          title="Review-a bax"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {overview && (
        <ReviewOverviewDialog
          open={!!overview}
          onOpenChange={(o) => !o && setOverview(null)}
          title={withKartSuffix(overview.group.cardName) + (overview.row ? ` · ${overview.row.empName}` : "")}
          data={overview.data}
          commentRefId={overview.commentRef}
          onChangeStatus={() => setStatusDialog({
            cardId: overview.group.cardId,
            cardName: overview.group.cardName,
            reviewId: overview.group.reviewId,
            status: overview.group.reviewStatus,
          })}
          onOpenTarget={(idx) => {
            const src = overview.row || overview.group.employees[0];
            const t = src?.targets[idx];
            if (t) setTargetDetail({ cardId: src.key, cardName: overview.group.cardName, target: t });
          }}
        />
      )}

      <TargetDetailDrawer data={targetDetail} onClose={() => setTargetDetail(null)} tabsFilter={["review", "performance"]} />

      <ReviewStatusChangeDialog
        open={!!statusDialog}
        onOpenChange={(o) => !o && setStatusDialog(null)}
        currentStatus={statusDialog ? toOverviewStatus(statusDialog.status) : "in_progress"}
        onSave={saveStatus}
      />

      <Dialog open={!!reasonDialog} onOpenChange={(o) => !o && setReasonDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{reasonDialog?.label || "Səbəb"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">{reasonDialog?.title}</p>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 max-h-[50vh] overflow-y-auto">
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{reasonDialog?.text}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};


export default ManagerKpiTrackingPage;


