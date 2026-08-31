// Shared KPI card types — used by KpiCardsPage (main) and the manager
// KPI-tracking detail view so both render the same tabs/content.

import type { LimitSet, ScoreDescRow } from "@/lib/kpiSetStore";

export interface EvaluatorPerson { name: string; weight: number; }
export interface EvaluatorConfig {
  type: "team" | "person" | "self" | "integration" | null;
  teamId?: number | null;
  persons: EvaluatorPerson[];
  randomCount?: number;
  integrationName?: string;
  integrationWeight?: number;
  integrationFields?: string[];
}

export interface SubKpi {
  id: number;
  name: string;
  target: string;
  weight: number;
  current?: string;
  progress?: number;
  unit?: string;
  assignerUnit?: string;
  evaluator?: EvaluatorConfig;
  assignerMode?: "self" | "other";
  assigner?: string;
  weightMin?: number;
  weightMax?: number;
  limits?: LimitSet;
  scoreDescriptions?: ScoreDescRow[];
}

export interface KpiCard {
  id: number;
  name: string;
  icon: any;
  zone: "green" | "yellow" | "red";
  target: string;
  current: string;
  unit: string;
  progress: number;
  minTarget: number;
  responsible: string;
  /** Kartı yaradan HR-in adı (Təyin Statusu tabında hədəflərin altında göstərilir) */
  createdByName?: string;
  period: string;
  type: string;
  formula: string;
  generalTarget?: string;
  department: string;
  group: string;
  subdivision: string;
  startDate: string;
  endDate: string;
  frequency: string;
  team: { name: string; role: string; avatar: string }[];
  history: { date: string; value: string; change: number }[];
  description: string;
  weight: number;
  approvalStatus: "pending" | "approved";
  subKpis?: SubKpi[];
  isPersonal?: boolean;
  frozen?: boolean;
  /** Təsdiqləmə matrisinin id-si (varsa) */
  matrixId?: string | null;
}
