import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Home, LayoutGrid, BarChart3, Link2, Settings, ClipboardCheck, Calculator,
  ShieldCheck, Building2, Shield, ChevronLeft, ChevronRight, DollarSign, Gauge,
  Workflow, GitBranch, Target, Users, Activity, Trophy, Gift, UserCog, Crown,
  ChevronDown,
} from "lucide-react";

import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = { path: string; labelKey: string; icon: any; perm?: string };

const ADMIN_ITEMS: NavItem[] = [
  { path: "/hr", labelKey: "nav.home", icon: Home, perm: "home" },
  { path: "/teskilati-struktur", labelKey: "nav.organization", icon: Building2, perm: "organization" },
  { path: "/kpi-kartlari", labelKey: "nav.kpis", icon: LayoutGrid, perm: "kpi" },
  
  { path: "/kpi-lifecycle", labelKey: "nav.kpi_lifecycle", icon: Workflow, perm: "kpi_lifecycle" },
  { path: "/kpi-qiymetleri", labelKey: "nav.kpi_results", icon: Gauge, perm: "kpi_scores" },
  { path: "/qiymetlendirme", labelKey: "nav.evaluation", icon: ClipboardCheck, perm: "evaluation" },
  { path: "/cascading", labelKey: "nav.cascading", icon: GitBranch, perm: "cascading" },
  { path: "/tesdiqleme-matrisi", labelKey: "nav.approval_matrix", icon: ShieldCheck, perm: "matrix" },
  { path: "/hesabat", labelKey: "nav.reports", icon: BarChart3, perm: "reporting" },
  { path: "/whistleblower", labelKey: "nav.whistleblower", icon: Shield, perm: "whistleblower" },
  { path: "/hesablama-dusturlari", labelKey: "nav.formulas", icon: Calculator, perm: "formulas" },
  { path: "/bonus", labelKey: "nav.bonuses", icon: DollarSign, perm: "bonus" },
  { path: "/inteqrasiyalar", labelKey: "nav.integrations", icon: Link2, perm: "integrations" },
  { path: "/ayarlar", labelKey: "nav.settings", icon: Settings, perm: "settings" },
];

