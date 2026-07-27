// User · KPI İzlənməsi — 3 kart (Fərdi / Komanda / Struktur).
// Fərdi KPI-lar: tam məlumatlı drawer (Ümumi, Hədəflər, BSC, Lifecycle, Tarixçə, KPI Üzvləri, Şərhlər).
// Komanda / Struktur KPI-ları: eyni drawer, lakin fərdi məlumat gizlidir — yalnız ümumi göstəricilər
// və "X iştirak edir / X tamamlayıb / X riskdə / X gecikir" statistikası.
import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { withKartSuffix } from "@/lib/utils";
import {
  Activity, User, Users, Network, ChevronLeft, ChevronRight, Search, Filter,
  LineChart, Check, Clock, MoreVertical, Eye, MessageSquare, Bell, X, Send, Paperclip,
  Target as TargetIcon, AlertTriangle,
} from "lucide-react";
import KpiAccordionList, { type AccordionKpi } from "@/components/kpi/KpiAccordionList";
import { useAuth } from "@/contexts/AuthContext";
import { useCascadeTree } from "@/lib/cascadeTreeStore";
import { useSharedKpiCards } from "@/lib/kpiCardStore";
import { getEmployees } from "@/lib/orgStore";
import { getCurrentEmployeeId } from "@/lib/scope";

// ============================================================
// Demo data model
// ============================================================
type ItemStatus = "in_progress" | "at_risk" | "completed" | "delayed";
type Scope = "own" | "team" | "structure";

interface DemoTarget {
  id: string; name: string; weight: number; plan: number; fakt: number; unit: string; status: ItemStatus;
}
interface DemoMember {
  name: string; role: string; status: ItemStatus; progress: number;
}
interface DemoComment { id: string; author: string; role: string; date: string; text: string; }
interface DemoHistory { id: string; date: string; author: string; field: string; from: string; to: string; }
interface DemoReminder { id: string; date: string; author: string; text: string; }
interface DemoLifecycle { name: string; date: string; done: boolean; }

interface DemoKpi {
  id: string;
  scope: Scope;
  name: string;
  description: string;
  period: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  unit: string;
  plan: number;
  fakt: number;
  status: ItemStatus;
  frequency: string;
  measure: string;
  type: string;
  method: string;
  weight: number;
  responsible: { name: string; role: string };
  bsc: { perspective: string; strategicGoal: string };
  targets: DemoTarget[];
  members: DemoMember[];
  comments: DemoComment[];
  history: DemoHistory[];
  reminders: DemoReminder[];
  lifecycle: DemoLifecycle[];
}

const pct = (plan: number, fakt: number) => (plan ? Math.round((fakt / plan) * 100) : 0);

const STATUS_META: Record<ItemStatus, { label: string; cls: string }> = {
  in_progress: { label: "İcradadır", cls: "bg-zone-yellow-bg text-zone-yellow-text hover:bg-zone-yellow-bg" },
  at_risk:     { label: "Riskdə",    cls: "bg-zone-red-bg text-zone-red-text hover:bg-zone-red-bg" },
  completed:   { label: "Tamamlandı", cls: "bg-zone-green-bg text-zone-green-text hover:bg-zone-green-bg" },
  delayed:     { label: "Gecikir",   cls: "bg-zone-red-bg text-zone-red-text hover:bg-zone-red-bg" },
};

const fmt = (n: number) => new Intl.NumberFormat("az-AZ").format(n);
const toDate = (v: string | number | undefined) => v ? new Date(v).toLocaleDateString("az-AZ") : "—";
const parseMetric = (v: unknown) => parseFloat(String(v ?? "").replace(/[^\d.\-]/g, "")) || 0;

// ============================================================
// Seeded demo KPIs — hər kart üçün tam dolğun məzmun
// ============================================================
const OWN_KPIS: DemoKpi[] = [];

const TEAM_KPIS: DemoKpi[] = [];

const STRUCTURE_KPIS: DemoKpi[] = [];

// ============================================================
// Page
// ============================================================
type View = "hub" | "own" | "team" | "structure";

