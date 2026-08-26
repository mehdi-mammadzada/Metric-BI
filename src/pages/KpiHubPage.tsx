import { useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Sparkles, LayoutGrid, Users, ArrowUpRight } from "lucide-react";
import KpiCardsPage from "./KpiCardsPage";
import { useUrlView } from "@/lib/useUrlView";

type View = null | "kart1" | "kart2";

const KpiHubPage = () => {
  const { t } = useTranslation();
  const [view, setView] = useUrlView<"kart1" | "kart2">("view", ["kart1", "kart2"]);

  if (view === "kart1") {
    return <KpiCardsPage onBack={() => setView(null)} forcedKartView="kart1" />;
  }
  if (view === "kart2") {
    return <KpiCardsPage onBack={() => setView(null)} forcedKartView="kart2" />;
  }

  const cards = [
    {
      key: "kart1" as const,
      title: t("kpi_hub.card1_title"),
      desc: t("kpi_hub.card1_desc"),
      icon: LayoutGrid,
      grad: "from-violet-500/15 via-fuchsia-500/10 to-transparent",
      iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
    {
      key: "kart2" as const,
      title: t("kpi_hub.card2_title"),
      desc: t("kpi_hub.card2_desc"),
      icon: Users,
      grad: "from-amber-500/15 via-orange-500/10 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title={t("kpi_hub.page_title")} />
      <main className="p-6 pb-24">
        <PageHero
          badge={t("kpi_hub.hero_badge")}
          icon={Sparkles}
          title={t("kpi_hub.hero_title")}
          subtitle={t("kpi_hub.hero_subtitle")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map(c => (
            <button
              key={c.key}
              onClick={() => setView(c.key)}
              className={`group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.grad} bg-card p-8 text-left hover:shadow-xl transition-all hover:-translate-y-1 min-h-[280px] flex flex-col`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`w-20 h-20 rounded-2xl ${c.iconBg} flex items-center justify-center shrink-0`}>
                  <c.icon className="w-10 h-10" />
                </div>
                <ArrowUpRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <h3 className="font-semibold text-2xl text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default KpiHubPage;
