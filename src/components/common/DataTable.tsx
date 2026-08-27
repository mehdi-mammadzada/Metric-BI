import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search, Columns, ChevronDown, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdvancedFilter, evaluateAdvFilter, type AdvFilterState } from "./AdvancedFilter";

export type FilterType = "text" | "number" | "date" | "select" | "none";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  width?: number;
  filterType?: FilterType;
  selectOptions?: string[];
  /** value used for filtering & default rendering */
  accessor?: (row: T) => string | number | Date | null | undefined;
  /** custom cell renderer */
  render?: (row: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  emptyMessage?: string;
  /** persist column order / widths / filters in localStorage */
  storageKey?: string;
  initialFontSize?: number;
  initialRowsPerPage?: number;
  initialColWidth?: number;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  /** include row number column at the start */
  showRowNumbers?: boolean;
  rowNumberLabel?: string;
  /** if provided, each row is expandable via a chevron and this returns the details cell content */
  renderExpandedRow?: (row: T) => React.ReactNode | null;
  /** keep the supplied column sequence and disable drag reordering */
  lockColumnOrder?: boolean;
}

interface NumberFilter { op: "eq" | "lt" | "gt" | "between"; a: string; b: string; }
interface DateFilter { from: string; to: string; }

type FilterValue = string | NumberFilter | DateFilter;

const Stepper = ({
  label, value, setValue, min = 1, max = 100, step = 1,
}: { label: string; value: number; setValue: (n: number) => void; min?: number; max?: number; step?: number }) => (
  <div className="flex items-center gap-1">
    <span>{label}:</span>
    <button
      type="button"
      className="w-6 h-6 inline-flex items-center justify-center rounded border border-border bg-background hover:bg-secondary/60"
      onClick={() => setValue(Math.max(min, value - step))}
    >−</button>
    <span className="min-w-[2.5rem] text-center font-medium text-foreground">{value}</span>
    <button
      type="button"
      className="w-6 h-6 inline-flex items-center justify-center rounded border border-border bg-background hover:bg-secondary/60"
      onClick={() => setValue(Math.min(max, value + step))}
    >+</button>
  </div>
);

const toText = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