const UserKpiCardsPage = () => {
  const [view, setView] = useState<View>("hub");
  const { user } = useAuth();
  const tree = useCascadeTree();
  const sharedCards = useSharedKpiCards();

  const ownKpis = useMemo<DemoKpi[]>(() => {
    const result: DemoKpi[] = [];
    const meId = getCurrentEmployeeId(user);
    const me = getEmployees().find(e => String(e.id) === meId || `e${e.id}` === meId || `${e.firstName} ${e.lastName}` === user?.name);
    const aliases = new Set<string>();
    if (me) { aliases.add(String(me.id)); aliases.add(`e${me.id}`); }
    if (meId) { aliases.add(meId); aliases.add(meId.startsWith("e") ? meId.slice(1) : `e${meId}`); }
    const name = user?.name || (me ? `${me.firstName} ${me.lastName}` : "");

    tree.filter(n => n.assigneeName === name || (me && n.assigneeId === me.id)).forEach(n => {
      const plan = Number(n.limit) || 0;
      result.push({
        id: `cascade-${n.id}`,
        scope: "own",
        name: `${n.cardName} — ${n.goalName || "Hədəf"}`,
        description: n.parentId ? "Cascade Load ilə formalaşan hədəf" : "Müstəqil kaskadlanan hədəf",
        period: toDate(n.createdAt), deadline: "—",
        createdAt: toDate(n.createdAt), updatedAt: toDate(n.updatedAt),
        unit: n.unit || "", plan, fakt: 0, status: "in_progress",
        frequency: "Cascade", measure: n.unit || "", type: "Cascade", method: "Cascade bölgü", weight: 100,
        responsible: { name: n.assigneeName, role: n.positionName || "İcraçı" },
        bsc: { perspective: "Cascade", strategicGoal: n.goalName || n.cardName },
        targets: [{ id: `target-${n.id}`, name: n.goalName || n.cardName, weight: 100, plan, fakt: 0, unit: n.unit || "", status: "in_progress" }],
        members: [{ name: n.assigneeName, role: n.positionName || "İcraçı", status: "in_progress", progress: 0 }],
        comments: [],
        history: [{ id: `hist-${n.id}`, date: toDate(n.createdAt), author: "Sistem", field: "Cascade", from: "—", to: `${fmt(plan)} ${n.unit || ""}`.trim() }],
        reminders: [],
        lifecycle: [{ name: "Təyin edildi", date: toDate(n.createdAt), done: true }, { name: "İcra", date: toDate(n.updatedAt), done: false }],
      });
    });

    sharedCards
      .filter(c => (c.status === "aktiv" || c.status === "natamam" || c.status === "tesdiq_gozlenilir") && c.assigneeIds.some(id => aliases.has(id)))
      .forEach(c => {
        (c.targets || []).forEach((t: any) => {
          const existsInTree = tree.some(n => n.cardName === c.name && n.goalName === (t.name || "Hədəf") && (n.assigneeName === name || (me && n.assigneeId === me.id)));
          if (existsInTree) return;
          const plan = parseMetric(t.targetValue);
          result.push({
            id: `shared-${c.id}-${t.id}`,
            scope: "own",
            name: `${c.name} — ${t.name || "Hədəf"}`,
            description: "Sizə təyin olunmuş KPI hədəfi",
            period: c.startDate || "—", deadline: c.endDate || "—",
            createdAt: c.createdAt?.slice(0, 10) || "—", updatedAt: c.updatedAt?.slice(0, 10) || "—",
            unit: t.unit || "", plan, fakt: 0, status: "in_progress",
            frequency: c.frequency || "—", measure: t.unit || "", type: t.type || "Hədəf", method: "Təyin edilmiş KPI", weight: t.weight || 100,
            responsible: { name: name || "İcraçı", role: me?.positionName || "İcraçı" },
            bsc: { perspective: "KPI", strategicGoal: c.name },
            targets: [{ id: String(t.id), name: t.name || "Hədəf", weight: t.weight || 100, plan, fakt: 0, unit: t.unit || "", status: "in_progress" }],
            members: [{ name: name || "İcraçı", role: me?.positionName || "İcraçı", status: "in_progress", progress: 0 }],
            comments: [],
            history: [{ id: `hist-${c.id}-${t.id}`, date: c.createdAt?.slice(0, 10) || "—", author: "Sistem", field: "KPI", from: "—", to: `${fmt(plan)} ${t.unit || ""}`.trim() }],
            reminders: [],
            lifecycle: [{ name: "Təyin edildi", date: c.createdAt?.slice(0, 10) || "—", done: true }, { name: "İcra", date: c.endDate || "—", done: false }],
          });
        });
      });

    return [...result, ...OWN_KPIS];
  }, [tree, sharedCards, user]);

  return (
    <div className="min-h-screen">
      <Header title="KPI İzlənməsi" />
      <main className="p-6 pb-24">
        {view !== "hub" && (
          <button
            onClick={() => setView("hub")}
            className="mb-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary"
          >
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
        )}

        {view === "hub" && (
          <>
            <PageHero
              badge="İstifadəçi Paneli"
              icon={Activity}
              title="KPI İzlənməsi"
              subtitle="Fərdi, komanda və struktur KPI-larınızı bir ekrandan izləyin."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-2">
              <HubCard icon={User} title="Fərdi KPI-lar"
                subtitle="Sizə şəxsən təyin olunmuş hədəflərin tam icrası və nəticələri."
                count={ownKpis.length}
                gradient="from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/40"
                onClick={() => setView("own")} />
              <HubCard icon={Users} title="Komanda KPI-ları"
                subtitle="Komandanıza toplu təyin olunmuş KPI-lar — yalnız ümumi göstəricilər."
                count={TEAM_KPIS.length}
                gradient="from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40"
                onClick={() => setView("team")} />
              <HubCard icon={Network} title="Struktur KPI-ları"
                subtitle="Struktur səviyyəsində KPI-lar — yalnız ümumi vəziyyət və progress."
                count={STRUCTURE_KPIS.length}
                gradient="from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/40"
                onClick={() => setView("structure")} />
            </div>
          </>
        )}

        {view === "own" && <KpiListView
          title="Fərdi KPI-lar"
          subtitle="Sizə təyin olunmuş hədəflərin tam siyahısı və icra vəziyyəti."
          icon={User}
          data={ownKpis} scope="own" />}
        {view === "team" && <KpiListView
          title="Komanda KPI-ları"
          subtitle="Toplu təyinatlar — digər əməkdaşların fərdi hədəf və nəticələri gizlədilir."
          icon={Users}
          data={TEAM_KPIS} scope="team" />}
        {view === "structure" && <KpiListView
          title="Struktur KPI-ları"
          subtitle="Struktur səviyyəli KPI-lar — yalnız ümumi status və progress."
          icon={Network}
          data={STRUCTURE_KPIS} scope="structure" />}
      </main>
    </div>
  );
};

