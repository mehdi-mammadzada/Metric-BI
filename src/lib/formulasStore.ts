// Shared store for calculation formulas + their variable book.
// Used by the standalone "Hesablama Düsturları" module.

export interface FormulaVariable {
  id: number;
  short: string; // e.g. CS
  name: string; // e.g. Cari Satış
  description: string;
  source: string; // integration system name (e.g. CHR, CRM Sistemi)
}

export interface Formula {
  id: number;
  name: string;
  formula: string;
  description: string;
  kpiName?: string; // backward compat (free-text label)
  kpiTypes?: string[]; // deprecated — hidden in UI
  variables: string[]; // variable shorts referenced
}

const FORMULAS_KEY = "kpi_formulas_v4";
const VARIABLES_KEY = "kpi_formula_variables_v4";

// Standart dəyişənlər kitabı — bütün (yeni və köhnə) təşkilatlarda
// "Düsturlar → Dəyişənlər Kitabı" dolu şəkildə açılır.
const DEFAULT_VARIABLES: FormulaVariable[] = [
  { id: 1, short: "PS", name: "Plan Satış", description: "Dövr üzrə planlaşdırılmış satış həcmi", source: "CRM Sistemi" },
  { id: 2, short: "CS", name: "Cari Satış", description: "Dövr üzrə faktiki satış həcmi", source: "CRM Sistemi" },
  { id: 3, short: "SF", name: "Satış Faizi", description: "Faktiki satışın plana nisbəti (%)", source: "CRM Sistemi" },
  { id: 4, short: "PG", name: "Plan Gəlir", description: "Dövr üzrə planlaşdırılmış gəlir", source: "Maliyyə Sistemi" },
  { id: 5, short: "FG", name: "Faktiki Gəlir", description: "Dövr üzrə faktiki gəlir", source: "Maliyyə Sistemi" },
  { id: 6, short: "XR", name: "Xərc", description: "Dövr üzrə ümumi xərc məbləği", source: "Maliyyə Sistemi" },
  { id: 7, short: "MG", name: "Mənfəət Marjası", description: "(Gəlir − Xərc) / Gəlir (%)", source: "Maliyyə Sistemi" },
  { id: 8, short: "BC", name: "Büdcə İcrası", description: "Büdcənin icra faizi (%)", source: "Maliyyə Sistemi" },
  { id: 9, short: "MS", name: "Müştəri Sayı", description: "Aktiv müştərilərin sayı", source: "CRM Sistemi" },
  { id: 10, short: "YM", name: "Yeni Müştəri", description: "Dövr ərzində əlavə olunan yeni müştərilər", source: "CRM Sistemi" },
  { id: 11, short: "MM", name: "Müştəri Məmnuniyyəti", description: "Sorğu nəticəsi üzrə məmnuniyyət balı", source: "Sorğu Sistemi" },
  { id: 12, short: "NPS", name: "NPS Göstəricisi", description: "Net Promoter Score dəyəri", source: "Sorğu Sistemi" },
  { id: 13, short: "ES", name: "Əməkdaş Sayı", description: "Aktiv əməkdaşların sayı", source: "CHR" },
  { id: 14, short: "DS", name: "Dövriyyə Faizi", description: "Əməkdaş dövriyyəsi (turnover, %)", source: "CHR" },
  { id: 15, short: "DG", name: "Davamiyyət", description: "İş günlərinin faktiki iştirak faizi (%)", source: "CHR" },
  { id: 16, short: "TS", name: "Təlim Saatı", description: "Əməkdaş üzrə tamamlanmış təlim saatları", source: "CHR" },
  { id: 17, short: "TT", name: "Tapşırıq Tamamlanma", description: "Tamamlanmış tapşırıqların faizi (%)", source: "Task Sistemi" },
  { id: 18, short: "VT", name: "Vaxtında İcra", description: "Vaxtında icra olunmuş işlərin faizi (%)", source: "Task Sistemi" },
  { id: 19, short: "SL", name: "SLA İcrası", description: "SLA şərtlərinə uyğun icra faizi (%)", source: "Servis Sistemi" },
  { id: 20, short: "IN", name: "İnsident Sayı", description: "Dövr üzrə qeydə alınan insidentlərin sayı", source: "Servis Sistemi" },
  { id: 21, short: "KY", name: "Keyfiyyət Balı", description: "Keyfiyyət auditi üzrə orta bal", source: "Keyfiyyət Sistemi" },
  { id: 22, short: "AU", name: "Audit Uyğunluğu", description: "Audit tələblərinə uyğunluq faizi (%)", source: "Keyfiyyət Sistemi" },
  { id: 23, short: "MH", name: "Məhsuldarlıq", description: "Vahid resursa düşən nəticə göstəricisi", source: "ERP" },
  { id: 24, short: "AQ", name: "Anbar Qalığı", description: "Dövr sonuna anbar qalığı", source: "ERP" },
];

const initialFormulas: Formula[] = [];

const readVariables = (): FormulaVariable[] | null => {
  const saved = localStorage.getItem(VARIABLES_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as FormulaVariable[]) : null;
  } catch { return null; }
};

export const getVariables = (): FormulaVariable[] => {
  const saved = readVariables();
  // Boş (və ya heç yazılmamış) kitab — standart dəyişənlərlə doldurulur.
  if (saved && saved.length > 0) return saved;
  localStorage.setItem(VARIABLES_KEY, JSON.stringify(DEFAULT_VARIABLES));
  return DEFAULT_VARIABLES;
};

export const saveVariables = (vars: FormulaVariable[]) => {
  localStorage.setItem(VARIABLES_KEY, JSON.stringify(vars));
  window.dispatchEvent(new Event("formulas-updated"));
};

export const getFormulas = (): Formula[] => {
  const saved = localStorage.getItem(FORMULAS_KEY);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  localStorage.setItem(FORMULAS_KEY, JSON.stringify(initialFormulas));
  return initialFormulas;
};

export const saveFormulas = (f: Formula[]) => {
  localStorage.setItem(FORMULAS_KEY, JSON.stringify(f));
  window.dispatchEvent(new Event("formulas-updated"));
};
