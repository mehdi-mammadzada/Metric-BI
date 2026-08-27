import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { GitBranch, Map, Activity, ArrowUpRight, Target } from "lucide-react";
import CascadingPage from "./CascadingPage";
import CascadeTrackingPage from "./CascadeTrackingPage";
import GoalTrackingPage from "./GoalTrackingPage";
import { useUrlView } from "@/lib/useUrlView";

const CascadingHubPage = () => {
  const [view, setView] = useUrlView<"map" | "track" | "goals">("view", ["map", "track", "goals"]);

  if (view === "map") return <CascadingPage onBack={() => setView(null)} />;
  if (view === "track") return <CascadeTrackingPage onBack={() => setView(null)} />;
  if (view === "goals") return <GoalTrackingPage onBack={() => setView(null)} />;

  return (
    <div className="min-h-screen">
      <Header title="Cascading" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Cascading"
          icon={GitBranch}
          title="Cascading"
          subtitle="KPI hədəflərinin təşkilati struktur boyu avtomatik yönləndirilməsi və izlənməsi"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          <HubCard
            title="Kaskadlama Xəritəsi"
            desc="Hər struktur vahidinin rəhbərini və tabeliyindəki əməkdaşları interaktiv ağac üzərində izləyin."
            icon={Map}
            gradient="from-indigo-500/15 via-violet-500/10 to-transparent"
            iconBg="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
            onClick={() => setView("map")}
          />
          <HubCard
            title="Kaskad İzləmə"
            desc="Hədəflərin kaskad zənciri boyunca icra statusunu real vaxtda izləyin."
            icon={Activity}
            gradient="from-emerald-500/15 via-teal-500/10 to-transparent"
            iconBg="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            onClick={() => setView("track")}
          />
          <HubCard
            title="Kaskadlanmış hədəflərin izlənməsi"
            desc="Kaskadlanmış hədəflərin icraçılar üzrə bölgüsünü və irəliləyişini izləyin."
            icon={Target}
            gradient="from-amber-500/15 via-orange-500/10 to-transparent"
            iconBg="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            onClick={() => setView("goals")}
          />
        </div>
      </main>
    </div>
  );
};

const HubCard = ({
  title, desc, icon: Icon, gradient, iconBg, onClick,
}: { title: string; desc: string; icon: any; gradient: string; iconBg: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${gradient} bg-card p-8 text-left hover:shadow-xl transition-all hover:-translate-y-1 min-h-[260px] flex flex-col`}
  >
    <div className="flex items-start justify-between mb-6">
      <div className={`w-20 h-20 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className="w-10 h-10" />
      </div>
      <ArrowUpRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </div>
    <h3 className="font-semibold text-xl text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
  </button>
);


export default CascadingHubPage;