export default UserKpiCardsPage;

// ============================================================
// HubCard / StatCard
// ============================================================
const HubCard = ({ icon: Icon, title, subtitle, count, gradient, onClick }: any) => (
  <button onClick={onClick}
    className={`text-left rounded-2xl border bg-gradient-to-br ${gradient} p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group`}>
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-white/70 backdrop-blur border border-white flex items-center justify-center shadow-sm">
        <Icon className="w-7 h-7 text-foreground/80" />
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-white text-foreground/70 font-medium">{count}</span>
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 group-hover:text-foreground">
      Aç <ChevronRight className="w-4 h-4" />
    </div>
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
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${map}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold text-foreground tabular-nums">{value}</div>
      </div>
    </div>
  );
};

// ============================================================
// List view (shared for all 3 scopes) — hər sətirdə ... menyusu var
// ============================================================
type DrawerTab = "general" | "targets" | "bsc" | "lifecycle" | "history" | "team" | "comments";

const KpiListView = ({
  title, subtitle, icon: Icon, data, scope,
}: { title: string; subtitle: string; icon: any; data: DemoKpi[]; scope: Scope }) => {
  const [statusF, setStatusF] = useState<string>("all");
  const [periodF, setPeriodF] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [drawerKpi, setDrawerKpi] = useState<DemoKpi | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("general");

  const periods = useMemo(() => Array.from(new Set(data.map(d => d.period))), [data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter(k =>
      (statusF === "all" || k.status === statusF) &&
      (periodF === "all" || k.period === periodF) &&
      (!s || k.name.toLowerCase().includes(s))
    );
  }, [data, statusF, periodF, q]);

  const stats = useMemo(() => {
    const total = data.length;
    const avg = total ? Math.round(data.reduce((a, k) => a + pct(k.plan, k.fakt), 0) / total) : 0;
    const done = data.filter(k => k.status === "completed" || pct(k.plan, k.fakt) >= 100).length;
    const late = data.filter(k => k.status === "delayed" || k.status === "at_risk").length;
    return { total, avg, done, late };
  }, [data]);

  const openDrawer = (k: DemoKpi, tab: DrawerTab) => { setDrawerKpi(k); setDrawerTab(tab); setOpenMenu(null); };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
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
          <StatCard icon={Check} label="Tamamlananlar" value={String(stats.done)} tone="green" />
          <StatCard icon={Clock} label="Gecikdirilənlər" value={String(stats.late)} tone="red" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Status</label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="w-44 h-9 mt-0.5"><SelectValue placeholder="Bütün statuslar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Bütün statuslar</SelectItem>
                <SelectItem value="in_progress">İcrada</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="not_achieved">Tamamlanmadı</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Dövr</label>
            <Select value={periodF} onValueChange={setPeriodF}>
              <SelectTrigger className="w-56 h-9 mt-0.5"><SelectValue placeholder="Bütün dövrlər" /></SelectTrigger>
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
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtrlər</Button>
      </div>

      <KpiAccordionList
        items={rows.map<AccordionKpi>(k => ({
          id: k.id,
          name: k.name,
          createdAt: k.createdAt,
          deadline: k.deadline,
          status: k.status,
          targets: k.targets.map(t => ({
            id: t.id, name: t.name, plan: t.plan, fakt: t.fakt, unit: t.unit, status: t.status,
          })),
        }))}
        onAction={(item, _t, a) => {
          const k = rows.find(r => r.id === item.id);
          if (!k) return;
          const tab: DrawerTab = a === "history" ? "history" : a === "comments" ? "comments" : a === "reminders" ? "history" : "general";
          openDrawer(k, tab);
        }}
      />



      {scope !== "own" && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Filter className="w-3 h-3" />
          Məxfilik: digər əməkdaşların fərdi hədəf, nəticə, qiymətləndirmə və şərh məlumatları bu görünüşdə göstərilmir.
        </p>
      )}

      <KpiDrawer kpi={drawerKpi} tab={drawerTab} setTab={setDrawerTab} scope={scope} onClose={() => setDrawerKpi(null)} />
    </>
  );
};

