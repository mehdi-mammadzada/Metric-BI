// Anonymous whistleblower store (localStorage)
export type WBStatus = "yeni" | "arashdirilir" | "hell_olundu";

export const WB_CATEGORIES = [
  "Korrupsiya",
  "Saxtakarlıq",
  "Mobbing / Təzyiq",
  "Diskriminasiya",
  "Təhlükəsizlik pozuntusu",
  "Etik qayda pozuntusu",
  "Digər",
] as const;

export interface WBAttachment {
  name: string;
  size: number;
  type: string;
  dataUrl: string; // base64
}

export interface WBHistoryEntry {
  at: string;
  action: string;
  note?: string;
  fromStatus?: WBStatus;
  toStatus?: WBStatus;
  by?: string;
}

export interface WBReport {
  id: string; // e.g. WB-2025-001
  category: string;
  title: string;
  description: string;
  extraNote?: string;
  status: WBStatus;
  createdAt: string;
  updatedAt: string;
  attachments: WBAttachment[];
  history: WBHistoryEntry[];
}

const KEY = "wb_reports_v1";

const read = (): WBReport[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WBReport[]) : [];
  } catch {
    return [];
  }
};

const write = (list: WBReport[]) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("wb:changed"));
};

export const listReports = (): WBReport[] =>
  read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const getReport = (id: string): WBReport | undefined =>
  read().find((r) => r.id === id);

const generateId = (): string => {
  const list = read();
  const year = new Date().getFullYear();
  const prefix = `WB-${year}-`;
  const nums = list
    .filter((r) => r.id.startsWith(prefix))
    .map((r) => parseInt(r.id.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
};

export const createReport = (input: {
  category: string;
  title: string;
  description: string;
  extraNote?: string;
  attachments: WBAttachment[];
}): WBReport => {
  const now = new Date().toISOString();
  const report: WBReport = {
    id: generateId(),
    category: input.category,
    title: input.title,
    description: input.description,
    extraNote: input.extraNote,
    status: "yeni",
    createdAt: now,
    updatedAt: now,
    attachments: input.attachments,
    history: [{ at: now, action: "Bildiriş yaradıldı", toStatus: "yeni" }],
  };
  const list = read();
  list.push(report);
  write(list);
  return report;
};

export const updateStatus = (id: string, toStatus: WBStatus, note?: string, by?: string) => {
  const list = read();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const fromStatus = list[idx].status;
  const now = new Date().toISOString();
  list[idx] = {
    ...list[idx],
    status: toStatus,
    updatedAt: now,
    history: [
      ...list[idx].history,
      { at: now, action: "Status yeniləndi", note, fromStatus, toStatus, by },
    ],
  };
  write(list);
};

export const STATUS_LABEL: Record<WBStatus, string> = {
  yeni: "Yeni",
  arashdirilir: "Araşdırılır",
  hell_olundu: "Həll olundu",
};

export const seedWhistleblowerDemo = () => {
  // Demo seeding disabled: reports only exist when real users submit them.
};
