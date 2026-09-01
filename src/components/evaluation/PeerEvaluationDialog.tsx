import { useEffect, useMemo, useState } from "react";
import { Lock, ChevronRight, CheckCircle2, Star, ListChecks } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingCircles } from "@/components/evaluation/RatingCircles";
import {
  buildPeerAssignments,
  CURRENT_CYCLE_ID,
  getInitials,
  MockEmployee,
} from "@/data/mockData";
import { submitPeerReviews, hasReviewerSubmitted } from "@/lib/peerReviewStore";
import { useCompetencyMatrices, CompetencyMatrix } from "@/lib/competencyMatrixStore";
import { resolveMatrixForPosition, matrixMaxScore } from "@/lib/competencyEvaluation";
import { toast } from "sonner";

type ScoresMap = Record<string, number>;

interface PeerEvaluationDialogProps {
  reviewerId: string;
  cycleId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary";
}

export const PeerEvaluationDialog = ({
  reviewerId,
  cycleId = CURRENT_CYCLE_ID,
  triggerLabel = "Qiymətləndirməyə başla",
  triggerVariant = "default",
}: PeerEvaluationDialogProps) => {
  const [open, setOpen] = useState(false);
  const peers = useMemo(() => buildPeerAssignments(cycleId)[reviewerId] || [], [cycleId, reviewerId]);
  const matrices = useCompetencyMatrices();
  const alreadySubmitted = useMemo(() => hasReviewerSubmitted(reviewerId, cycleId), [open, reviewerId, cycleId]);

  // Hər həmkar üçün vəzifəsinə uyğun səriştə matrisi
  const matrixByPeer = useMemo(() => {
    const map: Record<string, CompetencyMatrix | null> = {};
    peers.forEach(p => { map[p.id] = resolveMatrixForPosition(matrices, p.position); });
    return map;
  }, [peers, matrices]);

  const [activeTab, setActiveTab] = useState<string>(peers[0]?.id || "");
  const [scoresByPeer, setScoresByPeer] = useState<Record<string, ScoresMap>>({});
  const [commentsByPeer, setCommentsByPeer] = useState<Record<string, string>>({});

  // Matris meyarları dəyişdikdə bal xanalarını sıfırla/uyğunlaşdır
  useEffect(() => {
    setScoresByPeer(prev => {
      const next: Record<string, ScoresMap> = {};
      peers.forEach(p => {
        const qs = matrixByPeer[p.id]?.questions || [];
        next[p.id] = qs.reduce((acc, q) => ({ ...acc, [q.id]: prev[p.id]?.[q.id] ?? 0 }), {} as ScoresMap);
      });
      return next;
    });
    setCommentsByPeer(prev => {
      const next: Record<string, string> = {};
      peers.forEach(p => { next[p.id] = prev[p.id] ?? ""; });
      return next;
    });
    if (!peers.some(p => p.id === activeTab)) setActiveTab(peers[0]?.id || "");
  }, [peers, matrixByPeer]);

  const hasCriteria = peers.some(p => (matrixByPeer[p.id]?.questions?.length || 0) > 0);
  const allComplete = peers.length > 0 && hasCriteria;

  const updateScore = (peerId: string, questionId: string, value: number) =>
    setScoresByPeer(prev => ({ ...prev, [peerId]: { ...(prev[peerId] || {}), [questionId]: value } }));

  const goNext = () => {
    const idx = peers.findIndex(p => p.id === activeTab);
    if (idx < peers.length - 1) setActiveTab(peers[idx + 1].id);
  };

  const submit = () => {
    if (!allComplete) return;
    submitPeerReviews(
      peers.map(p => ({
        cycleId,
        reviewerId,
        revieweeId: p.id,
        scores: (scoresByPeer[p.id] || {}) as any,
        comment: commentsByPeer[p.id] || "",
      }))
    );
    toast.success("Qiymətləndirmə təsdiqləndi", {
      description: `${peers.length} həmkar üçün anonim qiymət göndərildi.`,
    });
    setOpen(false);
  };

  if (peers.length === 0) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Star className="w-4 h-4" />
        Qiymətləndirmə üçün həmkar yoxdur
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className="gap-2">
          <Star className="w-4 h-4" />
          {alreadySubmitted ? "Qiymətləndirməni yenilə" : triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Anonim Həmkar Qiymətləndirməsi
          </DialogTitle>
          <DialogDescription>
            Suallar həmkarın vəzifəsinə uyğun səriştə matrisinin meyarlarından formalaşır. Qiymətlər tam anonimdir.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            {peers.map((p, i) => (
              <TabsTrigger key={p.id} value={p.id} className="gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">Həmkar {i + 1}: {p.fullName.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {peers.map(p => {
            const matrix = matrixByPeer[p.id];
            const max = matrixMaxScore(matrix);
            return (
              <TabsContent key={p.id} value={p.id} className="space-y-4 pt-4">
                <PeerHeaderCard peer={p} />

                <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">
                    Sizin verdiyiniz qiymət <strong>anonimdir</strong>. Qiymətləndirilən şəxs kimin qiymət verdiyini görməyəcək.
                  </p>
                </div>

                {!matrix ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Bu vəzifə üçün aktiv səriştə matrisi tapılmadı. Səriştə matrisi yaradılmalıdır.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ListChecks className="w-3.5 h-3.5" />
                      Səriştə matrisi: <span className="font-medium text-foreground">{matrix.name}</span>
                      <span>· {matrix.questions.length} meyar</span>
                    </div>

                    <div className="space-y-5">
                      {matrix.questions.map(q => (
                        <div key={q.id} className="space-y-2 p-3 rounded-lg border border-border bg-background">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-medium text-foreground">
                              {q.text}
                              {q.weight ? (
                                <span className="text-muted-foreground font-normal"> · çəki {q.weight}%</span>
                              ) : null}
                            </label>
                            <Badge variant={(scoresByPeer[p.id]?.[q.id] || 0) > 0 ? "default" : "secondary"}>
                              {scoresByPeer[p.id]?.[q.id] ?? 0} / {max} bal
                            </Badge>
                          </div>
                          <RatingCircles
                            value={scoresByPeer[p.id]?.[q.id] ?? 0}
                            max={max}
                            onChange={v => updateScore(p.id, q.id, v)}
                          />
                          {matrix.answers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {matrix.answers.map(a => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => updateScore(p.id, q.id, a.score)}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                    (scoresByPeer[p.id]?.[q.id] ?? 0) === a.score
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-secondary/60 text-foreground/70 hover:bg-secondary"
                                  }`}
                                >
                                  {a.label} ({a.score})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Anonim şərh <span className="text-muted-foreground font-normal">(opsional)</span>
                  </label>
                  <Textarea
                    placeholder="Bu həmkar haqqında anonim şərhinizi qeyd edin..."
                    value={commentsByPeer[p.id] ?? ""}
                    onChange={e =>
                      setCommentsByPeer(prev => ({ ...prev, [p.id]: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        <DialogFooter className="gap-2">
          {peers.findIndex(p => p.id === activeTab) < peers.length - 1 ? (
            <Button variant="outline" onClick={goNext} className="gap-2">
              Növbəti həmkara keç <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button disabled={!allComplete} onClick={submit} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Bütün qiymətləndirmələri təsdiqlə
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PeerHeaderCard = ({ peer }: { peer: MockEmployee }) => (
  <Card className="p-4 flex items-center gap-3">
    <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
      {getInitials(peer.fullName)}
    </div>
    <div className="min-w-0">
      <p className="text-base font-semibold text-foreground truncate">{peer.fullName}</p>
      <p className="text-xs text-muted-foreground truncate">
        {peer.position} · {peer.department}
      </p>
    </div>
  </Card>
);
