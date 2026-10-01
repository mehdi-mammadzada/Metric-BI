// Səriştə matrisinin əməkdaş vəzifəsinə uyğunlaşdırılması üçün köməkçilər.
import { getScoreScale } from "@/lib/evaluationConfigStore";
import type { CompetencyMatrix } from "@/lib/competencyMatrixStore";

const norm = (s?: string) => (s || "").trim().toLowerCase();

/**
 * Verilmiş vəzifə üçün aktiv səriştə matrisini tapır.
 * Vəzifəyə birebir uyğun matris yoxdursa, vəzifə təyin edilməmiş (ümumi)
 * aktiv matris, o da yoxdursa ilk aktiv matris istifadə olunur.
 */
export const resolveMatrixForPosition = (
  matrices: CompetencyMatrix[],
  position?: string,
): CompetencyMatrix | null => {
  const active = matrices.filter(m => m.status === "aktiv" && m.questions.length > 0);
  if (active.length === 0) return null;
  const p = norm(position);
  const exact = active.find(m => (m.positions || []).some(x => norm(x) === p && p !== ""));
  if (exact) return exact;
  const generic = active.find(m => !m.positions || m.positions.length === 0);
  return generic || active[0];
};

/** Matrisin cavab variantlarından maksimal bal (default 5). */
// Qiymətləndirmə şkalası Parametrlərdə seçilmiş default şkaladan gəlir
// (cavab variantlarının ən böyük balından asılı deyil).
export const matrixMaxScore = (_matrix?: CompetencyMatrix | null): number => {
  try {
    const max = Number(getScoreScale().max);
    return max > 0 ? max : 5;
  } catch {
    return 5;
  }
};
