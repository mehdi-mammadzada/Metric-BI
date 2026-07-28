// KPI kartı yaradılarkən sehrbazda təyin olunan tam məlumat (hədəflər, Balanced
// Scorecard limitləri, KPI üzvləri və s.) burada saxlanılır.
// localStorage = keş, həqiqi mənbə = cloud (phase1SyncService vasitəsilə
// `org_catalogs` cədvəlinə `kpi_card_drafts` açarı ilə sinxronlaşır).

export const KPI_CARD_DRAFTS_KEY = "kpi_card_drafts_v1";
export const KPI_CARD_DRAFTS_EVENT = "kpi-card-drafts-updated";

export type KpiCardDrafts = Record<number, any>;

export const getCardDrafts = (): KpiCardDrafts => {
  try {
    const raw = localStorage.getItem(KPI_CARD_DRAFTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const saveCardDrafts = (drafts: KpiCardDrafts) => {
  try {
    localStorage.setItem(KPI_CARD_DRAFTS_KEY, JSON.stringify(drafts));
  } catch { /* noop */ }
  window.dispatchEvent(new Event(KPI_CARD_DRAFTS_EVENT));
};

export const setCardDraft = (cardId: number, draft: any) => {
  const all = getCardDrafts();
  all[cardId] = draft;
  saveCardDrafts(all);
  return all;
};

export const removeCardDraft = (cardId: number) => {
  const all = getCardDrafts();
  if (all[cardId] === undefined) return all;
  delete all[cardId];
  saveCardDrafts(all);
  return all;
};
