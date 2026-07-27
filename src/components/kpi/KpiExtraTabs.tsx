import { useEffect, useState } from "react";
import { Info, MoreHorizontal, Send } from "lucide-react";


export const KPI_EXTRA_TABS = [
  ["comments", "Şərhlər"],
] as const;

export type KpiExtraTabKey = typeof KPI_EXTRA_TABS[number][0];

export const isExtraTab = (t: string): t is KpiExtraTabKey =>
  KPI_EXTRA_TABS.some(([k]) => k === t);

interface Props {
  kpi: { id?: number; name: string; target?: string | number; current?: string | number; unit?: string; progress: number };
  tab: KpiExtraTabKey;
}

export default function KpiExtraTabContent({ kpi, tab }: Props) {
  if (tab === "comments") return <Comments cardId={kpi.id} />;
  return null;
}

// ================= Şərhlər (per-card, localStorage) =================

interface CommentItem { id: number; author: string; date: string; text: string; }

const COMMENTS_KEY = "kpi_card_comments_v1";
const COMMENTS_EVT = "kpi-card-comments-updated";

type Store = Record<string, CommentItem[]>;

const loadStore = (): Store => {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {}
  return {};
};
const saveStore = (s: Store) => {
  try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(s)); } catch {}
  window.dispatchEvent(new Event(COMMENTS_EVT));
};

const loadFor = (cardId?: number): CommentItem[] => {
  const store = loadStore();
  const key = String(cardId ?? "default");
  if (store[key] && store[key].length > 0) return store[key];
  return [];
};

function Comments({ cardId }: { cardId?: number }) {
  const [items, setItems] = useState<CommentItem[]>(() => loadFor(cardId));
  const [text, setText] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    setItems(loadFor(cardId));
    const refresh = () => setItems(loadFor(cardId));
    window.addEventListener(COMMENTS_EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(COMMENTS_EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [cardId]);

  const persist = (next: CommentItem[]) => {
    setItems(next);
    if (!cardId) return;
    const store = loadStore();
    store[String(cardId)] = next;
    saveStore(store);
  };

  const add = () => {
    if (!text.trim()) return;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const item: CommentItem = {
      id: Date.now(),
      author: "Admin",
      date: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
      text,
    };
    persist([item, ...items]);
    setText("");
  };

  const availableAuthors = Array.from(new Set(items.map(c => c.author).filter(Boolean)));
  const filtered = items.filter(c => {
    if (filterAuthor && c.author !== filterAuthor) return false;
    if (filterDate && !(c.date || "").includes(filterDate.split("-").reverse().join("."))) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Şərhlər</h3>
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">A</div>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Qeyd əlavə et..." className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <button onClick={add} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center gap-1">
          <Send className="w-3.5 h-3.5" /> Qeyd əlavə et
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
            {items.length === 0 ? "Hələ heç bir şərh yoxdur." : "Filtrə uyğun şərh tapılmadı."}
          </div>
        )}
        {filtered.map((c) => (
          <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${c.author === "Admin" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{c.author[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.author}</p>
                  <p className="text-[11px] text-muted-foreground">{c.date}</p>
                </div>
                <button className="p-1 rounded hover:bg-secondary"><MoreHorizontal className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <p className="text-sm text-foreground mt-1">{c.text}</p>
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
