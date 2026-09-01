// Səriştə üzrə qiymətləndirmə — həmkarların səriştə matrisi meyarları üzrə
// anonim qiymətləndirilməsi.
import { useMemo } from "react";
import { Award, Lock, Users, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeerEvaluationDialog } from "@/components/evaluation/PeerEvaluationDialog";
import {
  buildPeerAssignments,
  CURRENT_CYCLE_ID,
  getInitials,
} from "@/data/mockData";
import { hasReviewerSubmitted } from "@/lib/peerReviewStore";
import { useCompetencyMatrices } from "@/lib/competencyMatrixStore";
import { resolveMatrixForPosition } from "@/lib/competencyEvaluation";

interface Props {
  employeeId: string;
  cycleId?: string;
}

export const CompetencyEvaluationSection = ({ employeeId, cycleId = CURRENT_CYCLE_ID }: Props) => {
  const peers = useMemo(
    () => buildPeerAssignments(cycleId)[employeeId] || [],
    [cycleId, employeeId],
  );
  const matrices = useCompetencyMatrices();
  const submitted = hasReviewerSubmitted(employeeId, cycleId);

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Səriştə üzrə qiymətləndirmə
            </h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Suallar seçilmiş səriştə matrisinin meyarlarından gəlir — qiymətlər anonimdir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={submitted ? "default" : "secondary"} className="gap-1">
              <Users className="w-3 h-3" /> {peers.length} həmkar
            </Badge>
            <PeerEvaluationDialog reviewerId={employeeId} cycleId={cycleId} />
          </div>
        </div>

        {peers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Bu dövr üçün sizə həmkar təyin edilməyib.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {peers.map(p => {
              const matrix = resolveMatrixForPosition(matrices, p.position);
              return (
                <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {getInitials(p.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.position} · {p.department}</p>
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-muted-foreground truncate">
                      <ListChecks className="w-3 h-3 shrink-0" />
                      {matrix
                        ? `${matrix.name} · ${matrix.questions.length} meyar`
                        : "Səriştə matrisi təyin edilməyib"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CompetencyEvaluationSection;
