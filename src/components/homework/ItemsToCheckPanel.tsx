import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setHomeworkItemVerdict, type ItemToCheck, type StoredItemRating } from "@/lib/homework/reviewItems";

interface ItemsToCheckPanelProps {
  homeworkId: string;
  exerciseIndex: number;
  items: ItemToCheck[];
  onRated: (itemEvaluations: StoredItemRating[]) => void;
}

/** Answers the key could not judge: the teacher decides, and the verdict counts in the DSLM. */
export function ItemsToCheckPanel({ homeworkId, exerciseIndex, items, onRated }: ItemsToCheckPanelProps) {
  const [busy, setBusy] = useState<number | null>(null);
  if (items.length === 0) return null;

  const rate = async (questionIndex: number, correct: boolean) => {
    setBusy(questionIndex);
    try {
      const res = await setHomeworkItemVerdict(homeworkId, exerciseIndex, questionIndex, correct);
      if (!res.success || !res.item_evaluations) {
        toast.error(res.error || "Could not save your decision");
        return;
      }
      onRated(res.item_evaluations);
      toast.success(correct ? "Marked correct" : "Marked incorrect");
    } catch {
      toast.error("Could not save your decision");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4 border-dashed bg-muted/30 space-y-3">
      <div>
        <p className="font-medium text-sm">Answers to check ({items.length})</p>
        <p className="text-xs text-muted-foreground">
          The answer key could not decide these. Your decision is counted in the student's progress.
        </p>
      </div>
      {items.map((item) => (
        <div key={item.questionIndex} className="space-y-2 rounded-md border bg-background p-3">
          <p className="text-sm font-medium">
            {item.questionIndex + 1}. {item.questionText}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Student: </span>{item.studentAnswer}
          </p>
          {item.expectedAnswer && (
            <p className="text-sm">
              <span className="text-muted-foreground">Key: </span>{item.expectedAnswer}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy === item.questionIndex} onClick={() => rate(item.questionIndex, true)}>
              {busy === item.questionIndex ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Correct
            </Button>
            <Button size="sm" variant="outline" disabled={busy === item.questionIndex} onClick={() => rate(item.questionIndex, false)}>
              <X className="h-4 w-4 mr-1" />
              Incorrect
            </Button>
          </div>
        </div>
      ))}
    </Card>
  );
}
