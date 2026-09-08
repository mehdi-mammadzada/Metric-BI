// Review statusunu dəyiş — Metric BI dizayn sisteminə uyğun modal.
// Radio kartlar + status-a bağlı qeyd sahəsi (təxirə salındı / keçirilmədi məcburi).
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, CalendarClock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReviewStatusValue = "held" | "in_progress" | "deferred" | "missed";
export type SelectableReviewStatus = Exclude<ReviewStatusValue, "in_progress">;

const OPTIONS: {
  value: SelectableReviewStatus;
  label: string;
  desc: string;
  icon: typeof Check;
  color: string;
  ring: string;
  iconBg: string;
  iconColor: string;
}[] = [
  { value: "held", label: "Keçirildi", desc: "Review tamamlanıb.", icon: Check, color: "text-emerald-600", ring: "border-emerald-500 bg-emerald-500/5", iconBg: "bg-emerald-500/15", iconColor: "text-emerald-600" },
  { value: "deferred", label: "Təxirə salındı", desc: "Review başqa tarixə ertələnib.", icon: CalendarClock, color: "text-violet-600", ring: "border-violet-500 bg-violet-500/5", iconBg: "bg-violet-500/15", iconColor: "text-violet-600" },
  { value: "missed", label: "Keçirilmədi", desc: "Review dövrü bitib, lakin review keçirilməyib.", icon: XCircle, color: "text-rose-600", ring: "border-rose-500 bg-rose-500/5", iconBg: "bg-rose-500/15", iconColor: "text-rose-600" },
];

const CURRENT_META: Record<ReviewStatusValue, { label: string; cls: string }> = {
  held: { label: "Keçirildi", cls: "bg-emerald-500/15 text-emerald-700" },
  in_progress: { label: "İcrada", cls: "bg-amber-500/15 text-amber-700" },
  deferred: { label: "Təxirə salındı", cls: "bg-violet-500/15 text-violet-700" },
  missed: { label: "Keçirilmədi", cls: "bg-rose-500/15 text-rose-700" },
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentStatus: ReviewStatusValue;
  onSave: (v: { status: ReviewStatusValue; comment: string }) => void;
}

const ReviewStatusChangeDialog = ({ open, onOpenChange, currentStatus, onSave }: Props) => {
  const [status, setStatus] = useState<ReviewStatusValue>(currentStatus);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setComment("");
      setTouched(false);
    }
  }, [open, currentStatus]);

  const required = status === "deferred" || status === "missed";
  const labels = useMemo(() => {
    switch (status) {
      case "held": return { label: "Qeyd (istəyə bağlı)", placeholder: "Yekun qeydi daxil edin...", helper: "Review tamamlanması ilə bağlı əlavə qeyd yazıla bilər." };
      case "in_progress": return { label: "Qeyd (istəyə bağlı)", placeholder: "Review prosesi barədə qeyd daxil edin...", helper: "İcra prosesi ilə bağlı əlavə qeyd yazıla bilər." };
      case "deferred": return { label: "Qeyd *", placeholder: "Təxirə salınma səbəbini daxil edin...", helper: "Statusu dəyişmək üçün qeyd məcburidir.", err: "Təxirə salınma səbəbi daxil edilməlidir." };
      case "missed": return { label: "Qeyd *", placeholder: "Review-un keçirilməməsinin səbəbini daxil edin...", helper: "Statusu dəyişmək üçün qeyd məcburidir.", err: "Review-un keçirilməmə səbəbi daxil edilməlidir." };
    }
  }, [status]);

  const invalid = required && !comment.trim();
  const overLimit = comment.length > 250;

  const handleSave = () => {
    if (invalid) { setTouched(true); return; }
    if (overLimit) return;
    onSave({ status, comment: comment.trim() });
  };

  const cur = CURRENT_META[currentStatus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[740px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Review statusunu dəyiş</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Hazırkı status:</span>
            <Badge className={cn(cur.cls, "hover:" + cur.cls)}>{cur.label}</Badge>
          </div>
          <div className="border-t border-border" />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Yeni status seçin</h4>
            <div className="space-y-3">
              {OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all duration-150",
                      selected ? opt.ring : "border-border bg-background hover:bg-secondary/40 hover:shadow-sm",
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      selected ? `border-current ${opt.color}` : "border-muted-foreground/40",
                    )}>
                      {selected && <span className={cn("w-2.5 h-2.5 rounded-full bg-current", opt.color)} />}
                    </span>
                    <span className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", opt.iconBg)}>
                      <Icon className={cn("w-5 h-5", opt.iconColor)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-semibold", selected ? opt.color : "text-foreground")}>{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground">{labels?.label}</label>
            <p className="text-xs text-muted-foreground mt-0.5">{labels?.helper}</p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={4}
              maxLength={250}
              placeholder={labels?.placeholder}
              className={cn(
                "mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30",
                touched && invalid ? "border-destructive focus:ring-destructive/30" : "border-border",
              )}
            />
            <div className="flex items-center justify-between mt-1">
              {touched && invalid && labels && "err" in labels ? (
                <span className="text-xs text-destructive">{labels.err}</span>
              ) : <span />}
              <span className={cn("text-xs tabular-nums", overLimit ? "text-destructive" : "text-muted-foreground")}>{comment.length} / 250</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv et</Button>
            <Button onClick={handleSave} disabled={invalid || overLimit}>Yadda saxla</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewStatusChangeDialog;
