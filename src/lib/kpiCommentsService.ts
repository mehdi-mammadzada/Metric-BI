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

/** Bazadan şərhləri gətirir (ən yenilər əvvəldə) və lokal keşi yeniləyir. */
export const fetchKpiComments = async (cardRef?: string | number | null): Promise<KpiComment[]> => {
  if (cardRef == null) return [];
  const ref = String(cardRef);
  const { data, error } = await supabase
    .from("kpi_card_comments")
    .select("id, card_ref, author_name, text, created_at")
    .eq("card_ref", ref)
    .order("created_at", { ascending: false });
  if (error) return getCachedComments(ref);
  const rows = (data ?? []).map(mapRow);
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