const toNumber = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
};

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyMessage = "Məlumat yoxdur",
  storageKey,
  initialFontSize = 14,
  initialRowsPerPage = 10,
  initialColWidth = 150,
  toolbarLeft,
  toolbarRight,
  showRowNumbers = true,
  rowNumberLabel = "№",
  renderExpandedRow,
  lockColumnOrder = false,
}: DataTableProps<T>) {
  const [expandedKey, setExpandedKey] = useState<string | number | null>(null);
  // ----- persisted settings -----
  const loadPersist = <V,>(k: string, fallback: V): V => {
    if (!storageKey) return fallback;
    try {
      const raw = localStorage.getItem(`${storageKey}:${k}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return fallback;
  };
  const persist = (k: string, val: unknown) => {
    if (!storageKey) return;
    try { localStorage.setItem(`${storageKey}:${k}`, JSON.stringify(val)); } catch {}
  };

  const initialOrder = useMemo(
    () => loadPersist<string[]>("order", columns.map(c => c.key)).filter(k => columns.some(c => c.key === k))
      .concat(columns.map(c => c.key).filter(k => !loadPersist<string[]>("order", columns.map(c => c.key)).includes(k))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns.length, storageKey]
  );

  const [fontSize, setFontSize] = useState<number>(() => loadPersist("fontSize", initialFontSize));
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => loadPersist("rpp", initialRowsPerPage));
  const [defaultColWidth, setDefaultColWidth] = useState<number>(() => loadPersist("cw", initialColWidth));
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => loadPersist("widths", {}));
  const [colOrder, setColOrder] = useState<string[]>(initialOrder);
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>(
    () => loadPersist<Record<string, boolean>>("visible", Object.fromEntries(columns.map(c => [c.key, true])))
  );
  const [openSearch, setOpenSearch] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [advFilter, setAdvFilter] = useState<AdvFilterState>(
    () => loadPersist<AdvFilterState>("adv", { logic: "AND", rows: [] })
  );
  const [page, setPage] = useState(1);
  const [dragCol, setDragCol] = useState<string | null>(null);

  useEffect(() => persist("fontSize", fontSize), [fontSize]);
  useEffect(() => persist("rpp", rowsPerPage), [rowsPerPage]);
  useEffect(() => persist("cw", defaultColWidth), [defaultColWidth]);
  useEffect(() => persist("widths", colWidths), [colWidths]);
  useEffect(() => persist("order", colOrder), [colOrder]);
  useEffect(() => persist("visible", visibleCols), [visibleCols]);
  useEffect(() => persist("adv", advFilter), [advFilter]);
  useEffect(() => { setPage(1); }, [filters, advFilter, rowsPerPage, rows.length]);

  const colByKey = useMemo(() => Object.fromEntries(columns.map(c => [c.key, c])), [columns]);
  const orderedVisible = (lockColumnOrder ? columns.map(c => c.key) : colOrder)
    .map(k => colByKey[k])
    .filter((c): c is DataTableColumn<T> => !!c && visibleCols[c.key] !== false);

  const getColWidth = (k: string) => colWidths[k] ?? colByKey[k]?.width ?? defaultColWidth;

  const toggleColSearch = (key: string) => {
    setOpenSearch(s => {
      const next = { ...s, [key]: !s[key] };
      if (!next[key]) setFilters(f => { const n = { ...f }; delete n[key]; return n; });
      return next;
    });
  };

  // ----- filtering -----
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      for (const c of columns) {
        const fv = filters[c.key];
        if (fv == null || fv === "") continue;
        const type: FilterType = c.filterType ?? "text";
        const raw = c.accessor ? c.accessor(row) : undefined;
        if (type === "text") {
          const q = String(fv).trim().toLowerCase();
          if (!q) continue;
          if (!toText(raw).toLowerCase().includes(q)) return false;
        } else if (type === "select") {
          const q = String(fv).trim().toLowerCase();
          if (!q || q === "all") continue;
          if (toText(raw).toLowerCase() !== q) return false;
        } else if (type === "number") {
          const nf = fv as NumberFilter;
          const num = toNumber(raw);
          if (num == null) return false;
          const a = nf.a !== "" ? Number(nf.a) : null;
          const b = nf.b !== "" ? Number(nf.b) : null;
          if (nf.op === "eq" && a != null && num !== a) return false;
          if (nf.op === "lt" && a != null && !(num < a)) return false;
          if (nf.op === "gt" && a != null && !(num > a)) return false;
          if (nf.op === "between" && a != null && b != null && !(num >= a && num <= b)) return false;
        } else if (type === "date") {
          const df = fv as DateFilter;
          const d = toDate(raw);
          if (!d) return false;
          if (df.from && d < new Date(df.from)) return false;
          if (df.to && d > new Date(df.to + "T23:59:59")) return false;
        }
      }
      return true;
    });
  }, [rows, filters, columns]);

  const advFilteredRows = useMemo(
    () => evaluateAdvFilter(filteredRows, columns, advFilter),
    [filteredRows, columns, advFilter]
  );

  // pagination
  const totalRows = advFilteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pagedRows = advFilteredRows.slice(startIdx, startIdx + rowsPerPage);

  // resize
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = getColWidth(key);
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(60, startW + (ev.clientX - startX));
      setColWidths(cw => ({ ...cw, [key]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // reorder
  const onDragStartCol = (key: string) => setDragCol(key);
  const onDropCol = (target: string) => {
    if (!dragCol || dragCol === target) { setDragCol(null); return; }
    setColOrder(order => {
      const next = order.filter(k => k !== dragCol);
      const idx = next.indexOf(target);
      next.splice(idx, 0, dragCol);
      return next;
    });
    setDragCol(null);
  };

  // search popover content per type
  const renderFilterInput = (c: DataTableColumn<T>) => {
    const type: FilterType = c.filterType ?? "text";
    if (type === "text") {
      const v = (filters[c.key] as string) || "";
      return (
        <input
          autoFocus
          type="text"
          placeholder="axtar..."
          value={v}
          onChange={(e) => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
          className="mt-2 w-full px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      );
    }
    if (type === "select") {
      const v = (filters[c.key] as string) || "all";
      return (
        <select
          autoFocus
          value={v}
          onChange={(e) => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
          className="mt-2 w-full px-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Hamısı</option>
          {(c.selectOptions || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (type === "number") {
      const nf = (filters[c.key] as NumberFilter) || { op: "eq", a: "", b: "" };
      return (
        <div className="mt-2 flex flex-col gap-1">
          <select
            value={nf.op}
            onChange={(e) => setFilters(f => ({ ...f, [c.key]: { ...nf, op: e.target.value as NumberFilter["op"] } }))}
            className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
          >
            <option value="eq">=</option>
            <option value="lt">{'<'}</option>
            <option value="gt">{'>'}</option>
            <option value="between">aralıq</option>
          </select>
          <div className="flex gap-1">
            <input
              type="number"
              value={nf.a}
              placeholder={nf.op === "between" ? "min" : "dəyər"}
              onChange={(e) => setFilters(f => ({ ...f, [c.key]: { ...nf, a: e.target.value } }))}
              className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
            />
            {nf.op === "between" && (
              <input
                type="number"
                value={nf.b}
                placeholder="max"
                onChange={(e) => setFilters(f => ({ ...f, [c.key]: { ...nf, b: e.target.value } }))}
                className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
              />
            )}
          </div>
        </div>
      );
    }
    if (type === "date") {
      const df = (filters[c.key] as DateFilter) || { from: "", to: "" };
      return (
        <div className="mt-2 flex flex-col gap-1">
          <input
            type="date"
            value={df.from}
            onChange={(e) => setFilters(f => ({ ...f, [c.key]: { ...df, from: e.target.value } }))}
            className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
          />
          <input
            type="date"
            value={df.to}
            onChange={(e) => setFilters(f => ({ ...f, [c.key]: { ...df, to: e.target.value } }))}
            className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {(toolbarLeft || toolbarRight || true) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Columns className="w-4 h-4" /> Sütunlar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2">
                <div className="space-y-1">
                  {columns.map(c => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                      <Checkbox
                        checked={visibleCols[c.key] !== false}
                        onCheckedChange={(v) => setVisibleCols(s => ({ ...s, [c.key]: !!v }))}
                      />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <AdvancedFilter columns={columns} value={advFilter} onChange={setAdvFilter} />
            {toolbarLeft}
          </div>
          {toolbarRight}
        </div>
      )}

      {/* Density controls */}
      <div className="flex flex-wrap items-center gap-4 px-3 py-2 border-b border-border text-xs text-muted-foreground bg-secondary/20">
        <Stepper label="Şrift ölçüsü" value={fontSize} setValue={setFontSize} min={10} max={24} />
        <Stepper label="Sətir sayı" value={rowsPerPage} setValue={setRowsPerPage} min={5} max={100} step={5} />
        <Stepper label="Sütun eni" value={defaultColWidth} setValue={setDefaultColWidth} min={80} max={400} step={10} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: `${fontSize}px`, tableLayout: "fixed" }}>
          <thead className="bg-secondary/40">
            <tr className="text-left text-muted-foreground">
              {renderExpandedRow && (
                <th className="px-2 py-3 font-medium align-top" style={{ width: 36, minWidth: 36 }}></th>
              )}
              {showRowNumbers && (
                <th className="px-3 py-3 font-medium align-top" style={{ width: 64, minWidth: 64 }}>{rowNumberLabel}</th>
              )}
              {orderedVisible.map(c => (
                <th
                  key={c.key}
                   draggable={!lockColumnOrder}
                   onDragStart={() => !lockColumnOrder && onDragStartCol(c.key)}
                   onDragOver={(e) => { if (!lockColumnOrder) e.preventDefault(); }}
                   onDrop={() => !lockColumnOrder && onDropCol(c.key)}
                   className={`relative px-3 py-3 font-medium align-top select-none ${lockColumnOrder ? "" : "cursor-grab active:cursor-grabbing"} ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}
                  style={{ width: `${getColWidth(c.key)}px`, minWidth: `${getColWidth(c.key)}px` }}
                >
                  <div className={`flex items-center gap-1 ${c.align === "right" ? "justify-end" : c.align === "center" ? "justify-center" : ""}`}>
                    {(c.filterType ?? "text") !== "none" && (
                      <button
                        type="button"
                        onClick={() => toggleColSearch(c.key)}
                        className={`p-0.5 rounded hover:bg-secondary ${openSearch[c.key] ? "text-primary" : "opacity-60"}`}
                        title="Filtr"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="truncate">{c.label}</span>
                  </div>
                  {openSearch[c.key] && (c.filterType ?? "text") !== "none" && renderFilterInput(c)}
                  <span
                    onMouseDown={(e) => startResize(c.key, e)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                    title="Sütunu enləndir"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={orderedVisible.length + (showRowNumbers ? 1 : 0) + (renderExpandedRow ? 1 : 0)} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : pagedRows.map((row, idx) => {
              const k = rowKey(row);
              const isOpen = expandedKey === k;
              return (
                <Fragment key={k}>
                  <tr className="border-t border-border hover:bg-secondary/30">
                    {renderExpandedRow && (
                      <td className="px-2 py-2 align-top" style={{ width: 36, minWidth: 36 }}>
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isOpen ? null : k)}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground"
                          aria-label={isOpen ? "Bağla" : "Aç"}
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    {showRowNumbers && (
                      <td className="px-3 py-2 text-muted-foreground" style={{ width: 64, minWidth: 64 }}>
                        {startIdx + idx + 1}
                      </td>
                    )}
                    {orderedVisible.map(c => (
                      <td
                        key={c.key}
                        className={`px-3 py-2 truncate ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.className ?? ""}`}
                        style={{ width: `${getColWidth(c.key)}px`, minWidth: `${getColWidth(c.key)}px` }}
                      >
                        {c.render ? c.render(row, startIdx + idx) : toText(c.accessor?.(row))}
                      </td>
                    ))}
                  </tr>
                  {renderExpandedRow && isOpen && (
                    <tr key={`${k}-exp`} className="bg-secondary/20 border-t border-border">
                      <td colSpan={orderedVisible.length + (showRowNumbers ? 1 : 0) + 1} className="px-4 py-3">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalRows > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs">
          <div className="text-muted-foreground space-y-0.5">
            <div>Mövcud aralıq: <span className="font-semibold text-foreground">{startIdx + 1} - {Math.min(startIdx + rowsPerPage, totalRows)}</span></div>
            <div>Ümumi say: <span className="font-semibold text-foreground">{totalRows}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Səhifə:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={safePage}
              onChange={(e) => {
                const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                setPage(v);
              }}
              className="w-14 px-2 py-1 rounded-md border border-border bg-background text-center"
            />
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary/60 disabled:opacity-40"
            >‹</button>
            <span className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">{safePage}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-secondary/60 disabled:opacity-40"
            >›</button>
          </div>
        </div>
      )}
    </div>
  );
}
