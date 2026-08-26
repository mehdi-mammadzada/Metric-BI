import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Search, Check, X, Shield, Loader2, Save, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPermissions,
  fetchRolesForOrg,
  fetchOrgMembersWithRoles,
  createOrgRole,
  updateOrgRole,
  deleteOrgRole,
  setRolePermissions,
  setRoleMembers,
  type DbPermission,
  type DbRole,
  type OrgMemberRow,
} from "@/lib/rolesService";

// Human-friendly module labels (AZ) — ordered for the left sidebar.
const MODULE_LABELS: Record<string, string> = {
  home: "Əsas Səhifə",
  kpi: "KPI Kartları",
  kpi_scores: "KPI Nəticələri",
  kpi_tracking: "KPI İzlənməsi",
  lifecycle: "KPI Lifecycle",
  approvals: "Sistem Təsdiqləri",
  matrix: "Təsdiqləmə Matrisi",
  cascading: "Kaskadlama",
  evaluations: "Qiymətləndirmə",
  reports: "Hesabatlar",
  teams: "Komandalar",
  organization: "Struktur / Təşkilat",
  employees: "Əməkdaşlar",
  bonus: "Bonuslar",
  salary: "Əməkhaqqı",
  formulas: "Hesablama Düsturları",
  integrations: "İnteqrasiyalar",
  whistleblower: "Anonim Bildiriş",
  notifications: "Bildirişlər",
  roles: "Rollar və Səlahiyyət",
  users: "İstifadəçilər",
  settings: "Sazlamalar",
  audit: "Audit",
  profile: "Profil",
  org_structure: "Təşkilati Struktur",
  structure: "Struktur",
  organization_settings: "Təşkilat Ayarları",
};
const MODULE_ORDER = Object.keys(MODULE_LABELS);
const moduleSortKey = (m: string) => {
  const idx = MODULE_ORDER.indexOf(m);
  return idx === -1 ? 999 : idx;
};

