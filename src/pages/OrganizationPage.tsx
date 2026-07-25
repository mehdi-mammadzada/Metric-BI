import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import { PageHero, FancyCard } from "@/components/ui/page-hero";
import {
  Building2, Users, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Briefcase, UserPlus, Search, X, Check, KeyRound, ShieldCheck, UserCircle2,
  Eye, Folder, ChevronsLeft, ChevronsRight, ChevronLeft, Filter, Download,
  Wallet, ArrowUpRight, Network, Crown,
} from "lucide-react";

import chrLogo from "@/assets/chr-logo.jpeg";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getEmployees, updateEmployee, toggleEmployeeActive,
  getStructures,
  removePosition, removeStructure, canRemoveStructure, renameStructure, getAssignedEmployeeIds,
  setStarPerson, findLeaderStructuresOf, isStructureTypeInUse, isPositionInUse,
  type OrgEmployee, type OrgStructure, type OrgPosition, type LeaderStructInfo,
} from "@/lib/orgStore";
import { addPositionInCloud, addSlotsInCloud, addStructuresInCloud, assignSlotInCloud, createEmployeeInCloud, persistOrgNow, removeSlotInCloud, renameStructureInCloud, setStarPersonInCloud, updateOrganizationLogoInCloud } from "@/lib/orgService";


import {
  getStructureTypes, addStructureType, removeStructureType,
  getPositions, addPositionCatalog, removePositionCatalog,
} from "@/lib/catalogStore";
import SearchableSelect from "@/components/common/SearchableSelect";
import ColumnSearchHeader from "@/components/common/ColumnSearchHeader";
import { DataTable, type DataTableColumn } from "@/components/common/DataTable";
import { generateOtp } from "@/lib/passwordStore";
import { collectDeactivationReasons } from "@/lib/employeeDeactivation";
import DeactivateEmployeeDialog from "@/components/kpi/DeactivateEmployeeDialog";
// Rəhbəri dəyiş axını daha modal açmır — birbaşa Ştat cədvəlində tac ikonu klik ilə həll olunur.

// ── Ştat cədvəli — redaktə rejimi konteksti. Default olaraq oxu üçündür (readOnly=true).
// "Redaktə et" düyməsinə basdıqda kontekstdə readOnly=false olur və Vəzifə/Ştat əlavə et,
// silmə ikonları və sahə redaktəsi aktivləşir.
const StaffEditCtx = createContext<{ readOnly: boolean }>({ readOnly: true });

// ── Rəhbəri dəyiş konteksti: Ştat cədvəlində tac klikini müvəqqəti olaraq
// leader-swap əməliyyatına yönləndirir. Yalnız `changeLeaderFor` aktiv olduqda tətbiq olunur.
interface LeaderChangeCtxValue {
  oldLeaderId: number;
  leaderInfo: LeaderStructInfo;
  onPick: (newEmpId: number, sourceSlotId: number) => void;
}
const LeaderChangeCtx = createContext<LeaderChangeCtxValue | null>(null);

// One-time reset so employee table columns appear in code-defined order
if (!localStorage.getItem("__org_emp_order_fixed")) {
  localStorage.removeItem("org-employees:order");
  localStorage.setItem("__org_emp_order_fixed", "1");
}

const ORG_LOGO_KEY = "kpi_org_logo_v1";

const OrganizationPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: "struktur" | "emekdaslar" | "kataloq" | null =
    searchParams.get("tab") === "struktur" ? "struktur"
    : searchParams.get("tab") === "emekdaslar" ? "emekdaslar"
    : searchParams.get("tab") === "kataloq" ? "kataloq"
    : null;
  const [tab, setTab] = useState<"struktur" | "emekdaslar" | "kataloq" | null>(initialTab);
  const changeLeaderFor = searchParams.get("changeLeaderFor") ? Number(searchParams.get("changeLeaderFor")) : null;

  // Deep-link ilə (məs. /teskilati-struktur?tab=struktur&changeLeaderFor=4) səhifə açıldıqda
  // uyğun tabı avtomatik seçirik.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "struktur" || t === "emekdaslar" || t === "kataloq") setTab(t);
  }, [searchParams]);

  const clearChangeLeaderParam = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("changeLeaderFor");
    setSearchParams(next, { replace: true });
  };

  const [employees, setEmployeesState] = useState<OrgEmployee[]>(() => getEmployees());
  const [structures, setStructuresState] = useState<OrgStructure[]>(() => getStructures());
  const [orgLogo, setOrgLogo] = useState<string | null>(() => localStorage.getItem(ORG_LOGO_KEY));
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => {
      setEmployeesState(getEmployees());
      setStructuresState(getStructures());
      setOrgLogo(localStorage.getItem(ORG_LOGO_KEY));
    };
    window.addEventListener("org-updated", refresh);
    window.addEventListener("org-logo-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("org-updated", refresh);
      window.removeEventListener("org-logo-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.active).length;
    return { total: employees.length, active };
  }, [employees]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml)$/.test(file.type)) {
      toast.error(t("org.logo_error_format"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      localStorage.setItem(ORG_LOGO_KEY, url);
      setOrgLogo(url);
      void updateOrganizationLogoInCloud(url).catch(err => toast.error(err?.message || "Logo database-ə yazılmadı"));
      toast.success(orgLogo ? t("org.logo_toast_changed") : t("org.logo_toast_added"));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen">
      <Header title={t("org.page_title")} />
      <main className="p-6 pb-24">
        <PageHero
          badge={t("org.hero_badge")}
          icon={Building2}
          title={t("org.page_title")}
          subtitle={t("org.hero_subtitle")}
          left={
            <div className="flex items-center gap-2 pl-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
              {orgLogo ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="group relative h-16 w-16 rounded-xl border border-border bg-card overflow-hidden flex items-center justify-center shadow-sm"
                  title={t("org.logo_change")}
                >
                  <img src={orgLogo} alt={t("org.logo_alt")} className="max-h-14 max-w-14 object-contain" />
                  <span className="absolute inset-0 bg-black/50 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">{t("org.logo_change_short")}</span>
                </button>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 h-12 text-xs rounded-xl border border-dashed border-border bg-background hover:bg-secondary/40 text-muted-foreground"
                >
                  <Plus className="w-3.5 h-3.5" /> {t("org.logo_add")}
                </button>
              )}
            </div>
          }
        />


        {tab === null ? (
          <ModuleCards activeTab={tab} onSelectTab={setTab} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => setTab(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary/40 text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> {t("org.back")}
              </button>
              <TabToolbar total={stats.total} active={stats.active} />
            </div>
            {tab === "struktur" ? <StructureTab changeLeaderFor={changeLeaderFor} onClearChangeLeader={clearChangeLeaderParam} /> : tab === "emekdaslar" ? <EmployeesTab /> : <CatalogTab />}
          </div>
        )}
      </main>
    </div>
  );
};

const TabToolbar = ({ total, active }: { total: number; active: number }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary/40 transition-colors">
        <Download className="w-4 h-4 rotate-180" /> {t("org.excel_import")}
      </button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary/40 transition-colors">
        <img src={chrLogo} alt="" className="w-4 h-4 rounded" /> {t("org.chr_import")}
      </button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary/40 transition-colors">
        <img src={chrLogo} alt="" className="w-4 h-4 rounded" /> {t("org.chr_export")}
      </button>
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-muted-foreground">
        <Users className="w-4 h-4" /> <span className="font-medium text-foreground">{t("org.employees_count", { count: total })}</span> · {t("org.active_suffix", { count: active })}
      </div>
    </div>
  );
};

