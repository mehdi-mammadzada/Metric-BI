import { Link, useLocation } from "react-router-dom";
import { Home, LayoutGrid, ClipboardCheck, BarChart3, Users, Settings, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { useAppSidebar } from "@/contexts/SidebarContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const allNavItems = [
  { path: "/user", labelKey: "nav.home", icon: Home, permissions: ["home"] },
  { path: "/user/kpi-kartlari", labelKey: "nav.kpi_tracking", icon: LayoutGrid, permissions: ["kpi"] },
  { path: "/user/sistem-tesdiq", labelKey: "nav.system_approvals", icon: ClipboardCheck, permissions: ["approvals"] },
  { path: "/user/hesabat", labelKey: "nav.report", icon: BarChart3, permissions: ["reporting"] },
  { path: "/user/komandalar", labelKey: "nav.my_team_alt", icon: Users, permissions: ["teams", "teams_compare"] },
  { path: "/user/qiymetlendirme", labelKey: "nav.responsible_cards", icon: ClipboardList, permissions: ["evaluation"] },
  { path: "/user/ayarlar", labelKey: "nav.settings_alt", icon: Settings, permissions: ["settings"] },
];

const UserSidebar = () => {
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const { collapsed, toggle } = useAppSidebar();
  const { t } = useTranslation();

  const navItems = allNavItems.filter(item => item.permissions.some(p => hasPermission(p)));


  return (
    <TooltipProvider delayDuration={150}>
      <aside className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-sidebar-bg to-sidebar-hover flex flex-col z-50 shadow-xl transition-[width] duration-300 ease-in-out ${collapsed ? "w-[68px]" : "w-[210px]"}`}>
        <div className={`p-4 flex items-center gap-3 border-b border-sidebar-fg/10 ${collapsed ? "justify-center" : ""}`}>
          <img src={logo} alt="Metric BI logo" className="w-9 h-9 object-contain shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-sidebar-fg tracking-wide truncate">Metric BI</h1>
              <p className="text-[11px] text-sidebar-fg/60 truncate">{t("sidebar.panel_user")}</p>
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
          {navItems.map((item) => {
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
          })}
        </nav>

        <div className={`p-3 border-t border-sidebar-fg/10 ${collapsed ? "px-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-sidebar-fg/5">
              <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-sm shrink-0">
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

export default UserSidebar;