// Human-friendly permission labels for granular buttons (AZ). Falls back to
// the DB `description` when a code is not listed here.
const PERM_LABELS: Record<string, string> = {
  // Home
  "home.view": "Baxış",
  "home.widgets": "Bütün widget-lər",
  "home.export": "Export",
  "home.ai_assistant": "AI Köməkçi",
  // KPI cards
  "kpi.view": "Baxış",
  "kpi.create": "KPI yarat",
  "kpi.edit": "Redaktə et",
  "kpi.update": "Redaktə et",
  "kpi.delete": "Sil",
  "kpi.duplicate": "Kopyala",
  "kpi.submit_approval": "Təsdiqə göndər",
  "kpi.cancel": "Ləğv et",
  "kpi.assign": "Təyin et",
  "kpi.cascade": "Kaskadla",
  "kpi.export": "Export",
  "kpi.import": "Import",
  "kpi.change_status": "Statusu dəyiş",
  "kpi.manage": "Tam idarəetmə",
  "kpi.evaluate": "Qiymətləndir",
  "kpi.approve": "Təsdiqlə",
  // Approvals
  "approvals.view": "Baxış",
  "approvals.approve": "Təsdiqlə",
  "approvals.reject": "Rədd et",
  "approvals.delegate": "Delegasiya et",
  "approval_requests.view": "Baxış",
  "approval_requests.action": "Qərar ver",
  "approval.request": "Sorğu yarat",
  "approval_matrices.view": "Matrisə baxış",
  "approval_matrices.manage": "Matrisi idarə et",
  // Reports
  "reports.view": "Baxış",
  "reports.filter": "Filtr",
  "reports.export": "Export",
  "reports.export_excel": "Excel ixracı",
  "reports.export_pdf": "PDF ixracı",
  "reports.schedule": "Cədvəllə göndər",
  "reports.share": "Paylaş",
  // Teams
  "teams.view": "Baxış",
  "teams.create": "Komanda yarat",
  "teams.edit": "Redaktə et",
  "teams.delete": "Sil",
  "teams.add_member": "Üzv əlavə et",
  "teams.remove_member": "Üzv sil",
  "teams.change_leader": "Rəhbər dəyiş",
  "teams.manage": "Tam idarəetmə",
  // Formulas
  "formulas.view": "Baxış",
  "formulas.create": "Yarat",
  "formulas.edit": "Redaktə et",
  "formulas.delete": "Sil",
  "formulas.assign": "Təyin et",
  // Integrations
  "integrations.view": "Baxış",
  "integrations.connect": "Qoşul",
  "integrations.disconnect": "Kəs",
  "integrations.configure": "Konfiqurasiya",
  "integrations.test": "Test et",
  "integrations.sync": "Sinxronizasiya",
  "integrations.export": "Export",
  "integrations.import": "Import",
  "integrations.logs": "Loglar",
  "integrations.manage": "Tam idarəetmə",
  // Matrix
  "matrix.view": "Baxış",
  "matrix.create": "Yarat",
  "matrix.edit": "Redaktə et",
  "matrix.delete": "Sil",
  "matrix.assign": "Təyin et",
  "matrix.export": "Export",
  // Organization / structure
  "organization.view": "Baxış",
  "organization.update": "Redaktə et",
  "organization.create_structure": "Struktur vahidi yarat",
  "organization.edit_structure": "Struktur vahidini redaktə et",
  "organization.delete_structure": "Struktur vahidini sil",
  "organization.add_employee": "Əməkdaş əlavə et",
  "organization.edit_employee": "Əməkdaşı redaktə et",
  "organization.deactivate_employee": "Deaktiv et",
  "organization.set_star": "Rəhbər (⭐) təyin et",
  "org_structure.view": "Baxış",
  "org_structure.create": "Struktur yarat",
  "org_structure.update": "Struktur redaktə et",
  "org_structure.delete": "Struktur sil",
  "structure.manage": "Tam idarəetmə",
  // Employees
  "employees.view": "Baxış",
  "employees.create": "Yarat",
  "employees.update": "Redaktə et",
  "employees.delete": "Sil",
  "employees.manage": "Tam idarəetmə",
  // Evaluations
  "evaluations.view": "Baxış",
  "evaluations.create": "Yarat",
  "evaluations.edit": "Redaktə et",
  "evaluations.delete": "Sil",
  "evaluations.submit": "Göndər",
  "evaluations.approve": "Təsdiqlə",
  "evaluations.export": "Export",
  "evaluations.close": "Bağla",
  "evaluation_360.view": "360 baxış",
  "evaluation_360.submit": "360 göndər",
  "evaluation_360.manage": "360 idarə",
  "evaluation_cycles.view": "Dövrlər baxış",
  "evaluation_cycles.manage": "Dövrləri idarə et",
  // Lifecycle
  "lifecycle.view": "Baxış",
  "lifecycle.create": "Yarat",
  "lifecycle.edit": "Redaktə et",
  "lifecycle.delete": "Sil",
  "lifecycle.create_review": "Review yarat",
  "lifecycle.change_review_status": "Review statusu dəyiş",
  "lifecycle.export": "Export",
  "lifecycle.manage": "Tam idarəetmə",
  // Cascading
  "cascading.view": "Baxış",
  "cascading.distribute": "Bölüşdür",
  "cascading.load": "Yüklə",
  "cascading.change_leader": "Rəhbər dəyiş",
  "cascading.approve": "Təsdiqlə",
  "cascading.export": "Export",
  // Bonus
  "bonus.view": "Baxış",
  "bonus.calculate": "Hesabla",
  "bonus.recalculate": "Yenidən hesabla",
  "bonus.approve": "Təsdiqlə",
  "bonus.publish": "Yayımla",
  "bonus.configure": "Konfiqurasiya",
  "bonus.export": "Export",
  "bonus.audit": "Audit",
  // Salary
  "salary.view": "Baxış",
  "salary.upload": "Yüklə",
  "salary.edit": "Redaktə et",
  "salary.delete": "Sil",
  "salary.export": "Export",
  "salary.manage": "Tam idarəetmə",
  // Whistleblower
  "whistleblower.view": "Baxış",
  "whistleblower.create": "Bildiriş yarat",
  "whistleblower.respond": "Cavabla",
  "whistleblower.close": "Bağla",
  // Notifications
  "notifications.view": "Baxış",
  "notifications.settings": "Sazlamalar",
  "notifications.send": "Göndər",
  "notifications.mark_read": "Oxundu işarələ",
  "notifications.delete": "Sil",
  "notifications.manage": "Tam idarəetmə",
  // Roles
  "roles.view": "Baxış",
  "roles.create": "Yarat",
  "roles.update": "Redaktə et",
  "roles.delete": "Sil",
  "roles.assign": "İstifadəçilərə təyin et",
  "roles.manage": "Tam idarəetmə",
  // Users
  "users.view": "Baxış",
  "users.invite": "Dəvət et",
  "users.create": "Yarat",
  "users.update": "Redaktə et",
  "users.deactivate": "Deaktiv et",
  "users.reactivate": "Reaktiv et",
  "users.reset_password": "Şifrə sıfırla",
  "users.assign_roles": "Rol təyin et",
  "users.manage": "Tam idarəetmə",
  // Settings
  "settings.view": "Baxış",
  "settings.edit": "Redaktə et",
  "settings.export": "Export",
  "settings.import": "Import",
  "settings.language": "Dil sazlaması",
  "settings.reset": "Sıfırla",
  "settings.manage": "Tam idarəetmə",
  // Audit
  "audit.view": "Baxış",
  "audit.export": "Export",
  "audit.filter": "Filtr",
  // Profile
  "profile.self_manage": "Öz profilini idarə et",
};
const permLabel = (p: DbPermission) => PERM_LABELS[p.code] ?? p.description ?? p.code;

