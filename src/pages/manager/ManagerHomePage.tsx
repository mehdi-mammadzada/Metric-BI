import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Target, Trophy, Gift, Sparkles, TrendingUp } from "lucide-react";
import { PageHero, FancyStatCard, FancyCard } from "@/components/ui/page-hero";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AIChatSection } from "@/components/ai/AIChatSection";
import { useApprovals } from "@/lib/approvalsStore";
import { useVisibleSharedKpiCards } from "@/lib/kpiCardStore";
import { getCurrentEmployeeId, getVisibleApprovals, getVisibleKpiCards, getVisibleTeams } from "@/lib/scope";
import { useMemo } from "react";

const ManagerHomePage = () => {
  const { user } = useAuth();
  const approvals = useApprovals();
  const cards = useVisibleSharedKpiCards();
  const meId = getCurrentEmployeeId(user);
  const visibleApprovals = useMemo(() => getVisibleApprovals(user, approvals), [user, approvals]);
  const visibleCards = useMemo(() => getVisibleKpiCards(user, cards), [user, cards]);
  const teams = useMemo(() => getVisibleTeams(user), [user]);
  const teamMembers = teams.reduce((acc, t) => acc + t.memberIds.length, 0);
  const pendingApprovals = visibleApprovals.filter(a => a.status === "pending"
    && meId && a.decisions[meId]?.decision === "pending").length;
  const activeKpis = visibleCards.filter(c => c.status === "aktiv").length;
  const teamData = useMemo(
    () => visibleCards.map(c => ({ name: c.name, value: 0 })),
    [visibleCards],
  );
  const delayedKpis = visibleCards.filter(c => c.status === "natamam" || c.status === "imtina").length;
  const completedKpis = 0;


  return (
    <div className="min-h-screen">
      <Header title="Əsas Səhifə" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Rəhbər İdarəetmə Mərkəzi"
          icon={Sparkles}
          title={`Xoş gəlmisiniz, ${user?.name || ""}`}
          subtitle="Komandanızın performansını və KPI nəticələrini izləyin"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <FancyStatCard icon={Users} label="Komanda üzvləri" value={teamMembers} accent="primary" />
          <FancyStatCard icon={Target} label="Aktiv KPI" value={activeKpis} accent="violet" />
          <FancyStatCard icon={Trophy} label="Təsdiq gözləyir" value={pendingApprovals} accent="amber" />
          <FancyStatCard icon={Gift} label="Bu ay bonus" value="0 AZN" accent="emerald" />
        </div>

        <AIChatSection />




        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FancyCard title="Komanda performansı" subtitle="Cari ay" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(var(--header-accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </FancyCard>

          <FancyCard title="Qısa baxış" subtitle="Bu həftə">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/60">
                <span className="text-muted-foreground">Təsdiq gözləyən</span>
                <span className="font-semibold text-foreground">{pendingApprovals}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/60">
                <span className="text-muted-foreground">Gecikən KPI</span>
                <span className="font-semibold text-destructive">{delayedKpis}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/60">
                <span className="text-muted-foreground">Tamamlanan</span>
                <span className="font-semibold text-success">{completedKpis}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <TrendingUp className="w-4 h-4" />
                Real KPI nəticəsi daxil edilməyib
              </div>
            </div>
          </FancyCard>
        </div>
      </main>
    </div>
  );
};

export default ManagerHomePage;
