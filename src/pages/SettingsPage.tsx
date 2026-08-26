import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { Search, Plus, Pencil, Trash2, Check, X, Users, Calculator, ChevronDown, AlertTriangle, Calendar as CalendarIcon, Sparkles, Database, Shield, Bell, ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/ui/page-hero";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

import { getPeriods, addPeriod, deletePeriod, computeDurationLabel, formatPeriodRange, type KpiPeriod } from "@/lib/teamsStore";
import DropdownCatalogsTab from "@/components/settings/DropdownCatalogsTab";
import NotificationSettingsTab from "@/components/settings/NotificationSettingsTab";
import RolesPermissionsTab from "@/components/settings/RolesPermissionsTab";
import { useCatalogValues } from "@/lib/dropdownCatalogStore";

// Settings Tab 1 - Məlumat Cədvəli
const initialTargetTypes = [];

const structures = [];
const CALC_TYPE_DEFAULTS = ["Valyuta (AZN)", "Faiz (%)", "Zaman (Gün)", "Say (Hə/Yox)", "Ədəd"];
const KPI_CATEGORY_DEFAULTS = ["Maliyyə KPI ları", "Müştəri KPI ları", "Əməliyyat KPI ları", "İnkişaf KPI ları"];
const KPI_UNIT_DEFAULTS = ["Valyuta", "Faiz", "Gün/Saat", "Ədəd", "Nisbət"];

const initialKpiTypes = [];

// Hədəf data (matching KPI creation)
const SUB_KPI_UNIT_DEFAULTS = ["Valyuta (AZN)", "Faiz (%)", "Ədəd", "Zaman (Gün)", "Nisbət", "Say (Hə/Yox)"];

const initialSubKpis = [];

const kpiNameOptions = [];

interface Formula {
  id: number; name: string; formula: string; description: string; kpiName: string; variables: string[];
}

const initialFormulas: Formula[] = [];

interface Role {
  id: number; name: string; permissions: Record<string, string[]>; users: string[];
  description?: string; language?: "AZ" | "EN" | "RU";
}

// Detailed per-module permissions (4-6 actions per module)
const permissionModules: { key: string; label: string; actions: { key: string; label: string }[] }[] = [
  { key: "home", label: "Əsas Səhifə", actions: [
    { key: "view", label: "Baxış" },
    { key: "view_widgets", label: "Bütün widget-lər" },
    { key: "export", label: "Export" },
  ]},
  { key: "kpi", label: "KPI Kartları", actions: [
    { key: "view_own", label: "Yalnız öz kartları" },
    { key: "view_team", label: "Komanda kartları" },
    { key: "view_all", label: "Bütün kartlar" },
    { key: "create", label: "Yeni KPI yaratmaq" },
    { key: "edit", label: "Redaktə etmək" },
    { key: "delete", label: "Silmək" },
    { key: "copy", label: "Kopyalamaq" },
    { key: "archive", label: "Arxivləmək" },
    { key: "view_results", label: "Nəticələri görmək" },
    { key: "view_calc_details", label: "Hesablama detallarını görmək" },
  ]},

  { key: "approvals", label: "Sistem Təsdiqləri", actions: [
    { key: "view", label: "Baxış" },
    { key: "approve", label: "Təsdiq etmək" },
    { key: "reject", label: "Rədd etmək" },
    { key: "comment", label: "Şərh əlavə etmək" },
  ]},
  { key: "reporting", label: "Hesabatlar", actions: [
    { key: "view_own", label: "Yalnız öz hesabatları" },
    { key: "view_team", label: "Komanda hesabatları" },
    { key: "view_all", label: "Bütün hesabatlar" },
    { key: "export_pdf", label: "PDF export" },
    { key: "export_excel", label: "Excel export" },
    { key: "use_ai", label: "AI köməkçisi" },
  ]},
  { key: "teams", label: "Komandalar", actions: [
    { key: "view_own", label: "Yalnız öz komandası" },
    { key: "view_compare", label: "Müqayisələr" },
    { key: "view_all", label: "Bütün komandalar" },
    { key: "create", label: "Yeni komanda" },
    { key: "edit", label: "Redaktə" },
    { key: "delete", label: "Silmək" },
    { key: "manage_members", label: "Üzvləri idarə etmək" },
  ]},
  { key: "formulas", label: "Hesablama Düsturları", actions: [
    { key: "view", label: "Baxış" },
    { key: "create", label: "Yeni düstur" },
    { key: "edit", label: "Redaktə" },
    { key: "delete", label: "Silmək" },
    { key: "manage_book", label: "Dəyişənlər kitabı" },
  ]},
  { key: "integrations", label: "İnteqrasiyalar", actions: [
    { key: "view", label: "Baxış" },
    { key: "view_incoming", label: "Daxil olan məlumatlar" },
    { key: "view_outgoing", label: "Ötürülən məlumatlar" },
    { key: "select_data_fields", label: "Məlumat sahələrini seçmək" },
    { key: "view_errors", label: "Xəta detallarına baxmaq" },
    { key: "connect", label: "Qoşulmaq" },
    { key: "disconnect", label: "Ayırmaq" },
    { key: "configure", label: "Konfiqurasiya" },
    { key: "sync", label: "Sinxronizasiya" },
    { key: "export", label: "Cədvəli export etmək" },
  ]},
  { key: "matrix", label: "Təsdiqləmə Matrisi", actions: [
    { key: "view", label: "Baxış" },
    { key: "create", label: "Yeni matris yaratmaq" },
    { key: "edit", label: "Redaktə etmək" },
    { key: "delete", label: "Silmək" },
    { key: "request_delete", label: "KPI silinmə sorğusu yaratmaq" },
    { key: "approve_delete", label: "Silinmə təsdiqləmək" },
  ]},
  { key: "organization", label: "Struktur / Təşkilat", actions: [
    { key: "view", label: "Baxış" },
    { key: "edit", label: "Redaktə" },
    { key: "manage_structure", label: "Strukturları idarə" },
    { key: "manage_positions", label: "Vəzifələri idarə" },
    { key: "manage_employees", label: "Əməkdaşları idarə" },
    { key: "manage_catalog", label: "Kataloqu idarə" },
  ]},
  { key: "evaluation", label: "Qiymətləndirmə", actions: [
    { key: "view", label: "Baxış" },
    { key: "create_assignment", label: "Qiymətləndirmə yaratmaq" },
    { key: "edit", label: "Redaktə" },
    { key: "send", label: "Qiymətləndirmə göndərmək" },
    { key: "approve", label: "Təsdiqləmək" },
    { key: "manual_score", label: "Manual bal vermək" },
    { key: "random_assign", label: "Təsadüfi təyinat" },
    { key: "manual_assign", label: "Manual təyinat" },
    { key: "view_status", label: "Status izləmək" },
    { key: "manage_criteria", label: "Meyarlar kataloqu" },
    { key: "manage_params", label: "Parametrləri idarə" },
    { key: "toggle_season", label: "Sezon açmaq/bağlamaq" },
    { key: "export", label: "Hesabat export" },
  ]},

  { key: "bonus", label: "Bonus Hesablanması", actions: [
    { key: "view", label: "Baxış" },
    { key: "calculate", label: "Bonus hesablamaq" },
    { key: "force_calculate", label: "Çatışmayan qiymətlərə baxmayaraq hesablamaq" },
    { key: "send_reminder", label: "Xatırlatma göndərmək" },
    { key: "view_details", label: "Hesablama detallarına baxmaq" },
    { key: "export", label: "Hesabat export" },
  ]},
  { key: "whistleblower", label: "Anonim Bildiriş", actions: [
    { key: "view", label: "Baxış" },
    { key: "submit", label: "Bildiriş göndərmək" },
    { key: "review", label: "Bildirişləri araşdırmaq" },
    { key: "respond", label: "Cavab vermək" },
    { key: "close", label: "Bağlamaq" },
  ]},
  { key: "kpi_lifecycle", label: "KPI Lifecycle", actions: [
    { key: "view", label: "Baxış" },
    { key: "view_detail", label: "Kart üzrə detalı görmək" },
    { key: "configure_periods", label: "Dövrləri qurmaq (təyinat, qiymətləndirmə, bonus, review)" },
    { key: "add_review", label: "Review əlavə etmək" },
    { key: "use_custom_period", label: "Digər (kataloq) dövründən istifadə" },
  ]},
  { key: "cascading", label: "Cascading", actions: [
    { key: "view", label: "Baxış" },
    { key: "distribute", label: "Hədəfi komandaya paylaşmaq" },
    { key: "set_slice_limits", label: "Pay üçün limit təyin etmək" },
    { key: "edit", label: "Mövcud paylanmanı redaktə etmək" },
    { key: "cascade_push", label: "Cascade Push" },
    { key: "cascade_pull", label: "Cascade Pull" },
    { key: "approve", label: "Cascading-i təsdiqləmək" },
    { key: "reject", label: "Cascading-i ləğv etmək" },
  ]},
  { key: "kpi_scores", label: "KPI Nəticələri", actions: [
    { key: "view", label: "Nəticələri görmək" },
    { key: "view_calc_details", label: "Hesablama detallarını görmək" },
    { key: "view_evaluator_scores", label: "Qiymətləndiricilərin verdiyi balları görmək" },
    { key: "view_weights", label: "Çəki hesablamalarını görmək" },
    { key: "export", label: "Export" },
  ]},
  { key: "notifications", label: "Bildirişlər", actions: [
    { key: "send", label: "Göndərmək" },
    { key: "manage", label: "İdarə etmək" },
  ]},

  { key: "cascade_matrix", label: "Cascade Matrisi", actions: [
    { key: "view", label: "Baxış" },
    { key: "create", label: "Yeni matris yaratmaq" },
    { key: "edit", label: "Redaktə etmək" },
    { key: "delete", label: "Silmək" },
    { key: "manage_shared_persons", label: "Paylaşılan şəxsləri idarə etmək" },
  ]},
  { key: "salary", label: "Əməkhaqqı Bazası", actions: [
    { key: "view", label: "Baxış" },
    { key: "upload", label: "Yeni bazanı yükləmək" },
    { key: "edit", label: "Redaktə etmək" },
    { key: "export", label: "Export" },
  ]},
  { key: "notifications_settings", label: "Bildiriş Sazlamaları", actions: [
    { key: "view", label: "Baxış" },
    { key: "toggle", label: "Bildirişi aktiv/qeyri-aktiv etmək" },
    { key: "channels", label: "Kanalları seçmək (email, sms, telegram, app-daxili)" },
    { key: "reminders", label: "Xatırlatma günlərini təyin etmək" },
    { key: "recipients", label: "Alıcıları seçmək" },
    { key: "templates", label: "Mesaj şablonunu redaktə etmək" },
  ]},
  { key: "settings", label: "Ayarlar", actions: [
    { key: "view", label: "Baxış" },
    { key: "manage_data", label: "Məlumat cədvəli" },
    { key: "manage_roles", label: "Rol və səlahiyyət" },
    { key: "manage_passwords", label: "Şifrələri idarə" },
    { key: "manage_notifications", label: "Bildiriş sazlamaları" },
  ]},
];

import { getEmployees as _getEmployeesForRoles } from "@/lib/orgStore";

const allUsers = _getEmployeesForRoles()
  .filter(e => e.active)
  .map(e => ({
    name: `${e.firstName} ${e.lastName}`,
    role: e.positionName || "—",
    avatar: (e.firstName?.[0] || "?").toUpperCase(),
  }));

const initialRoles: Role[] = [];


const SettingsPage = () => {
  const [tab, setTab] = useState(0);
  const calcTypes = useCatalogValues("calc_units", CALC_TYPE_DEFAULTS);
  const kpiCategories = useCatalogValues("kpi_categories", KPI_CATEGORY_DEFAULTS);
  const kpiUnits = useCatalogValues("calc_units", KPI_UNIT_DEFAULTS);
  const subKpiUnitOptions = useCatalogValues("sub_kpi_units", SUB_KPI_UNIT_DEFAULTS);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [formulas, setFormulas] = useState<Formula[]>(initialFormulas);
  const [targetTypes, setTargetTypes] = useState(initialTargetTypes);
  const [kpiTypes, setKpiTypes] = useState(initialKpiTypes);
  const [subKpis, setSubKpis] = useState(initialSubKpis);

  // KPI Periods table (HR → Settings → Məlumat Cədvəli → KPI Dövrü)
  const [kpiPeriods, setKpiPeriods] = useState<KpiPeriod[]>(() => getPeriods());
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ startDate: "", endDate: "" });

  useEffect(() => {
    const refresh = () => setKpiPeriods(getPeriods());
    window.addEventListener("periods-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("periods-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const handleCreatePeriod = () => {
    if (!newPeriod.startDate || !newPeriod.endDate) {
      toast.error("Başlama və bitmə tarixini seçin");
      return;
    }
    if (newPeriod.endDate <= newPeriod.startDate) {
      toast.error("Bitmə tarixi başlama tarixindən sonra olmalıdır");
      return;
    }
    const durationLabel = computeDurationLabel(newPeriod.startDate, newPeriod.endDate);
    addPeriod({ durationLabel, startDate: newPeriod.startDate, endDate: newPeriod.endDate });
    toast.success("KPI dövrü yaradıldı");
    setShowCreatePeriod(false);
    setNewPeriod({ startDate: "", endDate: "" });
  };

  const handleDeletePeriod = (id: number) => {
    deletePeriod(id);
    toast.success("KPI dövrü silindi");
  };

  // Dialogs
  const [showCreateTarget, setShowCreateTarget] = useState(false);
  const [editingTarget, setEditingTarget] = useState<typeof initialTargetTypes[0] | null>(null);
  const [newTarget, setNewTarget] = useState({ name: "", structure: "", calcTypes: [] as string[], active: true });
  const [targetCalcSearch, setTargetCalcSearch] = useState("");
  const [showTargetCalcDropdown, setShowTargetCalcDropdown] = useState(false);

  const [showCreateKpiType, setShowCreateKpiType] = useState(false);
  const [editingKpiType, setEditingKpiType] = useState<typeof initialKpiTypes[0] | null>(null);
  const [newKpiType, setNewKpiType] = useState({ name: "", category: "", units: [] as string[], description: "", active: true });
  const [kpiUnitSearch, setKpiUnitSearch] = useState("");
  const [showKpiUnitDropdown, setShowKpiUnitDropdown] = useState(false);

  const [showCreateSubKpi, setShowCreateSubKpi] = useState(false);
  const [editingSubKpi, setEditingSubKpi] = useState<typeof initialSubKpis[0] | null>(null);
  const [newSubKpi, setNewSubKpi] = useState({ name: "", kpiName: "", units: [] as string[], weight: 0, active: true });
  const [showSubKpiKpiDropdown, setShowSubKpiKpiDropdown] = useState(false);
  const [subKpiKpiSearch, setSubKpiKpiSearch] = useState("");
  const [showSubKpiUnitDropdown, setShowSubKpiUnitDropdown] = useState(false);
  const [subKpiUnitSearch, setSubKpiUnitSearch] = useState("");

  const [showCreateDataType, setShowCreateDataType] = useState(false);
  const [newDataType, setNewDataType] = useState({ name: "", type: "", structure: "", description: "" });
  const dataTypeOptions = ["Hədəf Tipi", "KPI Növü", "Hesablama Metodu", "Ölçü Vahidi", "Kateqoriya"];

  const [showCreateFormula, setShowCreateFormula] = useState(false);
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null);
  const [newFormula, setNewFormula] = useState({ name: "", description: "", kpiName: "", variables: [""] as string[], formula: "" });

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [usersRole, setUsersRole] = useState<Role | null>(null);
  const [roleUserSearch, setRoleUserSearch] = useState("");


  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: number; name: string; usedIn?: string } | null>(null);

  const toggleCalcType = (t: string) => setNewTarget(p => ({ ...p, calcTypes: p.calcTypes.includes(t) ? p.calcTypes.filter(x => x !== t) : [...p.calcTypes, t] }));
  const toggleKpiUnit = (u: string) => setNewKpiType(p => ({ ...p, units: p.units.includes(u) ? p.units.filter(x => x !== u) : [...p.units, u] }));

  const insertFormulaToken = (token: string) => setNewFormula(prev => ({ ...prev, formula: prev.formula + token }));

  const saveFormula = () => {
    if (!newFormula.name || !newFormula.formula) return;
    if (editingFormula) {
      setFormulas(prev => prev.map(f => f.id === editingFormula.id ? { ...editingFormula, name: newFormula.name, formula: newFormula.formula, description: newFormula.description, kpiName: newFormula.kpiName, variables: newFormula.variables.filter(v => v.trim()) } : f));
    } else {
      setFormulas(prev => [...prev, { id: prev.length + 1, name: newFormula.name, formula: newFormula.formula, description: newFormula.description, kpiName: newFormula.kpiName, variables: newFormula.variables.filter(v => v.trim()) }]);
    }
    setNewFormula({ name: "", description: "", kpiName: "", variables: [""], formula: "" });
    setShowCreateFormula(false);
    setEditingFormula(null);
  };

  const handleEditFormula = (f: Formula) => {
    toast.info("Dəyişiklik cari tarixdən etibarən qüvvəyə minir");
    setEditingFormula(f);
    setNewFormula({ name: f.name, description: f.description, kpiName: f.kpiName, variables: f.variables.length > 0 ? f.variables : [""], formula: f.formula });
    setShowCreateFormula(true);
  };

  const handleDeleteFormula = (f: Formula) => {
    const usedIn = f.kpiName;
    if (usedIn) {
      toast.error(`Bu düstur hal-hazırda "${usedIn}" KPI-sinin tərkibində işlədilir`);
      return;
    }
    setDeleteConfirm({ type: "formula", id: f.id, name: f.name });
  };

  const handleEditTarget = (t: typeof initialTargetTypes[0]) => {
    toast.info("Dəyişiklik cari tarixdən etibarən qüvvəyə minir");
    setEditingTarget(t);
    setNewTarget({ name: t.name, structure: t.structure, calcTypes: t.calcType.split(", "), active: t.active });
    setShowCreateTarget(true);
  };

  const handleDeleteTarget = (t: typeof initialTargetTypes[0]) => {
    if (t.usedIn) {
      toast.error(`Bu məlumat hal-hazırda "${t.usedIn}" tərkibində işlədilir`);
      return;
    }
    setDeleteConfirm({ type: "target", id: t.id, name: t.name });
  };

  const handleEditKpiType = (t: typeof initialKpiTypes[0]) => {
    toast.info("Dəyişiklik cari tarixdən etibarən qüvvəyə minir");
    setEditingKpiType(t);
    setNewKpiType({ name: t.name, category: t.category, units: t.unit.split(", "), description: "", active: t.active });
    setShowCreateKpiType(true);
  };

  const handleDeleteKpiType = (t: typeof initialKpiTypes[0]) => {
    if (t.usedIn) {
      toast.error(`Bu məlumat hal-hazırda "${t.usedIn}" tərkibində işlədilir`);
      return;
    }
    setDeleteConfirm({ type: "kpiType", id: t.id, name: t.name });
  };

  const handleEditSubKpi = (sk: typeof initialSubKpis[0]) => {
    toast.info("Dəyişiklik cari tarixdən etibarən qüvvəyə minir");
    setEditingSubKpi(sk);
    setNewSubKpi({ name: sk.name, kpiName: sk.kpiName, units: [...sk.units], weight: sk.weight, active: sk.active });
    setShowCreateSubKpi(true);
  };

  const toggleSubKpiUnit = (u: string) => setNewSubKpi(p => ({ ...p, units: p.units.includes(u) ? p.units.filter(x => x !== u) : [...p.units, u] }));

  const handleDeleteSubKpi = (sk: typeof initialSubKpis[0]) => {
    if (sk.usedIn) {
      toast.error(`Bu Hədəf hal-hazırda "${sk.usedIn}" KPI-sinin tərkibində işlədilir`);
      return;
    }
    setDeleteConfirm({ type: "subKpi", id: sk.id, name: sk.name });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "target") setTargetTypes(prev => prev.filter(t => t.id !== deleteConfirm.id));
    if (deleteConfirm.type === "kpiType") setKpiTypes(prev => prev.filter(t => t.id !== deleteConfirm.id));
    if (deleteConfirm.type === "subKpi") setSubKpis(prev => prev.filter(s => s.id !== deleteConfirm.id));
    if (deleteConfirm.type === "formula") setFormulas(prev => prev.filter(f => f.id !== deleteConfirm.id));
    toast.success("Uğurla silindi");
    setDeleteConfirm(null);
  };

  const toggleRolePermission = (modKey: string, actionKey: string) => {
    if (!editingRole) return;
    setEditingRole(prev => {
      if (!prev) return null;
      const current = prev.permissions[modKey] || [];
      const next = current.includes(actionKey) ? current.filter(a => a !== actionKey) : [...current, actionKey];
      const updated = { ...prev.permissions, [modKey]: next };
      if (next.length === 0) delete updated[modKey];
      return { ...prev, permissions: updated };
    });
  };

  const toggleAllModuleActions = (modKey: string) => {
    if (!editingRole) return;
    const mod = permissionModules.find(m => m.key === modKey);
    if (!mod) return;
    const current = editingRole.permissions[modKey] || [];
    const all = mod.actions.map(a => a.key);
    const allOn = all.every(a => current.includes(a));
    setEditingRole(prev => {
      if (!prev) return null;
      const updated = { ...prev.permissions };
      if (allOn) delete updated[modKey];
      else updated[modKey] = all;
      return { ...prev, permissions: updated };
    });
  };

  const totalPermissionCount = (perms: Record<string, string[]>) => Object.values(perms).reduce((s, a) => s + a.length, 0);
  const totalAvailablePermissions = permissionModules.reduce((s, m) => s + m.actions.length, 0);

  const toggleAllPermissionsGlobal = () => {
    if (!editingRole) return;
    const total = totalPermissionCount(editingRole.permissions);
    setEditingRole(prev => {
      if (!prev) return null;
      if (total === totalAvailablePermissions) {
        return { ...prev, permissions: {} };
      }
      const all: Record<string, string[]> = {};
      permissionModules.forEach(m => { all[m.key] = m.actions.map(a => a.key); });
      return { ...prev, permissions: all };
    });
  };

  const [selectedRoleModule, setSelectedRoleModule] = useState<string>("home");
  const [roleModuleSearch, setRoleModuleSearch] = useState("");


  const toggleRoleUser = (name: string) => {
    if (!editingRole) return;
    setEditingRole(prev => prev ? ({ ...prev, users: prev.users.includes(name) ? prev.users.filter(u => u !== name) : [...prev.users, name] }) : null);
  };

  const saveRole = () => {
    if (!editingRole) return;
    const name = editingRole.name.trim();
    if (!name) { toast.error("Başlıq mütləqdir"); return; }
    if (!editingRole.description?.trim()) { toast.error("Təsvir mütləqdir"); return; }
    const newUsers = editingRole.users;
    setRoles(prev => {
      const exists = prev.find(r => r.id === editingRole.id);
      // Single-role enforcement: bu rola əlavə olunan əməkdaşları digər rolların users[]-indən çıxar
      const stripped = prev.map(r =>
        r.id === editingRole.id ? r : { ...r, users: r.users.filter(u => !newUsers.includes(u)) }
      );
      if (exists) return stripped.map(r => r.id === editingRole.id ? { ...editingRole, name } : r);
      return [...stripped, { ...editingRole, name }];
    });
    toast.success(`Rol yeniləndi. ${newUsers.length} əməkdaş hesabı sinxronlaşdırıldı.`);
    setEditingRole(null);
  };

  const handleDeleteRole = (role: Role) => {
    if (role.name.toUpperCase() === "HR") {
      toast.error("HR rolu silinə bilməz");
      return;
    }
    setRoles(prev => prev.filter(r => r.id !== role.id));
    toast.success(`"${role.name}" rolu silindi`);
  };

  const handleCreateRole = () => {
    const newRole: Role = { id: Date.now(), name: "YENİ ROL", permissions: {}, users: [], description: "", language: "AZ" };
    setRoles(prev => [...prev, newRole]);
    setEditingRole(newRole);
    setRoleUserSearch("");
    toast.success("Yeni rol yaradıldı");
  };

  const filteredRoleUsers = allUsers.filter(u => u.name.toLowerCase().includes(roleUserSearch.toLowerCase()) || u.role.toLowerCase().includes(roleUserSearch.toLowerCase()));

  const tabs = ["1. Məlumat Cədvəli", "2. Rol və Səlahiyyətlər", "3. Bildiriş sazlamaları"];
  const tabCards = [
    {
      title: "Məlumat Cədvəli",
      desc: "Sistem üzrə istifadə olunan bütün dropdown kataloqlarını idarə edin.",
      icon: Database,
      gradient: "from-sky-500/15 via-cyan-500/10 to-transparent",
      iconBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      title: "Rol və Səlahiyyətlər",
      desc: "İstifadəçi rollarını, modul icazələrini və təyinatları idarə edin.",
      icon: Shield,
      gradient: "from-violet-500/15 via-fuchsia-500/10 to-transparent",
      iconBg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
    {
      title: "Bildiriş sazlamaları",
      desc: "Bildiriş kanalları, alıcılar və şablonları konfiqurasiya edin.",
      icon: Bell,
      gradient: "from-amber-500/15 via-orange-500/10 to-transparent",
      iconBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
  ];
  const [openCard, setOpenCard] = useUrlIndexView("card", tabCards.length);

  return (
    <div className="min-h-screen">
      <Header title="Sazlamalar" />
      <main className="p-6 pb-24">
        <PageHero
          badge="Sistem Sazlamaları"
          icon={Sparkles}
          title="Sazlamalar"
          subtitle="Sistem konfiqurasiyası, rollar və şifrələri idarə edin"
        />

        {openCard === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tabCards.map((c, i) => (
              <button
                key={i}
                onClick={() => { setOpenCard(i); setTab(i); }}
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
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <button
                onClick={() => setOpenCard(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary transition-colors"
              >
                ← Geri
              </button>
              <h2 className="text-lg font-semibold text-foreground">{tabCards[openCard].title}</h2>
            </div>


        {/* Tab 1: Məlumat Cədvəli */}
        {tab === 0 && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <DropdownCatalogsTab />
          </div>
        )}



        {/* Tab 2: Rol və Səlahiyyətlər — DB-backed */}
        {tab === 1 && <RolesPermissionsTab />}

        {/* Tab 3: Bildiriş sazlamaları */}
        {tab === 2 && (
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <NotificationSettingsTab />
          </div>
        )}
          </>
        )}

      </main>


      {/* Create/Edit Target Type Dialog */}
      <Dialog open={showCreateTarget} onOpenChange={setShowCreateTarget}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTarget ? "Hədəf Tipini Redaktə Et" : "Yeni Hədəf Tipi Yarat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Hədəf Tipi</label><input value={newTarget.name} onChange={e => setNewTarget(p => ({ ...p, name: e.target.value }))} placeholder="Məsələn: Aylıq Satış Hədəfi" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Aid Olduğu Struktur</label><select value={newTarget.structure} onChange={e => setNewTarget(p => ({ ...p, structure: e.target.value }))} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"><option value="">Struktur seçin</option>{structures.map(s => <option key={s}>{s}</option>)}</select></div>
            <div>
              <label className="text-sm font-medium text-foreground">Hesablama Tipi (çoxlu seçim)</label>
              <div className="relative mt-1">
                <div onClick={() => setShowTargetCalcDropdown(!showTargetCalcDropdown)} className="w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background cursor-pointer flex flex-wrap gap-1 items-center">
                  {newTarget.calcTypes.length === 0 && <span className="text-muted-foreground">Tip seçin</span>}
                  {newTarget.calcTypes.map(t => <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{t}<X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); toggleCalcType(t); }} /></span>)}
                </div>
                {showTargetCalcDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
                    <div className="p-2"><input value={targetCalcSearch} onChange={e => setTargetCalcSearch(e.target.value)} placeholder="Axtar..." className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" onClick={e => e.stopPropagation()} /></div>
                    {calcTypes.filter(c => c.toLowerCase().includes(targetCalcSearch.toLowerCase())).map(c => (
                      <div key={c} onClick={e => { e.stopPropagation(); toggleCalcType(c); }} className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${newTarget.calcTypes.includes(c) ? 'bg-primary/5' : ''}`}><span>{c}</span>{newTarget.calcTypes.includes(c) && <Check className="w-4 h-4 text-primary" />}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNewTarget(p => ({ ...p, active: !p.active }))} className={`w-10 h-5 rounded-full transition-colors ${newTarget.active ? 'bg-primary' : 'bg-muted'}`}><div className={`w-4 h-4 rounded-full bg-card shadow transition-transform ${newTarget.active ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
              <span className="text-sm">Aktiv</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
              <button onClick={() => { setShowCreateTarget(false); setEditingTarget(null); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit KPI Type Dialog */}
      <Dialog open={showCreateKpiType} onOpenChange={setShowCreateKpiType}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingKpiType ? "KPI Növünü Redaktə Et" : "Yeni KPI Növü Yarat"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">KPI Növü</label><input value={newKpiType.name} onChange={e => setNewKpiType(p => ({ ...p, name: e.target.value }))} placeholder="Məsələn: Kəmiyyət KPI-ları" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Aid Olduğu Kateqoriya</label><select value={newKpiType.category} onChange={e => setNewKpiType(p => ({ ...p, category: e.target.value }))} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"><option value="">Kateqoriya seçin</option>{kpiCategories.map(c => <option key={c}>{c}</option>)}</select></div>
            <div>
              <label className="text-sm font-medium text-foreground">Ölçü Vahidi (çoxlu seçim)</label>
              <div className="relative mt-1">
                <div onClick={() => setShowKpiUnitDropdown(!showKpiUnitDropdown)} className="w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background cursor-pointer flex flex-wrap gap-1 items-center">
                  {newKpiType.units.length === 0 && <span className="text-muted-foreground">Vahid seçin</span>}
                  {newKpiType.units.map(u => <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{u}<X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); toggleKpiUnit(u); }} /></span>)}
                </div>
                {showKpiUnitDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
                    <div className="p-2"><input value={kpiUnitSearch} onChange={e => setKpiUnitSearch(e.target.value)} placeholder="Axtar..." className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" onClick={e => e.stopPropagation()} /></div>
                    {kpiUnits.filter(u => u.toLowerCase().includes(kpiUnitSearch.toLowerCase())).map(u => (
                      <div key={u} onClick={e => { e.stopPropagation(); toggleKpiUnit(u); }} className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${newKpiType.units.includes(u) ? 'bg-primary/5' : ''}`}><span>{u}</span>{newKpiType.units.includes(u) && <Check className="w-4 h-4 text-primary" />}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNewKpiType(p => ({ ...p, active: !p.active }))} className={`w-10 h-5 rounded-full transition-colors ${newKpiType.active ? 'bg-primary' : 'bg-muted'}`}><div className={`w-4 h-4 rounded-full bg-card shadow transition-transform ${newKpiType.active ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
              <span className="text-sm">Aktiv</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
              <button onClick={() => { setShowCreateKpiType(false); setEditingKpiType(null); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Hədəf Dialog */}
      <Dialog open={showCreateSubKpi} onOpenChange={setShowCreateSubKpi}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingSubKpi ? "Hədəf Redaktə Et" : "Yeni Hədəf Yarat"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Hədəf Adı</label><input value={newSubKpi.name} onChange={e => setNewSubKpi(p => ({ ...p, name: e.target.value }))} placeholder="Məsələn: Online Satış" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Aid Olduğu KPI</label>
              <div className="relative mt-1">
                <div onClick={() => setShowSubKpiKpiDropdown(!showSubKpiKpiDropdown)} className="w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background cursor-pointer flex flex-wrap gap-1 items-center">
                  {!newSubKpi.kpiName && <span className="text-muted-foreground">KPI seçin</span>}
                  {newSubKpi.kpiName && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{newSubKpi.kpiName}<X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); setNewSubKpi(p => ({ ...p, kpiName: "" })); }} /></span>}
                </div>
                {showSubKpiKpiDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
                    <div className="p-2"><input value={subKpiKpiSearch} onChange={e => setSubKpiKpiSearch(e.target.value)} placeholder="KPI axtar..." className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" onClick={e => e.stopPropagation()} /></div>
                    {kpiNameOptions.filter(k => k.toLowerCase().includes(subKpiKpiSearch.toLowerCase())).map(k => (
                      <div key={k} onClick={e => { e.stopPropagation(); setNewSubKpi(p => ({ ...p, kpiName: k })); setShowSubKpiKpiDropdown(false); setSubKpiKpiSearch(""); }} className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${newSubKpi.kpiName === k ? 'bg-primary/5' : ''}`}><span>{k}</span>{newSubKpi.kpiName === k && <Check className="w-4 h-4 text-primary" />}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Ölçü Vahidi (çoxlu seçim)</label>
                <div className="relative mt-1">
                  <div onClick={() => setShowSubKpiUnitDropdown(!showSubKpiUnitDropdown)} className="w-full min-h-[42px] px-3 py-2 text-sm border border-border rounded-lg bg-background cursor-pointer flex flex-wrap gap-1 items-center">
                    {newSubKpi.units.length === 0 && <span className="text-muted-foreground">Vahid seçin</span>}
                    {newSubKpi.units.map(u => <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{u}<X className="w-3 h-3 cursor-pointer" onClick={e => { e.stopPropagation(); toggleSubKpiUnit(u); }} /></span>)}
                  </div>
                  {showSubKpiUnitDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg">
                      <div className="p-2"><input value={subKpiUnitSearch} onChange={e => setSubKpiUnitSearch(e.target.value)} placeholder="Axtar..." className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background" onClick={e => e.stopPropagation()} /></div>
                      {subKpiUnitOptions.filter(u => u.toLowerCase().includes(subKpiUnitSearch.toLowerCase())).map(u => (
                        <div key={u} onClick={e => { e.stopPropagation(); toggleSubKpiUnit(u); }} className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${newSubKpi.units.includes(u) ? 'bg-primary/5' : ''}`}><span>{u}</span>{newSubKpi.units.includes(u) && <Check className="w-4 h-4 text-primary" />}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div><label className="text-sm font-medium text-foreground">Çəki (%)</label><input type="number" value={newSubKpi.weight} onChange={e => setNewSubKpi(p => ({ ...p, weight: Number(e.target.value) }))} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setNewSubKpi(p => ({ ...p, active: !p.active }))} className={`w-10 h-5 rounded-full transition-colors ${newSubKpi.active ? 'bg-primary' : 'bg-muted'}`}><div className={`w-4 h-4 rounded-full bg-card shadow transition-transform ${newSubKpi.active ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
              <span className="text-sm">Aktiv</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
              <button onClick={() => { setShowCreateSubKpi(false); setEditingSubKpi(null); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Data Type Dialog */}
      <Dialog open={showCreateDataType} onOpenChange={setShowCreateDataType}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Yeni Məlumat Tipi Yarat</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Məlumat Tipinin Adı</label><input value={newDataType.name} onChange={e => setNewDataType(p => ({ ...p, name: e.target.value }))} placeholder="Yeni Performans Göstəricisi" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Tip Kateqoriyası</label><select value={newDataType.type} onChange={e => setNewDataType(p => ({ ...p, type: e.target.value }))} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"><option value="">Kateqoriya seçin</option>{dataTypeOptions.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-sm font-medium text-foreground">Aid Olduğu Struktur</label><select value={newDataType.structure} onChange={e => setNewDataType(p => ({ ...p, structure: e.target.value }))} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background"><option value="">Struktur seçin</option>{structures.map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="text-sm font-medium text-foreground">Təsvir</label><textarea value={newDataType.description} onChange={e => setNewDataType(p => ({ ...p, description: e.target.value }))} placeholder="Təsviri..." rows={3} className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background resize-none" /></div>
            <div className="flex gap-3 pt-2">
              <button className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
              <button onClick={() => setShowCreateDataType(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Formula Dialog */}
      <Dialog open={showCreateFormula} onOpenChange={() => { setShowCreateFormula(false); setEditingFormula(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingFormula ? "Düsturu Redaktə Et" : "Yeni Düstur Əlavə Et"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-foreground">Düstur Adı</label><input value={newFormula.name} onChange={e => setNewFormula(p => ({ ...p, name: e.target.value }))} placeholder="Satış Performans Düsturu" className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Təsvir</label><input value={newFormula.description} onChange={e => setNewFormula(p => ({ ...p, description: e.target.value }))} placeholder="Düsturun təsviri..." className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div><label className="text-sm font-medium text-foreground">Aid Olduğu KPI</label><input value={newFormula.kpiName} onChange={e => setNewFormula(p => ({ ...p, kpiName: e.target.value }))} placeholder="KPI adı..." className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background" /></div>
            <div>
              <div className="flex items-center justify-between"><label className="text-sm font-medium text-foreground">Dəyişənlər</label><button onClick={() => setNewFormula(p => ({ ...p, variables: [...p.variables, ""] }))} className="text-xs text-primary font-medium">+ Yeni dəyişən</button></div>
              {newFormula.variables.map((v, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <input value={v} onChange={e => { const vars = [...newFormula.variables]; vars[i] = e.target.value; setNewFormula(p => ({ ...p, variables: vars })); }} placeholder={`Dəyişən ${i + 1}`} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-secondary" />
                  {newFormula.variables.length > 1 && <button onClick={() => setNewFormula(p => ({ ...p, variables: p.variables.filter((_, idx) => idx !== i) }))} className="w-8 h-8 rounded bg-zone-red-bg text-zone-red-text flex items-center justify-center"><X className="w-3 h-3" /></button>}
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Formula Builder</label>
              <div className="mt-1 border border-border rounded-lg overflow-hidden">
                <div className="flex flex-wrap gap-1 p-2 bg-secondary border-b border-border">
                  {newFormula.variables.filter(v => v.trim()).map((v, i) => <button key={i} onClick={() => insertFormulaToken(v)} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">{v}</button>)}
                  <span className="text-xs text-muted-foreground px-1 py-1">|</span>
                  {["+", "-", "×", "÷", "(", ")", "100"].map(op => <button key={op} onClick={() => insertFormulaToken(` ${op} `)} className="px-2 py-1 text-xs bg-card border border-border rounded font-mono">{op}</button>)}
                </div>
                <input value={newFormula.formula} onChange={e => setNewFormula(p => ({ ...p, formula: e.target.value }))} placeholder="(A / B) × 100" className="w-full px-3 py-2.5 text-sm bg-background font-mono" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveFormula} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
              <button onClick={() => { setShowCreateFormula(false); setEditingFormula(null); }} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle className="text-center">
              <span className="italic font-bold tracking-wider text-primary">{editingRole?.name?.trim() || "YENİ ROL"}</span>
              <span className="text-foreground"> — Rolun redaktə edilməsi</span>
            </DialogTitle>
          </DialogHeader>
          {editingRole && (() => {
            const totalSelected = totalPermissionCount(editingRole.permissions);
            const allSelected = totalSelected === totalAvailablePermissions;
            const activeModule = permissionModules.find(m => m.key === selectedRoleModule) || permissionModules[0];
            const filteredModules = permissionModules.filter(m => m.label.toLowerCase().includes(roleModuleSearch.toLowerCase()));
            const moduleActs = editingRole.permissions[activeModule.key] || [];
            const moduleAllOn = activeModule.actions.length > 0 && activeModule.actions.every(a => moduleActs.includes(a.key));
            return (
              <div className="flex flex-col">
                {/* Top bar: Language + Name + Description */}
                <div className="p-5 pb-3 border-b border-border space-y-3">
                  <div className="grid grid-cols-[120px_1fr_2fr] gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">Dil</label>
                      <select
                        value={editingRole.language || "AZ"}
                        onChange={e => setEditingRole(prev => prev ? { ...prev, language: e.target.value as "AZ" | "EN" | "RU" } : null)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                      >
                        <option value="AZ">AZ</option>
                        <option value="EN">EN</option>
                        <option value="RU">RU</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Başlıq <span className="text-destructive">*</span>
                      </label>
                      <input
                        value={editingRole.name}
                        onChange={e => setEditingRole(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                        placeholder="HR, MANAGER, USER..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background uppercase tracking-wider font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Təsvir <span className="text-destructive">*</span>
                      </label>
                      <input
                        value={editingRole.description || ""}
                        onChange={e => setEditingRole(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Rolun qısa təsviri"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleAllPermissionsGlobal}
                        className={`w-10 h-5 rounded-full transition-colors ${allSelected ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-card shadow transition-transform ${allSelected ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Bütün icazələri seç</p>
                        <p className="text-[11px] text-muted-foreground">Bütün modullarda bütün icazələri bir kliklə yandır/söndür</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{totalSelected} / {totalAvailablePermissions}</span>
                  </div>
                </div>

                {/* Two-panel layout */}
                <div className="grid grid-cols-12 min-h-[420px]">
                  {/* Left: modules */}
                  <div className="col-span-5 border-r border-border flex flex-col max-h-[420px]">
                    <div className="p-3 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input value={roleModuleSearch} onChange={e => setRoleModuleSearch(e.target.value)} placeholder="Modul axtar..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded bg-background" />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {filteredModules.map(mod => {
                        const acts = editingRole.permissions[mod.key] || [];
                        const sel = acts.length;
                        const total = mod.actions.length;
                        const isActive = mod.key === selectedRoleModule;
                        const fullySelected = sel === total && total > 0;
                        return (
                          <button
                            key={mod.key}
                            type="button"
                            onClick={() => setSelectedRoleModule(mod.key)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-border transition-colors ${isActive ? "bg-primary/10" : "hover:bg-secondary"}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${fullySelected ? "bg-zone-green-text" : sel > 0 ? "bg-warning" : "border border-border"}`}>
                                {sel > 0 && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                              </div>
                              <span className={`text-sm ${isActive ? "font-semibold text-foreground" : "text-foreground"}`}>{mod.label}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${fullySelected ? "bg-zone-green-bg text-zone-green-text" : sel > 0 ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>{sel}/{total}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: selected module's permissions */}
                  <div className="col-span-7 flex flex-col overflow-hidden max-h-[420px]">
                    <div className="p-3 border-b border-border flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{activeModule.label}</h4>
                        <p className="text-[11px] text-muted-foreground">{moduleActs.length} / {activeModule.actions.length} icazə seçilib</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllModuleActions(activeModule.key)}
                        className="text-xs text-primary font-medium px-2 py-1 rounded hover:bg-primary/10"
                      >
                        {moduleAllOn ? "Hamısını sil" : "Hamısını seç"}
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
                      {activeModule.actions.map(a => {
                        const on = moduleActs.includes(a.key);
                        return (
                          <div
                            key={a.key}
                            onClick={() => toggleRolePermission(activeModule.key, a.key)}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${on ? "bg-primary/10 border border-primary" : "border border-border hover:bg-secondary"}`}
                          >
                            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-primary" : "border border-border"}`}>{on && <Check className="w-3 h-3 text-primary-foreground" />}</div>
                            <span className="text-foreground">{a.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer — users managed separately via card 👥 icon */}
                <div className="border-t border-border p-4">
                  <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    İstifadəçilər rol yaradıldıqdan sonra kartın üzərindəki 👥 ikonundan idarə olunur.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={saveRole} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda Saxla</button>
                    <button onClick={() => setEditingRole(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Bağla</button>
                  </div>
                </div>

              </div>
            );
          })()}
        </DialogContent>

      </Dialog>

      {/* Users Management Dialog — opened from 👥 icon on role card */}
      <Dialog open={!!usersRole} onOpenChange={() => setUsersRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>İstifadəçiləri idarə et — </span>
              <span className="tracking-wider font-bold text-primary">{usersRole?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {usersRole && (() => {
            const list = allUsers.filter(u =>
              u.name.toLowerCase().includes(roleUserSearch.toLowerCase()) ||
              u.role.toLowerCase().includes(roleUserSearch.toLowerCase()),
            );
            const allNames = list.map(u => u.name);
            const allSelected = allNames.length > 0 && allNames.every(n => usersRole.users.includes(n));
            const toggle = (name: string) => setUsersRole(prev => prev ? ({
              ...prev,
              users: prev.users.includes(name) ? prev.users.filter(u => u !== name) : [...prev.users, name],
            }) : null);
            const toggleAll = () => setUsersRole(prev => prev ? ({
              ...prev,
              users: allSelected
                ? prev.users.filter(u => !allNames.includes(u))
                : Array.from(new Set([...prev.users, ...allNames])),
            }) : null);
            const save = () => {
              const newUsers = usersRole.users;
              setRoles(prev => {
                const stripped = prev.map(r =>
                  r.id === usersRole.id ? r : { ...r, users: r.users.filter(u => !newUsers.includes(u)) },
                );
                return stripped.map(r => r.id === usersRole.id ? { ...r, users: newUsers } : r);
              });
              toast.success(`${newUsers.length} əməkdaş "${usersRole.name}" rolu üçün yenilədi.`);
              setUsersRole(null);
            };
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={roleUserSearch}
                      onChange={e => setRoleUserSearch(e.target.value)}
                      placeholder="Əməkdaş axtar..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary font-medium text-foreground shrink-0"
                  >
                    {allSelected ? "Seçimləri sıfırla" : "Hamısını seç"}
                  </button>
                </div>
                {usersRole.users.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-lg bg-secondary/30">
                    {usersRole.users.map(u => (
                      <span key={u} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                        {u}
                        <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => toggle(u)} />
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[420px] overflow-y-auto border border-border rounded-lg p-2">
                  {list.map((u, i) => {
                    const on = usersRole.users.includes(u.name);
                    return (
                      <div key={i} onClick={() => toggle(u.name)} className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${on ? "bg-primary/5 border border-primary" : "hover:bg-secondary border border-transparent"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-semibold shrink-0">{u.avatar}</div>
                          <div className="min-w-0"><p className="text-xs font-medium text-foreground truncate">{u.name}</p><p className="text-[10px] text-muted-foreground truncate">{u.role}</p></div>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-border"}`}>{on && <Check className="w-3 h-3 text-primary-foreground" />}</div>
                      </div>
                    );
                  })}
                  {list.length === 0 && <p className="col-span-full text-center text-xs text-muted-foreground py-4">Nəticə tapılmadı</p>}
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={save} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">💾 Yadda saxla</button>
                  <button onClick={() => setUsersRole(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Bağla</button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>



      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Silmək istədiyinizə əminsiniz?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zone-red-bg">
              <AlertTriangle className="w-5 h-5 text-zone-red-text shrink-0" />
              <p className="text-sm text-zone-red-text"><strong>"{deleteConfirm?.name}"</strong> silinəcək. Bu əməliyyat geri qaytarıla bilməz.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={confirmDelete} className="flex-1 py-2.5 text-sm rounded-lg bg-destructive text-destructive-foreground font-medium">Sil</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">Ləğv Et</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create KPI Period Dialog */}
      <Dialog open={showCreatePeriod} onOpenChange={setShowCreatePeriod}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" /> Yeni KPI Dövrü
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Başlama və bitmə tarixini seçin — müddət avtomatik hesablanacaq</p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Başlama tarixi</label>
              <input
                type="date"
                value={newPeriod.startDate}
                onChange={e => setNewPeriod(p => ({ ...p, startDate: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Bitmə tarixi</label>
              <input
                type="date"
                value={newPeriod.endDate}
                onChange={e => setNewPeriod(p => ({ ...p, endDate: e.target.value }))}
                className="w-full mt-1 px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:outline-none"
              />
            </div>
            {newPeriod.startDate && newPeriod.endDate && newPeriod.endDate > newPeriod.startDate && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                <span className="text-muted-foreground">Müddət:</span>{" "}
                <span className="font-semibold text-primary">
                  {computeDurationLabel(newPeriod.startDate, newPeriod.endDate)}
                </span>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreatePeriod} className="flex-1 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
                💾 Yadda Saxla
              </button>
              <button onClick={() => setShowCreatePeriod(false)} className="flex-1 py-2.5 text-sm rounded-lg border border-border bg-card">
                Ləğv Et
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
