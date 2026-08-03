// Silinmiş / ləğv olunmuş KPI kartları — vahid mənbə.
// Bu kartlar heç bir modulda (lifecycle, izlənmə, kaskad, hesabatlar) görünməməlidir.
// Kart registrini birbaşa storage-dən oxuyuruq ki, dairəvi importlar yaranmasın.

const CARDS_KEY = "shared_kpi_cards_v1";

export const REMOVED_CARD_STATUSES = new Set(["silindi", "legv_olundu"]);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

interface RemovedIndex {
  ids: Set<string>;
  names: Set<string>;
}

const readRemoved = (): RemovedIndex => {
  const ids = new Set<string>();
  const names = new Set<string>();
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) return { ids, names };
    const rows = JSON.parse(raw);
    (Array.isArray(rows) ? rows : []).forEach((c: any) => {
      if (!REMOVED_CARD_STATUSES.has(String(c?.status))) return;
      if (c?.id != null) ids.add(String(c.id));
      if (c?.numericId != null) ids.add(String(c.numericId));
      const n = norm(c?.name);
      if (n) names.add(n);
    });
  } catch { /* noop */ }
  return { ids, names };
};

export const removedCardIds = (): Set<string> => readRemoved().ids;
export const removedCardNames = (): Set<string> => readRemoved().names;

/** Kart id və ya adı silinmiş/ləğv olunmuş kartlara aiddirmi? */
export const isRemovedCard = (idOrName?: string | number | null): boolean => {
  if (idOrName == null) return false;
  const { ids, names } = readRemoved();
  return ids.has(String(idOrName)) || names.has(norm(idOrName));
};

/** Kart id-si VƏ adı üzrə yoxlama (hər ikisi məlum olduqda). */
export const isRemovedCardRef = (id?: string | number | null, name?: string | null): boolean => {
  const { ids, names } = readRemoved();
  if (id != null && ids.has(String(id))) return true;
  return !!name && names.has(norm(name));
};
