import { useState, useMemo } from "react";
import { ClipboardCheck, ChevronRight, ChevronLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { KpiEvaluationSection } from "@/components/evaluation/KpiEvaluationSection";
import { useSubKpis } from "@/lib/kpiEvaluationStore";
import { MOCK_USER_ID } from "@/data/mockData";

type View = "hub" | "evaluate";

const HubCard = ({
  title,
  subtitle,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  badge: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="text-left rounded-2xl border bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all group"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-white/70 backdrop-blur border border-white flex items-center justify-center shadow-sm">
        <ClipboardCheck className="w-7 h-7 text-foreground/80" />
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
  const items = useSubKpis(MOCK_USER_ID);
  const evalCount = useMemo(() => items.length, [items]);

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
              icon={ClipboardCheck}
              title="Məsul olduğum kartlar"
              subtitle="Hədəflərinizi qiymətləndirin və nəticələri qeyd edin."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
              <HubCard
                title="Hədəf & səriştə qiymətləndirmə"
                subtitle="Sizə aid KPI kartlarındakı hədəfləri qiymətləndirin və nəticələri qeyd edin."
                badge={`${evalCount} hədəf`}
                onClick={() => setView("evaluate")}
              />
            </div>
          </>
        )}

        {view === "evaluate" && (
          <>
            <PageHero
              badge="Qiymətləndirmə"
              icon={ClipboardCheck}
              title="Hədəf & səriştə qiymətləndirmə"
              subtitle="Sizə aid KPI kartlarını açın və hər bir hədəf üzrə qiymətləndirmə aparın."
            />
            <div className="mt-5">
              <KpiEvaluationSection assigneeId={MOCK_USER_ID} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default UserEvaluationPage;
