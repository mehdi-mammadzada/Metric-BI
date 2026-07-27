// Uploaded salary documents store (localStorage demo)

export interface UploadRowDetail {
  no: number;
  firstName: string;
  lastName: string;
  fatherName: string;
  monthPay: number;
  totalPaid: number;
  avgMonthly: number;
  pctCurrent: number;
  pct12m: number;
  status: "Uyğunlaşdırıldı" | "Uyğunsuz";
  qeyd: string;
}

export interface SalaryUpload {
  id: number;
  operator: string;
  year: number;
  month: string;
  status: "Aktiv" | "Passiv";
  totalAmount: number;
  totalRows: number;
  matched: number;
  unmatched: number;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
  title: string;
  details: UploadRowDetail[];
}

const STORAGE = "kpi_salary_uploads_v3";

// Seed mirrors real org employees + salary template columns
const seedRows: Omit<UploadRowDetail, "no">[] = [];

const seedDetails: UploadRowDetail[] = seedRows.map((r, i) => ({ no: i + 1, ...r }));

// Nümunə uyğunsuz fayl — bir sətirdə FIN/əməkdaş kodu üst-üstə düşmür
const mismatchRows: UploadRowDetail[] = [
  { no: 1, firstName: "Aysel",   lastName: "Quliyeva", fatherName: "Vidadi", monthPay: 2100, totalPaid: 6300, avgMonthly: 2100, pctCurrent: 100, pct12m: 100, status: "Uyğunlaşdırıldı", qeyd: "FIN üzrə uyğunlaşdırıldı" },
  { no: 2, firstName: "Tural",   lastName: "İsmayılov", fatherName: "Akif",  monthPay: 2300, totalPaid: 6900, avgMonthly: 2300, pctCurrent: 100, pct12m: 100, status: "Uyğunlaşdırıldı", qeyd: "FIN üzrə uyğunlaşdırıldı" },
  { no: 3, firstName: "Vüsal",   lastName: "Hüseynli", fatherName: "Ramiz",  monthPay: 1950, totalPaid: 5850, avgMonthly: 1950, pctCurrent: 100, pct12m: 100, status: "Uyğunsuz", qeyd: "FIN və ya əməkdaş kodu sistemdə tapılmadı" },
];

const seed: SalaryUpload[] = [];

const load = (): SalaryUpload[] => {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(STORAGE, JSON.stringify(seed));
  return seed;
};

const save = (list: SalaryUpload[]) => {
  localStorage.setItem(STORAGE, JSON.stringify(list));
  window.dispatchEvent(new Event("salary-uploads-updated"));
  import("@/lib/payrollService").then(m => m.flushPayrollToCloud?.()).catch(() => {});
};

export const getUploads = (): SalaryUpload[] => load();

export const addUpload = (data: Omit<SalaryUpload, "id" | "createdAt">) => {
  const list = load();
  const id = list.length ? Math.max(...list.map(r => r.id)) + 1 : 1;
  list.push({ ...data, id, createdAt: new Date().toISOString() });
  save(list);
  return list;
};
