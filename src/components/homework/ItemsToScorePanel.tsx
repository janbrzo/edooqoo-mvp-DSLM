import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { setHomeworkItemScore, type ItemToScore, type StoredItemRating } from "@/lib/homework/reviewItems";

interface ItemsToScorePanelProps {
  homeworkId: string;
  exerciseIndex: number;
  items: ItemToScore[];
  onRated: (itemEvaluations: StoredItemRating[]) => void;
}

const DEFAULT_START = 70;

/** Open answers: the model's score is a proposal, the teacher's rating is what counts in the DSLM. */
export function ItemsToScorePanel({ homeworkId, exerciseIndex, items, onRated }: ItemsToScorePanelProps) {
  const [values, setValues] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  if (items.length === 0) return null;

  const save = async (item: ItemToScore) => {
    const value = values[item.questionIndex] ?? item.current ?? DEFAULT_START;
    setBusy(item.questionIndex);
    try {
      const res = await setHomeworkItemScore(homeworkId, exerciseIndex, item.questionIndex, value);
      if (!res.success || !res.item_evaluations) {
        toast.error(res.error || "Could not save your rating");
        return;
      }
      onRated(res.item_evaluations);
      toast.success("Rating saved");
    } catch {
      toast.error("Could not save your rating");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 border-dashed bg-muted/30 space-y-3">
      <div>
        <p className="font-medium text-sm">Your rating</p>
        <p className="text-xs text-muted-foreground">
          The automatic score is only a proposal. Set what you think the answer deserves; it is what the student's progress uses.
        </p>
      </div>
      {items.map((item) => {
        const value = values[item.questionIndex] ?? item.current ?? DEFAULT_START;
        return (
          <div key={item.questionIndex} className="space-y-2 rounded-md border bg-background p-3">
            <p className="text-sm font-medium">{item.questionIndex + 1}. {item.questionText}</p>
            <p className="text-sm whitespace-pre-wrap">
              <span className="text-muted-foreground">Student: </span>{item.studentAnswer || "(no written answer)"}
            </p>
            <div className="flex items-center gap-3">
              <Slider
                min={0}
                max={100}
                step={5}
                value={[value]}
                onValueChange={([v]) => setValues((prev) => ({ ...prev, [item.questionIndex]: v }))}
                className="flex-1"
                aria-label={`Rating for question ${item.questionIndex + 1}`}
              />
              <span className="w-12 text-right text-sm tabular-nums">{value}%</span>
              <Button size="sm" variant="outline" disabled={busy === item.questionIndex} onClick={() => save(item)}>
                {busy === item.questionIndex ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {item.source === 'teacher'
                ? "Your rating"
                : item.current === null ? "Not rated automatically" : `Automatic score: ${item.current}%`}
            </p>
          </div>
        );
      })}
    </Card>
  );
}
