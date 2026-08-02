import { useState, useMemo } from "react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Target, CheckCircle, Clock, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PageHero, FancyStatCard, FancyCard } from "@/components/ui/page-hero";
import { AIChatSection } from "@/components/ai/AIChatSection";
import SharedKpiPanel from "@/components/kpi/SharedKpiPanel";
import PeriodPicker, { currentPeriod, periodLabel, buildDemoSeries, type PeriodValue } from "@/components/common/PeriodPicker";

const myKpis = [];

const UserHomePage = () => {
  const { user } = useAuth();
  const zoneBg: Record<string, string> = { green: "bg-zone-green-bg text-zone-green-text", yellow: "bg-zone-yellow-bg text-zone-yellow-text", red: "bg-zone-red-bg text-zone-red-text" };
  const avg = Math.round(myKpis.reduce((s, k) => s + k.progress, 0) / myKpis.length);
  const [chartPeriod, setChartPeriod] = useState<PeriodValue>(() => currentPeriod("year"));
  const chartData = useMemo(() => buildDemoSeries(chartPeriod, 80), [chartPeriod]);

  return (
    <div className="min-h-screen">
      <Header title="Əsas Səhifə" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Şəxsi Performans Mərkəzi"
          icon={Sparkles}
          title={`Xoş gəlmisiniz, ${user?.name || ""}`}
          subtitle="Şəxsi KPI performans paneli"
        />
        <AIChatSection />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <FancyStatCard icon={Target} label="Aktiv KPI" value={myKpis.length} accent="primary" />
          <FancyStatCard icon={CheckCircle} label="Təsdiqlənmiş" value={myKpis.filter(k => k.status === "approved").length} accent="emerald" />
          <FancyStatCard icon={Clock} label="Gözləyən" value={myKpis.filter(k => k.status === "pending").length} accent="amber" />
          <FancyStatCard icon={TrendingUp} label="Orta Performans" value={`${avg}%`} accent="violet" />
        </div>





        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <FancyCard
            title="Performans Dinamikası"
            subtitle={periodLabel(chartPeriod)}
            className="lg:col-span-2"
            right={<PeriodPicker value={chartPeriod} onChange={setChartPeriod} />}
          >
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </FancyCard>

          <FancyCard title="KPI-larım">
            <div className="space-y-3">
              {myKpis.map((k, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{k.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${zoneBg[k.zone]}`}>{k.progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary to-primary/70 rounded-full h-1.5" style={{ width: `${k.progress}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>Hədəf: {k.target}</span>
                    <span>Cari: {k.current}</span>
                  </div>
                </div>
              ))}
            </div>
          </FancyCard>
        </div>
      </main>
    </div>
  );
};

export default UserHomePage;
