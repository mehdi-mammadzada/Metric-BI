import { useCallback, useEffect, useState } from "react";
import { Info, Loader2, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  addKpiComment,
  deleteKpiComment,
  fetchKpiComments,
  formatCommentDate,
  getCachedComments,
  KPI_COMMENTS_EVT,
  type KpiComment,
} from "@/lib/kpiCommentsService";


export const KPI_EXTRA_TABS = [
  ["comments", "Şərhlər"],
] as const;

export type KpiExtraTabKey = typeof KPI_EXTRA_TABS[number][0];

export const isExtraTab = (t: string): t is KpiExtraTabKey =>
  KPI_EXTRA_TABS.some(([k]) => k === t);

interface Props {
  kpi: { id?: number | string; name: string; target?: string | number; current?: string | number; unit?: string; progress: number };
  tab: KpiExtraTabKey;
}

export default function KpiExtraTabContent({ kpi, tab }: Props) {
  if (tab === "comments") return <Comments cardId={kpi.id} />;
  return null;
}

// ================= Şərhlər (per-card, database-persisted) =================

function Comments({ cardId }: { cardId?: number | string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<KpiComment[]>(() => getCachedComments(cardId));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const reload = useCallback(async () => {
    if (cardId == null) return;
    setLoading(true);
    const rows = await fetchKpiComments(cardId);
    setItems(rows);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    setItems(getCachedComments(cardId));
    void reload();
    const onCache = () => setItems(getCachedComments(cardId));
    window.addEventListener(KPI_COMMENTS_EVT, onCache);
    window.addEventListener("storage", onCache);
    return () => {
      window.removeEventListener(KPI_COMMENTS_EVT, onCache);
      window.removeEventListener("storage", onCache);
    };
  }, [cardId, reload]);

  const add = async () => {
    if (!text.trim() || cardId == null || saving) return;
    setSaving(true);
    const res = await addKpiComment(cardId, text, {
      organizationId: user?.currentOrgId,
      userId: user?.supabaseUserId,
      authorName: user?.name,
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Şərh yadda saxlanılmadı", description: res.error, variant: "destructive" });
      return;
    }
    setItems(res.rows);
    setText("");
  };

  const remove = async (id: string) => {
    if (cardId == null) return;
    setItems(await deleteKpiComment(cardId, id));
  };

  const initial = (name: string) => (name || "?").trim().charAt(0).toUpperCase();
  const availableAuthors = Array.from(new Set(items.map(c => c.author).filter(Boolean)));
  const filtered = items.filter(c => {
    if (filterAuthor && c.author !== filterAuthor) return false;
    if (filterDate && !formatCommentDate(c.createdAt).includes(filterDate.split("-").reverse().join("."))) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Şərhlər</h3>
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">{initial(user?.name || "")}</div>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Qeyd əlavə et..." className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <button onClick={() => void add()} disabled={saving || !text.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Qeyd əlavə et
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-border bg-background text-foreground"
        >
          <option value="">Bütün müəlliflər</option>
          {availableAuthors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-border bg-background text-foreground"
        />
        {(filterAuthor || filterDate) && (
          <button
            type="button"
            onClick={() => { setFilterAuthor(""); setFilterDate(""); }}
            className="text-xs px-2 py-1.5 rounded border border-border bg-background text-muted-foreground hover:text-foreground"
          >
            Sıfırla
          </button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-8 border border-dashed border-border rounded-lg text-sm text-muted-foreground">
            {loading ? "Yüklənir..." : items.length === 0 ? "Hələ heç bir şərh yoxdur." : "Filtrə uyğun şərh tapılmadı."}
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${c.author === user?.name ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{initial(c.author)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.author}</p>
                  <p className="text-[11px] text-muted-foreground">{formatCommentDate(c.createdAt)}</p>
                </div>
                {c.author === user?.name && (
                  <button onClick={() => void remove(c.id)} className="p-1 rounded hover:bg-secondary" title="Sil">
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground mt-1 break-words">{c.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-secondary/40 border border-border rounded-lg p-3 flex gap-2">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Qeyd: </span>Şərhlər yalnız bu KPI ilə bağlı daxili qeydlər üçün nəzərdə tutulub.</p>
      </div>
    </div>
  );
}
