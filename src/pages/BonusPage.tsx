import { useMemo, useState } from "react";
import { DataTable } from "@/components/common/DataTable";
import ExportMenu from "@/components/common/ExportMenu";
import { Calculator, Eye, AlertTriangle, Bell, CheckCircle2, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import { PageHero } from "@/components/ui/page-hero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PeriodRangePicker, { emptyPeriodSelection, resolvePeriod, type PeriodSelection } from "@/components/kpi/PeriodRangePicker";
import { toast } from "sonner";
import { useSampleResultsSeed } from "@/lib/sampleResultsSeed";
import { useBonusEmployees } from "@/lib/bonusEmployeesData";




export interface SubKpi { name: string; weight: number; evaluator: string; score: number | null; }
export interface Employee {
  id: string; firstName: string; lastName: string; fatherName?: string; department: string; position: string;
  baseSalary: number; targetBonusPct: number; subKpis: SubKpi[];
}

export const fullNameOf = (e: Pick<Employee, "firstName" | "lastName" | "fatherName">) =>
  [e.firstName, e.lastName, e.fatherName].filter(Boolean).join(" ");

export const DEFAULT_BONUS_EMPLOYEES: Employee[] = [];

const MONTHS_AZ = ["Yanvar","Fevral","Mart","Aprel","May","İyun","İyul","Avqust","Sentyabr","Oktyabr","Noyabr","Dekabr"];
const YEARS = [2025, 2026];
const MISSING_BY_LABEL: Record<string, string[]> = {};

interface CalcRow { employee: Employee; achievement: number | null; bonus: number | null; }

export interface BonusPageProps {
  employeesOverride?: Employee[];
  hideChrome?: boolean;
  hideCalcButton?: boolean;
  heroTitle?: string;
  heroSubtitle?: string;
}

const BonusPage = ({ employeesOverride, hideChrome, hideCalcButton, heroTitle, heroSubtitle }: BonusPageProps = {}) => {
  useSampleResultsSeed();
  const derived = useBonusEmployees();
  const employees = employeesOverride || derived;

  const [period, setPeriod] = useState<PeriodSelection>(() => ({ ...emptyPeriodSelection("monthly"), year: "2026", month: "5" }));
  // Default auto-calculated view — May 2026 (has full data)
  const defaultLabel = "May 2026";
  const defaultRows: CalcRow[] = employees.map(emp => {
    const allScored = emp.subKpis.length > 0 && emp.subKpis.every(s => s.score !== null);
    if (!allScored) return { employee: emp, achievement: null, bonus: null };
    const achievement = emp.subKpis.reduce((sum, sk) => sum + (sk.score! * sk.weight), 0) / 100;
    const bonus = (emp.baseSalary * emp.targetBonusPct * achievement) / 10000;
    return { employee: emp, achievement, bonus };
  });
  const [result, setResult] = useState<CalcRow[] | null>(defaultRows);
  const [usedLabel, setUsedLabel] = useState<string>(defaultLabel);
  const [errorOpen, setErrorOpen] = useState(false);
  const [missingEmployees, setMissingEmployees] = useState<{ emp: Employee; missing: SubKpi[] }[]>([]);
  const [detailEmp, setDetailEmp] = useState<CalcRow | null>(null);

  const resolvedPeriod = useMemo(() => resolvePeriod(period), [period]);
  const computeLabel = (): string => resolvedPeriod?.label || "";
  const isPeriodReady = (): boolean => !!resolvedPeriod;

  const calcRows = (label: string, force: boolean): CalcRow[] => {
    const missingIds = MISSING_BY_LABEL[label] || [];
    return employees.map(emp => {
      const isMissing = missingIds.includes(emp.id);
      const subs = isMissing
        ? emp.subKpis.map((sk, i) => i === 0 ? { ...sk, score: force ? sk.score : null } : sk)
        : emp.subKpis;
      const allScored = subs.length > 0 && subs.every(s => s.score !== null);
      if (!allScored) return { employee: emp, achievement: null, bonus: null };
      const achievement = subs.reduce((sum, sk) => sum + (sk.score! * sk.weight), 0) / 100;
      const bonus = (emp.baseSalary * emp.targetBonusPct * achievement) / 10000;
      return { employee: emp, achievement, bonus };
    });
  };

  const handleCalculate = () => {
    const label = computeLabel();
    if (!label) return;
    const missingIds = MISSING_BY_LABEL[label] || [];
    if (missingIds.length > 0) {
      const missing = employees.filter(e => missingIds.includes(e.id)).map(emp => ({
        emp,
        missing: emp.subKpis.slice(0, 1), // first hədəf is "missing"
      }));
      setMissingEmployees(missing);
      setUsedLabel(label);
      setErrorOpen(true);
      return;
    }
    setResult(calcRows(label, false));
    setUsedLabel(label);
    toast.success("Bonuslar hesablandı");
  };

  const forceCalc = () => {
    setResult(calcRows(usedLabel, true));
    setErrorOpen(false);
    toast.success("Çatışmayan qiymətlərə baxmayaraq hesablandı");
  };

  const sendReminder = () => {
    const evaluators = new Set(missingEmployees.flatMap(m => m.missing.map(s => s.evaluator)));
    toast.success(`${evaluators.size} qiymətləndirən şəxsə bildiriş göndərildi`);
  };


  return (
    <div className="min-h-screen">
      {!hideChrome && <Header title="Bonuslar" />}
      <main className={hideChrome ? "space-y-4" : "p-6 pb-24 space-y-4"}>
        {!hideChrome && (
          <PageHero
            badge="Bonus Mərkəzi"
            icon={Sparkles}
            title={heroTitle || "Bonuslar"}
            subtitle={heroSubtitle || "Əməkdaşlar üzrə dövrlük bonus hesablanması"}
          />
        )}

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(400px,460px)_1fr_auto] gap-3 items-end">
            <PeriodRangePicker value={period} onChange={(v) => { setPeriod(v); setResult(null); setUsedLabel(""); }} />
            <div className="flex items-center gap-2">
              {!hideCalcButton && (
                <Button onClick={handleCalculate} disabled={!isPeriodReady()}>
                  <Calculator className="mr-2 h-4 w-4" /> Bonus hesabla
                </Button>
              )}
              {result && (
                <ExportMenu
                  getData={() => ({
                    title: `Bonus Hesabatı${usedLabel ? ` — ${usedLabel}` : ""}`,
                    fileName: `bonus-${usedLabel || "hesabat"}`,
                    headers: ["Əməkdaşın A.S.A.", "Struktur", "Vəzifə", "İcra %", "Bonus (AZN)"],
                    rows: result.map(r => [
                      fullNameOf(r.employee),
                      r.employee.department, r.employee.position,
                      r.achievement?.toFixed(1) ?? "—",
                      r.bonus?.toFixed(2) ?? "—",
                    ]),
                  })}
                />
              )}
              {result && usedLabel && <Badge variant="secondary">Dövr: {usedLabel}</Badge>}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <BonusResultTable result={result && result.length ? result : defaultRows} setDetailEmp={setDetailEmp} />
        </div>
      </main>



      {/* Error dialog */}
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Xəta: qiymətlər tam deyil
            </DialogTitle>
            <DialogDescription>
              {employees.length} nəfərdən {missingEmployees.length} nəfərdə qiymət yoxdur:
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Əməkdaşın A.S.A.</TableHead>
                <TableHead>Struktur</TableHead>
                <TableHead>Çatışmayan Hədəf</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missingEmployees.map(({ emp, missing }) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{fullNameOf(emp)}</TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell>
                    {missing.map((sk, i) => (
                      <div key={i} className="text-sm">
                        {sk.name} <span className="text-muted-foreground">({sk.evaluator})</span>
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={sendReminder}>
              <Bell className="mr-2 h-4 w-4" /> Yenidən xatırlatma göndər
            </Button>
            <Button onClick={forceCalc}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Yenə də hesabla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailEmp} onOpenChange={() => setDetailEmp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailEmp && (
            <>
              <DialogHeader>
                <DialogTitle>{fullNameOf(detailEmp.employee)} — qiymətləri və hesablanması</DialogTitle>
                <DialogDescription>{detailEmp.employee.department} • {detailEmp.employee.position} • Dövr: {usedLabel}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 bg-muted/30 rounded-lg p-3">
                <div><div className="text-xs text-muted-foreground">Baza maaş</div><div className="font-semibold">{detailEmp.employee.baseSalary} ₼</div></div>
                <div><div className="text-xs text-muted-foreground">Hədəf bonus %</div><div className="font-semibold">{detailEmp.employee.targetBonusPct}%</div></div>
                <div><div className="text-xs text-muted-foreground">Ümumi icra %</div><div className="font-semibold">{detailEmp.achievement?.toFixed(1) ?? "—"}%</div></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hədəf</TableHead>
                    <TableHead>Qiymətləndirən</TableHead>
                    <TableHead className="text-right">Çəki</TableHead>
                    <TableHead className="text-right">Qiymət (1-5)</TableHead>
                    <TableHead className="text-right">İcra %</TableHead>
                    <TableHead className="text-right">Töhfə</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailEmp.employee.subKpis.map((sk, i) => {
                    const scale = sk.score == null ? null : Math.max(1, Math.min(5, Math.round(sk.score / 20)));
                    const pct = sk.score ?? 0;
                    const contrib = sk.score == null ? null : (pct * sk.weight) / 100;
                    return (
                      <TableRow key={i}>
                        <TableCell>{sk.name}</TableCell>
                        <TableCell>{sk.evaluator}</TableCell>
                        <TableCell className="text-right">{sk.weight}%</TableCell>
                        <TableCell className="text-right font-medium">{scale ?? "—"}/5</TableCell>
                        <TableCell className="text-right">{sk.score ?? "—"}%</TableCell>
                        <TableCell className="text-right text-primary font-medium">{contrib?.toFixed(1) ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground mb-1">Hesablama düsturu</div>
                <div className="font-mono text-muted-foreground">İcra% = Σ (sub_qiymət × çəki) / 100</div>
                <div className="font-mono text-muted-foreground">Bonus = Baza maaş × Hədəf bonus% × İcra% / 10000</div>
                <div className="font-mono text-foreground pt-1">
                  = {detailEmp.employee.baseSalary} × {detailEmp.employee.targetBonusPct}% × {detailEmp.achievement?.toFixed(1) ?? "—"}% / 100
                </div>
                <div className="text-[11px] text-muted-foreground pt-1">
                  Qeyd: 1-5 aralığı 100 faizli şkalaya proporsional çevrilir (1≈20%, 5≈100%).
                </div>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between">
                <span className="font-medium">Hesablanmış bonus</span>
                <span className="text-2xl font-bold text-primary">{detailEmp.bonus?.toFixed(2) ?? "—"} ₼</span>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BonusPage;

const BonusResultTable = ({ result, setDetailEmp }: { result: CalcRow[] | null; setDetailEmp: (r: CalcRow) => void }) => {
  const rows = result ?? [];
  const departments = Array.from(new Set(rows.map(r => r.employee.department)));
  const positions = Array.from(new Set(rows.map(r => r.employee.position)));
  return (
    <DataTable<CalcRow>
      rows={rows}
      rowKey={(r) => r.employee.id}
      storageKey="bonus-table"
      emptyMessage="Dövr seçin və 'Bonus hesabla' düyməsinə klik edin"
      columns={[
        {
          key: "op", label: "Əməliyyat", width: 100, align: "center", filterType: "none",
          render: (row) => (
            <Button variant="ghost" size="icon" onClick={() => setDetailEmp(row)}>
              <Eye className="w-4 h-4" />
            </Button>
          ),
        },
        {
          key: "name", label: "Əməkdaşın A.S.A.", filterType: "text",
          accessor: (r) => fullNameOf(r.employee),
          render: (r) => <span className="font-medium">{fullNameOf(r.employee)}</span>,
        },
        { key: "dep", label: "Struktur", filterType: "select", selectOptions: departments, accessor: (r) => r.employee.department },
        { key: "pos", label: "Vəzifə", filterType: "select", selectOptions: positions, accessor: (r) => r.employee.position },
        {
          key: "bonus", label: "Bonus", align: "right", filterType: "number",
          accessor: (r) => r.bonus ?? 0,
          render: (r) => r.bonus !== null ? (
            <div className="flex flex-col items-end">
              <span className="font-bold">{r.bonus.toFixed(2)} ₼</span>
              <span className="text-xs text-muted-foreground">{r.achievement?.toFixed(0)}% icra</span>
            </div>
          ) : (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Qiymət yox</Badge>
          ),
        },
      ]}
    />
  );
};

