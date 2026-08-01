import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/**
 * Daimi (bazada saxlanılan) şərh axını. `refId` — şərhlərin bağlandığı obyekt
 * (KPI kartı id-si, hədəf id-si və s.). Refresh / yeni giriş / digər cihazlarda
 * eyni şərhlər görünür.
 */
export default function KpiCommentThread({ refId, placeholder = "Şərhinizi yazın..." }: { refId?: string | number | null; placeholder?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<KpiComment[]>(() => getCachedComments(refId));
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    if (refId == null) return;
    setLoading(true);
    setItems(await fetchKpiComments(refId));
    setLoading(false);
  }, [refId]);

  useEffect(() => {
    setItems(getCachedComments(refId));
    void reload();
    const onCache = () => setItems(getCachedComments(refId));
    window.addEventListener(KPI_COMMENTS_EVT, onCache);
    window.addEventListener("storage", onCache);
    return () => {
      window.removeEventListener(KPI_COMMENTS_EVT, onCache);
      window.removeEventListener("storage", onCache);
    };
  }, [refId, reload]);

  const send = async () => {
    if (!draft.trim() || refId == null || saving) return;
    setSaving(true);
    const res = await addKpiComment(refId, draft, {
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
    setDraft("");
    toast({ title: "Şərh əlavə edildi" });
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest" }));
  };

  const remove = async (id: string) => {
    if (refId == null) return;
    setItems(await deleteKpiComment(refId, id));
  };

  // Ən köhnədən ən yeniyə (chat sırası)
  const ordered = [...items].reverse();

  return (
    <>
      <div className="space-y-2.5">
        {ordered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
            {loading ? "Yüklənir..." : "Hələ heç bir şərh yoxdur."}
          </p>
        )}
        {ordered.map(c => (
          <div key={c.id} className="flex gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex-shrink-0 flex items-center justify-center text-xs font-semibold">
              {(c.author || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs flex items-center gap-1">
                <span className="font-medium text-foreground">{c.author}</span>
                <span className="text-muted-foreground"> · {formatCommentDate(c.createdAt)}</span>
                {c.author === user?.name && (
                  <button onClick={() => void remove(c.id)} className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary" aria-label="Şərhi sil">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="mt-1 text-sm text-foreground rounded-lg bg-secondary/50 border border-border px-3 py-2 break-words whitespace-pre-wrap">{c.text}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button size="sm" onClick={() => void send()} disabled={saving || !draft.trim()} className="gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Göndər
        </Button>
      </div>
    </>
  );
}
