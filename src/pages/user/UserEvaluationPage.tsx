import { useState, useMemo } from "react";
import { ClipboardCheck, ChevronRight, ChevronLeft, Award, LayoutGrid } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { KpiEvaluationSection } from "@/components/evaluation/KpiEvaluationSection";
import { CompetencyEvaluationSection } from "@/components/evaluation/CompetencyEvaluationSection";
import { useSubKpis } from "@/lib/kpiEvaluationStore";
import { MOCK_USER_ID, buildPeerAssignments, CURRENT_CYCLE_ID } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";

type View = "hub" | "evaluate" | "competency";

const HubCard = ({
  title,
  subtitle,
  badge,
  icon: Icon,
  gradient,
  onClick,
}: {
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  gradient: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`text-left rounded-2xl border bg-gradient-to-br ${gradient} p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-white/70 backdrop-blur border border-white flex items-center justify-center shadow-sm">
        <Icon className="w-7 h-7 text-foreground/80" />
      </div>
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-white text-foreground/70 font-medium">
        {badge}
      </span>
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 group-hover:text-foreground">
      Aç <ChevronRight className="w-4 h-4" />
    </div>
  </button>
);

const UserEvaluationPage = () => {
  const [view, setView] = useState<View>("hub");
  const { hasPermission } = useAuth();
  const items = useSubKpis(MOCK_USER_ID);
  const evalCount = useMemo(() => items.length, [items]);
  const peerCount = useMemo(
    () => (buildPeerAssignments(CURRENT_CYCLE_ID)[MOCK_USER_ID] || []).length,
    [],
  );

  const canGoals = hasPermission("evaluation_goals");
  const canCompetency = hasPermission("evaluation_competency");

  return (
    <div className="min-h-screen">
      <Header title="Məsul olduğum kartlar" />
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
              badge="Qiymətləndirmə"
              icon={LayoutGrid}
              title="Məsul olduğum kartlar"
              subtitle="Hədəflərinizi və səriştələr üzrə qiymətləndirmələri buradan idarə edin."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
              {canGoals && (
                <HubCard
                  icon={ClipboardCheck}
                  title="Hədəf qiymətləndirmə"
                  subtitle="Sizə aid KPI kartlarındakı hədəfləri qiymətləndirin və nəticələri qeyd edin."
                  badge={`${evalCount} hədəf`}
                  gradient="from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40"
                  onClick={() => setView("evaluate")}
                />
              )}
              {canCompetency && (
                <HubCard
                  icon={Award}
                  title="Səriştə üzrə qiymətləndirmə"
                  subtitle="Həmkarlarınızı səriştə kateqoriyaları üzrə anonim qiymətləndirin."
                  badge={`${peerCount} həmkar`}
                  gradient="from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/40"
                  onClick={() => setView("competency")}
                />
              )}
              {!canGoals && !canCompetency && (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground md:col-span-2">
                  Bu modul üzrə səlahiyyətiniz yoxdur.
                </div>
              )}
            </div>
          </>
        )}

        {view === "evaluate" && (
          <>
            <PageHero
              badge="Qiymətləndirmə"
              icon={ClipboardCheck}
              title="Hədəf qiymətləndirmə"
              subtitle="Sizə aid KPI kartlarını açın və hər bir hədəf üzrə qiymətləndirmə aparın."
            />
            <div className="mt-5">
              <KpiEvaluationSection assigneeId={MOCK_USER_ID} />
            </div>
          </>
        )}

        {view === "competency" && (
          <>
            <PageHero
              badge="Qiymətləndirmə"
              icon={Award}
              title="Səriştə üzrə qiymətləndirmə"
              subtitle="Səriştə kateqoriyaları üzrə anonim qiymətləndirmə aparın və öz nəticələrinizi izləyin."
            />
            <div className="mt-5">
              <CompetencyEvaluationSection employeeId={MOCK_USER_ID} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default UserEvaluationPage;
