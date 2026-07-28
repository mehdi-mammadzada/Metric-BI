import { useEffect, useMemo, useState } from "react";
import { Database, Plus, Pencil, Trash2, Search, X, Check, CalendarIcon, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  addCatalogValue,
  addCatalogRow,
  addDropdownCatalog,
  deleteDropdownCatalog,
  getCatalogValues,
  getDropdownCatalogs,
  removeCatalogRow,
  removeCatalogValue,
  renameDropdownCatalog,
  updateCatalogRow,
  updateCatalogValue,
  LOCKED_CATALOG_IDS,
  type DropdownCatalog,
  type CatalogRow,
  type TargetTypeRow,
  type KpiKindRow,
  type SubKpiRow,
} from "@/lib/dropdownCatalogStore";
import {
  addPeriod, deletePeriod, computeDurationLabel, formatPeriodRange, getPeriods, type KpiPeriod,
} from "@/lib/teamsStore";

// ---------- köməkçi UI ----------
const inputCls = "w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "text-sm font-medium text-foreground block mb-1.5";

const ActiveToggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className="flex items-center gap-2 text-sm"
  >
    <span className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
    </span>
    <span className="text-foreground">Aktiv</span>
  </button>
);

const MultiTagInput = ({ values, onChange, placeholder, options }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string; options?: string[];
}) => {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    const t = v.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  };
  return (
    <div>
      <div className={`${inputCls} min-h-[44px] flex flex-wrap items-center gap-1.5`}>
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
            {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive"><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
          placeholder={values.length === 0 ? (placeholder || "Seç və ya yaz") : ""}
          className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
        />
      </div>
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {options.filter(o => !values.includes(o)).map(o => (
            <button key={o} onClick={() => add(o)} className="text-xs px-2 py-0.5 rounded border border-border hover:bg-secondary text-muted-foreground">+ {o}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Strukturlaşdırılmış cədvəllər ----------
const TargetTypesTable = ({ rows, onEdit, onDelete }: { rows: TargetTypeRow[]; onEdit: (r: TargetTypeRow) => void; onDelete: (r: TargetTypeRow) => void }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="text-muted-foreground text-left border-b border-border">
        <th className="py-3 w-12 font-medium">No</th>
        <th className="py-3 font-medium">Hədəf Tipi</th>
        <th className="py-3 font-medium">Struktur</th>
        <th className="py-3 font-medium">Hesablama Tipi</th>
        <th className="py-3 w-32 font-medium text-right pr-2">Əməliyyat</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Dəyər yoxdur</td></tr>
      ) : rows.map((r, i) => (
        <tr key={r.id} className={`border-b border-border last:border-b-0 ${r.active === false ? "opacity-50" : ""}`}>
          <td className="py-4 text-muted-foreground">{i + 1}</td>
          <td className="py-4 text-foreground">{r.name}</td>
          <td className="py-4 text-foreground">{r.structure}</td>
          <td className="py-4 text-foreground">{r.calcTypes.join(", ")}</td>
          <td className="py-4">
            <div className="flex items-center justify-end gap-2 pr-2">
              <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => onDelete(r)} className="p-1.5 rounded hover:bg-zone-red-bg"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  );

const KpiKindsTable = ({ rows, onEdit, onDelete }: { rows: KpiKindRow[]; onEdit: (r: KpiKindRow) => void; onDelete: (r: KpiKindRow) => void }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="text-muted-foreground text-left border-b border-border">
        <th className="py-3 w-12 font-medium">No</th>
        <th className="py-3 font-medium">KPI Növü</th>
        <th className="py-3 font-medium">Kateqoriya</th>
        <th className="py-3 font-medium">Ölçü Vahidi</th>
        <th className="py-3 w-32 font-medium text-right pr-2">Əməliyyat</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Dəyər yoxdur</td></tr>
      ) : rows.map((r, i) => (
        <tr key={r.id} className={`border-b border-border last:border-b-0 ${r.active === false ? "opacity-50" : ""}`}>
          <td className="py-4 text-muted-foreground">{i + 1}</td>
          <td className="py-4 text-foreground">{r.name}</td>
          <td className="py-4 text-foreground">{r.category}</td>
          <td className="py-4 text-foreground">{r.units.join(", ")}</td>
          <td className="py-4">
            <div className="flex items-center justify-end gap-2 pr-2">
              <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => onDelete(r)} className="p-1.5 rounded hover:bg-zone-red-bg"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  );

const SubKpisTable = ({ rows, onEdit, onDelete }: { rows: SubKpiRow[]; onEdit: (r: SubKpiRow) => void; onDelete: (r: SubKpiRow) => void }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="text-muted-foreground text-left border-b border-border">
        <th className="py-3 w-12 font-medium">No</th>
        <th className="py-3 font-medium">Hədəf Adı</th>
        <th className="py-3 font-medium">Aid KPI</th>
        <th className="py-3 font-medium">Ölçü Vahidi</th>
        <th className="py-3 w-20 font-medium">Çəki</th>
        <th className="py-3 w-32 font-medium text-right pr-2">Əməliyyat</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Dəyər yoxdur</td></tr>
      ) : rows.map((r, i) => (
        <tr key={r.id} className={`border-b border-border last:border-b-0 ${r.active === false ? "opacity-50" : ""}`}>
          <td className="py-4 text-muted-foreground">{i + 1}</td>
          <td className="py-4 text-foreground">{r.name}</td>
          <td className="py-4 text-foreground">{r.parent}</td>
          <td className="py-4">
            <div className="flex flex-wrap gap-1">
              {r.units.map(u => <span key={u} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{u}</span>)}
            </div>
          </td>
          <td className="py-4 text-foreground">{r.weight}%</td>
          <td className="py-4">
            <div className="flex items-center justify-end gap-2 pr-2">
              <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => onDelete(r)} className="p-1.5 rounded hover:bg-zone-red-bg"><Trash2 className="w-4 h-4 text-destructive" /></button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
  );

const PeriodsTable = ({ rows, onDelete }: { rows: KpiPeriod[]; onDelete: (p: KpiPeriod) => void }) => (
  <>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground text-left border-b border-border">
          <th className="py-3 w-12 font-medium">No</th>
          <th className="py-3 font-medium">Dövrün müddəti</th>
          <th className="py-3 font-medium">Başlama tarixi</th>
          <th className="py-3 font-medium">Bitmə tarixi</th>
          <th className="py-3 font-medium">Aralıq</th>
          <th className="py-3 w-20 font-medium text-right pr-2">Əməliyyat</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">Dövr yoxdur</td></tr>
        ) : rows.map((p, i) => (
          <tr key={p.id} className="border-b border-border last:border-b-0">
            <td className="py-4 text-muted-foreground">{i + 1}</td>
            <td className="py-4 text-foreground">{p.durationLabel}</td>
            <td className="py-4 text-foreground">{p.startDate}</td>
            <td className="py-4 text-foreground">{p.endDate}</td>
            <td className="py-4 text-muted-foreground">{formatPeriodRange(p)}</td>
            <td className="py-4">
              <div className="flex items-center justify-end gap-2 pr-2">
                <button onClick={() => onDelete(p)} className="p-1.5 rounded hover:bg-zone-red-bg"><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="text-xs text-muted-foreground mt-3">
      Bu dövrlər KPI yaratma formasında "Digər" dropdownda görünəcək.
    </p>
  </>
);

// ---------- Dialoq formaları ----------
type RowDialogState = { schema: "target_types" | "kpi_kinds" | "sub_kpis"; mode: "add" | "edit"; data: any } | null;

const TargetTypeDialog = ({ open, onClose, state, onSave, structures, calcOptions }: {
  open: boolean; onClose: () => void; state: { mode: "add" | "edit"; data: Partial<TargetTypeRow> } | null;
  onSave: (d: Omit<TargetTypeRow, "id">) => void; structures: string[]; calcOptions: string[];
}) => {
  const [form, setForm] = useState<Partial<TargetTypeRow>>({ active: true, calcTypes: [] });
  useEffect(() => { if (state) setForm({ active: true, calcTypes: [], ...state.data }); }, [state]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{state?.mode === "edit" ? "Hədəf Tipini Redaktə Et" : "Yeni Hədəf Tipi Yarat"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Hədəf Tipi</label>
            <input autoFocus value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Məsələn: Aylıq Satış Hədəfi" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Aid Olduğu Struktur</label>
            <select value={form.structure || ""} onChange={e => setForm(f => ({ ...f, structure: e.target.value }))} className={inputCls}>
              <option value="">Struktur seçin</option>
              {structures.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Hesablama Tipi (çoxlu seçim)</label>
            <MultiTagInput values={form.calcTypes || []} onChange={v => setForm(f => ({ ...f, calcTypes: v }))} placeholder="Tip seçin" options={calcOptions} />
          </div>
          <ActiveToggle value={form.active !== false} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <div className="flex gap-2 pt-2">
            <button onClick={() => { if (!form.name || !form.structure) { toast.error("Ad və struktur tələb olunur"); return; } onSave({ name: form.name!, structure: form.structure!, calcTypes: form.calcTypes || [], active: form.active !== false }); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
              <Save className="w-4 h-4" /> Yadda Saxla
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const KpiKindDialog = ({ open, onClose, state, onSave, categories, unitOptions }: {
  open: boolean; onClose: () => void; state: { mode: "add" | "edit"; data: Partial<KpiKindRow> } | null;
  onSave: (d: Omit<KpiKindRow, "id">) => void; categories: string[]; unitOptions: string[];
}) => {
  const [form, setForm] = useState<Partial<KpiKindRow>>({ active: true, units: [] });
  useEffect(() => { if (state) setForm({ active: true, units: [], ...state.data }); }, [state]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{state?.mode === "edit" ? "KPI Növünü Redaktə Et" : "Yeni KPI Növü Yarat"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>KPI Növü</label>
            <input autoFocus value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Məsələn: Kəmiyyət KPI-ları" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Aid Olduğu Kateqoriya</label>
            <select value={form.category || ""} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
              <option value="">Kateqoriya seçin</option>
              {categories.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ölçü Vahidi (çoxlu seçim)</label>
            <MultiTagInput values={form.units || []} onChange={v => setForm(f => ({ ...f, units: v }))} placeholder="Vahid seçin" options={unitOptions} />
          </div>
          <ActiveToggle value={form.active !== false} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <div className="flex gap-2 pt-2">
            <button onClick={() => { if (!form.name || !form.category) { toast.error("Ad və kateqoriya tələb olunur"); return; } onSave({ name: form.name!, category: form.category!, units: form.units || [], active: form.active !== false }); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
              <Save className="w-4 h-4" /> Yadda Saxla
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SubKpiDialog = ({ open, onClose, state, onSave, parents, unitOptions }: {
  open: boolean; onClose: () => void; state: { mode: "add" | "edit"; data: Partial<SubKpiRow> } | null;
  onSave: (d: Omit<SubKpiRow, "id">) => void; parents: string[]; unitOptions: string[];
}) => {
  const [form, setForm] = useState<Partial<SubKpiRow>>({ active: true, units: [], weight: 0 });
  useEffect(() => { if (state) setForm({ active: true, units: [], weight: 0, ...state.data }); }, [state]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{state?.mode === "edit" ? "Hədəf Redaktə Et" : "Yeni Hədəf Yarat"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Hədəf Adı</label>
            <input autoFocus value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Məsələn: Online Satış" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Aid Olduğu KPI</label>
            <select value={form.parent || ""} onChange={e => setForm(f => ({ ...f, parent: e.target.value }))} className={inputCls}>
              <option value="">KPI seçin</option>
              {parents.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Ölçü Vahidi (çoxlu seçim)</label>
              <MultiTagInput values={form.units || []} onChange={v => setForm(f => ({ ...f, units: v }))} placeholder="Vahid seçin" options={unitOptions} />
            </div>
            <div>
              <label className={labelCls}>Çəki (%)</label>
              <input type="number" min={0} max={100} value={form.weight ?? 0} onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) || 0 }))} className={inputCls} />
            </div>
          </div>
          <ActiveToggle value={form.active !== false} onChange={v => setForm(f => ({ ...f, active: v }))} />
          <div className="flex gap-2 pt-2">
            <button onClick={() => { if (!form.name || !form.parent) { toast.error("Ad və aid KPI tələb olunur"); return; } onSave({ name: form.name!, parent: form.parent!, units: form.units || [], weight: form.weight || 0, active: form.active !== false }); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
              <Save className="w-4 h-4" /> Yadda Saxla
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PeriodDialog = ({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (s: string, e: string) => void }) => {
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  useEffect(() => { if (open) { setStart(""); setEnd(""); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-primary" /> Yeni KPI Dövrü</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Başlama və bitmə tarixini seçin — müddət avtomatik hesablanacaq</p>
        <div className="space-y-3 pt-2">
          <div>
            <label className={labelCls}>Başlama tarixi</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bitmə tarixi</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={inputCls} />
          </div>
          {start && end && end > start && (
            <p className="text-xs text-muted-foreground">Müddət: <span className="font-medium text-foreground">{computeDurationLabel(start, end)}</span></p>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => { if (!start || !end || end <= start) { toast.error("Düzgün tarixlər daxil edin"); return; } onSave(start, end); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium">
              <Save className="w-4 h-4" /> Yadda Saxla
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv Et</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Əsas komponent ----------
const DropdownCatalogsTab = () => {
  const [catalogs, setCatalogs] = useState<DropdownCatalog[]>(() => getDropdownCatalogs());
  const [activeId, setActiveId] = useState<string>(catalogs[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [periods, setPeriods] = useState<KpiPeriod[]>(() => getPeriods());

  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Simple-value dialog
  const [valueDialog, setValueDialog] = useState<{ mode: "add" | "edit"; index?: number; value: string } | null>(null);

  // Structured-row dialogs
  const [ttDialog, setTtDialog] = useState<{ mode: "add" | "edit"; data: Partial<TargetTypeRow>; id?: string } | null>(null);
  const [kkDialog, setKkDialog] = useState<{ mode: "add" | "edit"; data: Partial<KpiKindRow>; id?: string } | null>(null);
  const [skDialog, setSkDialog] = useState<{ mode: "add" | "edit"; data: Partial<SubKpiRow>; id?: string } | null>(null);
  const [periodDialog, setPeriodDialog] = useState(false);

  const refresh = () => setCatalogs(getDropdownCatalogs());
  const refreshPeriods = () => setPeriods(getPeriods());

  useEffect(() => {
    const fn = () => refresh();
    const pf = () => refreshPeriods();
    window.addEventListener("dropdown-catalogs-updated", fn);
    window.addEventListener("storage", fn);
    window.addEventListener("periods-updated", pf);
    window.addEventListener("storage", pf);
    return () => {
      window.removeEventListener("dropdown-catalogs-updated", fn);
      window.removeEventListener("storage", fn);
      window.removeEventListener("periods-updated", pf);
      window.removeEventListener("storage", pf);
    };
  }, []);

  const active = catalogs.find(c => c.id === activeId) ?? null;

  // Reference data
  const calcOptions = useMemo(() => getCatalogValues("calc_units", []), [catalogs]);
  const subKpiUnitOptions = useMemo(() => getCatalogValues("sub_kpi_units", []), [catalogs]);
  const categoryOptions = useMemo(() => getCatalogValues("kpi_categories", []), [catalogs]);
  const targetTypeNames = useMemo(() => {
    const tt = catalogs.find(c => c.id === "kpi_types");
    return (tt?.rows as TargetTypeRow[] | undefined)?.map(r => r.name) || [];
  }, [catalogs]);
  // Struktur siyahısı — sadəcə mövcud rowlardan, plus boş seçim üçün boş array
  const structures = useMemo(() => {
    const tt = catalogs.find(c => c.id === "kpi_types");
    const set = new Set<string>();
    (tt?.rows as TargetTypeRow[] | undefined)?.forEach(r => r.structure && set.add(r.structure));
    return Array.from(set);
  }, [catalogs]);

  const filteredSimpleValues = useMemo(() => {
    if (!active || active.schema) return [];
    const q = search.trim().toLowerCase();
    return active.values.map((v, i) => ({ v, i })).filter(({ v }) => !q || v.toLowerCase().includes(q));
  }, [active, search]);

  const filteredRows = useMemo(() => {
    if (!active?.rows) return [];
    const q = search.trim().toLowerCase();
    return active.rows.filter(r => !q || r.name.toLowerCase().includes(q));
  }, [active, search]);

  const filteredPeriods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periods.filter(p => !q || p.durationLabel.toLowerCase().includes(q) || p.startDate.includes(q) || p.endDate.includes(q));
  }, [periods, search]);

  // Handlers
  const handleAddCatalog = () => {
    const cat = addDropdownCatalog(newCatalogName);
    if (!cat) { toast.error("Bu adda kataloq artıq var və ya ad boşdur"); return; }
    refresh(); setActiveId(cat.id); setShowAddCatalog(false); setNewCatalogName("");
    toast.success("Kataloq yaradıldı");
  };

  const handleRename = () => {
    if (!active) return;
    if (!renameDropdownCatalog(active.id, renameValue)) { toast.error("Ad mövcuddur və ya boşdur"); return; }
    refresh(); setRenameOpen(false); toast.success("Kataloq adı yeniləndi");
  };

  const handleDeleteCatalog = () => {
    if (!active) return;
    if (active.system) { toast.error("Sistem kataloqu silinə bilməz"); return; }
    if (!confirm(`"${active.name}" kataloqu silinsin?`)) return;
    deleteDropdownCatalog(active.id);
    const list = getDropdownCatalogs(); setCatalogs(list); setActiveId(list[0]?.id ?? "");
    toast.success("Kataloq silindi");
  };

  const handleSaveSimpleValue = () => {
    if (!active || !valueDialog) return;
    const ok = valueDialog.mode === "add"
      ? addCatalogValue(active.id, valueDialog.value)
      : updateCatalogValue(active.id, valueDialog.index!, valueDialog.value);
    if (!ok) { toast.error("Dəyər mövcuddur və ya boşdur"); return; }
    refresh(); setValueDialog(null);
    toast.success(valueDialog.mode === "add" ? "Dəyər əlavə edildi" : "Dəyər yeniləndi");
  };

  const openAddDialog = () => {
    if (!active) return;
    if (active.schema === "target_types") setTtDialog({ mode: "add", data: { active: true, calcTypes: [] } });
    else if (active.schema === "kpi_kinds") setKkDialog({ mode: "add", data: { active: true, units: [] } });
    else if (active.schema === "sub_kpis") setSkDialog({ mode: "add", data: { active: true, units: [], weight: 0 } });
    else if (active.schema === "kpi_periods") setPeriodDialog(true);
    else setValueDialog({ mode: "add", value: "" });
  };

  const addLabel = () => {
    if (active?.schema === "target_types") return "Yeni Hədəf Tipi";
    if (active?.schema === "kpi_kinds") return "Yeni KPI Növü";
    if (active?.schema === "sub_kpis") return "Yeni Hədəf";
    if (active?.schema === "kpi_periods") return "Yeni Dövr";
    return "Dəyər əlavə et";
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-5">
      {/* Sol panel — kataloqlar siyahısı */}
      <div className="bg-card rounded-xl border border-border p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">Kataloqlar</h3>
        </div>
        <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
          {catalogs.map(c => {
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setSearch(""); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"}`}
              >
                <Database className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="truncate text-left">{c.name}</span>
              </button>
            );
          })}

        </div>
      </div>

      {/* Sağ panel */}
      <div className="bg-card rounded-xl border border-border p-5">
        {!active ? (
          <p className="text-sm text-muted-foreground text-center py-10">Kataloq seçin və ya yeni əlavə edin</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-foreground">{active.name}</h3>
                {active.system && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">Sistem</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!active.system && (
                  <>
                    <button onClick={() => { setRenameValue(active.name); setRenameOpen(true); }} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-card hover:bg-secondary text-foreground">
                      <Pencil className="w-4 h-4" /> Redaktə
                    </button>
                    <button onClick={handleDeleteCatalog} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-card hover:bg-zone-red-bg text-destructive">
                      <Trash2 className="w-4 h-4" /> Sil
                    </button>
                  </>
                )}
                {!LOCKED_CATALOG_IDS.has(active.id) && (
                  <button onClick={openAddDialog} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                    <Plus className="w-4 h-4" /> {addLabel()}
                  </button>
                )}
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Axtar..." className="w-full pl-10 pr-3 py-2.5 text-sm border border-border rounded-lg bg-background" />
            </div>

            {active.schema === "target_types" && (
              <TargetTypesTable
                rows={filteredRows as TargetTypeRow[]}
                onEdit={r => setTtDialog({ mode: "edit", id: r.id, data: r })}
                onDelete={r => { if (confirm("Bu sətir silinsin?")) { removeCatalogRow(active.id, r.id); refresh(); } }}
              />
            )}
            {active.schema === "kpi_kinds" && (
              <KpiKindsTable
                rows={filteredRows as KpiKindRow[]}
                onEdit={r => setKkDialog({ mode: "edit", id: r.id, data: r })}
                onDelete={r => { if (confirm("Bu sətir silinsin?")) { removeCatalogRow(active.id, r.id); refresh(); } }}
              />
            )}
            {active.schema === "sub_kpis" && (
              <SubKpisTable
                rows={filteredRows as SubKpiRow[]}
                onEdit={r => setSkDialog({ mode: "edit", id: r.id, data: r })}
                onDelete={r => { if (confirm("Bu sətir silinsin?")) { removeCatalogRow(active.id, r.id); refresh(); } }}
              />
            )}
            {active.schema === "kpi_periods" && (
              <PeriodsTable
                rows={filteredPeriods}
                onDelete={p => { if (confirm("Bu dövr silinsin?")) { deletePeriod(p.id); refreshPeriods(); toast.success("Dövr silindi"); } }}
              />
            )}

            {!active.schema && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-left border-b border-border">
                    <th className="py-3 w-16 font-medium">#</th>
                    <th className="py-3 font-medium"><span className="inline-flex items-center gap-2"><Search className="w-3.5 h-3.5" /> Dəyər</span></th>
                    <th className="py-3 w-32 font-medium text-right pr-2">Əməliyyat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSimpleValues.length === 0 ? (
                    <tr><td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">Dəyər yoxdur</td></tr>
                  ) : filteredSimpleValues.map(({ v, i }, displayIndex) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="py-4 text-muted-foreground">{displayIndex + 1}</td>
                      <td className="py-4 text-foreground">{v}</td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-2 pr-2">
                          {!LOCKED_CATALOG_IDS.has(active.id) && (
                            <>
                              <button onClick={() => setValueDialog({ mode: "edit", index: i, value: v })} className="p-1.5 rounded hover:bg-secondary"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                              <button onClick={() => { if (confirm("Bu dəyər silinsin?")) { removeCatalogValue(active.id, i); refresh(); } }} className="p-1.5 rounded hover:bg-zone-red-bg"><Trash2 className="w-4 h-4 text-destructive" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
          </>
        )}
      </div>

      {/* Strukturlaşdırılmış dialoqlar */}
      <TargetTypeDialog
        open={!!ttDialog} onClose={() => setTtDialog(null)}
        state={ttDialog}
        structures={structures}
        calcOptions={calcOptions}
        onSave={d => {
          if (!active) return;
          const ok = ttDialog?.mode === "add" ? addCatalogRow(active.id, d) : updateCatalogRow(active.id, ttDialog!.id!, d);
          if (ok) { refresh(); setTtDialog(null); toast.success(ttDialog?.mode === "add" ? "Hədəf tipi əlavə edildi" : "Yeniləndi"); }
        }}
      />
      <KpiKindDialog
        open={!!kkDialog} onClose={() => setKkDialog(null)}
        state={kkDialog}
        categories={categoryOptions}
        unitOptions={calcOptions}
        onSave={d => {
          if (!active) return;
          const ok = kkDialog?.mode === "add" ? addCatalogRow(active.id, d) : updateCatalogRow(active.id, kkDialog!.id!, d);
          if (ok) { refresh(); setKkDialog(null); toast.success(kkDialog?.mode === "add" ? "KPI növü əlavə edildi" : "Yeniləndi"); }
        }}
      />
      <SubKpiDialog
        open={!!skDialog} onClose={() => setSkDialog(null)}
        state={skDialog}
        parents={targetTypeNames}
        unitOptions={subKpiUnitOptions}
        onSave={d => {
          if (!active) return;
          const ok = skDialog?.mode === "add" ? addCatalogRow(active.id, d) : updateCatalogRow(active.id, skDialog!.id!, d);
          if (ok) { refresh(); setSkDialog(null); toast.success(skDialog?.mode === "add" ? "Hədəf əlavə edildi" : "Yeniləndi"); }
        }}
      />
      <PeriodDialog
        open={periodDialog} onClose={() => setPeriodDialog(false)}
        onSave={(s, e) => {
          addPeriod({ durationLabel: computeDurationLabel(s, e), startDate: s, endDate: e });
          refreshPeriods(); setPeriodDialog(false); toast.success("KPI dövrü yaradıldı");
        }}
      />

      {/* Yeni kataloq dialoqu */}
      <Dialog open={showAddCatalog} onOpenChange={setShowAddCatalog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Kataloq</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className={labelCls}>Ad</label>
            <input autoFocus value={newCatalogName} onChange={e => setNewCatalogName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCatalog()}
              placeholder="Məsələn: Sertifikat Növləri" className={inputCls} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddCatalog(false)} className="px-4 py-2 text-sm rounded-lg border border-border bg-card hover:bg-secondary"><X className="w-4 h-4 inline -mt-0.5 mr-1" />Ləğv et</button>
              <button onClick={handleAddCatalog} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground"><Check className="w-4 h-4 inline -mt-0.5 mr-1" />Yarat</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kataloq adının redaktəsi */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Kataloqu Redaktə Et</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className={labelCls}>Ad</label>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()} className={inputCls} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRenameOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv et</button>
              <button onClick={handleRename} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground">Yadda saxla</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sadə dəyər */}
      <Dialog open={!!valueDialog} onOpenChange={o => !o && setValueDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{valueDialog?.mode === "add" ? "Yeni Dəyər" : "Dəyəri Redaktə Et"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className={labelCls}>Dəyər</label>
            <input autoFocus value={valueDialog?.value ?? ""} onChange={e => setValueDialog(v => v ? { ...v, value: e.target.value } : v)}
              onKeyDown={e => e.key === "Enter" && handleSaveSimpleValue()} className={inputCls} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setValueDialog(null)} className="px-4 py-2 text-sm rounded-lg border border-border bg-card hover:bg-secondary">Ləğv et</button>
              <button onClick={handleSaveSimpleValue} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground">Yadda saxla</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DropdownCatalogsTab;
