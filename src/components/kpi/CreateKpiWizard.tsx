import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { usePositions } from "@/lib/usePositions";
import { useCatalogValues, useWeightLimits } from "@/lib/dropdownCatalogStore";
import { getEmployees } from "@/lib/orgStore";
import { getStructures, type OrgStructure } from "@/lib/orgStore";
import { getTeams, addTeam } from "@/lib/teamsStore";
import { useCascadeMatrices } from "@/lib/cascadeMatrixStore";
import { getCompetencyMatrices } from "@/lib/competencyMatrixStore";
import { getApprovalMatrices, formatAssignee } from "@/lib/matrixStore";
import { useLifecycleTemplates, resolveTemplateLifecycle } from "@/lib/lifecycleTemplatesStore";
import {
  ChevronLeft, ChevronRight, Sparkles, CalendarDays, Calendar as CalendarIcon, Users, User,
  ShieldCheck, Target as TargetIcon, Trash2, Plus, GitBranch, UserPlus,
  ClipboardList, Save, Power, Send, Star, Search, X, Check, ChevronDown, Shuffle, Briefcase, Info,
} from "lucide-react";
import SearchableSelect from "@/components/common/SearchableSelect";
import DropdownMultiSelect from "@/components/kpi/DropdownMultiSelect";
import { WeightInput } from "@/components/kpi/WeightInput";
import { INTEGRATION_CATALOG } from "@/lib/integrationsCatalog";


import { toast } from "sonner";

// ============ TYPES ============
export type HedefType =
  | "Məbləğ" | "Say" | "İcra" | "Səriştə" | "Fərdi İnkişaf"
  | "Faiz" | "Nisbət" | "Boolean" | "Zaman";

export const HEDEF_TYPES: HedefType[] = [
  "Məbləğ", "Say", "İcra", "Səriştə", "Fərdi İnkişaf",
  "Faiz", "Nisbət", "Boolean", "Zaman",
];

const FREQUENCY_DEFAULTS = ["Günlük", "Həftəlik", "Aylıq", "Rüblük", "6 Aylıq", "İllik", "Custom"];
const SCORING_DEFAULTS = ["1-3 Bal Sistemi", "1-5 Bal Sistemi", "1-10 Bal Sistemi", "Faiz (0-100)"];
const EVALUATOR_TYPE_DEFAULTS = ["Şəxs", "Komanda", "Struktur", "Özü", "İnteqrasiya"];

export const CASCADE_TYPES: HedefType[] = ["Məbləğ", "Say", "Faiz", "Nisbət"];

/** Types that DO NOT allow range definitions — only score+description rows. */
const SCORE_DESC_TYPES: HedefType[] = ["İcra", "Fərdi İnkişaf", "Zaman"];

export interface WizardScoreDesc {
  id: string;
  score: number;
  description: string;
  timeStart?: string;
  timeEnd?: string;
  /** Bonus hesablanmasının başladığı minimum bal (yalnız bir sətir üçün) */
  isMinBonus?: boolean;
}

export interface WizardEvaluatorRef { id: string; name: string; weight: number }

export type TargetCreatedBy = "self" | "other";

export interface WizardHedef {
  id: string;
  name: string;
  type: HedefType;
  weight: number;
  scoreLimit: number;
  /** İşçinin çatmalı olduğu hədəf dəyəri (növə uyğun formatda saxlanır) */
  targetValue: string;

  /** Bu hədəfi kim təyin edir */
  createdBy: TargetCreatedBy;

  /** Birdən çox qiymətləndirici (faiz bölgüsü ilə) */
  evaluators: WizardEvaluatorRef[];
  /** Təyin edici (digər əməkdaş seçildikdə) */
  assigner: string;

  /** Back-compat: tək qiymətləndirici adı (1-ci evaluator-un adı) */
  evaluator: string;

  // Type-specific eval
  min: string;
  max: string;
  currency: "AZN" | "USD" | "EUR";
  ranges?: { id: string; min: string; max: string; score: string; weight: string }[];
  competencyMatrix: string;
  freeInput: string;
  booleanYes: number;
  booleanNo: number;
  timeStart: string;
  timeEnd: string;

  /** Score-description rows for İcra/Fərdi İnkişaf/Zaman və qiymət popup-u */
  scoreDescriptions?: WizardScoreDesc[];

  cascading: boolean;
  cascadeMatrix: string;
}

export type AssigneeKind = "Şəxs" | "Komanda" | "Struktur" | "Vəzifə";

export interface WizardAssignTarget { id: string; kind: AssigneeKind; value: string }
export interface WizardEvaluator { id: string; name: string; weight: number }

export type CreatedBy = "self" | "other";

export interface WizardLifecycleReview { id: string; name: string; start: string; end: string; reviewerName?: string; reviewerNames?: string[] }

export type WizardAction = "draft" | "submit" | "create_active";

export interface CreateKpiWizardDraft {
  name: string;
  mode: "individual" | "bulk";
  /** Fərdi mode: çoxlu əməkdaş (multi-select) */
  individualEmployees: string[];
  /** Toplu mode: hər kateqoriya üçün çoxlu seçim */
  bulkSelections: {
    teams: string[];
    structures: string[];
    positions: string[];
    persons: string[];
  };
  /** Toplu + Şəxs(lər): avtomatik yaradılacaq komandanın lideri (məcburi) */
  bulkTeamLeader?: string;

  frequency: string;
  /** Rüblük: il və rüb */
  quarterYear: number;
  quarter: 1 | 2 | 3 | 4;
  startDate: string;
  endDate: string;

  scoringSystem: string;
  useMatrix: boolean;
  approvalMatrixId: string;
  /** 3-cü addımda seçilir. Default `mode`/`bulkSelections`-a əsasən hesablanır. */
  approvalMethod: "structure_leader" | "team_leader" | "matrix";


  lifecycle: {
    /** KPI təyin olunması */
    assignmentStart: string;
    assignmentEnd: string;
    /** Köhnə fieldin saxlanması üçün back-compat */
    assignmentDeadline: string;
    /** KPI qiymətləndirilməsi */
    evaluationStart: string;
    evaluationEnd: string;
    /** Bonusun hesablanması */
    bonusStart: string;
    bonusEnd: string;
    reviews: WizardLifecycleReview[];
  };

  targets: WizardHedef[];

  // back-compat
  createdBy: CreatedBy;
  createdByEmployee: string;
  evaluators: WizardEvaluator[];
  assignTargets: WizardAssignTarget[];

  action?: WizardAction;
  lastStep?: number;
}

export const emptyKpiWizardDraft = (): CreateKpiWizardDraft => ({
  name: "",
  mode: "individual",
  individualEmployees: [],
  bulkSelections: { teams: [], structures: [], positions: [], persons: [] },
  bulkTeamLeader: "",
  frequency: "Aylıq",
  quarterYear: new Date().getFullYear(),
  quarter: 1,
  startDate: "",
  endDate: "",
  scoringSystem: "1-5 Bal Sistemi",
  useMatrix: false,
  approvalMatrixId: "",
  approvalMethod: "matrix",

  lifecycle: {
    assignmentStart: new Date().toISOString().slice(0, 10),
    assignmentEnd: "",
    assignmentDeadline: "",
    evaluationStart: "",
    evaluationEnd: "",
    bonusStart: "",
    bonusEnd: "",
    reviews: [],
  },
  targets: [],
  createdBy: "self",
  createdByEmployee: "",
  evaluators: [],
  assignTargets: [],
});

const emptyHedef = (): WizardHedef => ({
  id: crypto.randomUUID(),
  name: "",
  type: "Məbləğ",
  weight: 0,
  scoreLimit: 5,
  targetValue: "",
  createdBy: "self",
  evaluators: [],
  evaluator: "",
  assigner: "",
  min: "",
  max: "",
  currency: "AZN",
  ranges: [{ id: crypto.randomUUID(), min: "", max: "", score: "", weight: "" }],
  competencyMatrix: "",
  freeInput: "",
  booleanYes: 5,
  booleanNo: 2,
  timeStart: "",
  timeEnd: "",
  scoreDescriptions: [],
  cascading: false,
  cascadeMatrix: "",
});

const STEPS = [
  { n: 1, title: "Əsas məlumatlar", sub: "KPI adı, dövr, tarixlər və lifecycle", icon: Sparkles },
  { n: 2, title: "Hədəflər", sub: "KPI hədəflərini təyin edin", icon: TargetIcon },
  { n: 3, title: "Yekun və təsdiq", sub: "Bütün məlumatları nəzərdən keçirin və yadda saxlayın", icon: ClipboardList },
];
const TOTAL_STEPS = STEPS.length;

const CURRENCIES: WizardHedef["currency"][] = ["AZN", "USD", "EUR"];