const MenuItem = ({ icon: Icon, label, onClick }: any) => (
  <button onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-secondary text-foreground focus:outline-none focus:bg-secondary transition-colors">
    <Icon className="w-4 h-4 text-muted-foreground" />
    <span>{label}</span>
  </button>
);

// ============================================================
// DRAWER
// ============================================================
const MetaRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
    <div className="text-sm font-medium text-foreground">{value}</div>
  </div>
);

const KpiDrawer = ({ kpi, tab, setTab, scope, onClose }: {
  kpi: DemoKpi | null; tab: DrawerTab; setTab: (t: DrawerTab) => void; scope: Scope; onClose: () => void;
}) => {
  const [comments, setComments] = useState<DemoComment[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (kpi) setComments(kpi.comments); }, [kpi]);
  useEffect(() => {
    if (tab === "comments" && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [tab, comments, kpi]);

  const memberStatsData = useMemo(() => {
    if (!kpi) return { total: 0, done: 0, risk: 0, late: 0, active: 0 };
    const total = kpi.members.length;
    const done = kpi.members.filter(m => m.status === "completed").length;
    const risk = kpi.members.filter(m => m.status === "at_risk").length;
    const late = kpi.members.filter(m => m.status === "delayed").length;
    return { total, done, risk, late, active: total - done - risk - late };
  }, [kpi]);

  if (!kpi) return null;
  const p = pct(kpi.plan, kpi.fakt);
  const isLimited = scope !== "own";

  // Tabs — Fərdi: hamısı; Komanda/Struktur: yalnız icazə verilənlər (Şərhlər gizli)
  const ALL_TABS: [DrawerTab, string][] = [
    ["general", "Ümumi"],
    ["targets", "Hədəflər"],
    ["bsc", "Balanced Scorecard"],
    ["lifecycle", "Lifecycle"],
    ["history", "Tarixçə"],
    ["team", "KPI Üzvləri"],
    ["comments", "Şərhlər"],
  ];
  const LIMITED_ALLOWED: DrawerTab[] = ["general", "lifecycle", "history", "team"];
  const tabs = isLimited ? ALL_TABS.filter(([k]) => LIMITED_ALLOWED.includes(k)) : ALL_TABS;

  const sendComment = () => {
    const t = draft.trim();
    if (!t) return;
    const now = new Date();
    const stamp = `${String(now.getDate()).padStart(2,"0")}.${String(now.getMonth()+1).padStart(2,"0")}.${now.getFullYear()} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setComments(c => [...c, { id: `c${Date.now()}`, author: "Siz", role: "İstifadəçi", date: stamp, text: t }]);
    setDraft("");
  };

  const memberStats = memberStatsData;

  return (
    <aside className="fixed top-0 right-0 h-screen w-full sm:w-[640px] bg-card border-l border-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">KPI-yə bax</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-base font-semibold text-foreground">{withKartSuffix(kpi.name)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{kpi.description}</div>
            </div>
            <Badge className={STATUS_META[kpi.status].cls}>{STATUS_META[kpi.status].label}</Badge>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 mb-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <MetaRow label="Dövr" value={kpi.period} />
            <MetaRow label={isLimited ? "Ümumi plan" : "Plan"} value={`${fmt(kpi.plan)} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
            <MetaRow label="Status" value={<Badge className={STATUS_META[kpi.status].cls}>{STATUS_META[kpi.status].label}</Badge>} />
            <MetaRow label={isLimited ? "Ümumi fakt" : "Fakt"} value={`${fmt(kpi.fakt)} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
            <MetaRow label="Deadline" value={kpi.deadline} />
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Ümumi progress</div>
              <div className="flex items-center gap-2">
                <Progress value={Math.min(p, 100)} className="h-1.5 flex-1" />
                <span className="text-xs font-medium tabular-nums">{p}%</span>
              </div>
            </div>
            {!isLimited && <MetaRow label="Məsul rəhbər" value={<span>{kpi.responsible.name}<div className="text-[11px] text-muted-foreground">{kpi.responsible.role}</div></span>} />}
            <MetaRow label="Yaradılma" value={kpi.createdAt} />
            <MetaRow label="Son yenilənmə" value={kpi.updatedAt} />
          </div>

          <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1 mb-3">
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
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
              <MetaRow label={isLimited ? "Ümumi nəticə" : "Cari nəticə"} value={`${fmt(kpi.fakt)} / ${fmt(kpi.plan)}`} />
              <MetaRow label="Qalan hədəf" value={`${fmt(Math.max(kpi.plan - kpi.fakt, 0))} ${kpi.unit === "AZN" ? "₼" : kpi.unit}`} />
              <MetaRow label="Tezlik" value={kpi.frequency} />
              <MetaRow label="Trend" value={p >= 100 ? "Tamamlanıb" : "Artan (↑) daha yaxşıdır"} />
            </div>
          )}

          {tab === "targets" && !isLimited && (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Hədəf</th>
                    <th className="text-right px-3 py-2 font-medium">Plan</th>
                    <th className="text-right px-3 py-2 font-medium">Fakt</th>
                    <th className="text-left px-3 py-2 font-medium w-24">İcra %</th>
                    <th className="text-center px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi.targets.map(t => {
                    const tp = pct(t.plan, t.fakt);
                    const bar = tp >= 90 ? "bg-emerald-500" : tp >= 75 ? "bg-amber-500" : "bg-rose-500";
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
                              <div className={`h-full ${bar}`} style={{ width: `${Math.min(tp, 100)}%` }} />
                            </div>
                            <span className="tabular-nums font-medium w-8 text-right">{tp}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge className={`${STATUS_META[t.status].cls} text-[10px] px-1.5 py-0.5`}>{STATUS_META[t.status].label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "bsc" && !isLimited && (
            <div className="rounded-xl border border-border p-4">
              <div className="text-sm font-semibold text-foreground mb-2">Balanced Scorecard</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <MetaRow label="Perspektiv" value={kpi.bsc.perspective} />
                <MetaRow label="Strateji hədəf" value={kpi.bsc.strategicGoal} />
                <MetaRow label="Ölçü (KPI)" value={kpi.measure} />
                <MetaRow label="Hədəf dəyəri" value={`${fmt(kpi.plan)} ${kpi.unit}`} />
                <MetaRow label="Cari nəticə" value={`${fmt(kpi.fakt)} ${kpi.unit}`} />
                <MetaRow label="İcra faizi" value={`${p}%`} />
              </div>
            </div>
          )}

          {tab === "lifecycle" && (
            <ol className="relative border-l border-border pl-4 space-y-4">
              {kpi.lifecycle.map((s, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${s.done ? "bg-emerald-500 ring-emerald-500/15" : "bg-muted ring-muted"}`} />
                  <div className="text-sm font-medium text-foreground">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{s.date}</div>
                </li>
              ))}
            </ol>
          )}

          {tab === "history" && (
            <div className="space-y-4">
              <ol className="relative border-l border-border pl-4 space-y-4">
                {kpi.history.map(h => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/15" />
                    <div className="text-[11px] text-muted-foreground">{h.date}</div>
                    <div className="text-sm font-medium text-foreground">{isLimited ? "Sistem" : h.author}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.field}: <span className="text-foreground">{h.from}</span> → <span className="text-primary font-medium">{h.to}</span>
                    </div>
                  </li>
                ))}
              </ol>
              {!isLimited && kpi.reminders.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Bell className="w-4 h-4" /> Xatırlatmalar</div>
                  <div className="space-y-2">
                    {kpi.reminders.map(r => (
                      <div key={r.id} className="rounded-lg border border-border p-3 text-xs">
                        <div className="text-muted-foreground">{r.date} · {r.author}</div>
                        <div className="text-foreground mt-0.5">{r.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "team" && (
            isLimited ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border p-4">
                    <div className="text-[11px] text-muted-foreground">İştirak edir</div>
                    <div className="text-2xl font-semibold text-foreground tabular-nums">{memberStats.total} nəfər</div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Tamamlayıb</div>
                    <div className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{memberStats.done} nəfər</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="text-[11px] text-amber-700 dark:text-amber-400">Riskdədir</div>
                    <div className="text-2xl font-semibold text-amber-700 dark:text-amber-400 tabular-nums">{memberStats.risk} nəfər</div>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <div className="text-[11px] text-rose-700 dark:text-rose-400">Gecikir</div>
                    <div className="text-2xl font-semibold text-rose-700 dark:text-rose-400 tabular-nums">{memberStats.late} nəfər</div>
                  </div>
                </div>
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Məxfilik səbəbi ilə fərdi əməkdaş adları, hədəfləri və nəticələri bu görünüşdə göstərilmir.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {kpi.members.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                      {m.name.split(" ").map(x => x[0]).join("").slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.role}</div>
                    </div>
                    <Badge className={STATUS_META[m.status].cls}>{STATUS_META[m.status].label}</Badge>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "comments" && !isLimited && (
            <>
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex-shrink-0 flex items-center justify-center text-xs font-semibold">
                      {c.author.split(" ").map(x => x[0]).join("").slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs">
                        <span className="font-medium text-foreground">{c.author}</span>
                        <span className="text-muted-foreground"> · {c.date}</span>
                      </div>
                      <div className="mt-1 text-sm text-foreground rounded-lg bg-secondary/50 border border-border px-3 py-2">{c.text}</div>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground">Hələ şərh yoxdur.</div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                <button className="w-8 h-8 rounded-md hover:bg-secondary text-muted-foreground inline-flex items-center justify-center" aria-label="Fayl əlavə et">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                  placeholder="Şərhinizi yazın..."
                  className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                <Button size="sm" onClick={sendComment} className="gap-1"><Send className="w-3.5 h-3.5" /> Göndər</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

// unused helper marker (TargetIcon import kept for potential future use)
void TargetIcon;