// ====================================================
// Module entry cards — Komandalar & Əməkhaqqı bazası
// ====================================================
type OrgTab = "struktur" | "emekdaslar" | "kataloq";
const ModuleCards = ({ activeTab, onSelectTab }: { activeTab: OrgTab | null; onSelectTab: (t: OrgTab) => void }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const cards: Array<{
    title: string;
    desc: string;
    icon: typeof Users;
    gradient: string;
    iconBg: string;
    tab?: OrgTab;
    path?: string;
  }> = [
    {
      title: t("org.card_structure"),
      desc: t("org.card_structure_desc"),
      icon: Network,
      gradient: "from-indigo-500/15 via-violet-500/10 to-transparent",
      iconBg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
      tab: "struktur",
    },
    {
      title: t("org.card_employees"),
      desc: t("org.card_employees_desc"),
      icon: UserCircle2,
      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      tab: "emekdaslar",
    },
    {
      title: t("org.card_catalog"),
      desc: t("org.card_catalog_desc"),
      icon: Folder,
      gradient: "from-fuchsia-500/15 via-pink-500/10 to-transparent",
      iconBg: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
      tab: "kataloq",
    },
    {
      title: t("org.card_teams"),
      desc: t("org.card_teams_desc"),
      icon: Users,
      path: "/komandalar",
      gradient: "from-blue-500/15 via-sky-500/10 to-transparent",
      iconBg: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    },
    {
      title: t("org.card_salary"),
      desc: t("org.card_salary_desc"),
      icon: Wallet,
      path: "/emekhaqqi-bazasi",
      gradient: "from-emerald-500/15 via-teal-500/10 to-transparent",
      iconBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-6">
      {cards.map(c => {
        const isActive = c.tab && c.tab === activeTab;
        return (
          <button
            key={c.title}
            onClick={() => c.tab ? onSelectTab(c.tab) : c.path && navigate(c.path)}
            className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br ${c.gradient} bg-card p-8 text-left hover:shadow-xl transition-all hover:-translate-y-1 min-h-[280px] flex flex-col ${isActive ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border"}`}
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
        );
      })}
    </div>
  );
};

// ====================================================
// Helpers
// ====================================================

const countAllPositions = (node: OrgStructure): number =>
  node.positions.length + node.children.reduce((s, c) => s + countAllPositions(c), 0);

const countAllSlots = (node: OrgStructure): number =>
  node.positions.reduce((s, p) => s + p.slots.length, 0) +
  node.children.reduce((s, c) => s + countAllSlots(c), 0);

// ====================================================
// Structure tab — card-based tree
// ====================================================

interface StructureTabProps {
  changeLeaderFor?: number | null;
  onClearChangeLeader?: () => void;
}

const StructureTab = ({ changeLeaderFor, onClearChangeLeader }: StructureTabProps) => {
  const [structures, setStructuresState] = useState<OrgStructure[]>(() => getStructures());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [leaderChange, setLeaderChange] = useState<LeaderStructInfo | null>(null);

  useEffect(() => {
    const refresh = () => setStructuresState(getStructures());
    window.addEventListener("org-updated", refresh);
    return () => window.removeEventListener("org-updated", refresh);
  }, []);

  const [showCreate, setShowCreate] = useState<{ parentId: number | null } | null>(null);
  const [newStruct, setNewStruct] = useState({ type: "", name: "", count: 1 });

  const [showChrImport, setShowChrImport] = useState(false);

  const [staffModalFor, setStaffModalFor] = useState<OrgStructure | null>(null);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // "Rəhbəri dəyiş" axını: passiv edilmək istənilən əməkdaşın rəhbəri olduğu
  // strukturu tap, ata strukturları expand et, node-u highlight et və
  // birbaşa Ştat cədvəlini aç ki, istifadəçi başqa əməkdaşın tacına klik etsin.
  const openLeaderChangeFor = (info: LeaderStructInfo) => {
    setExpanded(prev => {
      const next = new Set(prev);
      info.ancestorIds.forEach(id => next.add(id));
      next.add(info.node.id);
      return next;
    });
    setHighlightId(info.node.id);
    setLeaderChange(info);
    setStaffModalFor(info.node); // Ştat cədvəlini avtomatik aç
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-struct-id="${info.node.id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  useEffect(() => {
    if (!changeLeaderFor) return;
    const list = findLeaderStructuresOf(changeLeaderFor);
    if (list.length === 0) { onClearChangeLeader?.(); return; }
    openLeaderChangeFor(list[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeLeaderFor]);

  // Ştat cədvəlində yeni rəhbər tac klikilə seçildikdə çağırılır.
  const handleLeaderPick = async (newEmpId: number, sourceSlotId: number) => {
    if (!leaderChange || !changeLeaderFor) return;
    if (newEmpId === changeLeaderFor) return;
    try {
      // 1) Yeni rəhbəri rəhbər ştatına qoy və dərhal database-də saxla.
      await assignSlotInCloud(leaderChange.slotId, { employeeId: newEmpId });
      // 2) Yeni rəhbərin əvvəlki (mənbə) ştatını təmizlə — eyni şəxs iki ştatda qalmasın.
      if (sourceSlotId !== leaderChange.slotId) {
        await assignSlotInCloud(sourceSlotId, { employeeId: null });
      }
      // 3) Ulduz / rəhbər rolu bayrağını database-də sinxronla.
      await setStarPersonInCloud(changeLeaderFor, false);
      await setStarPersonInCloud(newEmpId, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rəhbər dəyişikliyi database-ə yazılmadı.");
      return;
    }

    // 4) Bu əməkdaş üçün digər struktur rəhbərliyi qalıbsa, növbəti mərhələyə keç.
    const remaining = findLeaderStructuresOf(changeLeaderFor);
    if (remaining.length > 0) {
      setStaffModalFor(null);
      setLeaderChange(null);
      setTimeout(() => openLeaderChangeFor(remaining[0]), 50);
      return;
    }
    // 5) Bütün rəhbər əlaqələri həll edildi → əməkdaşı avtomatik Passiv et.
    const emp = getEmployees().find(e => e.id === changeLeaderFor);
    const otherBlockers = collectDeactivationReasons(changeLeaderFor).filter(r => r.code !== "structure_leader");
    if (emp?.active && otherBlockers.length === 0) {
      toggleEmployeeActive(changeLeaderFor);
      toast.success("Struktur rəhbəri uğurla dəyişdirildi. Əməkdaş avtomatik olaraq Passiv statusuna keçirildi.");
    } else {
      toast.success("Struktur rəhbəri uğurla dəyişdirildi.");
    }
    setStaffModalFor(null);
    setLeaderChange(null);
    setHighlightId(null);
    onClearChangeLeader?.();
  };




  const handleCreate = async () => {
    if (!newStruct.type.trim()) { toast.error("Struktur tipini daxil edin"); return; }
    const count = Math.max(1, Math.min(50, Number(newStruct.count) || 1));
    try {
      await addStructuresInCloud(showCreate?.parentId ?? null, newStruct.type.trim(), count);
      toast.success(count > 1 ? `${count} struktur yaradıldı — database-də saxlandı` : "Struktur yaradıldı — database-də saxlandı");
      setShowCreate(null);
      setNewStruct({ type: "", name: "", count: 1 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Struktur database-ə yazılmadı.");
    }
  };

  // Sync the staffModal data with latest tree
  const liveStaffModal = useMemo(() => {
    if (!staffModalFor) return null;
    const find = (nodes: OrgStructure[]): OrgStructure | null => {
      for (const n of nodes) {
        if (n.id === staffModalFor.id) return n;
        const r = find(n.children);
        if (r) return r;
      }
      return null;
    };
    return find(structures);
  }, [structures, staffModalFor]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setShowCreate({ parentId: null }); setNewStruct({ type: "", name: "", count: 1 }); }}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="w-4 h-4" /> Yeni struktur yarat
        </button>
      </div>


      {structures.length === 0 ? (
        <FancyCard>
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Hələ struktur yaradılmayıb. Yeni struktur yarat.</p>
          </div>
        </FancyCard>
      ) : (
        <div className="space-y-3">
          {structures.map(node => (
            <StructureCard
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggleExpand}
              onAddSub={(parentId) => { setShowCreate({ parentId }); setNewStruct({ type: "", name: "", count: 1 }); }}
              onOpenStaff={setStaffModalFor}
              highlightId={highlightId}
            />
          ))}
        </div>
      )}

      {/* Create structure dialog (manual type input) */}
      <Dialog open={!!showCreate} onOpenChange={() => setShowCreate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{showCreate?.parentId == null ? "Yeni struktur yarat" : "Sub-struktur yarat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Struktur tipi</label>
              <Select value={newStruct.type} onValueChange={(v) => setNewStruct(p => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Tip seçin" /></SelectTrigger>
                <SelectContent>
                  {getStructureTypes().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Tipləri Kataloq tabından idarə edin</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Struktur sayı</label>
              <input
                type="number"
                min={1}
                max={50}
                value={newStruct.count}
                onChange={e => setNewStruct(p => ({ ...p, count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Yazılan say qədər struktur yaranacaq. Yaradıldıqdan sonra hər birini ayrıca adlandıra bilərsiniz.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} className="flex-1 py-2.5 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium">Yarat</button>
              <button onClick={() => setShowCreate(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff (positions + slots) modal — Rəhbəri dəyiş rejimində
          tac ikonu klik ilə leader-swap tetiklənir (LeaderChangeCtx vasitəsilə). */}
      <LeaderChangeCtx.Provider
        value={
          changeLeaderFor && leaderChange
            ? { oldLeaderId: changeLeaderFor, leaderInfo: leaderChange, onPick: handleLeaderPick }
            : null
        }
      >
        <StaffModal
          node={liveStaffModal}
          onClose={() => {
            setStaffModalFor(null);
            if (leaderChange) {
              setLeaderChange(null);
              setHighlightId(null);
              onClearChangeLeader?.();
            }
          }}
        />
      </LeaderChangeCtx.Provider>

      <ChrImportDialog open={showChrImport} onClose={() => setShowChrImport(false)} />
    </div>
  );
};

const typeColorMap: Record<string, { bg: string; text: string; iconBg: string; iconText: string }> = {
  Departament: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", iconBg: "from-blue-500/10 to-sky-500/10", iconText: "text-blue-600" },
  Şöbə:      { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", iconBg: "from-emerald-500/10 to-teal-500/10", iconText: "text-emerald-600" },
  Sektor:    { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", iconBg: "from-amber-500/10 to-orange-500/10", iconText: "text-amber-600" },
  Qrup:      { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", iconBg: "from-purple-500/10 to-violet-500/10", iconText: "text-purple-600" },
  Komanda:   { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", iconBg: "from-rose-500/10 to-pink-500/10", iconText: "text-rose-600" },
};

const getTypeColors = (type: string) => {
  const colors = typeColorMap[type];
  if (colors) return colors;
  // Fallback for unknown types — hash-based deterministic color
  const hash = Array.from(type).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  const fallbacks = [
    { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", iconBg: "from-cyan-500/10 to-teal-500/10", iconText: "text-cyan-600" },
    { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", iconBg: "from-indigo-500/10 to-violet-500/10", iconText: "text-indigo-600" },
    { bg: "bg-lime-500/10", text: "text-lime-600 dark:text-lime-400", iconBg: "from-lime-500/10 to-green-500/10", iconText: "text-lime-600" },
    { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", iconBg: "from-fuchsia-500/10 to-purple-500/10", iconText: "text-fuchsia-600" },
    { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", iconBg: "from-orange-500/10 to-red-500/10", iconText: "text-orange-600" },
  ];
  return fallbacks[hash % fallbacks.length];
};

interface StructureCardProps {
  node: OrgStructure;
  depth: number;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onAddSub: (parentId: number) => void;
  onOpenStaff: (n: OrgStructure) => void;
  highlightId?: number | null;
}

const StructureCard = ({ node, depth, expanded, onToggle, onAddSub, onOpenStaff, highlightId }: StructureCardProps) => {
  const isOpen = expanded.has(node.id);
  const isHighlighted = highlightId != null && highlightId === node.id;
  const positionsCount = countAllPositions(node);
  const slotsCount = countAllSlots(node);
  const colors = getTypeColors(node.type);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(node.name);

  useEffect(() => { setDraftName(node.name); }, [node.name]);

  const commitRename = async () => {
    const v = draftName.trim();
    if (!v) { setDraftName(node.name); setEditing(false); return; }
    if (v !== node.name) {
      try {
        await renameStructureInCloud(node.id, v);
        toast.success("Ad yeniləndi");
      } catch (err) {
        setDraftName(node.name);
        toast.error(err instanceof Error ? err.message : "Ad database-ə yazılmadı.");
      }
    }
    setEditing(false);
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const check = canRemoveStructure(node.id);
    if (check.ok !== true) {
      toast.error(check.reason, { duration: 6000 });
      return;
    }

    setConfirmDelete(true);
  };

  const doDelete = () => {
    try {
      removeStructure(node.id);
      toast.success("Struktur silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinmə mümkün olmadı");
    }
    setConfirmDelete(false);
  };


  return (
    <div style={{ marginLeft: depth ? 24 : 0 }} className="animate-fade-in" data-struct-id={node.id}>
      <div className={`rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden ${isHighlighted ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-border"}`}>
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => onToggle(node.id)}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Aç/Bağla"
          >
            {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>

          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.iconBg} flex items-center justify-center`}>
            <Folder className={`w-5 h-5 ${colors.iconText}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-semibold`}>{node.type}</span>
              {editing ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setDraftName(node.name); setEditing(false); } }}
                  className="px-2 py-1 text-sm font-semibold border border-border rounded-md bg-background min-w-0 flex-1"
                />
              ) : (
                <>
                  <h3 className="font-semibold text-foreground truncate">{node.name}</h3>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 rounded hover:bg-secondary transition-colors"
                    aria-label="Adı dəyiş"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Briefcase className="w-3 h-3" /> {positionsCount} vəzifə</span>
              <span className="inline-flex items-center gap-1"><UserCircle2 className="w-3 h-3" /> {slotsCount} ştat</span>
              <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {node.children.length} sub-struktur</span>
            </div>
          </div>

          <button
            onClick={() => onOpenStaff(node)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Ştat cədvəlinə bax
          </button>
          <button
            onClick={() => onAddSub(node.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-md transition-shadow"
          >
            <Plus className="w-3.5 h-3.5" /> Sub-struktur
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>

      {isOpen && node.children.length > 0 && (
        <div className="mt-3 space-y-3 animate-accordion-down">
          {node.children.map(child => (
            <StructureCard
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onAddSub={onAddSub}
              onOpenStaff={onOpenStaff}
              highlightId={highlightId}
            />
          ))}
        </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Strukturu sil</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">"{node.name}"</span> strukturunu silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv et</button>
            <button onClick={doDelete} className="flex-1 py-2.5 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium">Sil</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


// ====================================================
// Staff Modal — positions + slots for a structure
// ====================================================

const StaffModal = ({ node, onClose }: { node: OrgStructure | null; onClose: () => void }) => {
  const [showAddPos, setShowAddPos] = useState(false);
  const [newPosName, setNewPosName] = useState("");
  const [search, setSearch] = useState("");

  const handleCreatePos = async () => {
    if (!node || !newPosName.trim()) return;
    try {
      await addPositionInCloud(node.id, newPosName.trim());
      toast.success("Vəzifə yaradıldı və database-də saxlandı");
      setNewPosName("");
      setShowAddPos(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Vəzifə database-ə yazılmadı.");
    }
  };

  const filteredPositions = useMemo(() => {
    if (!node) return [];
    const q = search.trim().toLowerCase();
    if (!q) return node.positions;
    return node.positions.filter(p => p.name.toLowerCase().includes(q));
  }, [node, search]);

  return (
    <Dialog open={!!node} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Ştat cədvəli — {node?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border">
          <p className="text-xs text-muted-foreground">{node && countAllPositions(node)} vəzifə · {node && countAllSlots(node)} ştat</p>
          <button
            onClick={() => setShowAddPos(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" /> Vəzifə əlavə et
          </button>
        </div>

        <div className="pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ad, soyad və ya vəzifə üzrə axtar..."
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 py-3 space-y-3">
          {node && node.positions.length === 0 && (
            <div className="py-12 text-center">
              <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Bu strukturda vəzifə yoxdur</p>
            </div>
          )}
          {node && node.positions.length > 0 && filteredPositions.length === 0 && (
            <p className="text-sm text-center text-muted-foreground py-6">Nəticə yoxdur</p>
          )}
          {filteredPositions.map(pos => (
            <PositionCard key={pos.id} position={pos} structureId={node!.id} structureName={node!.name} />
          ))}

        </div>

        {showAddPos && (
          <div className="border-t border-border pt-3 flex items-center gap-2">
            <div className="flex-1">
              <PositionPicker value={newPosName} onChange={setNewPosName} />
            </div>
            <button onClick={handleCreatePos} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground">Əlavə et</button>
            <button onClick={() => { setShowAddPos(false); setNewPosName(""); }} className="px-3 py-2 text-sm rounded-lg border border-border">Ləğv et</button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};

const FRACTION_OPTIONS: { value: 1 | 0.75 | 0.5 | 0.25; label: string }[] = [
  { value: 1, label: "Tam ştat (1.00)" },
  { value: 0.75, label: "0.75 ştat" },
  { value: 0.5, label: "Yarım ştat (0.50)" },
  { value: 0.25, label: "0.25 ştat" },
];

const PositionCard = ({ position, structureId, structureName }: { position: OrgPosition; structureId: number; structureName: string }) => {
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotCount, setSlotCount] = useState(1);
  const [slotFraction, setSlotFraction] = useState<1 | 0.75 | 0.5 | 0.25>(1);

  const handleDelete = () => {
    if (!confirm(`"${position.name}" vəzifəsini silmək istəyirsiniz?`)) return;
    removePosition(position.id);
    toast.success("Vəzifə silindi");
  };

  const handleAddSlots = async () => {
    const n = Math.max(1, Math.min(100, Number(slotCount) || 1));
    try {
      await addSlotsInCloud(position.id, n, slotFraction);
      setShowAddSlot(false);
      setSlotCount(1);
      setSlotFraction(1);
      toast.success(n > 1 ? `${n} ştat əlavə edildi` : "Ştat əlavə edildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ştat database-ə yazılmadı.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Briefcase className="w-4 h-4 text-amber-600" />
        <span className="font-medium text-foreground flex-1">{position.name}</span>
        <span className="text-xs text-muted-foreground">{position.slots.length} ştat</span>
        <button
          onClick={() => setShowAddSlot(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> Ştat əlavə et
        </button>
        <button onClick={handleDelete} className="p-1 rounded hover:bg-destructive/10">
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </button>
      </div>

      <div className="divide-y divide-border">
        {position.slots.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground text-center">Heç bir ştat yoxdur</p>
        ) : position.slots.map((slot, i) => (
          <SlotRow key={slot.id} slot={slot} index={i + 1} />
        ))}
      </div>

      <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ştat əlavə et — {position.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Ştat sayı</label>
              <input
                type="number"
                min={1}
                max={100}
                value={slotCount}
                onChange={e => setSlotCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Ştat vahidi</label>
              <Select value={String(slotFraction)} onValueChange={(v) => setSlotFraction(Number(v) as 1 | 0.75 | 0.5 | 0.25)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRACTION_OPTIONS.map(f => (
                    <SelectItem key={f.value} value={String(f.value)}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddSlots} className="flex-1 py-2.5 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium">Əlavə et</button>
              <button onClick={() => setShowAddSlot(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SlotRowProps { slot: { id: number; employeeId: number | null; salary: number | null; fraction?: 1 | 0.75 | 0.5 | 0.25 }; index: number; }

const SlotRow = ({ slot, index }: SlotRowProps) => {
  const [employees, setEmployees] = useState<OrgEmployee[]>(() => getEmployees());
  const [salaryDraft, setSalaryDraft] = useState(slot.salary != null ? String(slot.salary) : "");
  useEffect(() => {
    const r = () => setEmployees(getEmployees());
    window.addEventListener("org-updated", r);
    return () => window.removeEventListener("org-updated", r);
  }, []);
  useEffect(() => {
    setSalaryDraft(slot.salary != null ? String(slot.salary) : "");
  }, [slot.id, slot.salary]);

  const assignedIds = useMemo(() => getAssignedEmployeeIds(), [employees]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const current = slot.employeeId ? employees.find(e => e.id === slot.employeeId) : null;
  const available = employees.filter(e =>
    e.active &&
    (!assignedIds.has(e.id) || e.id === slot.employeeId) &&
    `${e.firstName} ${e.lastName} ${e.fin}`.toLowerCase().includes(search.toLowerCase()),
  );

  const leaderCtx = useContext(LeaderChangeCtx);
  const handleToggleStar = async () => {
    if (!current) return;
    // Rəhbəri dəyiş rejimi aktivdirsə tac klik yeni rəhbər seçimi kimi işləyir.
    if (leaderCtx) {
      if (current.id === leaderCtx.oldLeaderId) {
        toast.info("Bu köhnə rəhbərdir. Başqa aktiv əməkdaşın tacına klik edin.");
        return;
      }
      if (!current.active) {
        toast.error("Yalnız Aktiv əməkdaş rəhbər təyin edilə bilər.");
        return;
      }
      leaderCtx.onPick(current.id, slot.id);
      return;
    }
    const next = !current.isStarPerson;
    try {
      await setStarPersonInCloud(current.id, next);
      if (next) {
        toast.success(`⭐ ${current.firstName} ${current.lastName} — Rəhbər rolu təyin edildi`);
      } else {
        toast.info(`${current.firstName} ${current.lastName} — Rəhbər rolu geri götürüldü`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rəhbər rolu database-ə yazılmadı.");
    }
  };

  const isStar = !!current?.isStarPerson;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 ${isStar ? "bg-amber-500/5" : ""}`}>
      <span className="text-xs text-muted-foreground w-6">{index}.</span>
      {current ? (
        <button
          onClick={handleToggleStar}
          title={isStar ? "Rəhbər rolunu ləğv et" : "Bu şəxsə Rəhbər rolu ver (kaskadlama)"}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shrink-0 ${
            isStar
              ? "bg-amber-400 text-white shadow-sm hover:bg-amber-500"
              : "bg-secondary text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
          }`}
        >
          <Crown className={`w-3.5 h-3.5 ${isStar ? "fill-white" : ""}`} />
        </button>
      ) : (
        <UserCircle2 className="w-4 h-4 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-full text-left px-3 py-2 text-sm border border-border rounded-lg bg-background hover:bg-secondary/30 flex items-center justify-between gap-2"
            >
              <span className="truncate">
                {current ? `${current.firstName} ${current.lastName}` : <span className="text-muted-foreground">Əməkdaş seç</span>}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={4} className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Ad, soyad və ya FİN ilə axtar..."
                  className="w-full pl-8 pr-2 py-2 text-sm border border-border rounded-md bg-background focus:ring-2 focus:ring-primary/30 focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {current && (
                <button
                  onClick={async () => {
                    setOpen(false);
                    try {
                      await assignSlotInCloud(slot.id, { employeeId: null });
                      toast.success("Təyinat ləğv edildi");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Təyinat database-də ləğv edilmədi.");
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-destructive/5 border-b border-border flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> Təyinatı ləğv et
                </button>
              )}
              {available.length === 0 && (
                <p className="px-3 py-6 text-xs text-muted-foreground text-center">Müsait əməkdaş yoxdur</p>
              )}
              {available.map(e => (
                <button
                  key={e.id}
                  onClick={async () => {
                    setOpen(false);
                    try {
                      await assignSlotInCloud(slot.id, { employeeId: e.id });
                      toast.success("Əməkdaş təyin edildi");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Əməkdaş təyinatı database-ə yazılmadı.");
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/40 flex items-center justify-between gap-3 ${e.id === slot.employeeId ? 'bg-primary/5' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate">{e.firstName} {e.lastName}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">FİN: {e.fin}</p>
                  </div>
                  {e.id === slot.employeeId && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <Select
        value={String(slot.fraction ?? 1)}
        onValueChange={async (v) => {
          try {
            await assignSlotInCloud(slot.id, { fraction: Number(v) as 1 | 0.75 | 0.5 | 0.25 });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Ştat vahidi database-ə yazılmadı.");
          }
        }}
      >
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Tam (1.00)</SelectItem>
          <SelectItem value="0.75">0.75</SelectItem>
          <SelectItem value="0.5">Yarım (0.50)</SelectItem>
          <SelectItem value="0.25">0.25</SelectItem>
        </SelectContent>
      </Select>
      <input
        type="number"
        placeholder="Maaş (AZN)"
        value={salaryDraft}
        onChange={e => setSalaryDraft(e.target.value)}
        onBlur={async () => {
          try {
            await assignSlotInCloud(slot.id, { salary: salaryDraft ? Number(salaryDraft) : null });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Maaş database-ə yazılmadı.");
          }
        }}
        className="w-32 px-2 py-1.5 text-sm border border-border rounded-lg bg-background"
      />
      <button
        onClick={async () => {
          try {
            await removeSlotInCloud(slot.id);
            toast.success("Ştat silindi");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Ştat database-dən silinmədi.");
          }
        }}
        className="p-1 rounded hover:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </button>
    </div>
  );
};

// Position picker using Popover (portal) so it never gets clipped by dialog overflow.
const PositionPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const options = useMemo(() => getPositions(), [open]);
  const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(q.toLowerCase())), [options, q]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full min-h-[38px] px-3 py-2 text-sm border border-border rounded-lg bg-background flex items-center justify-between gap-2">
          <span className={value ? "text-foreground truncate" : "text-muted-foreground truncate"}>{value || "Vəzifə seçin (kataloqdan)"}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Axtar..." className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded bg-background" />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">Nəticə yoxdur</div>
          ) : filtered.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false); setQ(""); }} className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${o === value ? "bg-primary/5" : ""}`}>
              <span className="truncate">{o}</span>
              {o === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};


// ====================================================
// Employees tab — with filters, pagination, numbering
// ====================================================

// ==============================
// Validation helpers
// ==============================
const NAME_LETTERS = "A-Za-zƏəĞğİıÖöŞşÜüÇçÂâ";
const NAME_CHAR_RE = new RegExp(`[^${NAME_LETTERS} \\-]`, "g");
const NAME_VALID_RE = new RegExp(`^[${NAME_LETTERS}\\-]+(?: [${NAME_LETTERS}\\-]+)*$`);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeName = (v: string) => v.replace(NAME_CHAR_RE, "").replace(/\s{2,}/g, " ").replace(/^\s+/, "");
const validateName = (v: string, label: string, required = true): string | null => {
  const t = v.trim();
  if (!t) return required ? `${label} daxil edin.` : null;
  if (t.length < 2) return `${label} minimum 2 simvol olmalıdır.`;
  if (t.length > 50) return `${label} maksimum 50 simvol olmalıdır.`;
  if (!NAME_VALID_RE.test(t)) return `${label} yalnız hərflərdən və defis (-) işarəsindən ibarət olmalıdır.`;
  return null;
};

// FİN: yalnız rəqəmlər və ingilis əlifbasının böyük hərfləri (I və O istisna)
const sanitizeFin = (v: string) => v.toUpperCase().replace(/[^A-HJ-NP-Z0-9]/g, "").slice(0, 7);
const validateFin = (v: string): string | null => {
  if (!v) return "FİN daxil edin.";
  if (v.length !== 7) return "FİN 7 simvoldan ibarət olmalıdır.";
  if (!/^[A-HJ-NP-Z0-9]{7}$/.test(v)) return "FİN yalnız rəqəmlər və hərflərdən (I, O istisna) ibarət olmalıdır.";
  return null;
};

// Xarici vətəndaş üçün "Digər" identifikatoru — dəqiq 10 simvol
const sanitizeOther = (v: string) => v.replace(/\s+/g, "").slice(0, 10);
const validateOther = (v: string): string | null => {
  if (!v) return "Digər sahəsi daxil edin.";
  if (v.length !== 10) return "Digər sahəsi dəqiq 10 simvoldan ibarət olmalıdır.";
  return null;
};

const phoneDigits = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("994")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
};
const formatPhone = (raw: string) => {
  const d = phoneDigits(raw);
  if (!d) return "";
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 7);
  const p4 = d.slice(7, 9);
  let out = "+994";
  if (p1) out += " " + p1;
  if (p2) out += " " + p2;
  if (p3) out += " " + p3;
  if (p4) out += " " + p4;
  return out;
};
const validatePhone = (v: string): string | null => {
  const d = phoneDigits(v);
  if (!d) return "Telefon nömrəsi daxil edin.";
  if (d.length !== 9) return "Düzgün telefon nömrəsi daxil edin.";
  return null;
};
const validateEmail = (v: string, existingLower: string[]): string | null => {
  const t = v.trim().toLowerCase();
  if (!t) return "Email daxil edin.";
  if (!EMAIL_RE.test(t)) return "Düzgün email ünvanı daxil edin.";
  if (existingLower.includes(t)) return "Bu email artıq istifadə olunur.";
  return null;
};

type EmployeeFormState = { firstName: string; lastName: string; fatherName: string; fin: string; phone: string; email: string };
const emptyEmployeeForm: EmployeeFormState = { firstName: "", lastName: "", fatherName: "", fin: "", phone: "", email: "" };

const ValidatedField = ({
  label, value, onChange, error, mono, placeholder, disabled, required = true,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string | null;
  mono?: boolean; placeholder?: string; disabled?: boolean; required?: boolean;
}) => (
  <div>
    <label className="text-sm font-medium text-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={`w-full mt-1 px-3 py-2.5 text-sm border rounded-lg bg-background ${mono ? 'font-mono' : ''} ${
        error ? 'border-destructive focus:outline-none focus:ring-1 focus:ring-destructive' : 'border-border'
      } ${disabled ? 'bg-muted/40 cursor-not-allowed text-muted-foreground' : ''}`}
    />
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

const EmployeesTab = () => {
  const [employees, setEmployeesState] = useState<OrgEmployee[]>(() => getEmployees());
  useEffect(() => {
    const r = () => setEmployeesState(getEmployees());
    window.addEventListener("org-updated", r);
    return () => window.removeEventListener("org-updated", r);
  }, []);

  const [search, setSearch] = useState("");
  

  // Filters
  const [filterStructure, setFilterStructure] = useState<string>("");
  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showChrImport, setShowChrImport] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", fatherName: "", fin: "", phone: "", email: "" });
  const [citizenship, setCitizenship] = useState<"az" | "foreign">("az");

  const [editing, setEditing] = useState<OrgEmployee | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", fatherName: "", fin: "", phone: "", email: "" });


  const [otpDialog, setOtpDialog] = useState<{ user: OrgEmployee; code: string } | null>(null);
  const [deactivateDialog, setDeactivateDialog] = useState<{ name: string; reasons: import("@/lib/employeeDeactivation").DeactivationReason[] } | null>(null);

  const handleStatusToggle = (e: OrgEmployee) => {
    // Passiv → Aktiv keçidi sərbəstdir
    if (!e.active) { toggleEmployeeActive(e.id); toast.success("Əməkdaş uğurla aktiv edildi."); return; }
    const reasons = collectDeactivationReasons(e.id);
    if (reasons.length > 0) {
      const nm = [e.firstName, e.lastName, e.fatherName].filter(Boolean).join(" ");
      setDeactivateDialog({ name: nm, reasons });
      return;
    }
    toggleEmployeeActive(e.id);
    toast.success("Əməkdaş uğurla passiv edildi.");
  };

  const structureOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => e.structurePath && set.add(e.structurePath));
    return Array.from(set);
  }, [employees]);

  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => e.positionName && set.add(e.positionName));
    return Array.from(set);
  }, [employees]);

  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const setColFilter = (k: string, v: string) => setColFilters(p => ({ ...p, [k]: v }));

  const fullNameOf = (e: OrgEmployee) => [e.firstName, e.lastName, e.fatherName].filter(Boolean).join(" ");

  const filtered = useMemo(() => employees.filter(e => {
    if (search && !`${e.firstName} ${e.lastName} ${e.fatherName || ""} ${e.fin} ${e.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStructure && e.structurePath !== filterStructure) return false;
    if (filterPosition && e.positionName !== filterPosition) return false;
    if (filterStatus === "active" && !e.active) return false;
    if (filterStatus === "inactive" && e.active) return false;
    const l = (s: string) => s.toLowerCase();
    const cf = colFilters;
    if (cf.fullName && !l(fullNameOf(e)).includes(l(cf.fullName))) return false;
    if (cf.email && !l(e.email).includes(l(cf.email))) return false;
    if (cf.position && !l(e.positionName || "").includes(l(cf.position))) return false;
    if (cf.salary && !String(e.salary ?? "").toLowerCase().includes(l(cf.salary))) return false;
    if (cf.status) {
      const st = e.active ? "aktiv" : "deaktiv";
      if (!st.includes(l(cf.status))) return false;
    }
    if (cf.struct && !l(e.structurePath || "").includes(l(cf.struct))) return false;
    return true;
  }), [employees, search, filterStructure, filterPosition, filterStatus, colFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [search, filterStructure, filterPosition, filterStatus, pageSize]);

  const emailsExcluding = (excludeId?: number) =>
    employees.filter(e => e.id !== excludeId).map(e => e.email.trim().toLowerCase());
  const finsExcluding = (excludeId?: number) =>
    employees.filter(e => e.id !== excludeId).map(e => e.fin);

  const createErrors = useMemo(() => ({
    firstName: validateName(form.firstName, "Ad"),
    lastName: validateName(form.lastName, "Soyad"),
    fatherName: validateName(form.fatherName, "Ata adı", false),
    fin: citizenship === "foreign"
      ? (validateOther(form.fin) || (finsExcluding().includes(form.fin) ? "Bu identifikator artıq sistemdə mövcuddur." : null))
      : (validateFin(form.fin) || (finsExcluding().includes(form.fin) ? "Bu FİN artıq sistemdə mövcuddur." : null)),
    email: validateEmail(form.email, emailsExcluding()),
  }), [form, employees, citizenship]);
  const createValid = Object.values(createErrors).every(v => !v);

  const editErrors = useMemo(() => ({
    firstName: validateName(editForm.firstName, "Ad"),
    lastName: validateName(editForm.lastName, "Soyad"),
    fatherName: validateName(editForm.fatherName, "Ata adı", false),
    phone: validatePhone(editForm.phone),
    // email intentionally excluded — not editable in edit dialog
  }), [editForm, employees, editing]);
  const editValid = Object.values(editErrors).every(v => !v);

  const handleCreate = async () => {
    if (!createValid) { toast.error("Formu düzgün doldurun"); return; }
    setCreatingEmployee(true);
    try {
      await createEmployeeInCloud({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fatherName: form.fatherName.trim() || "-",
        fin: form.fin.trim(),
        phone: "",
        email: form.email.trim(),
      });
      toast.success("Əməkdaş database-də yaradıldı");
      setShowCreate(false);
      setForm(emptyEmployeeForm);
      setCitizenship("az");
    } catch (error: any) {
      toast.error(error?.message || "Əməkdaş yaradılmadı. Database yazısını yoxlayın.");
    } finally {
      setCreatingEmployee(false);
    }
  };

  const startEdit = (e: OrgEmployee) => {
    setEditing(e);
    setEditForm({ firstName: e.firstName, lastName: e.lastName, fatherName: e.fatherName || "", fin: e.fin, phone: formatPhone(e.phone) || e.phone, email: e.email });
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editValid) { toast.error("Formu düzgün doldurun"); return; }
    const { fin: _ignored, email: _eignored, ...rest } = editForm;
    updateEmployee(editing.id, {
      firstName: rest.firstName.trim(),
      lastName: rest.lastName.trim(),
      fatherName: rest.fatherName.trim() || "-",
      phone: formatPhone(rest.phone),
      // email intentionally not updated — not editable
    });
    toast.success("Yeniləndi");
    setEditing(null);
  };

  const handleOtp = (e: OrgEmployee) => {
    if (!e.email) { toast.error("Email yoxdur"); return; }
    const code = generateOtp(e.email);
    setOtpDialog({ user: e, code });
  };

  const clearFilters = () => {
    setFilterStructure(""); setFilterPosition(""); setFilterStatus("all");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div />

        <div className="flex items-center gap-2 flex-wrap">
          {/* CHR import moved to org-level action bar */}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Yeni əməkdaş yarat
          </button>
        </div>
      </div>

      {showFilters && (
        <FancyCard>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Struktur</label>
              <select value={filterStructure} onChange={e => setFilterStructure(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="">Hamısı</option>
                {structureOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Vəzifə</label>
              <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="">Hamısı</option>
                {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as "all" | "active" | "inactive")} className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background">
                <option value="all">Hamısı</option>
                <option value="active">Aktiv</option>
                <option value="inactive">Deaktiv</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={clearFilters} className="px-3 py-2 text-sm rounded-lg border border-border bg-background w-full">Sıfırla</button>
            </div>
          </div>
        </FancyCard>
      )}

      <FancyCard>
        {(() => {
          const splitPath = (p?: string) => (p ? p.split(" › ") : []);
          const maxDepth = filtered.reduce((m, e) => Math.max(m, splitPath(e.structurePath).length), 0);
          const structHeaders = Array.from({ length: maxDepth }, (_, i) => {
            if (i === 0) return "Struktur";
            if (i === 1) return "Sub-struktur";
            return `Sub-struktur ${i}`;
          });
          const structCols: DataTableColumn<OrgEmployee>[] = structHeaders.map((h, i) => ({
            key: `struct_${i}`,
            label: h,
            filterType: "text",
            accessor: (e) => splitPath(e.structurePath)[i] || "",
            render: (e) => splitPath(e.structurePath)[i] || <span className="text-muted-foreground italic">—</span>,
          }));
          const cols: DataTableColumn<OrgEmployee>[] = [
            {
              key: "op", label: "Əməliyyat", width: 110, align: "center", filterType: "none",
              render: (e) => (
                <div className="flex items-center gap-1 justify-center">
                  <button onClick={() => startEdit(e)} title="Redaktə et" className="p-1.5 rounded hover:bg-secondary">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleOtp(e)} title="Şifrə yarat" className="p-1.5 rounded hover:bg-primary/10">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                  </button>
                </div>
              ),
            },
            { key: "fullName", label: "Əməkdaşın A.S.A.", filterType: "text", accessor: (e) => fullNameOf(e), render: (e) => <span className="font-medium">{fullNameOf(e) || <span className="text-muted-foreground italic">—</span>}</span> },
            { key: "email", label: "Email", filterType: "text", accessor: (e) => e.email, render: (e) => <span className="text-muted-foreground">{e.email}</span> },
            ...structCols,
            { key: "position", label: "Vəzifə", filterType: "text", accessor: (e) => e.positionName || "", render: (e) => e.positionName || <span className="text-muted-foreground italic">—</span> },
            { key: "salary", label: "Əməkhaqqı", filterType: "number", accessor: (e) => e.salary ?? 0, render: (e) => e.salary ? `${e.salary} ₼` : <span className="text-muted-foreground italic">—</span> },
            {
              key: "status", label: "Status", filterType: "select", selectOptions: ["Aktiv", "Deaktiv"],
              accessor: (e) => e.active ? "Aktiv" : "Deaktiv",
              render: (e) => (
                <button
                  onClick={() => handleStatusToggle(e)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${e.active ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${e.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              ),
            },
          ];
          return (
            <DataTable<OrgEmployee>
              rows={filtered}
              rowKey={(e) => e.id}
              storageKey="org-employees"
              emptyMessage="Əməkdaş tapılmadı"
              columns={cols}
            />
          );
        })()}
      </FancyCard>

      <DeactivateEmployeeDialog
        open={!!deactivateDialog}
        onOpenChange={(o) => { if (!o) setDeactivateDialog(null); }}
        employeeName={deactivateDialog?.name || ""}
        reasons={deactivateDialog?.reasons || []}
        onConfirm={() => {
          if (!deactivateDialog) return;
          const reasons = deactivateDialog.reasons;
          const target = employees.find(x => [x.firstName, x.lastName, x.fatherName].filter(Boolean).join(" ") === deactivateDialog.name);
          if (target) toggleEmployeeActive(target.id);
          const isSingleKpi = reasons.length === 1 && reasons[0].code === "kpi_active";
          toast.success(isSingleKpi
            ? "Əməkdaş uğurla passiv edildi."
            : "Əməkdaş uğurla passiv edildi. Aktiv KPI və struktur əlaqələrini yeniləməyiniz tövsiyə olunur.");
        }}
      />







      {/* Create employee */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) { setForm(emptyEmployeeForm); setCitizenship("az"); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Yeni əməkdaş yarat</DialogTitle></DialogHeader>

          <div className="mb-1">
            <label className="text-sm font-medium text-foreground">Vətəndaşlıq</label>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="citizenship"
                  checked={citizenship === "az"}
                  onChange={() => { setCitizenship("az"); setForm(p => ({ ...p, fin: "" })); }}
                  className="w-4 h-4 accent-primary"
                />
                <span>Azərbaycan vətəndaşı</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="citizenship"
                  checked={citizenship === "foreign"}
                  onChange={() => { setCitizenship("foreign"); setForm(p => ({ ...p, fin: "" })); }}
                  className="w-4 h-4 accent-primary"
                />
                <span>Xarici vətəndaş</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ValidatedField label="Ad" value={form.firstName} error={createErrors.firstName}
              onChange={v => setForm(p => ({ ...p, firstName: sanitizeName(v).slice(0, 50) }))} />
            <ValidatedField label="Soyad" value={form.lastName} error={createErrors.lastName}
              onChange={v => setForm(p => ({ ...p, lastName: sanitizeName(v).slice(0, 50) }))} />
            <ValidatedField label="Ata adı" value={form.fatherName} error={createErrors.fatherName} required={false}
              onChange={v => setForm(p => ({ ...p, fatherName: sanitizeName(v).slice(0, 50) }))} />
            {citizenship === "foreign" ? (
              <ValidatedField label="Digər" value={form.fin} mono error={createErrors.fin}
                placeholder="Dəqiq 10 simvol"
                onChange={v => setForm(p => ({ ...p, fin: sanitizeOther(v) }))} />
            ) : (
              <ValidatedField label="FİN" value={form.fin} mono error={createErrors.fin}
                onChange={v => setForm(p => ({ ...p, fin: sanitizeFin(v) }))} />
            )}
            <div className="col-span-2">
              <ValidatedField label="Email" value={form.email} error={createErrors.email}
                onChange={v => setForm(p => ({ ...p, email: v.trim() }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Struktur, vəzifə və əməkhaqqı məlumatları yalnız <span className="text-foreground font-medium">Struktur</span> tabından təyin oluna bilər.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={!createValid || creatingEmployee}
              className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creatingEmployee ? "Yaradılır..." : "Yarat"}
            </button>
            <button disabled={creatingEmployee} onClick={() => { setShowCreate(false); setForm(emptyEmployeeForm); setCitizenship("az"); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card disabled:opacity-50 disabled:cursor-not-allowed">Ləğv Et</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit employee */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Əməkdaşı redaktə et</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <ValidatedField label="Ad" value={editForm.firstName} error={editErrors.firstName}
              onChange={v => setEditForm(p => ({ ...p, firstName: sanitizeName(v).slice(0, 50) }))} />
            <ValidatedField label="Soyad" value={editForm.lastName} error={editErrors.lastName}
              onChange={v => setEditForm(p => ({ ...p, lastName: sanitizeName(v).slice(0, 50) }))} />
            <ValidatedField label="Ata adı" value={editForm.fatherName} error={editErrors.fatherName} required={false}
              onChange={v => setEditForm(p => ({ ...p, fatherName: sanitizeName(v).slice(0, 50) }))} />
            <div>
              <label className="text-sm font-medium text-foreground">FİN <span className="text-[10px] text-muted-foreground font-normal">(dəyişdirilə bilməz)</span></label>
              <input
                value={editForm.fin}
                disabled
                readOnly
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-muted/40 font-mono cursor-not-allowed text-muted-foreground"
              />
            </div>
            <div className="col-span-2">
              <ValidatedField label="Email" value={editing?.email || ""} error={null}
                disabled
                onChange={() => {}} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={saveEdit}
              disabled={!editValid}
              className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Yadda Saxla
            </button>
            <button onClick={() => setEditing(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
          </div>
        </DialogContent>
      </Dialog>


      {/* OTP */}
      <Dialog open={!!otpDialog} onOpenChange={() => setOtpDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Birdəfəlik Şifrə</DialogTitle>
          </DialogHeader>
          {otpDialog && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <p className="text-xs text-muted-foreground">İstifadəçi</p>
                <p className="text-sm font-medium text-foreground">{otpDialog.user.firstName} {otpDialog.user.lastName}</p>
                <p className="text-xs text-muted-foreground">{otpDialog.user.email}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">Yeni birdəfəlik şifrə</p>
                <div className="inline-flex items-center gap-3 bg-primary/5 border-2 border-dashed border-primary/30 rounded-xl px-6 py-4">
                  <span className="text-3xl font-bold tracking-widest font-mono text-primary">{otpDialog.code}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(otpDialog.code); toast.success("Kopyalandı"); }}
                    className="p-2 rounded-md hover:bg-primary/10"
                  ><Check className="w-5 h-5 text-primary" /></button>
                </div>
              </div>
              <button onClick={() => setOtpDialog(null)} className="w-full py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">Bağla</button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ChrImportDialog open={showChrImport} onClose={() => setShowChrImport(false)} />
    </div>
  );
};

const Field = ({ label, value, onChange, mono }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean }) => (
  <div>
    <label className="text-sm font-medium text-foreground">{label}</label>
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

// ====================================================
// Catalog tab — manage structure types & positions
// ====================================================
const CatalogTab = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const r = () => force(t => t + 1);
    window.addEventListener("catalog-updated", r);
    return () => window.removeEventListener("catalog-updated", r);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <CatalogList
        title="Struktur tipləri"
        icon={Building2}
        items={getStructureTypes()}
        onAdd={(v) => { const r = addStructureType(v); r.ok ? toast.success("Tip əlavə edildi") : toast.error("Bu tip artıq mövcuddur"); }}
        onRemove={(v) => {
          if (isStructureTypeInUse(v)) { toast.error("Bu struktur tipi istifadə olunduğu üçün silinə bilməz."); return; }
          removeStructureType(v); toast.success("Tip silindi");
        }}
        placeholder="məs: Departament"
      />
      <CatalogList
        title="Vəzifələr"
        icon={Briefcase}
        items={getPositions()}
        onAdd={(v) => { const r = addPositionCatalog(v); r.ok ? toast.success("Vəzifə əlavə edildi") : toast.error("Bu vəzifə artıq mövcuddur"); }}
        onRemove={(v) => {
          if (isPositionInUse(v)) { toast.error("Bu vəzifə istifadə olunduğu üçün silinə bilməz."); return; }
          removePositionCatalog(v); toast.success("Vəzifə silindi");
        }}
        placeholder="məs: Backend Developer"
      />
    </div>
  );
};

interface CatalogListProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}
const CatalogList = ({ title, icon: Icon, items, onAdd, onRemove, placeholder }: CatalogListProps) => {
  const [val, setVal] = useState("");
  const [q, setQ] = useState("");
  const submit = () => {
    if (!val.trim()) return;
    onAdd(val.trim());
    setVal("");
  };
  const filtered = useMemo(() => items.filter(i => i.toLowerCase().includes(q.toLowerCase())), [items, q]);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/30">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
          <button onClick={submit} className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Əlavə et
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Axtar..."
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background"
          />
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">{q ? "Nəticə yoxdur" : "Boşdur"}</p>}
          {filtered.map(it => (
            <div key={it} className="flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-border bg-background">
              <span className="text-foreground">{it}</span>
              <button onClick={() => onRemove(it)} className="p-1 rounded hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ====================================================
// CHR Import Dialog — shows changed fields as checkbox list
// ====================================================

interface ChrChange {
  id: string;
  employee: string;
  field: string;
  oldValue: string;
  newValue: string;
}

const MOCK_CHR_CHANGES: ChrChange[] = [
  { id: "c1", employee: "Günel Əlizadə", field: "Vəzifə", oldValue: "HR mütəxəssisi", newValue: "HR menecer" },
  { id: "c2", employee: "Nigar Hüseynova", field: "Maaş", oldValue: "1200 AZN", newValue: "1450 AZN" },
  { id: "c3", employee: "Samir Həsənov", field: "Şöbə", oldValue: "İT", newValue: "Texniki dəstək" },
  { id: "c4", employee: "Leyla Məmmədova", field: "Telefon", oldValue: "+994501234570", newValue: "+994551234570" },
  { id: "c5", employee: "Rəşad Əliyev", field: "Status", oldValue: "Aktiv", newValue: "Məzuniyyətdə" },
];

const ChrImportDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelected(new Set(MOCK_CHR_CHANGES.map(c => c.id)));
  }, [open]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === MOCK_CHR_CHANGES.length) setSelected(new Set());
    else setSelected(new Set(MOCK_CHR_CHANGES.map(c => c.id)));
  };

  const handleApply = () => {
    if (selected.size === 0) { toast.error("Heç bir dəyişiklik seçilməyib"); return; }
    toast.success(`${selected.size} dəyişiklik tətbiq edildi`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Dəyişilən məlumatlar bunlardır</DialogTitle>
          <p className="text-sm text-muted-foreground">CHR sistemindən gələn dəyişiklikləri seçin və tətbiq edin</p>
        </DialogHeader>

        <div className="flex items-center justify-between pb-2 border-b border-border">
          <button
            onClick={toggleAll}
            className="text-xs text-primary hover:underline"
          >
            {selected.size === MOCK_CHR_CHANGES.length ? "Heç birini seçmə" : "Hamısını seç"}
          </button>
          <span className="text-xs text-muted-foreground">{selected.size} / {MOCK_CHR_CHANGES.length} seçilib</span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {MOCK_CHR_CHANGES.map(c => {
            const checked = selected.has(c.id);
            return (
              <label
                key={c.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background hover:bg-secondary/30 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(c.id)}
                  className="mt-1 w-4 h-4 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.employee}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{c.field}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="line-through">{c.oldValue}</span>
                    <span className="mx-2">→</span>
                    <span className="text-foreground font-medium">{c.newValue}</span>
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border bg-card">Ləğv et</button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
          >
            Tətbiq et
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrganizationPage;