// ============ DATE HELPERS ============
const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fromISO = (iso: string): Date | undefined => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const formatISODate = (iso: string) => fromISO(iso)?.toLocaleDateString("az-AZ") || "Tarix seçin";
const findScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  let el: HTMLElement | null = node;
  while (el) {
    const style = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`)) return el;
    el = el.parentElement;
  }
  return null;
};
const addMonths = (iso: string, months: number): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const target = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return toISO(target);
};
const addDays = (iso: string, days: number): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return toISO(target);
};
const quarterRange = (year: number, q: 1 | 2 | 3 | 4): [string, string] => {
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return [toISO(start), toISO(end)];
};

// ============ MULTI-SELECT (search) ============
function MultiSelectDropdown({
  options, selected, onChange, placeholder, ariaLabel, disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(o => o.label.toLowerCase().includes(s));
  }, [q, options]);
  const keepOpen = () => {
    setOpen(true);
    requestAnimationFrame(() => setOpen(true));
  };
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    keepOpen();
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const allSelected = filtered.length > 0 && filtered.every(o => selected.includes(o.value));
  const toggleAll = () => {
    if (allSelected) onChange(selected.filter(v => !filtered.some(o => o.value === v)));
    else onChange(Array.from(new Set([...selected, ...filtered.map(o => o.value)])));
    keepOpen();
  };
  return (
    <div className="relative" ref={wrapRef}>

      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className="w-full min-h-[36px] px-2.5 py-1.5 text-sm border border-border rounded-lg bg-background flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={selected.length ? "text-foreground" : "text-muted-foreground"}>
          {selected.length ? `${selected.length} seçildi` : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <div className="p-1.5 border-b border-border flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Axtar..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded bg-background"
              />
            </div>
            <button
              type="button"
              aria-label="Dropdown-u bağla"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}
              className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center hover:bg-secondary"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">Nəticə yoxdur</div>
            ) : filtered.map(o => {
              const sel = selected.includes(o.value);
              return (
                <button key={o.value} type="button"
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(o.value); }}
                  className={`w-full px-2.5 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-secondary ${sel ? "bg-primary/5" : ""}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
                    {sel && <Check className="w-3 h-3" />}
                  </span>
                  <span className="truncate flex-1">{o.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-2 py-1 border-t border-border">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleAll(); }}
              className="text-[11px] text-primary hover:underline px-1 font-medium">
              {allSelected ? "Seçimləri sıfırla" : "Hamısını seç"}
            </button>
            <div className="flex gap-2 items-center">
              <span className="text-[11px] text-muted-foreground">{selected.length} seçildi</span>
              {selected.length > 0 && (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
                  className="text-[11px] text-destructive hover:underline px-1">Təmizlə</button>
              )}
            </div>
          </div>

        </div>
      )}
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map(v => {
            const o = options.find(x => x.value === v);
            return (
              <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-primary/10 text-primary rounded">
                {o?.label || v}
                <X className="w-3 h-3 cursor-pointer" onClick={() => toggle(v)} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DatePickerField({ value, onChange, disabled = false, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = fromISO(value);
  const preserveScroll = (next: string) => {
    const scrollParent = findScrollParent(triggerRef.current);
    const top = scrollParent?.scrollTop ?? 0;
    onChange(next);
    requestAnimationFrame(() => {
      if (scrollParent) scrollParent.scrollTop = top;
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm border border-border rounded-lg bg-background flex items-center justify-between gap-2 text-left disabled:opacity-70 ${className}`}
        >
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>{formatISODate(value)}</span>
          <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 pointer-events-auto"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            preserveScroll(toISO(d));
            setOpen(false);
          }}
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

// Recursive helpers for org tree
const flattenStructures = (nodes: OrgStructure[], parent = ""): { id: string; label: string }[] => {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    const label = parent ? `${parent} › ${n.name}` : n.name;
    out.push({ id: String(n.id), label });
    if (n.children?.length) out.push(...flattenStructures(n.children, label));
  }
  return out;
};
const flattenPositions = (nodes: OrgStructure[]): { id: string; label: string }[] => {
  const out: { id: string; label: string }[] = [];
  for (const n of nodes) {
    for (const p of n.positions || []) out.push({ id: String(p.id), label: `${p.name} (${n.name})` });
    if (n.children?.length) out.push(...flattenPositions(n.children));
  }
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<CreateKpiWizardDraft>;
  onComplete: (draft: CreateKpiWizardDraft) => void;
}

function Field({ label, required, children, span = "col-span-12 md:col-span-6" }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  span?: string;
}) {
  return (
    <div className={span}>
      <label className="text-sm font-medium text-foreground">{label}{required && <span className="text-destructive"> *</span>}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

import { useAuth as useWizardAuth } from "@/contexts/AuthContext";

export default function CreateKpiWizard({ open, onOpenChange, initial, onComplete }: Props) {
  const { user: wizardUser } = useWizardAuth();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<CreateKpiWizardDraft>(() => ({ ...emptyKpiWizardDraft(), ...(initial || {}) }));

  useEffect(() => {
    if (open) {
      const seeded = { ...emptyKpiWizardDraft(), ...(initial || {}) };
      // ensure nested defaults
      seeded.lifecycle = { ...emptyKpiWizardDraft().lifecycle, ...(initial as any)?.lifecycle };
      seeded.bulkSelections = { ...emptyKpiWizardDraft().bulkSelections, ...(initial as any)?.bulkSelections };
      setDraft(seeded);
      const resumeStep = (initial as any)?.lastStep;
      setStep(typeof resumeStep === "number" && resumeStep >= 1 && resumeStep <= TOTAL_STEPS ? resumeStep : 1);
    }
  }, [open, initial]);

  const periodOptions = useCatalogValues("frequencies", FREQUENCY_DEFAULTS);
  const scoringOptions = useCatalogValues("scoring_systems", SCORING_DEFAULTS);
  const targetTypeOptions = useCatalogValues("sub_kpi_units", HEDEF_TYPES);
  const cascadeMatrices = useCascadeMatrices();

  // ===== Reference data =====
  const employeesRaw = useMemo(
    () => getEmployees().filter(e => e.active).map(e => ({
      id: String(e.id),
      fullName: `${e.firstName} ${e.lastName}`,
      value: `${e.firstName} ${e.lastName}${e.positionName ? " — " + e.positionName : ""}`,
      label: `${e.firstName} ${e.lastName}${e.positionName ? " — " + e.positionName : ""}`,
      positionName: e.positionName || "",
      structurePath: e.structurePath || "",
    })),
    [open],
  );
  const activeEmployees = employeesRaw;
  const employeeOptions = useMemo(() => {
    const base = activeEmployees.map(e => ({ value: e.value, label: e.label }));
    // "Özüm" — HR/istifadəçi öz kartını özünə də təyin edə bilsin.
    if (wizardUser?.name) {
      const selfValue = `${wizardUser.name}${wizardUser.department ? " — " + wizardUser.department : " — Özüm"}`;
      const already = base.some(o => o.value.startsWith(wizardUser.name!));
      const selfOpt = { value: already ? base.find(o => o.value.startsWith(wizardUser.name!))!.value : selfValue, label: `Özüm (${wizardUser.name})` };
      return [selfOpt, ...base.filter(o => o.value !== selfOpt.value)];
    }
    return base;
  }, [activeEmployees, wizardUser?.name, wizardUser?.department]);

  const teamsRaw = useMemo(() => getTeams(), [open]);
  const teamOptions = useMemo(
    () => teamsRaw.map(t => ({ value: t.name, label: `${t.name} (${t.leader})` })),
    [teamsRaw],
  );
  const structureTree = useMemo(() => getStructures(), [open]);
  const structureOptions = useMemo(() => flattenStructures(structureTree).map(s => ({ value: s.label, label: s.label })), [structureTree]);
  const allPositions = usePositions();
  const positionOptions = useMemo(
    () => allPositions.map(p => ({ value: p, label: p })),
    [allPositions],
  );

  /** Toplu rejimdə avtomatik komandanın üzvləri: birbaşa seçilmiş şəxslər,
   *  yaxud seçilmiş vəzifələrə uyğun gələn əməkdaşlar. */
  const bulkTeamMembers = useMemo(() => {
    if (draft.mode !== "bulk") return [] as string[];
    const bs = draft.bulkSelections;
    if (bs.persons.length) return bs.persons;
    if (bs.positions.length) {
      return employeesRaw.filter(e => bs.positions.includes(e.positionName)).map(e => e.value);
    }
    return [] as string[];
  }, [draft.mode, draft.bulkSelections, employeesRaw]);

  // ===== Individual-mode filters (Vəzifə / Komanda / Struktur) =====
  const [indFilterPositions, setIndFilterPositions] = useState<string[]>([]);
  const [indFilterTeams, setIndFilterTeams] = useState<string[]>([]);
  const [indFilterStructures, setIndFilterStructures] = useState<string[]>([]);
  // Şəxs / Komanda / Struktur / Vəzifə – tab-based application scope selector
  const [scopeTab, setScopeTab] = useState<"persons" | "teams" | "structures" | "positions">("persons");
  useEffect(() => {
    if (!open) {
      setIndFilterPositions([]); setIndFilterTeams([]); setIndFilterStructures([]);
      setScopeTab("persons");
    }
  }, [open]);

  const filteredIndividualEmployeeOptions = useMemo(() => {
    const noFilter = !indFilterPositions.length && !indFilterTeams.length && !indFilterStructures.length;
    if (noFilter) return employeeOptions;
    const teamMemberNames = new Set<string>();
    if (indFilterTeams.length) {
      teamsRaw.filter(t => indFilterTeams.includes(t.name)).forEach(t => {
        teamMemberNames.add(t.leader);
        t.members.forEach(m => teamMemberNames.add(m.name));
      });
    }
    return employeeOptions.filter(o => {
      const raw = employeesRaw.find(r => r.value === o.value);
      if (!raw) return o.label.startsWith("Özüm"); // keep self option
      if (indFilterPositions.length && !indFilterPositions.includes(raw.positionName)) return false;
      if (indFilterStructures.length && !indFilterStructures.some(s => raw.structurePath === s || raw.structurePath.startsWith(s + " › "))) return false;
      if (indFilterTeams.length && !teamMemberNames.has(raw.fullName)) return false;
      return true;
    });
  }, [employeeOptions, employeesRaw, teamsRaw, indFilterPositions, indFilterTeams, indFilterStructures]);

  const update = (patch: Partial<CreateKpiWizardDraft>) => setDraft(p => ({ ...p, ...patch }));
  const updLifecycle = (patch: Partial<CreateKpiWizardDraft["lifecycle"]>) =>
    setDraft(p => ({ ...p, lifecycle: { ...p.lifecycle, ...patch } }));

  // Lifecycle template picker
  const lifecycleTemplates = useLifecycleTemplates();
  const [lifecycleTemplateId, setLifecycleTemplateId] = useState<string>("");
  useEffect(() => { if (!open) setLifecycleTemplateId(""); }, [open]);
  const lifecycleFromTemplate = lifecycleTemplateId !== "";

  const applyLifecycleTemplate = (tplId: string) => {
    setLifecycleTemplateId(tplId);
    if (tplId === "") return;
    const tpl = lifecycleTemplates.find(t => t.id === tplId);
    if (!tpl) return;
    const baseDate = draft.startDate || draft.lifecycle.assignmentStart || new Date().toISOString().slice(0, 10);
    const resolved = resolveTemplateLifecycle(tpl, baseDate);
    const existingReviewers = draft.lifecycle.reviews;
    setDraft(p => ({
      ...p,
      lifecycle: {
        ...p.lifecycle,
        assignmentStart: resolved.assignment?.start || "",
        assignmentEnd: resolved.assignment?.end || "",
        assignmentDeadline: resolved.assignment?.start || "",
        evaluationStart: resolved.evaluation?.start || "",
        evaluationEnd: resolved.evaluation?.end || "",
        bonusStart: resolved.bonus?.start || "",
        bonusEnd: resolved.bonus?.end || "",
        reviews: resolved.reviews.map((r, i) => {
          const prior = existingReviewers[i];
          return {
            id: r.id || crypto.randomUUID(),
            name: `Review ${i + 1}`,
            start: r.start,
            end: r.end,
            reviewerName: prior?.reviewerName || "",
            reviewerNames: prior?.reviewerNames || [],
          };
        }),
      },
    }));
  };


  // ===== Frequency-driven date auto-fill =====
  const setFrequency = (f: string) => {
    setDraft(p => {
      const next = { ...p, frequency: f };
      if (f === "Günlük" && p.startDate) next.endDate = addDays(p.startDate, 1);
      else if (f === "Həftəlik" && p.startDate) next.endDate = addDays(p.startDate, 7);
      else if (f === "Aylıq" && p.startDate) next.endDate = addMonths(p.startDate, 1);
      else if (f === "6 Aylıq" && p.startDate) next.endDate = addMonths(p.startDate, 6);
      else if (f === "İllik" && p.startDate) next.endDate = addMonths(p.startDate, 12);
      else if (f === "Rüblük") {
        const [s, e] = quarterRange(p.quarterYear, p.quarter);
        next.startDate = s; next.endDate = e;
      }
      return next;
    });
  };
  const setStartDate = (s: string) => {
    setDraft(p => {
      const next: CreateKpiWizardDraft = { ...p, startDate: s };
      if (p.frequency === "Günlük") next.endDate = addDays(s, 1);
      else if (p.frequency === "Həftəlik") next.endDate = addDays(s, 7);
      else if (p.frequency === "Aylıq") next.endDate = addMonths(s, 1);
      else if (p.frequency === "6 Aylıq") next.endDate = addMonths(s, 6);
      else if (p.frequency === "İllik") next.endDate = addMonths(s, 12);
      return next;
    });
  };
  const setQuarter = (year: number, q: 1 | 2 | 3 | 4) => {
    const [s, e] = quarterRange(year, q);
    setDraft(p => ({ ...p, quarterYear: year, quarter: q, startDate: s, endDate: e }));
  };

  // ===== Targets =====
  const updHedef = (id: string, patch: Partial<WizardHedef>) =>
    setDraft(p => ({ ...p, targets: p.targets.map(t => t.id === id ? { ...t, ...patch } : t) }));
  const addHedef = () => setDraft(p => ({ ...p, targets: [...p.targets, emptyHedef()] }));
  const removeHedef = (id: string) => setDraft(p => ({ ...p, targets: p.targets.filter(t => t.id !== id) }));
  const totalWeight = useMemo(() => draft.targets.reduce((s, t) => s + (Number(t.weight) || 0), 0), [draft.targets]);

  const applyEvaluatorsToAll = (evs: WizardEvaluatorRef[]) =>
    setDraft(p => ({
      ...p,
      targets: p.targets.map(t => ({ ...t, evaluators: evs.map(e => ({ ...e, id: crypto.randomUUID() })), evaluator: evs[0]?.name || "" })),
    }));
  const applyAssignerToAll = (name: string) =>
    setDraft(p => ({ ...p, targets: p.targets.map(t => ({ ...t, assigner: name, createdBy: name ? "other" : t.createdBy })) }));

  // Reviews
  const addReview = () => updLifecycle({
    reviews: [...draft.lifecycle.reviews, { id: crypto.randomUUID(), name: `Review ${draft.lifecycle.reviews.length + 1}`, start: "", end: "", reviewerName: "" }],
  });
  const updReview = (id: string, patch: Partial<WizardLifecycleReview>) =>
    updLifecycle({ reviews: draft.lifecycle.reviews.map(r => r.id === id ? { ...r, ...patch } : r) });
  const removeReview = (id: string) =>
    updLifecycle({ reviews: draft.lifecycle.reviews.filter(r => r.id !== id) });

  const weightLimits = useWeightLimits();

  // Scoring system upper bound
  const scoreMax = useMemo<number | undefined>(() => {
    const s = (draft.scoringSystem || "").toLowerCase();
    const m = s.match(/(\d+)\s*-\s*(\d+)/);
    if (m) return Number(m[2]);
    if (s.includes("faiz")) return 100;
    return undefined;
  }, [draft.scoringSystem]);

  // Validation per target — for "Save draft" we don't strictly require everything
  const validateHedef = (t: WizardHedef): string | null => {
    // "Digər əməkdaş təyin edir" — name/weight/scores təyin edən dolduracaq.
    // Bu addımda yalnız Təyin edici və Qiymətləndirici tələb olunur.
    if (t.createdBy === "other") {
      if (!t.assigner) return `Hədəf #${(t.name || "").trim() || "?"} üçün Təyin edici seçilməlidir`;
      if (t.evaluators.length === 0) return `Hədəf üçün ən az 1 Qiymətləndirici seçin`;
      return null;
    }
    if (!t.name.trim()) return "Hədəf adı boşdur";
    if (!t.weight || t.weight <= 0) return "Hədəf çəkisi 0-dan böyük olmalıdır";
    if (t.weight < weightLimits.min) return `"${t.name}": hədəf çəkisi minimum ${weightLimits.min}%-dən aşağı ola bilməz`;
    if (t.weight > weightLimits.max) return `"${t.name}": hədəf çəkisi maksimum ${weightLimits.max}%-dən yuxarı ola bilməz`;
    if (t.evaluators.length === 0) return `"${t.name}" üçün ən az 1 Qiymətləndirici seçin`;
    if (t.evaluators.length > 1) {
      const sum = t.evaluators.reduce((s, e) => s + (Number(e.weight) || 0), 0);
      if (sum !== 100) return `"${t.name}": qiymətləndiricilərin faiz cəmi 100% olmalıdır (hazırda ${sum}%)`;
    }

    // === Qiymətlər (məcburi 5/2 və ya 10/4) — bütün hədəf növləri ===
    const max = scoreMax || 5;
    const required = max === 10 ? [10, 4] : [max, 2];
    const sd = t.scoreDescriptions || [];
    const isTime = t.type === "Zaman";
    const needsRanges = ["Məbləğ", "Say", "Faiz", "Nisbət"].includes(t.type);
    if (isTime && t.createdBy === "self" && (!t.timeStart || !t.timeEnd)) {
      return `"${t.name}": başlama və bitmə tarixləri seçilməlidir`;
    }

    if (t.type === "Səriştə") {
      if (!t.competencyMatrix) return `"${t.name}": Səriştə matrisi seçilməlidir`;
      return null;
    }
    for (const r of required) {
      const row = sd.find(x => Number(x.score) === r);
      if (!row) return `"${t.name}" üçün ${r} balı tələb olunur — "Qiymətlər" düyməsini açın`;
      if (isTime) {
        if (!row.timeStart || !row.timeEnd) return `"${t.name}" Zaman: ${r} balı üçün zaman aralığı tələb olunur`;
      } else if (needsRanges) {
        if (row.description === undefined || row.description === "") {
          // description field reused for "min-max" string e.g. "6-10"
          return `"${t.name}": ${r} balı üçün Min/Max daxil edilməlidir`;
        }
      } else {
        if (!row.description.trim()) return `"${t.name}": ${r} balının izahı məcburidir`;
      }
    }
    // Səriştə validation handled above
    return null;
  };

  // Step gate (for "Növbəti")
  const canNext = useMemo(() => {
    switch (step) {
      case 1: {
        const lc = draft.lifecycle;
        const lifecycleOk = !!lc.assignmentStart && !!lc.assignmentEnd
          && !!lc.evaluationStart && !!lc.evaluationEnd
          && !!lc.bonusStart && !!lc.bonusEnd;
        // Review varsa, hər review üçün ən azı 1 reviewer məcburidir
        const reviewersOk = lc.reviews.every(r =>
          (r.reviewerNames && r.reviewerNames.length > 0) || !!(r.reviewerName || "").trim());
        // Toplu + 2+ şəxs → avtomatik komanda yaranır, lider məcburidir
        const bulkPersons = bulkTeamMembers;
        const leaderOk = bulkPersons.length < 2
          || (!!draft.bulkTeamLeader && bulkPersons.includes(draft.bulkTeamLeader));
        return !!draft.name.trim() && !!draft.frequency && !!draft.startDate && !!draft.endDate
          && draft.endDate >= draft.startDate && !!draft.scoringSystem && lifecycleOk && reviewersOk && leaderOk;
      }
      case 2: {
        const hasOther = draft.targets.some(t => t.createdBy === "other");
        const weightOk = hasOther ? true : totalWeight === 100;
        return draft.targets.length > 0 && weightOk
          && draft.targets.every(t => validateHedef(t) === null);
      }
      case 3: return true;
      default: return false;
    }
  }, [step, draft, totalWeight, scoreMax]);

  const close = () => {
    onOpenChange(false);
    setTimeout(() => { setStep(1); setDraft({ ...emptyKpiWizardDraft(), ...(initial || {}) }); }, 200);
  };

  const handleNext = () => {
    if (!canNext) {
      if (step === 1) {
        const bp = bulkTeamMembers;
        const missingReviewer = draft.lifecycle.reviews.findIndex(r =>
          !((r.reviewerNames && r.reviewerNames.length > 0) || (r.reviewerName || "").trim()));
        if (bp.length >= 2 && !(draft.bulkTeamLeader && bp.includes(draft.bulkTeamLeader))) {
          toast.error("Komanda Lideri seçilməlidir — avtomatik yaradılacaq komanda üçün 1 nəfər lider təyin edin");
        } else if (missingReviewer >= 0) {
          toast.error(`Review #${missingReviewer + 1} üçün reviewu keçirəcək şəxs(lər) seçilməlidir`);
        } else {
          toast.error("Bütün tələb olunan sahələri (lifecycle tarixləri daxil) doldurun");
        }
      }
      else if (step === 2) {
        const first = draft.targets.map(validateHedef).find(Boolean);
        if (first) toast.error(first);
        else if (totalWeight !== 100) toast.error(`Hədəf çəkilərinin cəmi 100% olmalıdır (hazırda ${totalWeight}%)`);
        else toast.error("Ən az bir hədəf əlavə edin");
      }
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  /** Auto-create a team if Toplu (Şəxs və ya Vəzifə) 2+ nəfər əhatə edir. */
  const ensureAutoTeam = (d: CreateKpiWizardDraft) => {
    if (d.mode !== "bulk") return;
    const persons = bulkTeamMembers;
    if (persons.length < 2) return;
    const leader = d.bulkTeamLeader && persons.includes(d.bulkTeamLeader) ? d.bulkTeamLeader : "";
    if (!leader) { toast.error("Komanda Lideri seçilmədən komanda yaradıla bilməz"); return; }
    const baseName = `${d.name || "KPI"} — Komandası`;
    const teams = getTeams();
    if (teams.some(t => t.name === baseName)) return;
    const newId = Math.max(0, ...teams.map(t => t.id)) + 1;
    addTeam({
      id: newId,
      name: baseName,
      leader,
      leaderAvatar: leader.charAt(0).toUpperCase(),
      kpiResult: 0,
      branch: "Auto-generated",
      activeKpi: 0, completedKpi: 0, totalKpi: 1,
      members: persons.map(p => ({ name: p, role: p === leader ? "Komanda Lideri" : "Üzv", kpiScore: 0, avatar: p.charAt(0).toUpperCase() })),
    });
    toast.success(`Yeni komanda yaradıldı: ${baseName}`);
  };

  // ==== Approval method auto-default (touched flag qoruyur user seçimini) ====
  const [approvalMethodTouched, setApprovalMethodTouched] = useState(false);
  const suggestApprovalMethod = (d: CreateKpiWizardDraft): CreateKpiWizardDraft["approvalMethod"] => {
    // Fərdi mode: default matrix
    if (d.mode === "individual") return "matrix";
    const bs = d.bulkSelections;
    // Toplu: komanda seçilibsə → komanda rəhbəri
    if (bs.teams.length > 0) return "team_leader";
    // Toplu: struktur seçilibsə → struktur rəhbəri
    if (bs.structures.length > 0) return "structure_leader";
    // Toplu: yalnız vəzifə və ya şəxs seçilibsə → matrix
    if (bs.positions.length > 0 || bs.persons.length > 0) return "matrix";
    return "structure_leader";
  };
  useEffect(() => {
    if (approvalMethodTouched) return;
    const suggested = suggestApprovalMethod(draft);
    if (suggested !== draft.approvalMethod) {
      setDraft(p => ({ ...p, approvalMethod: suggested }));
    }
  }, [draft.mode, draft.bulkSelections, approvalMethodTouched]);
  // Təsdiqləmə üsulu dəyişəndə "təsdiqləmə matrisi olsun" seçimi silinmir —
  // istifadəçi səhvən seçib sonra fikrini dəyişə bilsin deyə blok görünən qalır.
  const setApprovalMethod = (m: CreateKpiWizardDraft["approvalMethod"]) => {
    setApprovalMethodTouched(true);
    update({ approvalMethod: m, approvalMatrixId: m === "matrix" ? draft.approvalMatrixId : "" });
  };

  // ==== Approval targets validation (team_leader / structure_leader / matrix) ====
  const collectAssignedEmployees = (d: CreateKpiWizardDraft): string[] => {
    if (d.mode === "individual") return d.individualEmployees;
    const bs = d.bulkSelections;
    const set = new Set<string>();
    // Şəxs kateqoriyası — birbaşa adlar; digər kateqoriyalarda üzvləri toplayırıq.
    bs.persons.forEach(n => set.add(n));
    if (bs.teams.length > 0) {
      const allTeams = getTeams();
      bs.teams.forEach(name => {
        const t = allTeams.find(x => x.name === name);
        if (!t) return;
        set.add(t.leader);
        t.members.forEach(m => set.add(m.name));
      });
    }
    // Struktur/vəzifə üçün əməkdaş adlarını burada map etmirik (validator ayrıca yoxlayır).
    return Array.from(set);
  };

  const getTeamOfPerson = (name: string) => {
    const teams = getTeams();
    return teams.find(t => t.leader === name || t.members.some(m => m.name === name)) || null;
  };
  const getStructureLeaderName = (empName: string): string | null => {
    const employees = getEmployees();
    const emp = employees.find(e => `${e.firstName} ${e.lastName}` === empName || (e as any).fullName === empName);
    if (!emp) return null;
    const path = (emp as any).structurePath as string | undefined;
    if (!path) return null;
    const leader = employees.find(e => (e as any).structurePath === path && e.isStarPerson);
    if (!leader) return null;
    return `${leader.firstName} ${leader.lastName}`;
  };

  const validateApprovalTargets = (d: CreateKpiWizardDraft): string | null => {
    // "Təsdiqləmə matrisi olsun" seçilməyibsə approval validasiyası ümumiyyətlə işləmir.
    // Bu halda nə matris, nə əməkdaş/struktur seçimi ilə bağlı error/toast göstərilməməlidir.
    if (!d.useMatrix) return null;

    if (d.useMatrix && d.approvalMethod === "matrix") {
      if (!d.approvalMatrixId) return "Təsdiqləmə matrisi seçin";
      return null;
    }
    if (d.approvalMethod === "team_leader") {
      const people = collectAssignedEmployees(d);
      if (people.length === 0 && d.bulkSelections.teams.length === 0) return "Təsdiqləmə üçün əməkdaş və ya komanda seçilməlidir";
      const missing = people.filter(p => !getTeamOfPerson(p));
      if (missing.length > 0 && missing.length === people.length) {
        return `Heç bir seçilmiş şəxsin komandası yoxdur: ${missing.join(", ")}.`;
      }
      if (missing.length > 0) {
        toast.warning(`${missing.join(", ")} komanda liderinə malik deyil — bu şəxs(lər) üçün kart yaradılmayacaq. Qalanları üçün kart yaranır.`);
      }
      return null;
    }
    // structure_leader — struktur rəhbəri validasiyası tələb olunmur
    const people = collectAssignedEmployees(d);
    if (people.length === 0 && d.bulkSelections.structures.length === 0) return "Təsdiqləmə üçün əməkdaş və ya struktur seçilməlidir";
    return null;
  };

  const finalize = (action: WizardAction) => {
    const bulkPersons = bulkTeamMembers;
    if (bulkPersons.length >= 2 && !(draft.bulkTeamLeader && bulkPersons.includes(draft.bulkTeamLeader))) {
      toast.error("Komanda Lideri seçilməlidir — avtomatik yaradılacaq komanda üçün 1 nəfər lider təyin edin");
      setStep(1);
      return;
    }
    if (action === "submit") {
      const err = validateApprovalTargets(draft);
      if (err) { toast.error(err); return; }
    }
    ensureAutoTeam(draft);
    onComplete({ ...draft, action, lastStep: step });
    toast.success(
      action === "draft" ? "Qaralama kimi yadda saxlanıldı"
      : action === "create_active" ? "KPI yaradıldı və aktiv edildi"
      : "KPI təyinə göndərildi",
    );
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-4xl w-[92vw] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Yeni KPI — Addım {step}/{TOTAL_STEPS}: {STEPS[step - 1].title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{STEPS[step - 1].sub}</p>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex gap-2 mb-3 mt-1">
          {STEPS.map(s => (
            <div key={s.n} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${s.n < step ? "bg-primary" : s.n === step ? "bg-primary/80" : "bg-muted"}`} />
              <div className={`text-[11px] mt-1 ${s.n === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s.n}. {s.title}</div>
            </div>
          ))}
        </div>

        <div className="min-h-[280px]">
          {/* ===== STEP 1 ===== */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <Field label="KPI adı" required span="col-span-12">
                  <input autoFocus value={draft.name} onChange={e => update({ name: e.target.value })}
                    placeholder="Məsələn: Aylıq Satış Hədəfi 2026"
                    className="w-full px-3.5 py-2 text-base border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/40 outline-none" />
                </Field>

                <Field label="Tətbiq ediləcək əməkdaş(lar)" required span="col-span-12">
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    {([
                      { v: "individual" as const, t: "Fərdi", icon: User },
                      { v: "bulk" as const, t: "Toplu", icon: Users },
                    ]).map(o => {
                      const Icon = o.icon;
                      const active = draft.mode === o.v;
                      return (
                        <button key={o.v} type="button" onClick={() => update({ mode: o.v })}
                          className={`p-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${active ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                          <Icon className="w-4 h-4" />{o.t}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Tətbiq sahəsi tabs — Şəxs / Komanda / Struktur / Vəzifə */}
                <Field label="Tətbiq sahəsi" required span="col-span-12">
                  {(() => {
                    const CATS: { key: typeof scopeTab; label: string; Icon: any }[] = [
                      { key: "persons",    label: "Şəxs(lər)", Icon: User },
                      { key: "teams",      label: "Komanda",   Icon: Users },
                      { key: "structures", label: "Struktur",  Icon: ShieldCheck },
                      { key: "positions",  label: "Vəzifə",    Icon: Briefcase },
                    ];
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {CATS.map(c => {
                          const active = scopeTab === c.key;
                          const Icon = c.Icon;
                          return (
                            <button key={c.key} type="button" onClick={() => setScopeTab(c.key)}
                              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${active ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                              <span className={`w-4 h-4 rounded border flex items-center justify-center ${active ? "bg-primary border-primary text-white" : "border-muted-foreground/40 bg-background"}`}>
                                {active && <Check className="w-3 h-3" />}
                              </span>
                              <Icon className="w-4 h-4" />
                              <span className="truncate">{c.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </Field>

                {/* INDIVIDUAL mode: selection under the chosen tab */}
                {draft.mode === "individual" && (
                  <Field
                    label={
                      scopeTab === "persons" ? "Şəxs(lər) seçin"
                      : scopeTab === "teams" ? "Komanda seçin"
                      : scopeTab === "structures" ? "Struktur seçin"
                      : "Vəzifə seçin"
                    }
                    required
                    span="col-span-12"
                  >
                    {scopeTab === "persons" && (
                      <MultiSelectDropdown
                        options={filteredIndividualEmployeeOptions}
                        selected={draft.individualEmployees}
                        onChange={(v) => update({ individualEmployees: v })}
                        placeholder="Şəxs(lər) seçin"
                      />
                    )}
                    {scopeTab === "teams" && (
                      <MultiSelectDropdown
                        options={teamOptions}
                        selected={indFilterTeams}
                        onChange={(v) => {
                          setIndFilterTeams(v);
                          // auto-fill individualEmployees from filtered pool
                          const pool = filteredIndividualEmployeeOptions
                            .filter(o => {
                              const teams = teamsRaw.filter(t => v.includes(t.name));
                              return teams.some(t => t.leader === o.value.split(" — ")[0] || t.members.some(m => m.name === o.value.split(" — ")[0]));
                            })
                            .map(o => o.value);
                          if (pool.length) update({ individualEmployees: pool });
                        }}
                        placeholder="Komanda seçin"
                      />
                    )}
                    {scopeTab === "structures" && (
                      <MultiSelectDropdown
                        options={structureOptions}
                        selected={indFilterStructures}
                        onChange={(v) => {
                          setIndFilterStructures(v);
                          const pool = employeesRaw
                            .filter(e => v.some(sp => (e.structurePath || "").startsWith(sp)))
                            .map(e => e.value);
                          if (pool.length) update({ individualEmployees: pool });
                        }}
                        placeholder="Struktur seçin"
                      />
                    )}
                    {scopeTab === "positions" && (
                      <MultiSelectDropdown
                        options={positionOptions}
                        selected={indFilterPositions}
                        onChange={(v) => {
                          setIndFilterPositions(v);
                          const pool = employeesRaw
                            .filter(e => v.includes(e.positionName))
                            .map(e => e.value);
                          if (pool.length) update({ individualEmployees: pool });
                        }}
                        placeholder="Vəzifə seçin"
                      />
                    )}
                    {scopeTab !== "persons" && draft.individualEmployees.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {draft.individualEmployees.length} əməkdaş avtomatik seçildi.
                      </p>
                    )}
                  </Field>
                )}

                {/* BULK mode: same tabs — populate bulkSelections for the active category */}
                {draft.mode === "bulk" && (() => {
                  const bs = draft.bulkSelections;
                  const setCat = (cat: "persons" | "teams" | "structures" | "positions", v: string[]) => {
                    const cleared = { teams: [], structures: [], positions: [], persons: [] };
                    const nextMembers = cat === "persons"
                      ? v
                      : cat === "positions"
                        ? employeesRaw.filter(e => v.includes(e.positionName)).map(e => e.value)
                        : [];
                    update({
                      bulkSelections: { ...cleared, [cat]: v },
                      bulkTeamLeader: draft.bulkTeamLeader && nextMembers.includes(draft.bulkTeamLeader)
                        ? draft.bulkTeamLeader
                        : "",
                    });
                  };
                  return (
                    <Field
                      label={
                        scopeTab === "persons" ? "Şəxs(lər) seçin"
                        : scopeTab === "teams" ? "Komanda seçin"
                        : scopeTab === "structures" ? "Struktur seçin"
                        : "Vəzifə seçin"
                      }
                      required
                      span="col-span-12"
                    >
                      {scopeTab === "persons" && (
                        <MultiSelectDropdown options={employeeOptions} selected={bs.persons}
                          onChange={(v) => setCat("persons", v)} placeholder="Şəxs(lər) seçin" />
                      )}
                      {scopeTab === "teams" && (
                        <MultiSelectDropdown options={teamOptions} selected={bs.teams}
                          onChange={(v) => setCat("teams", v)} placeholder="Komanda seçin" />
                      )}
                      {scopeTab === "structures" && (
                        <MultiSelectDropdown options={structureOptions} selected={bs.structures}
                          onChange={(v) => setCat("structures", v)} placeholder="Struktur seçin" />
                      )}
                      {scopeTab === "positions" && (
                        <MultiSelectDropdown options={positionOptions} selected={bs.positions}
                          onChange={(v) => setCat("positions", v)} placeholder="Vəzifə seçin" />
                      )}
                      {bulkTeamMembers.length >= 2 && (
                        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                          <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Yadda saxladıqda bu {bulkTeamMembers.length} şəxs üçün avtomatik yeni komanda yaradılacaq.
                          </p>
                          <div>
                            <label className="text-xs font-medium text-foreground">
                              Komanda Lideri <span className="text-destructive">*</span>
                            </label>
                            <select
                              value={draft.bulkTeamLeader || ""}
                              onChange={e => update({ bulkTeamLeader: e.target.value })}
                              className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg bg-background ${
                                draft.bulkTeamLeader ? "border-border" : "border-destructive"
                              }`}
                            >
                              <option value="">— Lider seçin —</option>
                              {bulkTeamMembers.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            {!draft.bulkTeamLeader && (
                              <p className="text-[11px] text-destructive mt-1">
                                Komanda Lideri seçilməlidir — bu sahə məcburidir.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </Field>
                  );
                })()}


                <Field label="Dövr" required span="col-span-12 md:col-span-4">
                  <select value={draft.frequency} onChange={e => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                    {[...new Set([...periodOptions, draft.frequency].filter(Boolean))].map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>

                {/* Rüblük → il + rüb */}
                {draft.frequency === "Rüblük" ? (
                  <>
                    <Field label="İl" required span="col-span-6 md:col-span-2">
                      <select value={draft.quarterYear} onChange={e => setQuarter(Number(e.target.value), draft.quarter)}
                        className="w-full px-2 py-2 text-sm border border-border rounded-lg bg-background">
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 1).map(y =>
                          <option key={y} value={y}>{y}</option>
                        )}
                      </select>
                    </Field>
                    <Field label="Rüb" required span="col-span-6 md:col-span-2">
                      <select value={draft.quarter} onChange={e => setQuarter(draft.quarterYear, Number(e.target.value) as 1 | 2 | 3 | 4)}
                        className="w-full px-2 py-2 text-sm border border-border rounded-lg bg-background">
                        <option value={1}>I rüb</option>
                        <option value={2}>II rüb</option>
                        <option value={3}>III rüb</option>
                        <option value={4}>IV rüb</option>
                      </select>
                    </Field>
                  </>
                ) : (
                  <Field label="Başlama tarixi" required span="col-span-6 md:col-span-3">
                    <DatePickerField value={draft.startDate} onChange={setStartDate} />
                  </Field>
                )}

                <Field label="Bitmə tarixi" required span="col-span-6 md:col-span-3">
                  <DatePickerField
                    value={draft.endDate}
                    onChange={(v) => update({ endDate: v })}
                    disabled={draft.frequency !== "Custom"}
                  />
                  {draft.frequency !== "Custom" && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Dövrə əsasən avtomatik hesablanır</p>
                  )}
                </Field>

                <Field label="Qiymətləndirmə bal sistemi" required span="col-span-12 md:col-span-4">
                  <select value={draft.scoringSystem} onChange={e => update({ scoringSystem: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                    {[...new Set([...scoringOptions, draft.scoringSystem].filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <div className="col-span-12">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={draft.useMatrix}
                      onChange={e => {
                        const on = e.target.checked;
                        setApprovalMethodTouched(true);
                        update({
                          useMatrix: on,
                          approvalMethod: on ? "matrix" : suggestApprovalMethod(draft),
                          approvalMatrixId: on ? draft.approvalMatrixId : "",
                        });
                      }}
                      className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                    />
                    <div className="text-xs text-foreground/85">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        Təsdiqləmə matrisi olsun
                      </div>
                    </div>
                  </label>
                </div>


              </div>

              {/* ===== Lifecycle ===== */}
              <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">KPI Lifecycle</h3>
                </div>

                {/* Şablondan seç */}
                <div>
                  <label className="text-xs font-medium text-foreground">Lifecycle şablonlarından seç</label>
                  <select
                    value={lifecycleTemplateId || ""}
                    onChange={e => applyLifecycleTemplate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    <option value="">— Şablon seçin (opsional) —</option>
                    {lifecycleTemplates.filter(t => t.active).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}

                  </select>
                  {lifecycleFromTemplate && (
                    <p className="text-[11px] text-primary mt-1">
                      Şablon tətbiq olundu — tarixlər avtomatik dolduruldu və readonly-dir. Yalnız Review iştirakçıları seçilə bilər.
                    </p>
                  )}
                </div>

                <LifecycleStage title="KPI təyin olunması *"
                  start={draft.lifecycle.assignmentStart} end={draft.lifecycle.assignmentEnd}
                  onStart={v => updLifecycle({ assignmentStart: v, assignmentDeadline: v })}
                  onEnd={v => updLifecycle({ assignmentEnd: v })}
                  disabled={lifecycleFromTemplate} />
                <LifecycleStage title="KPI qiymətləndirilməsi *"
                  start={draft.lifecycle.evaluationStart} end={draft.lifecycle.evaluationEnd}
                  onStart={v => updLifecycle({ evaluationStart: v })}
                  onEnd={v => updLifecycle({ evaluationEnd: v })}
                  disabled={lifecycleFromTemplate} />
                <LifecycleStage title="Bonusun hesablanması *"
                  start={draft.lifecycle.bonusStart} end={draft.lifecycle.bonusEnd}
                  onStart={v => updLifecycle({ bonusStart: v })}
                  onEnd={v => updLifecycle({ bonusEnd: v })}
                  disabled={lifecycleFromTemplate} />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Review dövrləri</label>
                    <button type="button" onClick={addReview} disabled={lifecycleFromTemplate}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40">
                      <Plus className="w-3.5 h-3.5" /> Review əlavə et
                    </button>
                  </div>
                  {draft.lifecycle.reviews.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Review əlavə edilməyib.</p>
                  ) : (
                    <div className="space-y-2">
                      {draft.lifecycle.reviews.map((r, i) => {
                        const emps = getEmployees().filter(e => e.active);
                        return (
                        <div key={r.id} className="rounded-lg border border-border p-3 space-y-2 bg-secondary/30">
                          <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-12 md:col-span-4">
                              <label className="text-[11px] text-muted-foreground">Review #{i + 1} adı</label>
                              <input value={r.name} onChange={e => updReview(r.id, { name: e.target.value })}
                                disabled={lifecycleFromTemplate}
                                className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-70" />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                              <label className="text-[11px] text-muted-foreground">Başlama</label>
                              <DatePickerField value={r.start} onChange={(v) => updReview(r.id, { start: v })} disabled={lifecycleFromTemplate} className="mt-0.5 px-2 py-1.5 rounded" />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                              <label className="text-[11px] text-muted-foreground">Bitmə</label>
                              <DatePickerField value={r.end} onChange={(v) => updReview(r.id, { end: v })} disabled={lifecycleFromTemplate} className="mt-0.5 px-2 py-1.5 rounded" />
                            </div>
                            <div className="col-span-12 md:col-span-2">
                              <button type="button" onClick={() => removeReview(r.id)}
                                disabled={lifecycleFromTemplate}
                                className="w-full px-2 py-1.5 text-xs rounded border border-border text-destructive hover:bg-destructive/10 disabled:opacity-40">
                                Sil
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" /> Reviewu keçirəcək şəxs(lər) <span className="text-destructive">*</span>
                            </label>
                            <div className="flex items-start gap-2 mt-0.5">
                              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                                <Users className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                {(() => {
                                  const currentList: string[] = r.reviewerNames && r.reviewerNames.length
                                    ? r.reviewerNames
                                    : (r.reviewerName ? [r.reviewerName] : []);
                                  const opts = emps.map(e => `${e.firstName} ${e.lastName}${e.positionName ? " · " + e.positionName : ""}`);
                                  const toggle = (v: string) => {
                                    const has = currentList.includes(v);
                                    const next = has ? currentList.filter(x => x !== v) : [...currentList, v];
                                    updReview(r.id, { reviewerNames: next, reviewerName: next[0] || "" });
                                  };
                                  return (
                                    <DropdownMultiSelect
                                      options={opts}
                                      selected={currentList}
                                      onToggle={toggle}
                                      onChange={(next) => updReview(r.id, { reviewerNames: next, reviewerName: next[0] || "" })}
                                      placeholder="Şəxs(lər) seçin — bir neçə seçilə bilər"
                                      searchPlaceholder="Şəxs axtar (ad, vəzifə)…"
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== STEP 2 ===== */}
          {step === 2 && (
            <Step2Targets
              draft={draft}
              employeeOptions={employeeOptions}
              cascadeMatrices={cascadeMatrices}
              scoreMax={scoreMax}
              totalWeight={totalWeight}
              targetTypeOptions={targetTypeOptions}
              update={update}
              updHedef={updHedef}
              addHedef={addHedef}
              removeHedef={removeHedef}
              applyEvaluatorsToAll={applyEvaluatorsToAll}
              applyAssignerToAll={applyAssignerToAll}
            />
          )}

          {/* ===== STEP 3 ===== */}
          {step === 3 && (() => {
            const approvalMatrices = getApprovalMatrices();
            const selectedMatrix = approvalMatrices.find(m => m.id === draft.approvalMatrixId);
            return (
              <div className="space-y-3">
                <SummarySection title="Əsas Məlumatlar">
                  <SummaryRow label="KPI adı" value={draft.name} />
                  <SummaryRow label="Təyinat növü" value={draft.mode === "individual" ? "Fərdi" : "Toplu"} />
                  <SummaryRow label="Dövr" value={draft.frequency} />
                  <SummaryRow label="Müddət" value={`${draft.startDate} → ${draft.endDate}`} />
                  <SummaryRow label="Bal sistemi" value={draft.scoringSystem} />
                  {draft.useMatrix && (
                    <SummaryRow label="Təsdiqləmə üsulu" value={
                      draft.approvalMethod === "team_leader" ? "Komanda rəhbəri"
                      : draft.approvalMethod === "structure_leader" ? "Təşkilati struktur rəhbəri"
                      : "Matriks"
                    } />
                  )}

                  {draft.mode === "individual" && <SummaryRow label="Əməkdaşlar" value={draft.individualEmployees.join(", ") || "—"} />}
                  {draft.mode === "bulk" && (
                    <>
                      {draft.bulkSelections.teams.length > 0 && <SummaryRow label="Komandalar" value={draft.bulkSelections.teams.join(", ")} />}
                      {draft.bulkSelections.structures.length > 0 && <SummaryRow label="Strukturlar" value={`${draft.bulkSelections.structures.length} seçim`} />}
                      {draft.bulkSelections.positions.length > 0 && <SummaryRow label="Vəzifələr" value={`${draft.bulkSelections.positions.length} seçim`} />}
                      {draft.bulkSelections.persons.length > 0 && <SummaryRow label="Şəxslər" value={draft.bulkSelections.persons.join(", ")} />}
                    </>
                  )}
                </SummarySection>

                <SummarySection title="Lifecycle">
                  <SummaryRow label="KPI təyin olunması" value={`${draft.lifecycle.assignmentStart || "—"} → ${draft.lifecycle.assignmentEnd || "—"}`} />
                  <SummaryRow label="Qiymətləndirmə" value={`${draft.lifecycle.evaluationStart || "—"} → ${draft.lifecycle.evaluationEnd || "—"}`} />
                  <SummaryRow label="Bonus hesablanması" value={`${draft.lifecycle.bonusStart || "—"} → ${draft.lifecycle.bonusEnd || "—"}`} />
                  <SummaryRow label="Review sayı" value={`${draft.lifecycle.reviews.length}`} />
                </SummarySection>

                <SummarySection title={`Hədəflər (${draft.targets.length} · ${totalWeight}%)`}>
                  {draft.targets.length === 0
                    ? <div className="text-xs text-muted-foreground italic">Hədəf yoxdur</div>
                    : draft.targets.map((t, i) => (
                      <div key={t.id} className="text-xs py-1 border-b border-border/50 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">#{i + 1} {t.name}</span>
                          <span className="text-muted-foreground">{t.type} · {t.weight}%{t.cascading ? ` · cascade (${t.cascadeMatrix})` : ""}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Qiymətləndiricilər: <span className="text-foreground">{t.evaluators.map(e => `${e.name}${t.evaluators.length > 1 ? ` (${e.weight}%)` : ""}`).join(", ") || "—"}</span>
                          {" · "}Təyin edən: <span className="text-foreground">{t.createdBy === "self" ? "Özüm" : (t.assigner || "—")}</span>
                        </div>
                      </div>
                    ))
                  }
                </SummarySection>

                {/* Təsdiqləmə üsulu — yalnız təsdiqləmə matrisi seçilibsə görünür */}
                {draft.useMatrix && (
                <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Təsdiqləmə üsulu</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["structure_leader", "Struktur rəhbəri"],
                      ["team_leader", "Komanda rəhbəri"],
                      ["matrix", "Matriks"],
                    ] as const).map(([val, label]) => {
                      const active = draft.approvalMethod === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setApprovalMethod(val)}
                          className={`px-2 py-1.5 text-xs rounded-md border text-center transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border bg-background text-foreground hover:bg-secondary"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {draft.approvalMethod === "matrix" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-muted-foreground">Sistemdə mövcud matrislərdən birini seçin</label>
                      <select value={draft.approvalMatrixId}
                        onChange={e => update({ approvalMatrixId: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-background">
                        <option value="">— Təsdiqləmə matrisi seçin —</option>
                        {approvalMatrices.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.steps.length} addım)</option>
                        ))}
                      </select>
                      {selectedMatrix && (
                        <div className="mt-2 rounded-md border border-border bg-background overflow-hidden">
                          <div className="px-2.5 py-1.5 bg-secondary/50 text-[11px] font-medium text-foreground">
                            Təsdiqləyicilər ({selectedMatrix.steps.length} mərhələ)
                          </div>
                          <table className="w-full text-[11px]">
                            <thead className="bg-secondary/30">
                              <tr className="text-muted-foreground">
                                <th className="text-left px-2 py-1 w-8">№</th>
                                <th className="text-left px-2 py-1">Ad Soyad / Rol</th>
                                <th className="text-left px-2 py-1">Vəzifə / Növ</th>
                                <th className="text-left px-2 py-1">Mərhələ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedMatrix.steps.flatMap((s, si) =>
                                (s.assignees.length ? s.assignees : [{ type: "role" as const, name: "—" }]).map((a, ai) => (
                                  <tr key={`${si}-${ai}`} className="border-t border-border">
                                    <td className="px-2 py-1 text-foreground font-medium">{si + 1}</td>
                                    <td className="px-2 py-1 text-foreground">{formatAssignee(a)}</td>
                                    <td className="px-2 py-1 text-muted-foreground">{a.type === "user" ? "Şəxs" : "Rol"}</td>
                                    <td className="px-2 py-1 text-muted-foreground">{s.label}</td>
                                  </tr>
                                )),
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {draft.approvalMethod === "team_leader" && (
                    <p className="text-[11px] text-muted-foreground">Seçilmiş komandaların rəhbərləri təsdiqləyəcək.</p>
                  )}
                  {draft.approvalMethod === "structure_leader" && (
                    <p className="text-[11px] text-muted-foreground">Seçilmiş strukturların rəhbərləri təsdiqləyəcək.</p>
                  )}
                </div>
                )}



              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-3">
          <button type="button" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}
            className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg border border-border bg-card text-foreground disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Geri
          </button>
          <div className="text-xs text-muted-foreground">{step} / {TOTAL_STEPS}</div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button type="button" onClick={close} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card">Ləğv et</button>
            <button type="button" onClick={() => finalize("draft")}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-secondary">
              <Save className="w-4 h-4" /> Yadda saxla
            </button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={handleNext} disabled={!canNext}
                className="flex items-center gap-1 px-5 py-1.5 text-sm rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium disabled:opacity-50">
                Növbəti <ChevronRight className="w-4 h-4" />
              </button>
            ) : (draft.useMatrix || draft.targets.some(t => t.createdBy === "other")) ? (
              <button type="button" onClick={() => finalize("submit")}
                className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-semibold shadow-sm hover:from-amber-500 hover:to-yellow-600">
                <Send className="w-4 h-4" /> Təyinə göndər
              </button>
            ) : (
              <button type="button" onClick={() => finalize("create_active")}
                className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-sm hover:from-emerald-600 hover:to-emerald-700">
                <Power className="w-4 h-4" /> KPI yarat
              </button>
            )}

          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================
// Lifecycle stage sub-component
// =========================================================
function LifecycleStage({ title, start, end, onStart, onEnd, disabled }: {
  title: string; start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12 md:col-span-4">
        <label className="text-xs font-medium text-foreground">{title}</label>
      </div>
      <div className="col-span-6 md:col-span-4">
        <label className="text-[11px] text-muted-foreground">Başlama tarixi</label>
        <DatePickerField value={start} onChange={onStart} disabled={disabled} className="mt-0.5 px-2 py-1.5 rounded" />
      </div>
      <div className="col-span-6 md:col-span-4">
        <label className="text-[11px] text-muted-foreground">Bitmə tarixi</label>
        <DatePickerField value={end} onChange={onEnd} disabled={disabled} className="mt-0.5 px-2 py-1.5 rounded" />
      </div>
    </div>
  );
}

// =========================================================
// STEP 2 — Targets
// =========================================================
function Step2Targets({
  draft, employeeOptions, cascadeMatrices, scoreMax, totalWeight,
  targetTypeOptions, update, updHedef, addHedef, removeHedef, applyEvaluatorsToAll, applyAssignerToAll,
}: {
  draft: CreateKpiWizardDraft;
  employeeOptions: { value: string; label: string }[];
  cascadeMatrices: { id: string; name: string; scopeType: string }[];
  scoreMax: number | undefined;
  totalWeight: number;
  targetTypeOptions: string[];
  update: (p: Partial<CreateKpiWizardDraft>) => void;
  updHedef: (id: string, p: Partial<WizardHedef>) => void;
  addHedef: () => void;
  removeHedef: (id: string) => void;
  applyEvaluatorsToAll: (evs: WizardEvaluatorRef[]) => void;
  applyAssignerToAll: (n: string) => void;
}) {
  // Unified picker for "vahid təyinedici / qiymətləndirici" — Dialog popup
  const [unifiedOpen, setUnifiedOpen] = useState(false);
  const [unifiedAssigner, setUnifiedAssigner] = useState<string>("");
  const [unifiedEvaluators, setUnifiedEvaluators] = useState<WizardEvaluatorRef[]>([]);
  const [unifiedEvalPickerOpen, setUnifiedEvalPickerOpen] = useState(false);
  // Applied markers — once applied, target-level pickers are locked
  const [unifiedAssignerApplied, setUnifiedAssignerApplied] = useState<string>("");
  const [unifiedEvaluatorsApplied, setUnifiedEvaluatorsApplied] = useState<WizardEvaluatorRef[]>([]);
  const [scoreDlgFor, setScoreDlgFor] = useState<string | null>(null);
  const [assignerPickerFor, setAssignerPickerFor] = useState<string | null>(null);
  const [evalPickerFor, setEvalPickerFor] = useState<string | null>(null);
  const [questionsDlgFor, setQuestionsDlgFor] = useState<string | null>(null);

  const weightLimits = useWeightLimits();
  const competencyMatrices = getCompetencyMatrices();
  const competencyMatrixOptions = competencyMatrices;
  const questionsDlgTarget = draft.targets.find(t => t.id === questionsDlgFor) || null;
  const questionsDlgMatrix = questionsDlgTarget ? competencyMatrices.find(m => m.id === questionsDlgTarget.competencyMatrix) || null : null;

  const scoreDlgTarget = draft.targets.find(t => t.id === scoreDlgFor) || null;
  const unifiedActive = !!unifiedAssignerApplied || unifiedEvaluatorsApplied.length > 0;

  return (
    <div className="space-y-3">
      {/* Vahid şəxs (bütün hədəflər üçün) */}
      <div className="rounded-lg bg-white dark:bg-background border border-sky-200 dark:border-sky-900 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <UserPlus className="w-4 h-4 text-sky-600" />
          <span className="font-medium">Vahid şəxs</span>
          <span className="text-xs text-muted-foreground">(bütün hədəflər üçün)</span>
          {unifiedActive && (
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">Tətbiq edilib</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unifiedActive && (
            <button type="button" onClick={() => {
              setUnifiedAssignerApplied(""); setUnifiedEvaluatorsApplied([]);
              setUnifiedAssigner(""); setUnifiedEvaluators([]);
              toast("Vahid seçim sıfırlandı — indi hər hədəf üçün ayrıca seçim edə bilərsiniz");
            }} className="px-3 py-1 text-xs rounded-full border border-border bg-background hover:bg-secondary">Sıfırla</button>
          )}
          <button type="button" onClick={() => setUnifiedOpen(true)}
            className="px-4 py-1.5 text-sm rounded-full border border-border bg-background hover:bg-secondary">
            Seç
          </button>
        </div>
      </div>

      <Dialog open={unifiedOpen} onOpenChange={setUnifiedOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-sky-600" /> Vahid şəxs seçimi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Təyin edici</label>
              <div className="mt-1">
                <SearchableSelect
                  value={unifiedAssigner}
                  onChange={setUnifiedAssigner}
                  options={employeeOptions.map(o => ({ value: o.value, label: o.label }))}
                  placeholder="Əməkdaş seçin"
                  allowClear
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Qiymətləndirici(lər) — çəkilər cəmi 100%</label>
              <div className="mt-1 rounded-lg border border-border bg-background p-2 space-y-2">
                {unifiedEvaluators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Hələ qiymətləndirici seçilməyib.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {unifiedEvaluators.map(e => (
                      <span key={e.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300">
                        {e.name.split(" — ")[0]}
                        {unifiedEvaluators.length > 1 && <span className="text-[10px] opacity-80">({e.weight}%)</span>}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setUnifiedEvalPickerOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded border border-indigo-400 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {unifiedEvaluators.length === 0 ? "Qiymətləndirici seç" : "Dəyiş"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={() => setUnifiedOpen(false)}
              className="px-3 py-1.5 text-xs rounded border border-border bg-card">Ləğv et</button>
            <button type="button"
              disabled={draft.targets.length === 0 || (!unifiedAssigner && unifiedEvaluators.length === 0)}
              onClick={() => {
                if (unifiedEvaluators.length > 1) {
                  const sum = unifiedEvaluators.reduce((s, e) => s + (Number(e.weight) || 0), 0);
                  if (sum !== 100) { toast.error(`Qiymətləndiricilərin faiz cəmi 100% olmalıdır (hazırda ${sum}%)`); return; }
                }
                if (unifiedAssigner) { applyAssignerToAll(unifiedAssigner); setUnifiedAssignerApplied(unifiedAssigner); }
                if (unifiedEvaluators.length > 0) { applyEvaluatorsToAll(unifiedEvaluators); setUnifiedEvaluatorsApplied(unifiedEvaluators); }
                toast.success(`${draft.targets.length} hədəfə tətbiq edildi`);
                setUnifiedOpen(false);
              }}
              className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50">
              Hamısına tətbiq et
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {unifiedEvalPickerOpen && (
        <EvaluatorPickerDialog
          initialEvaluators={unifiedEvaluators}
          employeeOptions={employeeOptions}
          onClose={() => setUnifiedEvalPickerOpen(false)}
          onSave={(evs) => { setUnifiedEvaluators(evs); setUnifiedEvalPickerOpen(false); }}
          title="Vahid qiymətləndirici"
        />
      )}



      {draft.targets.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
          Hələ hədəf əlavə edilməyib.
          <div className="mt-3">
            <button type="button" onClick={addHedef} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
              <Plus className="w-3.5 h-3.5" /> Hədəf əlavə et
            </button>
          </div>
        </div>
      )}

      {draft.targets.map((t, idx) => {
        const isOther = t.createdBy === "other";
        const disabled = isOther; // disable main fields except assigner/evaluators
        const showCascade = CASCADE_TYPES.includes(t.type);

        return (
          <div key={t.id} className="relative p-3.5 rounded-xl border-2 border-primary/30 bg-card/60 space-y-2.5 shadow-sm">
            <button type="button" title="Sil" onClick={() => removeHedef(t.id)}
              className="absolute top-3 right-3 p-1.5 rounded hover:bg-destructive/10 text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold text-base flex items-center justify-center">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-foreground">Hədəf #{idx + 1}</div>
                <div className="text-xs text-muted-foreground">{t.name || "— Adsız hədəf —"} · {t.type}</div>
              </div>
              <div className="flex gap-1.5 mr-8">
                {(["self", "other"] as TargetCreatedBy[]).map(mode => {
                  const active = t.createdBy === mode;
                  return (
                    <button key={mode} type="button"
                      onClick={() => updHedef(t.id, { createdBy: mode, assigner: mode === "self" ? "" : t.assigner })}
                      className={`px-2 py-1 rounded border text-[11px] font-medium ${active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "border-border bg-card hover:border-primary/40"}`}>
                      {mode === "self" ? "Özüm təyin edirəm" : "Digər əməkdaş təyin edir"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 md:col-span-5">
                <label className="text-[11px] text-muted-foreground">Hədəf adı *</label>
                <input value={t.name} disabled={disabled} onChange={e => updHedef(t.id, { name: e.target.value })}
                  placeholder="Məsələn: Rüblük satış həcmi"
                  className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60" />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="text-[11px] text-muted-foreground">Hədəf növü *</label>
                <select value={t.type} disabled={disabled} onChange={e => updHedef(t.id, { type: e.target.value as HedefType })}
                  className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60">
                  {[...new Set([...targetTypeOptions, t.type].filter(Boolean))].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="text-[11px] text-muted-foreground">Çəki (%) *</label>
                <WeightInput value={t.weight} disabled={disabled}
                  min={weightLimits.min} max={weightLimits.max}
                  onChange={n => updHedef(t.id, { weight: n })}
                  className="mt-0.5" />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Limit: min {weightLimits.min}% – maks {weightLimits.max}%
                </p>
                {t.weight > 0 && (t.weight < weightLimits.min || t.weight > weightLimits.max) && (
                  <p className="text-[10px] text-destructive mt-0.5">
                    Çəki {weightLimits.min}%–{weightLimits.max}% aralığında olmalıdır
                  </p>
                )}
              </div>

              {t.type === "Səriştə" ? (
                <>
                  <div className="col-span-12 md:col-span-3">
                    <label className="text-[11px] text-muted-foreground">Səriştə matrisi *</label>
                    <select value={t.competencyMatrix} disabled={isOther}
                      onChange={e => updHedef(t.id, { competencyMatrix: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60">
                      <option value="">— Matris seçin —</option>
                      {competencyMatrixOptions.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6 md:col-span-2 flex items-end">
                    <button type="button"
                      onClick={() => setQuestionsDlgFor(t.id)}
                      disabled={!t.competencyMatrix}
                      className="w-full px-2 py-1.5 text-xs font-medium rounded border border-primary/60 text-primary hover:bg-primary/10 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                      <ClipboardList className="w-3.5 h-3.5" /> Suallara bax
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-12 md:col-span-10">
                    <label className="text-[11px] text-muted-foreground">
                      {t.type === "Zaman" ? "Zaman aralığı" : "Hədəf dəyəri"} {isOther ? <span className="text-amber-600">(təyin edən dolduracaq)</span> : "*"}
                    </label>
                    <div className="mt-0.5 flex gap-1">
                      {(t.type === "Zaman") ? (
                        <>
                          <input type="date" value={t.timeStart || ""} disabled={isOther}
                            onChange={e => updHedef(t.id, { timeStart: e.target.value })}
                            title="Başlama tarixi"
                            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60" />
                          <input type="date" value={t.timeEnd || ""} disabled={isOther}
                            onChange={e => updHedef(t.id, { timeEnd: e.target.value })}
                            title="Bitmə tarixi"
                            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60" />
                        </>
                      ) : (t.type === "Boolean") ? (
                        <select value={t.targetValue} disabled={isOther}
                          onChange={e => updHedef(t.id, { targetValue: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60">
                          <option value="">— Seçin —</option>
                          <option value="Bəli">Bəli</option>
                          <option value="Xeyr">Xeyr</option>
                        </select>
                      ) : (t.type === "İcra" || t.type === "Fərdi İnkişaf") ? (
                        <input value={t.targetValue} disabled={isOther}
                          onChange={e => updHedef(t.id, { targetValue: e.target.value })}
                          placeholder="Hədəf təsviri"
                          className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60" />
                      ) : (
                        <>
                          <input type="number" value={t.targetValue} disabled={isOther}
                            onChange={e => updHedef(t.id, { targetValue: e.target.value })}
                            placeholder={t.type === "Faiz" ? "0-100" : "0"}
                            className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-background disabled:opacity-60" />
                          {t.type === "Məbləğ" && (
                            <select value={t.currency} disabled={isOther}
                              onChange={e => updHedef(t.id, { currency: e.target.value as any })}
                              className="px-1.5 py-1.5 text-xs border border-border rounded bg-background disabled:opacity-60">
                              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                          {t.type === "Faiz" && <span className="px-2 py-1.5 text-xs text-muted-foreground">%</span>}
                          {t.type === "Say" && <span className="px-2 py-1.5 text-xs text-muted-foreground whitespace-nowrap">ədəd</span>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-2 flex items-end">
                    <button type="button" onClick={() => setScoreDlgFor(t.id)}
                      disabled={isOther}
                      title={isOther ? "Digər əməkdaş təyin edir — qiymətləri o dolduracaq" : ""}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-amber-500/60 text-amber-700 hover:bg-amber-500/10 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                      <Star className="w-3.5 h-3.5" /> Qiymətlər
                    </button>
                  </div>
                </>
              )}

            </div>

            {/* Qiymətləndirici / Təyin edici — minimal inline pill row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Qiymətləndirici */}
              <button type="button"
                onClick={() => { if (!unifiedEvaluatorsApplied.length) setEvalPickerFor(evalPickerFor === t.id ? null : t.id); }}
                disabled={unifiedEvaluatorsApplied.length > 0}
                title={unifiedEvaluatorsApplied.length > 0 ? "Vahid seçimdən təyin edilib" : ""}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border border-dashed transition ${
                  unifiedEvaluatorsApplied.length > 0
                    ? "border-indigo-300 bg-indigo-50 text-indigo-600 cursor-not-allowed opacity-80 dark:bg-indigo-950/30"
                    : "border-indigo-400 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                }`}>
                <UserPlus className="w-3 h-3" />
                Qiymətləndirici
                {t.evaluators.length > 0 && <span className="ml-0.5 truncate max-w-[140px]">: {t.evaluators.map(e => e.name.split(" — ")[0]).join(", ")}</span>}
              </button>

              {/* Təyin edici — only when "other" */}
              {isOther && (
                <button type="button"
                  onClick={() => { if (!unifiedAssignerApplied) setAssignerPickerFor(assignerPickerFor === t.id ? null : t.id); }}
                  disabled={!!unifiedAssignerApplied}
                  title={unifiedAssignerApplied ? "Vahid seçimdən təyin edilib" : ""}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border border-dashed transition ${
                    unifiedAssignerApplied
                      ? "border-amber-300 bg-amber-50 text-amber-700 cursor-not-allowed opacity-80 dark:bg-amber-950/30"
                      : "border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  }`}>
                  <UserPlus className="w-3 h-3" />
                  Təyin edici
                  {t.assigner && <span className="ml-0.5 truncate max-w-[140px]">: {t.assigner.split(" — ")[0]}</span>}
                </button>
              )}
            </div>

            {/* Qiymətləndirici — 5-tab Dialog (Şəxs / Komanda / Struktur / Özü / İnteqrasiya) */}
            {evalPickerFor === t.id && !unifiedEvaluatorsApplied.length && (
              <EvaluatorPickerDialog
                initialEvaluators={t.evaluators}
                employeeOptions={employeeOptions}
                onClose={() => setEvalPickerFor(null)}
                onSave={(evs) => { updHedef(t.id, { evaluators: evs, evaluator: evs[0]?.name || "" }); setEvalPickerFor(null); }}
                title={t.name || "Hədəf"}
              />
            )}

            {/* Təyin edici inline picker */}
            {isOther && assignerPickerFor === t.id && !unifiedAssignerApplied && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Təyin edici *</span>
                  <button type="button" onClick={() => setAssignerPickerFor(null)} className="text-[11px] text-primary hover:underline">Bağla</button>
                </div>
                <SearchableSelect
                  size="sm"
                  value={t.assigner}
                  onChange={v => updHedef(t.id, { assigner: v })}
                  options={employeeOptions.map(o => ({ value: o.value, label: o.label }))}
                  placeholder="Əməkdaş seçin"
                  allowClear
                />
              </div>
            )}

            {/* Cascade (C) — yalnız bölünə bilən tiplər üçün */}
            {!disabled && (
              showCascade ? (
                <div className="rounded-md border border-primary/30 p-3 bg-primary/5 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" checked={t.cascading}
                      onChange={e => updHedef(t.id, { cascading: e.target.checked, cascadeMatrix: "" })}
                      className="w-4 h-4" />
                    <GitBranch className="w-3.5 h-3.5 text-primary" />
                    <b>C — Kaskadlana bilər</b>
                  </label>
                  <p className="text-[11px] text-muted-foreground pl-6 leading-relaxed">
                    Aktiv olduqda bu hədəf <b>Ana Hədəf</b> hesab olunur və təyin edici <b>Rəhbər (⭐)</b> tərəfindən tabelikdəki əməkdaşlar arasında bölüşdürülə bilər.
                    Cascading Matrix tələb olunmur — təşkilati struktur avtomatik istifadə olunur.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/60 p-2.5 bg-secondary/20 text-[11px] text-muted-foreground flex items-start gap-2">
                  <GitBranch className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span><b>C (Kaskadlama)</b> yalnız bölünə bilən tiplər üçün mümkündür: <i>Məbləğ, Say, Faiz, Nisbət</i>. Cari tip ({t.type}) bölünə bilmir.</span>
                </div>
              )
            )}
          </div>
        );
      })}

      {draft.targets.length > 0 && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={addHedef} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5">
            <Plus className="w-3.5 h-3.5" /> Hədəf əlavə et
          </button>
        </div>
      )}


      {/* Qiymətlər dialog */}
      {scoreDlgTarget && (
        <ScoresDialog
          target={scoreDlgTarget}
          scoreMax={scoreMax}
          onClose={() => setScoreDlgFor(null)}
          onSave={(rows) => { updHedef(scoreDlgTarget.id, { scoreDescriptions: rows }); setScoreDlgFor(null); }}
        />
      )}

      {/* Səriştə matrisi sualları dialog */}
      {questionsDlgTarget && questionsDlgMatrix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setQuestionsDlgFor(null)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Suallar — {questionsDlgMatrix.name}</h3>
              <button onClick={() => setQuestionsDlgFor(null)} className="p-1 rounded hover:bg-secondary"><X className="w-4 h-4" /></button>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr><th className="px-3 py-2 text-left w-10">#</th><th className="px-3 py-2 text-left">Sual</th><th className="px-3 py-2 text-right w-20">Çəki</th></tr>
                </thead>
                <tbody>
                  {questionsDlgMatrix.questions.map((q, i) => (
                    <tr key={q.id} className="border-t border-border">
                      <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">{q.text}</td>
                      <td className="px-3 py-2 text-right">{q.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// Evaluators multi-editor
// =========================================================
function UnifiedEvaluatorsEditor({ employeeOptions, evaluators, onChange }: {
  employeeOptions: { value: string; label: string }[];
  evaluators: WizardEvaluatorRef[];
  onChange: (e: WizardEvaluatorRef[]) => void;
}) {
  const sum = evaluators.reduce((s, e) => s + (Number(e.weight) || 0), 0);
  const add = () => onChange([...evaluators, { id: crypto.randomUUID(), name: "", weight: evaluators.length === 0 ? 100 : 0 }]);
  return (
    <div className="space-y-1.5">
      {evaluators.map(ev => (
        <div key={ev.id} className="grid grid-cols-12 gap-1.5 items-center">
          <SearchableSelect
            className="col-span-8"
            size="sm"
            value={ev.name}
            onChange={v => onChange(evaluators.map(x => x.id === ev.id ? { ...x, name: v } : x))}
            options={employeeOptions.map(o => ({ value: o.value, label: o.label }))}
            placeholder="Əməkdaş seçin"
            allowClear
          />
          <WeightInput value={ev.weight}
            onChange={n => onChange(evaluators.map(x => x.id === ev.id ? { ...x, weight: n } : x))}
            placeholder="%"
            className="col-span-3 !py-1.5 !px-2 text-xs" />

          <button type="button" onClick={() => onChange(evaluators.filter(x => x.id !== ev.id))}
            className="col-span-1 p-1 text-destructive hover:bg-destructive/10 rounded" title="Sil">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" onClick={add}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-dashed border-primary/50 text-primary hover:bg-primary/10">
          <Plus className="w-3 h-3" /> Qiymətləndirici əlavə et
        </button>
        {evaluators.length > 1 && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${sum === 100 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
            Cəm: {sum}%
          </span>
        )}
      </div>
    </div>
  );
}

// =========================================================
// Scores Dialog
// =========================================================
function ScoresDialog({ target, scoreMax, onClose, onSave }: {
  target: WizardHedef;
  scoreMax: number | undefined;
  onClose: () => void;
  onSave: (rows: WizardScoreDesc[]) => void;
}) {
  const max = scoreMax || 5;
  const isTime = target.type === "Zaman";
  const needsMinMax = ["Məbləğ", "Say", "Faiz", "Nisbət"].includes(target.type);

  const seedRows = useMemo(() => {
    if (target.scoreDescriptions && target.scoreDescriptions.length > 0) return target.scoreDescriptions;
    return Array.from({ length: max }, (_, i) => ({ id: crypto.randomUUID(), score: i + 1, description: "", timeStart: "", timeEnd: "" }));
  }, [target.id, max]);

  const [rows, setRows] = useState<WizardScoreDesc[]>(seedRows);
  useEffect(() => { setRows(seedRows); }, [seedRows]);

  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.score) - Number(b.score)), [rows]);
  const minBonusScore = ordered.find(r => r.isMinBonus)?.score ?? null;

  const parts = (r: WizardScoreDesc) => {
    const [mn = "", mx = ""] = (r.description || "").split("-");
    return { mn, mx };
  };

  // Interval validasiyası — Min ≤ Max, ardıcıllıq, boşluq/üst-üstə düşmə yoxdur.
  const errors = useMemo(() => {
    const e: Record<number, string> = {};
    if (!needsMinMax) return e;
    let prevMax: number | null = null;
    ordered.forEach(r => {
      const { mn, mx } = parts(r);
      if (mn === "" && mx === "") { prevMax = null; return; }
      const nMin = Number(mn);
      const nMax = Number(mx);
      if (mn === "" || mx === "" || isNaN(nMin) || isNaN(nMax)) {
        e[r.score] = "Min və Max daxil edilməlidir";
      } else if (nMin > nMax) {
        e[r.score] = "Min dəyər Max dəyərdən böyük ola bilməz";
      } else if (prevMax !== null && nMin !== prevMax + 1) {
        e[r.score] = nMin <= prevMax
          ? `İntervallar üst-üstə düşür — Min ${prevMax + 1} olmalıdır`
          : `Boşluq var — Min ${prevMax + 1} olmalıdır`;
      }
      if (!e[r.score]) prevMax = nMax;
    });
    return e;
  }, [ordered, needsMinMax]);

  const save = () => {
    if (needsMinMax) {
      const firstErr = ordered.find(r => errors[r.score]);
      if (firstErr) { toast.error(`Bal ${firstErr.score}: ${errors[firstErr.score]}`); return; }
      const filled = ordered.filter(r => { const { mn, mx } = parts(r); return mn !== "" && mx !== ""; });
      if (filled.length !== ordered.length) { toast.error("Bütün ballar üçün Min və Max dəyər daxil edin"); return; }
    } else {
      const required = max === 10 ? [10, 4] : [max, 2];
      for (const r of required) {
        const row = ordered.find(x => Number(x.score) === r);
        if (!row) { toast.error(`${r} balı tələb olunur`); return; }
        if (isTime) {
          if (!row.timeStart || !row.timeEnd) { toast.error(`Zaman: ${r} balı üçün zaman aralığı tələb olunur`); return; }
        } else if (!row.description?.trim()) {
          toast.error(`${r} balı üçün izah məcburidir`); return;
        }
      }
    }
    if (!minBonusScore) { toast.error("Minimum Bonus Bal seçilməlidir"); return; }
    onSave(ordered);
  };

  const updMinMax = (id: string, side: "min" | "max", val: string) => {
    setRows(rows.map(x => {
      if (x.id !== id) return x;
      const [mn = "", mx = ""] = (x.description || "").split("-");
      const next = side === "min" ? `${val}-${mx}` : `${mn}-${val}`;
      return { ...x, description: next };
    }));
  };

  // Hədəf dəyərindən ardıcıl, kəsişməyən intervallar hesablayır (son interval hədəfdə bitir).
  const targetNumber = useMemo(() => {
    const raw = String(target.targetValue ?? "").replace(/[^0-9.,-]/g, "").replace(/\s/g, "").replace(",", ".");
    const n = Number(raw);
    return isFinite(n) && n > 0 ? n : null;
  }, [target.targetValue]);

  const autoFill = () => {
    if (!needsMinMax) return;
    if (targetNumber === null) {
      toast.error("Əvvəlcə hədəf dəyərini daxil edin");
      return;
    }
    const count = ordered.length || max;
    const bounds: number[] = [];
    for (let i = 1; i <= count; i++) {
      let b = Math.round((targetNumber * i) / count);
      const prev = i === 1 ? -1 : bounds[i - 2];
      if (b <= prev) b = prev + 1;
      bounds.push(b);
    }
    bounds[count - 1] = Math.max(targetNumber, (bounds[count - 2] ?? -1) + 1);
    const byScore = new Map<string, { mn: number; mx: number }>();
    ordered.forEach((r, i) => {
      const mn = i === 0 ? 0 : bounds[i - 1] + 1;
      const mx = Math.max(bounds[i], mn);
      byScore.set(r.id, { mn, mx });
    });
    setRows(rows.map(x => {
      const v = byScore.get(x.id);
      return v ? { ...x, description: `${v.mn}-${v.mx}` } : x;
    }));
    toast.success("Bal intervalları hədəf dəyərinə uyğun dolduruldu");
  };

  const inputCls = "w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-amber-500" />
              "{target.name || "Hədəf"}" üçün bal intervalları (1–{max})
            </DialogTitle>
            {needsMinMax && (
              <button
                type="button"
                onClick={autoFill}
                className="shrink-0 mr-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card shadow-sm text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                title="Hədəf dəyərinə əsasən intervalları avtomatik hesabla"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Avtomatik
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
            {needsMinMax
              ? "Minimum bal yalnız bir qiymət üçün seçilə bilər. \"Avtomatik\" hədəf dəyərinə əsasən intervalları doldurur — sonradan əl ilə dəyişə bilərsiniz."
              : `${max === 10 ? "10 və 4" : `${max} və 2`} ballarının ${isTime ? "zaman aralığı" : "izahı"} məcburidir.`}
          </p>
        </DialogHeader>


        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-secondary/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-2">Minimum</div>
            <div className="col-span-1">Bal</div>
            {needsMinMax ? (
              <>
                <div className="col-span-4">Min dəyər</div>
                <div className="col-span-5">Max dəyər</div>
              </>
            ) : isTime ? (
              <>
                <div className="col-span-4">Başlama</div>
                <div className="col-span-5">Bitmə</div>
              </>
            ) : (
              <div className="col-span-9">İzah</div>
            )}
          </div>
          <div className="divide-y divide-border">
            {ordered.map((r) => {
              const { mn, mx } = parts(r);
              const selected = !!r.isMinBonus;
              const err = errors[r.score];
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-12 gap-3 px-4 py-3 items-center transition-colors ${
                    selected ? "bg-amber-500/10" : "hover:bg-secondary/20"
                  }`}
                >
                  <div className="col-span-2">
                    <input
                      type="radio"
                      name="min-bonus-score"
                      checked={selected}
                      onChange={() => setRows(rows.map(x => ({ ...x, isMinBonus: x.id === r.id })))}
                      className="w-4 h-4 accent-amber-500 cursor-pointer"
                      aria-label={`Bal ${r.score} minimum bonus balı`}
                    />
                  </div>
                  <div className="col-span-1 text-base font-bold text-foreground tabular-nums">
                    {r.score}
                  </div>
                  {needsMinMax ? (
                    <>
                      <div className="col-span-4">
                        <input type="number" value={mn} onChange={e => updMinMax(r.id, "min", e.target.value)}
                          placeholder="0" className={inputCls} />
                      </div>
                      <div className="col-span-5 flex items-center gap-2">
                        <input type="number" value={mx} onChange={e => updMinMax(r.id, "max", e.target.value)}
                          placeholder="100" className={inputCls} />
                        {selected && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-[11px] font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                            <Star className="w-3 h-3 fill-current" /> Minimum Bonus Balı
                          </span>
                        )}
                      </div>
                      {err && <div className="col-span-12 text-[11px] text-destructive">{err}</div>}
                    </>
                  ) : isTime ? (
                    <>
                      <div className="col-span-4">
                        <input type="date" value={r.timeStart || ""}
                          onChange={e => setRows(rows.map(x => x.id === r.id ? { ...x, timeStart: e.target.value } : x))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-5">
                        <input type="date" value={r.timeEnd || ""}
                          onChange={e => setRows(rows.map(x => x.id === r.id ? { ...x, timeEnd: e.target.value } : x))}
                          className={inputCls} />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-9">
                      <input value={r.description || ""}
                        onChange={e => setRows(rows.map(x => x.id === r.id ? { ...x, description: e.target.value } : x))}
                        placeholder="Bu balı qazanmaq üçün şərt..." className={inputCls} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">Bonus yalnız seçilmiş minimum baldan etibarən hesablanacaq.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border bg-card">Ləğv et</button>
          <button type="button" onClick={save} className="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground flex items-center gap-1">
            <Save className="w-4 h-4" /> Yadda saxla
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// =========================================================
// Summary helpers
// =========================================================
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value || "—"}</span>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/20">
      <div className="px-3 py-1.5 bg-secondary/40 text-xs font-semibold text-foreground border-b border-border">{title}</div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

// =========================================================
// Qiymətləndirici seçim dialoqu — 4 tab (Şəxs / Komanda / Özü / İnteqrasiya)
// =========================================================
const INTEGRATION_SYSTEMS: { name: string; fields: string[] }[] = INTEGRATION_CATALOG.map(s => ({
  name: s.name,
  fields: s.dataFields.map(f => `${f.name} — ${f.description}`),
}));


function EvaluatorPickerDialog({ initialEvaluators, employeeOptions, onClose, onSave, title }: {
  initialEvaluators: WizardEvaluatorRef[];
  employeeOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (evs: WizardEvaluatorRef[]) => void;
  title?: string;
}) {
  const initialTab: "person" | "team" | "structure" | "self" | "integration" = (() => {
    const first = initialEvaluators[0]?.name || "";
    if (first.startsWith("[Komanda]")) return "team";
    if (first.startsWith("[Struktur]")) return "structure";
    if (first === "[Özü]") return "self";
    if (first.startsWith("[İnteqrasiya]")) return "integration";
    return "person";
  })();
  const [tab, setTab] = useState<"person" | "team" | "structure" | "self" | "integration">(initialTab);
  const evaluatorTypeLabels = useCatalogValues("evaluator_types", EVALUATOR_TYPE_DEFAULTS);
  const [personEvs, setPersonEvs] = useState<WizardEvaluatorRef[]>(
    initialTab === "person" ? initialEvaluators : []
  );
  const [personSearch, setPersonSearch] = useState("");
  const filteredEmployeeOptions = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [personSearch, employeeOptions]);
  const teams = useMemo(() => getTeams(), []);
  const [teamName, setTeamName] = useState<string>(
    initialTab === "team" ? (initialEvaluators[0]?.name.replace("[Komanda] ", "").split(" — ")[0] || "") : ""
  );
  const [teamSearch, setTeamSearch] = useState("");
  const [teamMemberEvs, setTeamMemberEvs] = useState<WizardEvaluatorRef[]>(
    initialTab === "team" && initialEvaluators.length > 0 && !initialEvaluators[0].name.startsWith("[Komanda]")
      ? initialEvaluators : []
  );
  const [randomCount, setRandomCount] = useState<number>(1);
  const [teamMemberSearch, setTeamMemberSearch] = useState("");
  const selectedTeam = teams.find(t => t.name === teamName) || null;
  const teamMembers: { name: string }[] = selectedTeam
    ? [{ name: selectedTeam.leader }, ...selectedTeam.members.map(m => ({ name: m.name }))]
    : [];
  const filteredTeamMembers = teamMembers.filter(m => m.name.toLowerCase().includes(teamMemberSearch.toLowerCase()));
  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));
  const toggleTeamMember = (name: string) => {
    setTeamMemberEvs(prev => prev.find(p => p.name === name)
      ? prev.filter(p => p.name !== name)
      : [...prev, { id: crypto.randomUUID(), name, weight: 0 }]);
  };
  const updateTeamMemberWeight = (name: string, w: number) => {
    setTeamMemberEvs(prev => prev.map(p => p.name === name ? { ...p, weight: w } : p));
  };
  const randomPickTeam = () => {
    if (!selectedTeam || teamMembers.length === 0) return;
    const wanted = Math.max(1, Math.min(randomCount || 1, teamMembers.length));
    const pool = [...teamMembers];
    const picked: string[] = [];
    for (let i = 0; i < wanted && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0].name);
    }
    const each = Math.floor(100 / picked.length);
    setTeamMemberEvs(picked.map(n => ({ id: crypto.randomUUID(), name: n, weight: each })));
    toast.success(`Təsadüfi seçildi: ${picked.join(", ")}`);
  };

  // ===== Struktur tab (mirrors Komanda tab) =====
  const structureList = useMemo(() => flattenStructures(getStructures()), []);
  const allEmployees = useMemo(() => getEmployees().filter(e => e.active), []);
  const [structPath, setStructPath] = useState<string>(
    initialTab === "structure" ? (initialEvaluators[0]?.name.replace("[Struktur] ", "").split(" — ")[0] || "") : ""
  );
  const [structSearch, setStructSearch] = useState("");
  const [structMemberEvs, setStructMemberEvs] = useState<WizardEvaluatorRef[]>(
    initialTab === "structure" && initialEvaluators.length > 0 && !initialEvaluators[0].name.startsWith("[Struktur]")
      ? initialEvaluators : []
  );
  const [structRandomCount, setStructRandomCount] = useState<number>(1);
  const [structMemberSearch, setStructMemberSearch] = useState("");
  const structMembers: { name: string }[] = structPath
    ? allEmployees
        .filter(e => (e.structurePath || "").startsWith(structPath))
        .map(e => ({ name: `${e.firstName} ${e.lastName}` }))
    : [];
  const filteredStructMembers = structMembers.filter(m => m.name.toLowerCase().includes(structMemberSearch.toLowerCase()));
  const filteredStructures = structureList.filter(s => s.label.toLowerCase().includes(structSearch.toLowerCase()));
  const toggleStructMember = (name: string) => {
    setStructMemberEvs(prev => prev.find(p => p.name === name)
      ? prev.filter(p => p.name !== name)
      : [...prev, { id: crypto.randomUUID(), name, weight: 0 }]);
  };
  const updateStructMemberWeight = (name: string, w: number) => {
    setStructMemberEvs(prev => prev.map(p => p.name === name ? { ...p, weight: w } : p));
  };
  const randomPickStruct = () => {
    if (!structPath || structMembers.length === 0) return;
    const wanted = Math.max(1, Math.min(structRandomCount || 1, structMembers.length));
    const pool = [...structMembers];
    const picked: string[] = [];
    for (let i = 0; i < wanted && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0].name);
    }
    const each = Math.floor(100 / picked.length);
    setStructMemberEvs(picked.map(n => ({ id: crypto.randomUUID(), name: n, weight: each })));
    toast.success(`Təsadüfi seçildi: ${picked.join(", ")}`);
  };

  type IntegrationSel = { name: string; weight: number; fields: string[] };
  const initialIntegrationSel: IntegrationSel[] = initialTab === "integration"
    ? initialEvaluators
        .filter(e => e.name.startsWith("[İnteqrasiya]"))
        .map(e => {
          const raw = e.name.replace("[İnteqrasiya] ", "");
          const [sysName, fieldsPart] = raw.split(" · ");
          return {
            name: (sysName || "").trim(),
            weight: Number(e.weight) || 0,
            fields: fieldsPart ? fieldsPart.split(", ").map(f => f.trim()).filter(Boolean) : [],
          };
        })
        .filter(s => INTEGRATION_SYSTEMS.some(x => x.name === s.name))
    : [];
  const [integrationSel, setIntegrationSel] = useState<IntegrationSel[]>(initialIntegrationSel);
  const [integrationSearch, setIntegrationSearch] = useState("");
  const filteredIntegrationSystems = INTEGRATION_SYSTEMS.filter(s => s.name.toLowerCase().includes(integrationSearch.toLowerCase()));
  const integrationTotal = integrationSel.reduce((s, x) => s + (Number(x.weight) || 0), 0);
  const integrationWeightValid = integrationSel.length > 0 && integrationTotal === 100;
  const integrationFieldsMissing = integrationSel.some(s => s.fields.length === 0);

  const toggleIntegrationSystem = (name: string) => {
    setIntegrationSel(prev => {
      const exists = prev.some(s => s.name === name);
      const next = exists ? prev.filter(s => s.name !== name) : [...prev, { name, weight: 0, fields: [] }];
      if (next.length === 0) return next;
      // avtomatik bərabər paylaşım
      const base = Math.floor(100 / next.length);
      const rest = 100 - base * next.length;
      return next.map((s, i) => ({ ...s, weight: i === 0 ? base + rest : base }));
    });
  };
  const setIntegrationWeightFor = (name: string, weight: number) =>
    setIntegrationSel(prev => prev.map(s => s.name === name ? { ...s, weight } : s));
  const toggleIntegrationField = (name: string, field: string) =>
    setIntegrationSel(prev => prev.map(s => s.name === name
      ? { ...s, fields: s.fields.includes(field) ? s.fields.filter(f => f !== field) : [...s.fields, field] }
      : s));


  const save = () => {
    if (tab === "person") {
      if (personEvs.length === 0) { toast.error("Ən azı bir qiymətləndirici seçin"); return; }
      if (personEvs.length > 1) {
        const sum = personEvs.reduce((s, e) => s + (Number(e.weight) || 0), 0);
        if (sum !== 100) { toast.error(`Faiz cəmi 100% olmalıdır (hazırda ${sum}%)`); return; }
      }
      onSave(personEvs);
    } else if (tab === "team") {
      if (!teamName) { toast.error("Komanda seçin"); return; }
      if (teamMemberEvs.length === 0) {
        // whole team
        onSave([{ id: crypto.randomUUID(), name: `[Komanda] ${teamName}`, weight: 100 }]);
      } else {
        if (teamMemberEvs.length > 1) {
          const sum = teamMemberEvs.reduce((s, e) => s + (Number(e.weight) || 0), 0);
          if (sum !== 100) { toast.error(`Faiz cəmi 100% olmalıdır (hazırda ${sum}%)`); return; }
        } else {
          teamMemberEvs[0].weight = 100;
        }
        onSave(teamMemberEvs.map(e => ({ ...e, name: `[${teamName}] ${e.name}` })));
      }
    } else if (tab === "structure") {
      if (!structPath) { toast.error("Struktur seçin"); return; }
      if (structMemberEvs.length === 0) {
        onSave([{ id: crypto.randomUUID(), name: `[Struktur] ${structPath}`, weight: 100 }]);
      } else {
        if (structMemberEvs.length > 1) {
          const sum = structMemberEvs.reduce((s, e) => s + (Number(e.weight) || 0), 0);
          if (sum !== 100) { toast.error(`Faiz cəmi 100% olmalıdır (hazırda ${sum}%)`); return; }
        } else {
          structMemberEvs[0].weight = 100;
        }
        onSave(structMemberEvs.map(e => ({ ...e, name: `[${structPath}] ${e.name}` })));
      }
    } else if (tab === "self") {
      onSave([{ id: crypto.randomUUID(), name: "[Özü]", weight: 100 }]);
    } else {
      if (integrationSel.length === 0) { toast.error("Ən azı bir inteqrasiya sistemi seçin"); return; }
      if (integrationFieldsMissing) { toast.error("Hər bir seçilmiş sistem üzrə ən azı bir məlumat seçin"); return; }
      if (integrationTotal !== 100) {
        toast.error(`İnteqrasiya sistemlərinin çəkilərinin cəmi 100% olmalıdır (hazırda ${integrationTotal}%)`);
        return;
      }
      onSave(integrationSel.map(s => ({
        id: crypto.randomUUID(),
        name: `[İnteqrasiya] ${s.name} · ${s.fields.join(", ")}`,
        weight: Number(s.weight) || 0,
      })));
    }

  };

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "person", label: evaluatorTypeLabels[0] ?? "Şəxs" },
    { key: "team", label: evaluatorTypeLabels[1] ?? "Komanda" },
    { key: "structure", label: evaluatorTypeLabels[2] ?? "Struktur" },
    { key: "self", label: evaluatorTypeLabels[3] ?? "Özü" },
    { key: "integration", label: evaluatorTypeLabels[4] ?? "İnteqrasiya" },
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            Qiymətləndirici seçimi — "{title || "Qiymətləndirici seçimi"}"
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border">
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                tab === t.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-[140px] py-2">
          {tab === "person" && (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Qiymətləndirici(lər){personEvs.length > 1 && <span className="text-amber-600"> — faiz cəmi 100%</span>}
              </div>
              <UnifiedEvaluatorsEditor
                employeeOptions={filteredEmployeeOptions}
                evaluators={personEvs}
                onChange={setPersonEvs}
              />
            </div>
          )}
          {tab === "team" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Komanda</label>
                <div className="relative mt-1 mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    placeholder="Komanda axtar..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background"
                  />
                </div>
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y">
                  {filteredTeams.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setTeamName(t.name); setTeamMemberEvs([]); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-secondary ${teamName === t.name ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium" : ""}`}
                    >
                      <span>{t.name}</span>
                      {teamName === t.name && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                  {filteredTeams.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nəticə yoxdur</div>
                  )}
                </div>
              </div>
              {selectedTeam && (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Üzvlər ({teamMembers.length})</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-muted-foreground">Say:</label>
                      <input
                        type="number"
                        min={1}
                        max={teamMembers.length}
                        value={randomCount}
                        onChange={e => setRandomCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-14 px-2 py-1 text-xs border border-border rounded bg-background"
                      />
                      <button type="button" onClick={randomPickTeam} className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-secondary">
                        <Shuffle className="w-3 h-3" /> Təsadüfi
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={teamMemberSearch}
                      onChange={e => setTeamMemberSearch(e.target.value)}
                      placeholder="Üzv axtar..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background"
                    />
                  </div>
                  <div className="border border-border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {filteredTeamMembers.map(m => {
                      const sel = teamMemberEvs.find(p => p.name === m.name);
                      return (
                        <div key={m.name} className="flex items-center gap-2 p-2">
                          <input type="checkbox" checked={!!sel} onChange={() => toggleTeamMember(m.name)} />
                          <span className="flex-1 text-sm">{m.name}</span>
                          {sel && (
                            <div className="flex items-center gap-1">
                              <WeightInput value={sel.weight} onChange={n => updateTeamMemberWeight(m.name, n)} className="w-16 !px-2 !py-1 text-xs" />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredTeamMembers.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Üzv tapılmadı</div>
                    )}
                  </div>
                  {teamMemberEvs.length > 1 && (
                    <div className="text-xs text-muted-foreground">
                      Toplam ağırlıq: {teamMemberEvs.reduce((s, p) => s + (Number(p.weight) || 0), 0)}%
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Heç bir üzv seçilməsə, komandanın bütün üzvləri qiymətləndirici sayılacaq.</p>
                </>
              )}
            </div>
          )}
          {tab === "structure" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Struktur</label>
                <div className="relative mt-1 mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={structSearch}
                    onChange={e => setStructSearch(e.target.value)}
                    placeholder="Struktur axtar..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background"
                  />
                </div>
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y">
                  {filteredStructures.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setStructPath(s.label); setStructMemberEvs([]); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-secondary ${structPath === s.label ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium" : ""}`}
                    >
                      <span className="truncate">{s.label}</span>
                      {structPath === s.label && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                  {filteredStructures.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nəticə yoxdur</div>
                  )}
                </div>
              </div>
              {structPath && (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Əməkdaşlar ({structMembers.length})</span>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-muted-foreground">Say:</label>
                      <input
                        type="number"
                        min={1}
                        max={structMembers.length}
                        value={structRandomCount}
                        onChange={e => setStructRandomCount(Math.max(1, Number(e.target.value) || 1))}
                        className="w-14 px-2 py-1 text-xs border border-border rounded bg-background"
                      />
                      <button type="button" onClick={randomPickStruct} className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-secondary">
                        <Shuffle className="w-3 h-3" /> Təsadüfi
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={structMemberSearch}
                      onChange={e => setStructMemberSearch(e.target.value)}
                      placeholder="Əməkdaş axtar..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background"
                    />
                  </div>
                  <div className="border border-border rounded-lg divide-y max-h-60 overflow-y-auto">
                    {filteredStructMembers.map(m => {
                      const sel = structMemberEvs.find(p => p.name === m.name);
                      return (
                        <div key={m.name} className="flex items-center gap-2 p-2">
                          <input type="checkbox" checked={!!sel} onChange={() => toggleStructMember(m.name)} />
                          <span className="flex-1 text-sm">{m.name}</span>
                          {sel && (
                            <div className="flex items-center gap-1">
                              <WeightInput value={sel.weight} onChange={n => updateStructMemberWeight(m.name, n)} className="w-16 !px-2 !py-1 text-xs" />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredStructMembers.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Əməkdaş tapılmadı</div>
                    )}
                  </div>
                  {structMemberEvs.length > 1 && (
                    <div className="text-xs text-muted-foreground">
                      Toplam ağırlıq: {structMemberEvs.reduce((s, p) => s + (Number(p.weight) || 0), 0)}%
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Heç bir əməkdaş seçilməsə, strukturun bütün əməkdaşları qiymətləndirici sayılacaq.</p>
                </>
              )}
            </div>
          )}
          {tab === "self" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-sm text-foreground">
              Bu hədəfi <strong>əməkdaşın özü</strong> qiymətləndirəcək (self-evaluation).
            </div>
          )}
          {tab === "integration" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Növ</label>
                <div className="mt-1 px-2.5 py-1.5 text-sm border border-border rounded bg-muted/40 text-foreground">
                  İnteqrasiya
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">İnteqrasiya sistemləri (bir və ya bir neçə)</label>
                <div className="relative mt-1 mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={integrationSearch}
                    onChange={e => setIntegrationSearch(e.target.value)}
                    placeholder="Sistem axtar..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded bg-background"
                  />
                </div>
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto divide-y">
                  {filteredIntegrationSystems.map(s => {
                    const sel = integrationSel.find(x => x.name === s.name);
                    return (
                      <div key={s.name} className={`flex items-center gap-2 px-3 py-2 text-sm ${sel ? "bg-indigo-50/60 dark:bg-indigo-500/10" : ""}`}>
                        <input type="checkbox" checked={!!sel} onChange={() => toggleIntegrationSystem(s.name)} />
                        <button type="button" onClick={() => toggleIntegrationSystem(s.name)} className="flex-1 text-left">
                          {s.name}
                        </button>
                        {sel && (
                          <div className="flex items-center gap-1">
                            <WeightInput value={sel.weight} onChange={n => setIntegrationWeightFor(s.name, n)} className="w-16 !px-2 !py-1 text-xs" />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredIntegrationSystems.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nəticə yoxdur</div>
                  )}
                </div>
              </div>

              {integrationSel.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Mübadilə edilə bilən məlumatlar</label>
                  {integrationSel.map(sel => {
                    const sys = INTEGRATION_SYSTEMS.find(s => s.name === sel.name);
                    if (!sys) return null;
                    return (
                      <div key={sel.name} className="border border-border rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-muted/40 text-xs font-medium flex items-center justify-between">
                          <span>{sel.name}</span>
                          <span className="text-muted-foreground">{sel.weight || 0}%</span>
                        </div>
                        <div className="divide-y">
                          {sys.fields.map(f => {
                            const checked = sel.fields.includes(f);
                            return (
                              <label key={f} className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-secondary/50">
                                <input type="checkbox" checked={checked} onChange={() => toggleIntegrationField(sel.name, f)} />
                                <span>{f}</span>
                              </label>
                            );
                          })}
                        </div>
                        {sel.fields.length === 0 && (
                          <div className="px-3 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                            Bu sistem üzrə ən azı bir məlumat seçin
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {integrationSel.length > 0 && (
                <div className={`rounded-lg border px-3 py-2 text-xs ${integrationWeightValid
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
                  Çəkilərin cəmi: <strong>{integrationTotal}%</strong>
                  {!integrationWeightValid && (
                    <span> — cəm mütləq 100% olmalıdır ({integrationTotal > 100 ? "azaldın" : "artırın"}).</span>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded border border-border bg-card">Ləğv et</button>
          <button
            type="button"
            onClick={save}
            disabled={tab === "integration" && (integrationSel.length === 0 || !integrationWeightValid || integrationFieldsMissing)}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >Yadda saxla</button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
