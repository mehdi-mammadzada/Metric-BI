// Səriştə üzrə qiymətləndirmə — həmkarların səriştə kateqoriyaları üzrə
// anonim qiymətləndirilməsi və şəxsi anonim nəticələrin göstərilməsi.
import { useMemo } from "react";
import { Award, Lock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PeerEvaluationDialog } from "@/components/evaluation/PeerEvaluationDialog";
import { MyAnonymousScores } from "@/components/evaluation/MyAnonymousScores";
import {
  buildPeerAssignments,
  CURRENT_CYCLE_ID,
  EVALUATION_CATEGORIES,
  getInitials,
} from "@/data/mockData";
import { hasReviewerSubmitted } from "@/lib/peerReviewStore";

interface Props {
  employeeId: string;
  cycleId?: string;
}

export const CompetencyEvaluationSection = ({ employeeId, cycleId = CURRENT_CYCLE_ID }: Props) => {
  const peers = useMemo(
    () => buildPeerAssignments(cycleId)[employeeId] || [],
    [cycleId, employeeId],
  );
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
              <Lock className="w-3 h-3" /> Qiymətlər anonimdir — kimin bal verdiyi göstərilmir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={submitted ? "default" : "secondary"} className="gap-1">
              <Users className="w-3 h-3" /> {peers.length} həmkar
            </Badge>
            <PeerEvaluationDialog reviewerId={employeeId} cycleId={cycleId} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {EVALUATION_CATEGORIES.map(c => (
            <span
              key={c.key}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary/60 text-foreground/70"
            >
              {c.label}
            </span>
          ))}
        </div>

        {peers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Bu dövr üçün sizə həmkar təyin edilməyib.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {peers.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {getInitials(p.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.position} · {p.department}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <MyAnonymousScores employeeId={employeeId} cycleId={cycleId} />
    </div>
  );
};

export default CompetencyEvaluationSection;
