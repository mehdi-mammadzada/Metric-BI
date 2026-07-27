// User Reports — 2 tabs: Mənim Hesabatım / Komanda Hesabatı
// RBAC:
//  - "Mənim Hesabatım": only if user is in any individual KPI assignment
//  - "Komanda Hesabatı": only if user is a member of a team
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { getTeams, type Team } from "@/lib/teamsStore";
import {
  User as UserIcon, Users as UsersIcon, TrendingUp, Target, Award, Activity,
  ArrowUpRight, ArrowDownRight, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarRadiusAxis, Legend, PieChart, Pie, Cell,
} from "recharts";
import PeriodPicker, { currentPeriod, buildDemoSeries, type PeriodValue } from "@/components/common/PeriodPicker";

type TabKey = "mine" | "team";


// --- Mock individual KPI assignments (which users appear on individual KPIs) ---
const individualKpiAssignees = [];

const TAB_DEFS: { key: TabKey; label: string; icon: any; gradient: string }[] = [
  { key: "mine", label: "Mənim Hesabatım", icon: UserIcon, gradient: "from-primary to-primary/60" },
  { key: "team", label: "Komanda Hesabatı", icon: UsersIcon, gradient: "from-emerald-500 to-emerald-400" },
];

const UserReportsPage = () => {
  const { user, hasPermission } = useAuth();
  const [teams, setTeams] = useState<Team[]>(() => getTeams());
  const [activeTab, setActiveTab] = useState<TabKey>("mine");

  useEffect(() => {
    const refresh = () => setTeams(getTeams());
    window.addEventListener("teams-updated", refresh);
    return () => window.removeEventListener("teams-updated", refresh);
  }, []);

  // ---- Visibility rules (RBAC) ----
  const myTeams = useMemo(
    () => teams.filter(t => t.leader === user?.name || t.members.some(m => m.name === user?.name)),
    [teams, user]
  );
  const showMine = !!user && individualKpiAssignees.includes(user.name);
  const showTeam = myTeams.length > 0 && hasPermission("reporting");

  const visibleTabs = TAB_DEFS.filter(t =>
    (t.key === "mine" && showMine) ||
    (t.key === "team" && showTeam)
  );

  // Auto-pick first available tab
  useEffect(() => {
    if (!visibleTabs.find(t => t.key === activeTab) && visibleTabs[0]) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="min-h-screen">
      <Header title="Hesabat" />
      <main className="p-6 pb-24">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-secondary/40 border border-border p-6 mb-6">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 w-72 h-72 rounded-full bg-violet-400/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs text-muted-foreground mb-3">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Performans Mərkəzi
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Hesabatlar</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Şəxsi, komanda və müştərək KPI nəticələrinizi tək yerdə izləyin
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-2 rounded-lg bg-card border border-border">
                <div className="text-muted-foreground">Aktiv tab</div>
                <div className="font-semibold text-foreground">
                  {TAB_DEFS.find(t => t.key === activeTab)?.label || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {visibleTabs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              {visibleTabs.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`group relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${t.gradient} text-primary-foreground shadow-md`
                        : "bg-card border border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {activeTab === "mine" && <MyReport userName={user?.name || ""} />}
            {activeTab === "team" && <TeamReport teams={myTeams} />}
            
          </>
        )}
      </main>
    </div>
  );
};

// ----- Empty state -----
const EmptyState = () => (
  <div className="text-center py-24 rounded-2xl border border-dashed border-border bg-card">
    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
    <p className="text-lg font-semibold text-foreground">Sizin üçün hesabat yoxdur</p>
    <p className="text-sm text-muted-foreground">Heç bir KPI və ya komanda assignmenti tapılmadı</p>
  </div>
);

// ============================================================
// TAB 1 — MƏNİM HESABATIM
// ============================================================
const MyReport = ({ userName }: { userName: string }) => {
  const summary = {
    overall: 86,
    completed: 7,
    active: 4,
    rank: 3,
  };

  const [trendPeriod, setTrendPeriod] = useState<PeriodValue>(() => currentPeriod("year"));
  const trend = useMemo(() => buildDemoSeries(trendPeriod, 78), [trendPeriod]);

  const radar = [
    { skill: "Satış", value: 92 }, { skill: "Müştəri", value: 78 },
    { skill: "İnnovasiya", value: 70 }, { skill: "Komanda", value: 88 },
    { skill: "Keyfiyyət", value: 84 },
  ];

  const radial = [{ name: "Performans", value: summary.overall, fill: "hsl(var(--primary))" }];

  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Ümumi Performans" value={`${summary.overall}%`} delta={+6} accent="primary" />
        <StatCard icon={Award} label="Reytinq" value={`#${summary.rank}`} delta={+1} accent="emerald" />
        <StatCard icon={Activity} label="Aktiv KPI" value={summary.active} delta={0} accent="violet" />
        <StatCard icon={TrendingUp} label="Tamamlanmış" value={summary.completed} delta={+2} accent="amber" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radial — overall */}
        <ChartCard title="Ümumi Göstərici" subtitle={userName}>
          <ResponsiveContainer width="100%" height={280}>
            <RadialBarChart innerRadius="65%" outerRadius="100%" data={radial} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="-mt-44 text-center pointer-events-none">
            <div className="text-4xl font-bold text-foreground">{summary.overall}%</div>
            <div className="text-xs text-muted-foreground mt-1">Performans</div>
          </div>
          <div className="h-32" />
        </ChartCard>

        {/* Period trend */}
        <ChartCard title="İrəliləyiş" subtitle="Seçilmiş dövr üzrə" className="lg:col-span-2" right={<PeriodPicker value={trendPeriod} onChange={setTrendPeriod} />}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>

              <defs>
                <linearGradient id="myGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#myGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar — skill profile */}
        <ChartCard title="Bacarıq Profili" subtitle="Sahələr üzrə performans" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radar}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Radar name="Performans" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} strokeWidth={2} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* KPI list mini */}
        <ChartCard title="Aktiv KPI-lar" subtitle="Sizə təyin edilmiş">
          <div className="space-y-3 mt-2">
            {([] as { name: string; v: number }[]).map(k => (
              <div key={k.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground font-medium">{k.name}</span>
                  <span className="text-muted-foreground">{k.v}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${k.v > 80 ? "bg-emerald-500" : k.v > 60 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${k.v}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ============================================================
// TAB 2 — KOMANDA HESABATI (no individual names)
// ============================================================
const TeamReport = ({ teams }: { teams: Team[] }) => {
  // Aggregate-only data: focus on group metrics, no person identification.
  const teamData = teams.map(t => ({
    name: t.name,
    performance: t.kpiResult,
    active: t.activeKpi,
    completed: t.completedKpi,
    total: t.totalKpi,
  }));

  const avg = teamData.length ? Math.round(teamData.reduce((s, t) => s + t.performance, 0) / teamData.length) : 0;
  const totalCompleted = teamData.reduce((s, t) => s + t.completed, 0);
  const totalActive = teamData.reduce((s, t) => s + t.active, 0);

  const distribution = [
    { name: "Yaşıl Zona", value: teamData.filter(t => t.performance > 80).length, color: "hsl(145, 65%, 42%)" },
    { name: "Sarı Zona", value: teamData.filter(t => t.performance >= 50 && t.performance <= 80).length, color: "hsl(38, 92%, 55%)" },
    { name: "Qırmızı Zona", value: teamData.filter(t => t.performance < 50).length, color: "hsl(0, 78%, 60%)" },
  ];

  const [barPeriod, setBarPeriod] = useState<PeriodValue>(() => currentPeriod("year"));
  const [donutPeriod, setDonutPeriod] = useState<PeriodValue>(() => currentPeriod("year"));
  const [trendPeriod, setTrendPeriod] = useState<PeriodValue>(() => currentPeriod("year"));
  const trend = useMemo(() => buildDemoSeries(trendPeriod, avg || 72).map(d => ({ name: d.name, group: d.value })), [trendPeriod, avg]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label="Komanda sayı" value={teams.length} accent="emerald" />
        <StatCard icon={Target} label="Orta Performans" value={`${avg}%`} delta={+4} accent="primary" />
        <StatCard icon={Activity} label="Aktiv KPI" value={totalActive} accent="violet" />
        <StatCard icon={Award} label="Tamamlanmış" value={totalCompleted} delta={+3} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar — per team performance (anonymized: shows team only, no member names) */}
        <ChartCard title="Qrup Performansı" subtitle="Adlar göstərilmir — yalnız qrup ümumi göstəricisi" className="lg:col-span-2" right={<PeriodPicker value={barPeriod} onChange={setBarPeriod} />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamData}>
              <defs>
                <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(145, 65%, 50%)" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(145, 65%, 35%)" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="performance" fill="url(#teamGrad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Donut — zone distribution */}
        <ChartCard title="Zona Bölgüsü" subtitle="Komandaların performans zonaları" right={<PeriodPicker value={donutPeriod} onChange={setDonutPeriod} />}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={distribution} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={4}>
                {distribution.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Group trend */}
        <ChartCard title="Qrup İrəliləyişi" subtitle="Seçilmiş dövr üzrə birgə performans" className="lg:col-span-3" right={<PeriodPicker value={trendPeriod} onChange={setTrendPeriod} />}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="group" stroke="hsl(145, 65%, 42%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(145, 65%, 42%)" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};



// ============================================================
// Reusable bits
// ============================================================
const StatCard = ({
  icon: Icon, label, value, delta, accent,
}: {
  icon: any; label: string; value: string | number; delta?: number; accent: "primary" | "emerald" | "violet" | "amber";
}) => {
  const accents: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${accents[accent]} blur-2xl opacity-60`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {typeof delta === "number" && delta !== 0 && (
            <div className={`inline-flex items-center gap-1 text-xs mt-2 ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(delta)}% bu ay
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accents[accent]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const ChartCard = ({
  title, subtitle, children, className = "", right,
}: { title: string; subtitle?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) => (
  <div className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${className}`}>
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
    {children}
  </div>
);


export default UserReportsPage;
