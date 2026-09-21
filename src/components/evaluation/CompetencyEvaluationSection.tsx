// Səriştə üzrə qiymətləndirmə — həmkarların səriştə matrisi meyarları üzrə
// anonim qiymətləndirilməsi. Gözləyən / Tamamlanan tabları.
import { useEffect, useMemo, useState } from "react";
import { Award, Lock, Users, ListChecks, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PeerEvaluationDialog } from "@/components/evaluation/PeerEvaluationDialog";
import {
  buildPeerAssignments,
  CURRENT_CYCLE_ID,
  getInitials,
  MockEmployee,
} from "@/data/mockData";
import { getReviewsByReviewer, PEER_REVIEWS_EVT } from "@/lib/peerReviewStore";
import { useCompetencyMatrices, CompetencyMatrix } from "@/lib/competencyMatrixStore";
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
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener(PEER_REVIEWS_EVT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(PEER_REVIEWS_EVT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const submittedIds = useMemo(
    () => new Set(getReviewsByReviewer(employeeId, cycleId).map(r => r.revieweeId)),
    [employeeId, cycleId, version],
  );

  const pending = useMemo(() => peers.filter(p => !submittedIds.has(p.id)), [peers, submittedIds]);
  const completed = useMemo(() => peers.filter(p => submittedIds.has(p.id)), [peers, submittedIds]);

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
          <Badge variant="secondary" className="gap-1">
            <Users className="w-3 h-3" /> {peers.length} həmkar
          </Badge>
        </div>

        {peers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Bu dövr üçün sizə həmkar təyin edilməyib.
          </div>
        ) : (
          <Tabs defaultValue={pending.length > 0 ? "pending" : "completed"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-3.5 h-3.5" />
                Gözləyən ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tamamlanan ({completed.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="pt-4 space-y-4">
              {pending.length === 0 ? (
                <EmptyBox text="Gözləyən qiymətləndirmə yoxdur — bütün həmkarlar üzrə qiymət verilib." />
              ) : (
                <>
                  <PeerGrid peers={pending} matrices={matrices} />
                  <div className="flex justify-end">
                    <PeerEvaluationDialog
                      reviewerId={employeeId}
                      cycleId={cycleId}
                      peerIds={pending.map(p => p.id)}
                    />
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="completed" className="pt-4 space-y-4">
              {completed.length === 0 ? (
                <EmptyBox text="Hələ tamamlanmış qiymətləndirmə yoxdur." />
              ) : (
                <>
                  <PeerGrid peers={completed} matrices={matrices} done />
                  <div className="flex justify-end">
                    <PeerEvaluationDialog
                      reviewerId={employeeId}
                      cycleId={cycleId}
                      peerIds={completed.map(p => p.id)}
                      triggerVariant="outline"
                      triggerLabel="Qiymətləndirməyə bax"
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
};

const EmptyBox = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
    {text}
  </div>
);

const PeerGrid = ({
  peers,
  matrices,
  done,
}: {
  peers: MockEmployee[];
  matrices: CompetencyMatrix[];
  done?: boolean;
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {peers.map(p => {
      const matrix = resolveMatrixForPosition(matrices, p.position);
      return (
        <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
            {getInitials(p.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground truncate">{p.fullName}</p>
              {done && (
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-zone-green-text" /> Tamamlandı
                </Badge>
              )}
            </div>
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
);

export default CompetencyEvaluationSection;
