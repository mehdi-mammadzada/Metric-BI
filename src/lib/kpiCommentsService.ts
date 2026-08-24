// KPI kart şərhləri — daimi (persistent) saxlama: public.kpi_card_comments.
// Lokal keş yalnız offline/ilk render üçün istifadə olunur; həqiqət mənbəyi bazadır.

import { supabase } from "@/integrations/supabase/client";

export interface KpiComment {
  id: string;
  cardRef: string;
  author: string;
  createdAt: string;
  text: string;
}

const CACHE_KEY = "kpi_card_comments_cache_v1";
export const KPI_COMMENTS_EVT = "kpi-card-comments-updated";

type Cache = Record<string, KpiComment[]>;

const readCache = (): Cache => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
};

const writeCache = (cardRef: string, rows: KpiComment[]) => {
  try {
    const cache = readCache();
    cache[cardRef] = rows;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
  window.dispatchEvent(new Event(KPI_COMMENTS_EVT));
};

export const getCachedComments = (cardRef?: string | number | null): KpiComment[] => {
  if (cardRef == null) return [];
  return readCache()[String(cardRef)] ?? [];
};

const mapRow = (r: any): KpiComment => ({
  id: String(r.id),
  cardRef: String(r.card_ref),
  author: r.author_name || "İstifadəçi",
  createdAt: r.created_at,
  text: r.text || "",
});

/**
 * Bir KPI kartına aid mümkün bütün ref variantlarını qaytarır.
 * Kart bəzi modullarda uuid, bəzilərində köhnə nömrəli id ilə göstərilir —
 * şərhlərin heç bir cihazda "yox olmaması" üçün hər iki variantla oxuyuruq.
 */
const variantCache = new Map<string, string[]>();

const resolveRefVariants = async (ref: string): Promise<string[]> => {
  if (variantCache.has(ref)) return variantCache.get(ref)!;
  const variants = new Set<string>([ref]);
  // Əməkdaş səviyyəli ref (card:<id>:emp:<ad>) üçün kart səviyyəsini də əlavə edirik.
  const emp = /^card:([^:]+):emp:/.exec(ref);
  const m = /^card:([^:]+)$/.exec(ref);
  const raw = (emp?.[1] || m?.[1] || (/^card:/.test(ref) ? "" : ref))?.trim();
  if (raw) {
    variants.add(raw);
    variants.add(`card:${raw}`);
    try {
      const isUuid = /^[0-9a-f-]{32,}$/i.test(raw);
      const numeric = Number(raw);
      const q = supabase.from("kpi_cards").select("id, legacy_numeric_id");
      const { data } = isUuid
        ? await q.eq("id", raw).maybeSingle()
        : Number.isFinite(numeric)
          ? await q.eq("legacy_numeric_id", numeric).maybeSingle()
          : { data: null as any };
      if (data) {
        if (data.id) { variants.add(`card:${data.id}`); variants.add(String(data.id)); }
        if (data.legacy_numeric_id != null) {
          const n = String(Number(data.legacy_numeric_id));
          variants.add(`card:${n}`);
          variants.add(n);
        }
      }
    } catch {}
  }
  const list = Array.from(variants);
  variantCache.set(ref, list);
  return list;
};

/**
 * Bazadan şərhləri gətirir (ən yenilər əvvəldə) və lokal keşi yeniləyir.
 * Kart səviyyəsində oxunduqda əməkdaş səviyyəli (card:<id>:emp:<ad>) şərhlər də daxil olur;
 * əməkdaş səviyyəsində isə kartın ümumi şərhləri də görünür.
 */
export const fetchKpiComments = async (cardRef?: string | number | null): Promise<KpiComment[]> => {
  if (cardRef == null) return [];
  const ref = String(cardRef);
  const refs = await resolveRefVariants(ref);
  const base = supabase
    .from("kpi_card_comments")
    .select("id, card_ref, author_name, text, created_at");
  const [exact, scoped] = await Promise.all([
    base.in("card_ref", refs).order("created_at", { ascending: false }),
    // Yalnız kart səviyyəli baxışda alt (əməkdaş) şərhləri də çəkirik.
    /:emp:/.test(ref)
      ? Promise.resolve({ data: [] as any[], error: null })
      : supabase
          .from("kpi_card_comments")
          .select("id, card_ref, author_name, text, created_at")
          .or(refs.map(r => `card_ref.like.${r}:emp:%`).join(","))
          .order("created_at", { ascending: false }),
  ]);
  if (exact.error) return getCachedComments(ref);
  const byId = new Map<string, KpiComment>();
  for (const r of [...(exact.data ?? []), ...((scoped as any).data ?? [])]) {
    const c = mapRow(r);
    byId.set(c.id, c);
  }
  const rows = Array.from(byId.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  writeCache(ref, rows);
  return rows;
};

/** Yeni şərh əlavə edir. Uğurlu olduqda tam siyahını qaytarır. */
export const addKpiComment = async (
  cardRef: string | number,
  text: string,
  meta: { organizationId?: string | null; userId?: string | null; authorName?: string | null },
): Promise<{ ok: boolean; error?: string; rows: KpiComment[] }> => {
  const ref = String(cardRef);
  const body = text.trim();
  if (!body) return { ok: false, error: "Şərh boşdur", rows: getCachedComments(ref) };
  if (!meta.organizationId || !meta.userId) {
    return { ok: false, error: "Təşkilat və ya istifadəçi müəyyən edilmədi", rows: getCachedComments(ref) };
  }
  const { error } = await supabase.from("kpi_card_comments").insert({
    card_ref: ref,
    organization_id: meta.organizationId,
    author_user_id: meta.userId,
    author_name: meta.authorName || "İstifadəçi",
    text: body,
  });
  if (error) return { ok: false, error: error.message, rows: getCachedComments(ref) };
  const rows = await fetchKpiComments(ref);
  return { ok: true, rows };
};


/** Şərhi silir (yalnız müəllif). */
export const deleteKpiComment = async (cardRef: string | number, id: string): Promise<KpiComment[]> => {
  await supabase.from("kpi_card_comments").delete().eq("id", id);
  return fetchKpiComments(cardRef);
};

export const formatCommentDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
