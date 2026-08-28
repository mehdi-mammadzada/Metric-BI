import { Search, Bell, Moon, Sun, LogOut, Mail, Building2, Users as UsersIcon, CheckCircle2, AlertCircle, Clock, Globe, Shield, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState, useRef } from "react";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useNotificationsFor, markAllRead, deleteNotification, deleteAllNotifications } from "@/lib/notificationsStore";
import { getCurrentEmployeeId } from "@/lib/scope";
import { useTranslation } from "react-i18next";
import { UI_TO_CODE, CODE_TO_UI, type SupportedLang } from "@/i18n";

interface HeaderProps {
  title: string;
  showVersion?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "approval" | "kpi" | "system";
  read: boolean;
  link?: string;
}

const Header = ({ title, showVersion = true }: HeaderProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [dark, setDark] = useState(() => getStoredTheme() === "dark");
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const lang = CODE_TO_UI[(i18n.language?.split("-")[0] as SupportedLang) || "az"] ?? "AZ";
  const setLang = (l: "AZ" | "ENG" | "RU") => {
    i18n.changeLanguage(UI_TO_CODE[l]);
    // Keep legacy key in sync for anywhere it's still read.
    try { localStorage.setItem("kpi_lang", l); } catch { /* noop */ }
  };
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const dateStr = `${now.getFullYear()} M${String(now.getMonth() + 1).padStart(2, '0')} ${now.getDate()}, ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]}`;

  // Live notifications scoped to the current user.
  const meId = getCurrentEmployeeId(user);
  const liveNotifs = useNotificationsFor(meId);
  const notifications: Notification[] = useMemo(() => liveNotifs.map(n => ({
    id: n.id,
    title: n.title,
    message: n.body || "",
    time: new Date(n.createdAt).toLocaleString("az-AZ", { hour: "2-digit", minute: "2-digit" }),
    type: n.type === "approval_request" || n.type === "approval_result" ? "approval"
      : n.type === "goal_assigned" || n.type === "execution_update" ? "kpi"
      : "system",
    read: n.read,
    link: n.link,
  })), [liveNotifs]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const displayedNotifications = showUnreadOnly ? notifications.filter(n => !n.read) : notifications;


  useEffect(() => {
    applyTheme(dark ? "dark" : "light");
  }, [dark]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLang(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const notifIcon = (type: string) => {
    if (type === "approval") return <CheckCircle2 className="w-4 h-4 text-zone-green-text" />;
    if (type === "kpi") return <AlertCircle className="w-4 h-4 text-primary" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const isHR = user?.role === "HR";
  const isManager = user?.role === "MANAGER";
  const headerBg = isHR
    ? "bg-gradient-to-r from-primary/10 via-card/85 to-primary/10 border-primary/30"
    : isManager
      ? "bg-gradient-to-r from-[hsl(268_75%_55%/0.12)] via-card/85 to-[hsl(268_75%_55%/0.12)] border-[hsl(268_75%_55%/0.35)]"
      : "bg-gradient-to-r from-success/10 via-card/85 to-success/10 border-success/30";
  const accentBar = isHR ? "bg-primary" : isManager ? "bg-[hsl(268_75%_55%)]" : "bg-success";
  const roleLabel = isHR ? t("header.panel_hr") : isManager ? t("header.panel_manager") : t("header.panel_user");
  const roleName = isHR ? t("header.role_hr") : isManager ? t("header.role_manager") : t("header.role_user");
  const roleChip = isHR
    ? "bg-primary/15 text-primary"
    : isManager
      ? "bg-[hsl(268_75%_55%/0.18)] text-[hsl(268_75%_55%)]"
      : "bg-success/15 text-success";

  return (
    <header className={`sticky top-0 z-40 h-16 border-b backdrop-blur-md flex items-center justify-between px-6 relative ${headerBg}`}>
      <span className={`absolute left-0 top-0 h-full w-1 ${accentBar}`} aria-hidden />
      <div className="flex items-center gap-3">
        <span className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md ${roleChip}`}>
          {roleLabel}
        </span>
        <span className="hidden md:inline text-xs text-muted-foreground">{dateStr}</span>
      </div>
      <div className="flex items-center gap-3">

{(isManager || user?.role === "USER") && (
          <button
            onClick={() => navigate(isManager ? "/manager/whistleblower" : "/user/whistleblower")}
            className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-[hsl(268_75%_55%/0.12)] hover:bg-[hsl(268_75%_55%/0.2)] text-[hsl(268_75%_55%)] transition-colors"
            title={t("common.anonymous_report")}
          >
            <Shield className="w-4 h-4" />
            <span className="text-xs font-semibold hidden md:inline">{t("common.anonymous_report")}</span>
          </button>
        )}
        <button
          onClick={() => setDark(d => !d)}
          className="w-9 h-9 rounded-lg bg-secondary/70 hover:bg-secondary flex items-center justify-center transition-colors"
          title={dark ? t("common.light_mode") : t("common.dark_mode")}
        >
        {dark ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Language switcher */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => { setShowLang(s => !s); setShowNotif(false); setShowProfile(false); }}
            className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-secondary/70 hover:bg-secondary transition-colors"
            title={t("common.language")}
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{lang}</span>
          </button>
          {showLang && (
            <div className="absolute right-0 top-full mt-2 w-32 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {(["AZ", "ENG", "RU"] as const).map(l => (
                <button
                  key={l}
                  onClick={() => { setLang(l); setShowLang(false); }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-secondary transition-colors flex items-center justify-between ${lang === l ? "bg-primary/5 text-primary font-medium" : "text-foreground"}`}
                >
                  <span>{l}</span>
                  {lang === l && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => { setShowNotif(s => !s); setShowProfile(false); setShowLang(false); }} className="relative w-9 h-9 rounded-lg bg-secondary/70 hover:bg-secondary flex items-center justify-center transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full border-2 border-card flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{t("header.notifications")}</h3>
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{t("header.notifications_new", { count: unreadCount })}</span>
              </div>
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <span className="text-sm text-foreground">{t("header.only_show_unread")}</span>
                <Switch
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                  aria-label={t("header.only_show_unread")}
                />
              </div>
              <div className="max-h-96 overflow-y-auto">
                {displayedNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("header.notifications_empty")}</p>
                ) : displayedNotifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { if (n.link) { navigate(n.link); setShowNotif(false); } }}
                    className={`group relative p-3 border-b border-border hover:bg-secondary cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">{notifIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground pr-6">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{n.time}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-opacity"
                          title={t("header.delete_notification")}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-border flex items-center">
                <button
                  onClick={() => meId && markAllRead(meId)}
                  className="flex-1 text-center text-xs text-primary hover:underline py-1"
                >{t("header.mark_all_read")}</button>
                <button
                  onClick={() => { if (meId && notifications.length) { if (confirm(t("header.delete_all_confirm"))) deleteAllNotifications(meId); } }}
                  className="flex-1 text-center text-xs text-destructive hover:underline py-1"
                >{t("header.delete_all")}</button>
              </div>

            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button onClick={() => { setShowProfile(s => !s); setShowNotif(false); setShowLang(false); }} className="flex items-center gap-2 hover:bg-secondary/70 rounded-lg p-1 pr-3 transition-colors">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-sm ${isHR ? "bg-primary" : isManager ? "bg-[hsl(268_75%_55%)]" : "bg-success"}`}>
              {user?.avatar || "A"}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground leading-tight">{user?.name || t("header.default_user")}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{roleName}</p>
            </div>
          </button>
          {showProfile && user && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/30 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-primary-foreground text-lg font-semibold ${isHR ? "bg-primary" : isManager ? "bg-[hsl(268_75%_55%)]" : "bg-success"}`}>
                    {user.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{user.name}</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full ${roleChip}`}>
                      {roleName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" /><span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" /><span>{user.department}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UsersIcon className="w-3.5 h-3.5" /><span>{user.team}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <p className="mb-1">{t("header.permissions")}: <span className="text-foreground font-medium">{user.permissions.length}</span></p>
                </div>
              </div>
              <div className="border-t border-border p-1">
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4" /> {t("common.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