const MANAGER_ITEMS: NavItem[] = [
  { path: "/hr/rehber/sistem-tesdiq", labelKey: "nav.system_approvals", icon: ClipboardCheck, perm: "approvals" },
  { path: "/hr/rehber/mesul-kartlar", labelKey: "nav.responsible_cards", icon: LayoutGrid, perm: "kpi" },
  { path: "/hr/rehber/komandam", labelKey: "nav.my_team", icon: Users, perm: "teams" },
  { path: "/hr/rehber/kpi-izleme", labelKey: "nav.kpi_tracking", icon: Activity, perm: "goal_tracking" },
  { path: "/hr/rehber/neticelerim", labelKey: "nav.my_results", icon: Trophy, perm: "kpi_scores" },
  { path: "/hr/rehber/bonuslarim", labelKey: "nav.my_bonuses", icon: Gift, perm: "bonus" },
];

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { collapsed, toggle } = useAppSidebar();
  const { t } = useTranslation();
  const [adminOpen, setAdminOpen] = useState(true);
  const [managerOpen, setManagerOpen] = useState(true);

  const managerFiltered = MANAGER_ITEMS.filter(it => !it.perm || (user?.permissions.includes(it.perm) ?? false));
  const showManagerSection = managerFiltered.length > 0;

  const renderItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const label = t(item.labelKey);
    const link = (
      <Link
        key={item.path}
        to={item.path}
        className={`group flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-lg text-sm transition-all relative ${
          isActive
            ? "bg-sidebar-active text-sidebar-fg font-medium shadow-sm"
            : "text-sidebar-fg/70 hover:bg-sidebar-hover hover:text-sidebar-fg"
        }`}
      >
        {isActive && !collapsed && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-foreground rounded-r-full" />}
        <item.icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? '' : 'group-hover:scale-110'}`} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
    return collapsed ? (
      <Tooltip key={item.path}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    ) : link;
  };

  const adminFiltered = ADMIN_ITEMS.filter(it => !it.perm || (user?.permissions.includes(it.perm) ?? false));

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-sidebar-bg to-sidebar-hover flex flex-col z-50 shadow-xl transition-[width] duration-300 ease-in-out ${
          collapsed ? "w-[68px]" : "w-[210px]"
        }`}
      >
        <div className={`p-4 flex items-center gap-3 border-b border-sidebar-fg/10 ${collapsed ? "justify-center" : ""}`}>
          <img src={logo} alt="Metric BI logo" className="w-9 h-9 object-contain shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-fg tracking-wide truncate">Metric BI</h1>
              <p className="text-[11px] text-sidebar-fg/60 truncate">{t("sidebar.panel_hr")}</p>
            </div>
          )}
        </div>

        <button
          onClick={toggle}
          aria-label={collapsed ? t("common.sidebar_open") : t("common.sidebar_close")}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-foreground" /> : <ChevronLeft className="w-3.5 h-3.5 text-foreground" />}
        </button>

        <nav className={`flex-1 ${collapsed ? "px-2" : "px-3"} mt-4 space-y-1 overflow-y-auto scrollbar-hide`}>
          {/* ===== ADMİN qrupu ===== */}
          {!collapsed ? (
            <button
              onClick={() => setAdminOpen(v => !v)}
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg text-[11px] uppercase tracking-wider font-semibold text-sidebar-fg/80 hover:bg-sidebar-hover"
            >
              <span className="inline-flex items-center gap-2">
                <UserCog className="w-3.5 h-3.5" /> {t("sidebar.section_admin")}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${adminOpen ? "" : "-rotate-90"}`} />
            </button>
          ) : (
            <div className="mx-auto my-2 w-6 h-6 rounded-md bg-sidebar-fg/10 flex items-center justify-center" title={t("sidebar.section_admin")}>
              <UserCog className="w-3.5 h-3.5 text-sidebar-fg/70" />
            </div>
          )}
          {adminOpen && (
            <div className={collapsed ? "space-y-1" : "space-y-1 pl-1 border-l border-sidebar-fg/10 ml-2"}>
              {adminFiltered.map(renderItem)}
            </div>
          )}

          {/* ===== RƏHBƏR qrupu ===== */}
          {showManagerSection && (
            <>
              {!collapsed ? (
                <button
                  onClick={() => setManagerOpen(v => !v)}
                  className="mt-4 w-full flex items-center justify-between px-2 py-2 rounded-lg text-[11px] uppercase tracking-wider font-semibold text-sidebar-fg/80 hover:bg-sidebar-hover"
                >
                  <span className="inline-flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5" /> {t("sidebar.section_manager")}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${managerOpen ? "" : "-rotate-90"}`} />
                </button>
              ) : (
                <div className="mx-auto mt-3 mb-1 w-6 h-6 rounded-md bg-sidebar-fg/10 flex items-center justify-center" title={t("sidebar.section_manager")}>
                  <Crown className="w-3.5 h-3.5 text-sidebar-fg/70" />
                </div>
              )}
              {managerOpen && (
                <div className={collapsed ? "space-y-1" : "space-y-1 pl-1 border-l border-sidebar-fg/10 ml-2"}>
                  {managerFiltered.map(renderItem)}
                </div>
              )}
            </>
          )}
        </nav>

        <div className={`p-3 border-t border-sidebar-fg/10 ${collapsed ? "px-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-sidebar-fg/5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-sm shrink-0">
                {user?.avatar}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-sidebar-fg truncate">{user?.name}</p>
                <p className="text-[10px] text-sidebar-fg/50">{user?.role}</p>
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="mt-2 pt-2 border-t border-sidebar-fg/10 text-center">
              <p className="text-[10px] text-sidebar-fg/40">{t("common.copyright")}</p>
            </div>
          )}
        </div>

      </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
