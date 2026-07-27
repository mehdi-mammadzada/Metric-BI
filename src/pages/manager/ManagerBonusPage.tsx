// Rəhbər · Bonuslarım — dinamik: cari daxil olmuş istifadəçiyə görə hesablanır.
// Öz bonuslarım — yalnız cari istifadəçi. Tabeçiliyimdəkilərin bonusları —
// istifadəçinin struktur vahidi altında olan tabeliyində olan əməkdaşlar
// (starPerson iyerarxiyasına əsasən). Heç bir hardcoded şəxs istifadə olunmur.
import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Gift, User, Network, ChevronLeft, ChevronRight } from "lucide-react";
import BonusPage, { type Employee } from "@/pages/BonusPage";
import { useAuth } from "@/contexts/AuthContext";
import { getEmployees, getStructures, getSubordinatesOfStarHolder, type OrgEmployee } from "@/lib/orgStore";

const toBonusEmployee = (e: OrgEmployee, evaluator: string): Employee => ({
  id: String(e.id),
  firstName: e.firstName,
  lastName: e.lastName,
  fatherName: e.fatherName,
  department: e.structurePath || "—",
  position: e.positionName || "—",
  baseSalary: e.salary || 0,
  targetBonusPct: 20,
  subKpis: [],
});

type View = "hub" | "own" | "sub";

const ManagerBonusPage = () => {
  const [view, setView] = useState<View>("hub");
  const { user } = useAuth();

  const { own, sub } = useMemo(() => {
    const all = getEmployees().filter(e => e.active);
    const me = all.find(e => e.email === user?.email) || all.find(e => `${e.firstName} ${e.lastName}` === user?.name);
    if (!me) return { own: [] as Employee[], sub: [] as Employee[] };

    // Cari istifadəçinin struktur vahidini tap
    const findUnitId = (): number | null => {
      const walk = (list: any[], path: string[]): number | null => {
        for (const n of list) {
          const cur = [...path, n.name];
          if (cur.join(" › ") === me.structurePath) return n.id;
          const ch = walk(n.children, cur);
          if (ch) return ch;
        }
        return null;
      };
      return walk(getStructures(), []);
    };
    const unitId = findUnitId();
    const subs = unitId ? getSubordinatesOfStarHolder(me.id, unitId) : [];
    const meName = `${me.firstName} ${me.lastName}`;
    return {
      own: [toBonusEmployee(me, "Rəhbər")],
      sub: subs.map(s => toBonusEmployee(s, meName)),
    };
  }, [user?.email, user?.name]);

  return (
    <div className="min-h-screen">
      <Header title="Bonuslar" />
      <main className="p-6 pb-24">
        {view !== "hub" && (
          <button onClick={() => setView("hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
        )}
        {view === "hub" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={Gift} title="Bonuslar" subtitle="Şəxsi və tabeçilik bonuslarını izləyin." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
              <HubCard icon={User} title="Öz bonuslarım" subtitle="Sizin fərdi performansınıza görə hesablanmış bonuslar." count={own.length} gradient="from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/40" onClick={() => setView("own")} />
              <HubCard icon={Network} title="Tabeçiliyimdəkilərin bonusları" subtitle="Tabeliyinizdəki əməkdaşların bonusları." count={sub.length} gradient="from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40" onClick={() => setView("sub")} />
            </div>
          </>
        )}
        {view === "own" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={User} title="Öz bonuslarım" subtitle="Sizin fərdi performansınıza görə hesablanmış bonuslar." />
            <BonusPage employeesOverride={own} hideChrome hideCalcButton />
          </>
        )}
        {view === "sub" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={Network} title="Tabeçiliyimdəkilərin bonusları" subtitle="Tabeliyinizdəki əməkdaşların bonusları." />
            <BonusPage employeesOverride={sub} hideChrome hideCalcButton />
          </>
        )}
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
      <span className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-white text-foreground/70 font-medium">{count} əməkdaş</span>
    </div>
    <h3 className="text-xl font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground/70 group-hover:text-foreground">Aç <ChevronRight className="w-4 h-4" /></div>
  </button>
);

export default ManagerBonusPage;
