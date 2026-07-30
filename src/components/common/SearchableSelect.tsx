import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  group?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: SearchableOption[] | string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  /** Kompakt ölçü (kiçik formalar üçün) */
  size?: "sm" | "md";
}

const normalize = (o: SearchableOption | string): SearchableOption =>
  typeof o === "string" ? { value: o, label: o } : o;

const PANEL_MAX_H = 288; // search + list

const SearchableSelect = ({ value, onChange, options, placeholder = "Seçin", disabled, className = "", allowClear = false, size = "md" }: Props) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number }>({ top: 0, left: 0, width: 0, maxH: PANEL_MAX_H });

  const opts = useMemo(() => options.map(normalize), [options]);
  const filtered = useMemo(() => {
    const lower = q.toLowerCase();
    return opts.filter(o => o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower));
  }, [opts, q]);

  const current = opts.find(o => o.value === value);

  // Dropdown həmişə düzgün istiqamətdə açılsın: aşağıda yer varsa aşağı,
  // yoxdursa yuxarı — hər iki halda ekran sərhədləri daxilində.
  const reposition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const gap = 4;
    const spaceBelow = vh - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxH = Math.max(160, Math.min(PANEL_MAX_H, openUp ? spaceAbove : spaceBelow));
    const width = r.width;
    const left = Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8));
    const top = openUp ? r.top - gap - maxH : r.bottom + gap;
    setPos({ top, left, width, maxH });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, reposition]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) {
      document.addEventListener("mousedown", h);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); };

  // Radix Dialog/Popover focus-trap-larından qaçmaq üçün paneli ən yaxın
  // dialog/popover konteynerinə portal edirik — əks halda search input-a yazmaq olmur.
  const portalTarget = (() => {
    if (typeof document === "undefined") return null;
    const host = ref.current?.closest("[role='dialog'], [data-radix-popper-content-wrapper]") as HTMLElement | null;
    return host ?? document.body;
  })();

  const btnCls = size === "sm"
    ? "w-full min-h-[32px] px-2 py-1.5 text-xs"
    : "w-full min-h-[38px] px-3 py-2 text-sm";


  const row = (o: SearchableOption) => (
    <div key={o.value} onClick={() => pick(o.value)}
      className={`px-3 py-1.5 text-sm cursor-pointer flex items-center justify-between hover:bg-secondary ${o.value === value ? "bg-primary/5" : ""}`}>
      <span className="truncate">{o.label}</span>
      {o.value === value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
    </div>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`${btnCls} border border-border rounded-lg bg-background flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={current ? "text-foreground truncate" : "text-muted-foreground truncate"}>{current?.label || placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {allowClear && current && (
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); onChange(""); }} />
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH, pointerEvents: "auto" }}
          className="z-[200] bg-card border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onFocus={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >

          <div className="p-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key !== "Escape") e.stopPropagation(); }}
                onKeyUp={e => e.stopPropagation()}
                onKeyPress={e => e.stopPropagation()}
                placeholder="Axtar..."
                className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded bg-background"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain py-1">

            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">Nəticə yoxdur</div>
            ) : (
              (() => {
                const hasGroups = filtered.some(o => o.group);
                if (!hasGroups) return filtered.map(row);
                const groups: Record<string, SearchableOption[]> = {};
                filtered.forEach(o => { const g = o.group || "Digər"; (groups[g] = groups[g] || []).push(o); });
                return Object.entries(groups).map(([g, list]) => (
                  <div key={g}>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold bg-secondary/40">{g}</div>
                    {list.map(row)}
                  </div>
                ));
              })()
            )}
          </div>
        </div>,
        portalTarget ?? document.body,
      )}
    </div>
  );
};

export default SearchableSelect;
