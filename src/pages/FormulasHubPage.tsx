import { useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Calculator, BookOpen, ArrowUpRight, Sparkles } from "lucide-react";
import FormulasPage from "./FormulasPage";
import FormulaAssignmentsPage from "./FormulaAssignmentsPage";
import { useUrlView } from "@/lib/useUrlView";

type Tab = "calc" | "formulas";


const FormulasHubPage = () => {
  const [tab, setTab] = useUrlView<Tab>("view", ["calc", "formulas"]);

  if (tab === "calc") return <FormulaAssignmentsPage onBack={() => setTab(null)} />;
  if (tab === "formulas") return <FormulasPage onBack={() => setTab(null)} />;


  const cards: Array<{
    title: string;
    desc: string;
    icon: typeof Calculator;
    gradient: string;
    iconBg: string;
    tab: Tab;
  }> = [
    {
      title: "Hesablama",
      desc: "KPI nəticələrinin düsturlar əsasında hesablanması",
      icon: Calculator,
      gradient: "from-sky-500/15 via-cyan-500/10 to-transparent",
      iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
      tab: "calc",
    },
    {
      title: "Düsturlar",
      desc: "Düsturların və dəyişənlərin idarə olunması",
      icon: BookOpen,
      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      tab: "formulas",
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Hesablama Düsturları" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Düstur Mərkəzi"
          icon={Sparkles}
          title="Hesablama Düsturları"
          subtitle="Hesablama və düsturların idarə olunması"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {cards.map(c => (
            <button
              key={c.tab}
              onClick={() => setTab(c.tab)}
              className={`group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.gradient} bg-card p-8 text-left hover:shadow-xl transition-all hover:-translate-y-1 min-h-[260px] flex flex-col`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`w-20 h-20 rounded-2xl ${c.iconBg} flex items-center justify-center shrink-0`}>
                  <c.icon className="w-10 h-10" />
                </div>
                <ArrowUpRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
              <h3 className="font-semibold text-xl text-foreground mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default FormulasHubPage;