const RolesPermissionsTab = () => {
  const { user, hasPermission } = useAuth();
  const orgId = user?.currentOrgId ?? "";
  const canManage = hasPermission("roles.manage") || user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<DbPermission[]>([]);
  const [roles, setRoles] = useState<DbRole[]>([]);
  const [members, setMembers] = useState<OrgMemberRow[]>([]);

  const [editing, setEditing] = useState<DbRole | null>(null);
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [usersRole, setUsersRole] = useState<DbRole | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [pendingMembers, setPendingMembers] = useState<Set<string>>(new Set());
  const [savingMembers, setSavingMembers] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newRole, setNewRole] = useState<{ name: string; description: string }>({
    name: "",
    description: "",
  });

  // ── Load ───────────────────────────────────────────────────────────────
  const reload = async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [p, r, m] = await Promise.all([
        fetchPermissions(),
        fetchRolesForOrg(orgId),
        fetchOrgMembersWithRoles(orgId),
      ]);
      setPermissions(p);
      setRoles(r);
      setMembers(m);
    } catch (e: any) {
      toast.error(`Rollar yüklənmədi: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); /* eslint-disable-next-line */ }, [orgId]);

  const modules = useMemo(() => {
    const set = new Set(permissions.map(p => p.module));
    return Array.from(set).sort((a, b) => moduleSortKey(a) - moduleSortKey(b));
  }, [permissions]);
  useEffect(() => {
    if (!selectedModule && modules.length) setSelectedModule(modules[0]);
  }, [modules, selectedModule]);

  const permByModule = useMemo(() => {
    const map = new Map<string, DbPermission[]>();
    for (const p of permissions) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return map;
  }, [permissions]);

  const memberCountByRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) for (const rid of m.roleIds) map.set(rid, (map.get(rid) ?? 0) + 1);
    return map;
  }, [members]);

  // ── Edit permissions ───────────────────────────────────────────────────
  const openEdit = (r: DbRole) => {
    setEditing(r);
    setEditingIds(new Set(r.permissionIds));
    setSelectedModule(modules[0] ?? "");
    setModuleSearch("");
  };
  const togglePerm = (id: string) => {
    setEditingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleModuleAll = (mod: string) => {
    const list = permByModule.get(mod) ?? [];
    const allOn = list.every(p => editingIds.has(p.id));
    setEditingIds(prev => {
      const next = new Set(prev);
      for (const p of list) {
        if (allOn) next.delete(p.id); else next.add(p.id);
      }
      return next;
    });
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Rol adı mütləqdir"); return; }
    setSaving(true);
    try {
      await updateOrgRole(editing.id, {
        name: editing.name,
        description: editing.description || null,
      });
      await setRolePermissions(editing.id, Array.from(editingIds));
      toast.success("Rol və icazələr backend-də yadda saxlanıldı");
      setEditing(null);
      await reload();
    } catch (e: any) {
      toast.error(`Xəta: ${e?.message ?? e}`);
    } finally { setSaving(false); }
  };

  // ── Users on role ──────────────────────────────────────────────────────
  const openUsers = (r: DbRole) => {
    setUsersRole(r);
    setUserSearch("");
    setPendingMembers(new Set(members.filter(m => m.roleIds.includes(r.id)).map(m => m.memberId)));
  };
  const toggleMember = (mid: string) => {
    setPendingMembers(prev => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid); else next.add(mid);
      return next;
    });
  };
  const saveMembers = async () => {
    if (!usersRole) return;
    setSavingMembers(true);
    try {
      await setRoleMembers(usersRole.id, Array.from(pendingMembers), user?.supabaseUserId ?? null);
      toast.success("İstifadəçi təyinatları yadda saxlanıldı");
      setUsersRole(null);
      await reload();
    } catch (e: any) {
      toast.error(`Xəta: ${e?.message ?? e}`);
    } finally { setSavingMembers(false); }
  };

  // ── Create / delete ────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!orgId) return;
    if (!newRole.name.trim()) { toast.error("Rol adı mütləqdir"); return; }
    try {
      await createOrgRole(orgId, {
        name: newRole.name,
        description: newRole.description,
        cloneFromRoleId: null,
      });
      toast.success("Rol yaradıldı");
      setShowCreate(false);
      setNewRole({ name: "", description: "" });
      await reload();
    } catch (e: any) {
      toast.error(`Xəta: ${e?.message ?? e}`);
    }
  };

  const removeRole = async (r: DbRole) => {
    if (r.is_system_role) {
      toast.error("Default HR / USER / MANAGER rolları silinə bilməz"); return;
    }
    if (!confirm(`"${r.name}" rolu silinsin?`)) return;
    try {
      await deleteOrgRole(r.id);
      toast.success("Rol silindi");
      await reload();
    } catch (e: any) {
      toast.error(`Xəta: ${e?.message ?? e}`);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (!orgId) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border text-sm text-muted-foreground">
        Təşkilat seçilməyib. RBAC idarəetməsi üçün təşkilat konteksti tələb olunur.
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Rollar və İcazələr</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Default rollar: HR, USER, MANAGER. Rollara əməkdaş təyin edin, icazələri dəyişin və yeni custom rol yaradın.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Yeni Rol Yarat
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Yüklənir...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {roles.map(r => {
            const isSystem = r.is_system_role;
            const memberCount = memberCountByRole.get(r.id) ?? 0;
            return (
              <div
                key={r.id}
                className="group relative border border-border rounded-xl p-5 bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col"
              >
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  {canManage && (
                    <button
                      onClick={() => openUsers(r)}
                      className="p-1.5 rounded-md bg-background border border-border hover:bg-secondary"
                      title="İstifadəçiləri idarə et"
                    >
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-md bg-background border border-border hover:bg-secondary"
                      title="Rolu və icazələri redaktə et"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  {!isSystem && canManage && (
                    <button
                      onClick={() => removeRole(r)}
                      className="p-1.5 rounded-md bg-background border border-border hover:bg-zone-red-bg"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>

                <div className="flex items-start gap-3 mb-3 pr-16">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold tracking-wider text-sm text-foreground truncate">{r.name}</h4>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {isSystem && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider font-semibold">Sistem</span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2rem]">
                  {r.description || "Təsvir əlavə edilməyib"}
                </p>

                <div className="mt-auto flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                    <Users className="w-3 h-3" /> {memberCount} istifadəçi
                  </span>
                  <button
                    onClick={() => openEdit(r)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border text-muted-foreground font-medium hover:bg-secondary"
                  >
                    {r.permissionIds.length}/{permissions.length} icazə
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Rol Yarat</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rol Adı</label>
              <input
                value={newRole.name}
                onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
                placeholder="Məsələn: Marketinq Meneceri"
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Təsvir</label>
              <textarea
                value={newRole.description}
                onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={submitCreate} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
                Yarat
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">
                Ləğv Et
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit permissions dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-6xl p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-8 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-center text-xl">
              <span className="italic font-bold text-primary">{editing?.name}</span>
              <span className="text-foreground font-normal"> — Rolun redaktə edilməsi</span>
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="flex-1 min-h-0 flex flex-col px-8 pt-5 pb-3">
              {/* Sticky header: meta + toggle */}
              <div className="shrink-0 space-y-4 pb-4 bg-card">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">
                      Rol adı <span className="text-destructive">*</span>
                    </label>
                    <input
                      value={editing.name}
                      onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : prev)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background uppercase tracking-wider font-semibold focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">
                      Təsvir <span className="text-destructive">*</span>
                    </label>
                    <input
                      value={editing.description || ""}
                      onChange={e => setEditing(prev => prev ? { ...prev, description: e.target.value } : prev)}
                      placeholder="Rolun qısa təsviri"
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
                  <button
                    type="button"
                    onClick={() => setEditingIds(prev => prev.size === permissions.length ? new Set() : new Set(permissions.map(p => p.id)))}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className={`relative w-11 h-6 rounded-full transition-colors ${editingIds.size === permissions.length ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 block w-5 h-5 rounded-full bg-card shadow transition-transform ${editingIds.size === permissions.length ? "translate-x-5" : "translate-x-0.5"}`} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Bütün icazələri seç</span>
                      <span className="block text-[11px] text-muted-foreground">Bütün modullarda bütün icazələri bir kliklə yandır/söndür</span>
                    </span>
                  </button>
                  <span className="text-lg font-bold text-primary tabular-nums">{editingIds.size} / {permissions.length}</span>
                </div>
              </div>

              {/* Modules + Permissions — independent scroll columns */}
              <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
                {/* Module list */}
                <div className="col-span-5 flex flex-col min-h-0">
                  <div className="relative mb-3 shrink-0">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <input
                      value={moduleSearch}
                      onChange={e => setModuleSearch(e.target.value)}
                      placeholder="Modul axtar..."
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                    {modules
                      .filter(m => (MODULE_LABELS[m] ?? m).toLowerCase().includes(moduleSearch.toLowerCase()))
                      .map(m => {
                        const list = permByModule.get(m) ?? [];
                        const on = list.filter(p => editingIds.has(p.id)).length;
                        const total = list.length;
                        const active = m === selectedModule;
                        const fullyOn = total > 0 && on === total;
                        return (
                          <button
                            key={m}
                            onClick={() => setSelectedModule(m)}
                            className={`w-full text-left px-3 py-3 rounded-lg text-sm flex items-center gap-3 transition-colors border ${
                              active
                                ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                                : "border-transparent hover:bg-secondary text-foreground"
                            }`}
                          >
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                              fullyOn ? "bg-emerald-500 text-white" : on > 0 ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground/60"
                            }`}>
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            </span>
                            <span className="flex-1 truncate">{MODULE_LABELS[m] ?? m}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 tabular-nums ${
                              fullyOn ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                            }`}>{on}/{total}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Permissions for selected module */}
                <div className="col-span-7 flex flex-col min-h-0">
                  {(() => {
                    const list = permByModule.get(selectedModule) ?? [];
                    const on = list.filter(p => editingIds.has(p.id)).length;
                    const allOn = list.length > 0 && on === list.length;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3 shrink-0">
                          <div>
                            <h4 className="text-base font-semibold text-foreground">{MODULE_LABELS[selectedModule] ?? selectedModule}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{on} / {list.length} icazə seçilib</p>
                          </div>
                          {list.length > 0 && (
                            <button
                              onClick={() => toggleModuleAll(selectedModule)}
                              className="text-xs px-3 py-1.5 rounded-md text-primary hover:bg-primary/10 font-medium"
                            >
                              {allOn ? "Hamısını sil" : "Hamısını seç"}
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-1">
                          {list.map(p => {
                            const checked = editingIds.has(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => togglePerm(p.id)}
                                className={`flex items-center gap-3 px-4 h-11 rounded-full border text-left text-sm transition-all shrink-0 ${
                                  checked
                                    ? "bg-primary/5 border-primary text-foreground"
                                    : "bg-background border-border hover:border-primary/40 hover:bg-secondary/50"
                                }`}
                              >
                                <div className={`w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 border transition-colors ${
                                  checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 bg-transparent"
                                }`}>
                                  {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                                </div>
                                <span className="font-medium">{permLabel(p)}</span>
                              </button>
                            );
                          })}
                          {list.length === 0 && (
                            <div className="text-sm text-muted-foreground">Bu modulda icazə tapılmadı.</div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Footer note */}
              <div className="shrink-0 flex items-center gap-2 text-xs text-muted-foreground pt-3">
                <Users className="w-4 h-4 shrink-0" />
                <span>İstifadəçilər rol yaradıldıqdan sonra kartın üzərindəki <Users className="w-3.5 h-3.5 inline-block mx-0.5 text-primary" /> ikonundan idarə olunur.</span>
              </div>
            </div>
          )}


          {editing && (
            <div className="px-8 py-4 border-t border-border shrink-0 flex gap-3 bg-card">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-3 text-sm rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saxlanılır..." : "Yadda Saxla"}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-3 text-sm rounded-lg border border-border bg-card font-medium hover:bg-secondary transition-colors"
              >
                Bağla
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Users dialog */}
      <Dialog open={!!usersRole} onOpenChange={() => setUsersRole(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              <span className="tracking-wider font-bold text-primary">{usersRole?.name}</span>
              <span className="text-foreground"> — İstifadəçiləri idarə et</span>
            </DialogTitle>
          </DialogHeader>
          {usersRole && (() => {
            const q = userSearch.toLowerCase();
            const visible = members.filter(m =>
              !q ||
              m.fullName.toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q) ||
              m.positionName.toLowerCase().includes(q));
            const allVisibleOn = visible.length > 0 && visible.every(m => pendingMembers.has(m.memberId));
            const toggleAllVisible = () => setPendingMembers(prev => {
              const next = new Set(prev);
              if (allVisibleOn) visible.forEach(m => next.delete(m.memberId));
              else visible.forEach(m => next.add(m.memberId));
              return next;
            });
            return (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Ad, email və ya vəzifə üzrə axtar..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  disabled={visible.length === 0}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {allVisibleOn ? "Seçimi ləğv et" : "Hamısını seç"}
                </button>
                <span className="text-[11px] text-muted-foreground">{pendingMembers.size} seçilib</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {visible
                  .map(m => {
                    const on = pendingMembers.has(m.memberId);

                    return (
                      <button
                        key={m.memberId}
                        onClick={() => toggleMember(m.memberId)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                          on ? "bg-primary/5" : "hover:bg-secondary"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          on ? "bg-primary border-primary text-primary-foreground" : "border-border"
                        }`}>
                          {on && <Check className="w-3 h-3" />}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {(m.fullName[0] || "?").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{m.fullName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {m.positionName || "—"}
                          </div>
                        </div>

                      </button>
                    );
                  })}
                {members.length === 0 && (
                  <div className="text-sm text-muted-foreground p-3">Təşkilatda aktiv əməkdaş tapılmadı.</div>
                )}
              </div>
              {pendingMembers.size > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Seçilmiş istifadəçilər ({pendingMembers.size})
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-[132px] overflow-y-auto pr-1">
                    {members
                      .filter(m => pendingMembers.has(m.memberId))
                      .map(m => (
                        <div
                          key={m.memberId}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-xs text-foreground"
                          title={m.fullName}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {(m.fullName[0] || "?").toUpperCase()}
                          </div>
                          <span className="truncate">{m.fullName}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveMembers}
                  disabled={savingMembers}
                  className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-60"
                >
                  {savingMembers ? "Saxlanılır..." : "Yadda Saxla"}
                </button>
                <button onClick={() => setUsersRole(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">
                  Bağla
                </button>
              </div>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesPermissionsTab;
