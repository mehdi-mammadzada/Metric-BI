import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getEmployees, type OrgEmployee } from "@/lib/orgStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Əvvəlki review iştirakçıları — id siyahısı. Boş və ya undefined ola bilər. */
  previousParticipantIds?: string[];
  /** Əvvəlki review-ləri keçirən şəxslərin adları (id olmadıqda ad üzrə uyğunlaşdırılır). */
  previousParticipantNames?: string[];
  onCreate: (payload: { start: string; end: string; participantIds: string[]; reviewerNames: string[] }) => void;
}

type Mode = "previous" | "new";

const initials = (e: OrgEmployee) =>
  `${(e.firstName || "").charAt(0)}${(e.lastName || "").charAt(0)}`.toUpperCase();

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

const normalizePersonName = (value: string) =>
  String(value || "")
    .split("·")[0]
    .split("—")[0]
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const NewReviewDialog = ({ open, onOpenChange, previousParticipantIds, previousParticipantNames, onCreate }: Props) => {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mode, setMode] = useState<Mode>("previous");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const activeEmployees = useMemo(
    () => getEmployees().filter(e => e.active !== false),
    [open],
  );

  const prevList = useMemo(() => {
    const ids = new Set((previousParticipantIds || []).map(String));
    const names = new Set(
      (previousParticipantNames || [])
        .map(normalizePersonName)
        .filter(Boolean),
    );
    if (ids.size === 0 && names.size === 0) return [];
    return activeEmployees.filter(e => {
      if (ids.has(String(e.id))) return true;
      const full = normalizePersonName(`${e.firstName || ""} ${e.lastName || ""}`);
      const rev = normalizePersonName(`${e.lastName || ""} ${e.firstName || ""}`);
      return names.has(full) || names.has(rev);
    });
  }, [previousParticipantIds, previousParticipantNames, activeEmployees]);

  const hasPrevious = prevList.length > 0;

  // Reset on open
  useEffect(() => {
    if (open) {
      setStart(""); setEnd(""); setQuery("");
      if (hasPrevious) {
        setMode("previous");
        setSelected(new Set(prevList.map(e => String(e.id))));
      } else {
        setMode("new");
        setSelected(new Set());
      }
    }
  }, [open, hasPrevious, prevList]);

  useEffect(() => {
    if (mode === "previous") {
      setSelected(new Set(prevList.map(e => String(e.id))));
    } else {
      setSelected(new Set());
    }
    setQuery("");
  }, [mode, prevList]);

  const listForMode: OrgEmployee[] = mode === "previous" ? prevList : activeEmployees;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return listForMode;
    return listForMode.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q),
    );
  }, [listForMode, query]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const endInvalid = start && end && new Date(end) < new Date(start);
  const canCreate = !!start && !!end && !endInvalid && selected.size > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const participantIds = Array.from(selected);
    const selectedNames = activeEmployees
      .filter(e => selected.has(String(e.id)))
      .map(e => `${e.firstName} ${e.lastName}`.trim())
      .filter(Boolean);
    onCreate({ start, end, participantIds, reviewerNames: selectedNames });
    onOpenChange(false);
  };

  const previewList = filtered;

  const avatarClass = (id: string) => {
    const n = Array.from(String(id)).reduce((a, c) => a + c.charCodeAt(0), 0);
    return AVATAR_COLORS[n % AVATAR_COLORS.length];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-semibold">Yeni Review yarat</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tarixlər */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rv-start" className="text-sm">
                Review başlanma tarixi <span className="text-destructive">*</span>
              </Label>
              <Input id="rv-start" type="date" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-end" className="text-sm">
                Review bitmə tarixi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rv-end"
                type="date"
                value={end}
                min={start || undefined}
                onChange={e => setEnd(e.target.value)}
              />
              {endInvalid && (
                <p className="text-[11px] text-destructive">Bitmə tarixi başlanma tarixindən əvvəl ola bilməz.</p>
              )}
            </div>
          </div>

          {/* Əməkdaş seçimi */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Əməkdaş seçimi</h3>
            <RadioGroup value={mode} onValueChange={v => setMode(v as Mode)} className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <RadioGroupItem value="previous" id="mode-prev" disabled={!hasPrevious} />
                <span className={`text-sm ${!hasPrevious ? "text-muted-foreground" : ""}`}>
                  Əvvəlki review iştirakçılarını avtomatik istifadə et
                </span>
                <Badge variant="secondary" className="text-[11px]">
                  {prevList.length} nəfər
                </Badge>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <RadioGroupItem value="new" id="mode-new" />
                <span className="text-sm">Yeni əməkdaş seç</span>
              </label>
            </RadioGroup>
          </div>

          <div className="border-t border-border" />

          {/* Siyahı */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {mode === "previous" ? "Seçilmiş əməkdaşlar" : "Əməkdaşlar"}
              </h3>
              <Badge variant="secondary" className="text-[11px]">
                {mode === "previous"
                  ? `${selected.size} nəfər seçilib`
                  : `Seçilmiş: ${selected.size} nəfər`}
              </Badge>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={mode === "previous" ? "Axtar..." : "İşçi adı və ya soyadı ilə axtar..."}
                className="pl-9"
              />
            </div>

            <div className="border border-border rounded-md">
              <div className="max-h-72 overflow-y-auto">
                <ul className="divide-y divide-border">
                  {previewList.length === 0 && (
                    <li className="p-4 text-center text-sm text-muted-foreground">
                      Əməkdaş tapılmadı
                    </li>
                  )}
                  {previewList.map(e => {
                    const id = String(e.id);
                    const checked = selected.has(id);
                    return (
                      <li key={id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(id)}
                          aria-label={`${e.firstName} ${e.lastName}`}
                        />
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarClass(id)}`}>
                          {initials(e)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {e.firstName} {e.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {e.positionName || "—"}
                          </p>
                        </div>
                        {checked && (
                          <button
                            type="button"
                            onClick={() => remove(id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md"
                            aria-label="Sil"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
          <Button onClick={handleCreate} disabled={!canCreate}>Yarat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewReviewDialog;
