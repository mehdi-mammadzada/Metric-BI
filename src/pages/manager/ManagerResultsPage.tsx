// Rəhbər · Nəticələrim — 3 kart (Fərdi / Komanda / Tabeçilik).
// Fərdi / Komanda — HR-in KPI Nəticələri modulunun eynisi (KpiScoresPage).
// Tabeçilik — KPI İzlənməsi tabeçilik moduluyla eyni iyerarxik struktur;
// Əməliyyatlar yalnız Eye ikonu ilə saxlanılır (⋮ menyu yox), Eye seçilmiş
// əməkdaşın KpiScoresPage nəticələrini modalda açır.
import { useMemo, useState } from "react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Trophy, User, Users, Network, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import KpiScoresPage from "@/pages/KpiScoresPage";
import { getEmployees, getSubordinatesOfStarHolder, getStructures } from "@/lib/orgStore";
import { useAuth } from "@/contexts/AuthContext";
import { SubordinatesView } from "@/pages/manager/ManagerKpiTrackingPage";

type View = "hub" | "own" | "team" | "sub";

const ManagerResultsPage = () => {
  const [view, setView] = useState<View>("hub");
  const { user } = useAuth();
  const [detail, setDetail] = useState<{ empId: number; name: string } | null>(null);

  const { own, team, sub, mePath } = useMemo(() => {
    const all = getEmployees().filter(e => e.active);
    const me = all.find(e => e.email === user?.email) || all.find(e => `${e.firstName} ${e.lastName}` === user?.name);
    if (!me) return { own: [], team: [], sub: [], mePath: null as string | null };
    const teamMembers = all.filter(e => (e.structurePath || "").startsWith(me.structurePath || ""));
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
    return { own: [me], team: teamMembers, sub: subs, mePath: me.structurePath || null };
  }, [user?.email, user?.name]);

  // Kartlarda göstərilən say — real nəticəsi olan əməkdaşların sayı olmalıdır.
  const cards = useSharedKpiCards();
  const countWithResults = (list: any[]) => {
    try {
      return list.filter(e => {
        const subs = getSubKpis(String(e.id));
        return subs.some(k => isEvaluated(k) && cards.some(c => c.id === k.cardId || c.name === k.cardId));
      }).length;
    } catch { return 0; }
  };
  const ownCount = useMemo(() => countWithResults(own), [own, cards]);
  const teamCount = useMemo(() => countWithResults(team), [team, cards]);
  const subCount = useMemo(() => countWithResults(sub as any[]), [sub, cards]);


  // Struktur əhatəsi: HR/SuperAdmin → bütün şirkət; Rəhbər → yalnız öz strukturu.
  const scopePath = user?.role === "HR" || user?.role === "SUPER_ADMIN" ? null : mePath;

  // Detail-də tək əməkdaşın nəticələri KpiScoresPage ilə göstərilir.
  const detailEmployee = useMemo(() => {
    if (!detail) return null;
    return getEmployees().find(e => e.id === detail.empId) || null;
  }, [detail]);

  return (
    <div className="min-h-screen">
      <Header title="Nəticələr" />
      <main className="p-6 pb-24">
        {view !== "hub" && (
          <button onClick={() => setView("hub")} className="mb-4 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
        )}

        {view === "hub" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={Trophy} title="Nəticələr" subtitle="Fərdi, komanda və tabeçilik üzrə KPI nəticələri." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-2">
              <HubCard icon={User} title="Fərdi nəticələrim" subtitle="Sizin şəxsi KPI nəticələriniz." count={own.length} gradient="from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-400/40" onClick={() => setView("own")} />
              <HubCard icon={Users} title="Komanda nəticələri" subtitle="Komandanızın KPI nəticələri." count={team.length} gradient="from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-400/40" onClick={() => setView("team")} />
              <HubCard icon={Network} title="Tabeçiliyimdəki nəticələr" subtitle="Tabeliyinizdəki şəxslərin nəticələri." count={sub.length} gradient="from-amber-500/15 via-amber-500/5 to-transparent border-amber-400/40" onClick={() => setView("sub")} />
            </div>
          </>
        )}

        {view === "own" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={User} title="Fərdi nəticələrim" subtitle="Sizin şəxsi KPI kartları üzrə nəticələr." />
            <KpiScoresPage employeesOverride={own as any} hideChrome />
          </>
        )}
        {view === "team" && (
          <>
            <PageHero badge="Rəhbər Paneli" icon={Users} title="Komanda nəticələri" subtitle="Komandanızın KPI kartları üzrə nəticələri." />
            <KpiScoresPage employeesOverride={team as any} hideChrome />
          </>
        )}
        {view === "sub" && (
          <SubordinatesView
            scopePath={scopePath}
            actionsMode="results"
            title="Tabeçiliyimdəkilərin Nəticələri"
            subtitle="Əsas səhifə / KPI Nəticələri / Tabeçiliyimdəkilərin Nəticələri"
            onOpenEmployee={(empId, name) => setDetail({ empId, name })}
          />
        )}
      </main>

      {/* Nəticələr detalı — Eye ikonuna əsaslanan mövcud KpiScoresPage baxışı */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="w-[90vw] max-w-[1500px] h-[88vh] min-h-[88vh] max-h-[88vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border">
            <DialogTitle className="text-xl">Nəticələr — {detail?.name ?? "—"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {detailEmployee && (
              <KpiScoresPage employeesOverride={[detailEmployee] as any} hideChrome />
            )}
          </div>
        </DialogContent>
      </Dialog>
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

export default ManagerResultsPage;
