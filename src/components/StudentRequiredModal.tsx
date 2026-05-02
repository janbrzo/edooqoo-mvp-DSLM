import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";

interface StudentRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description?: string;
}

export const StudentRequiredModal: React.FC<StudentRequiredModalProps> = ({
  open,
  onOpenChange,
  featureName,
  description
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[100]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              <UserCheck className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>{featureName} — Student Required</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {description || `The "${featureName}" feature is available when a worksheet is assigned to a student. Use the student selector (👥 icon) in the worksheet header to assign this worksheet to a student.`}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg my-4">
          <h4 className="font-semibold text-sm mb-2">Why assign a student?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Flashcard sets linked to student progress</li>
            <li>✓ Student notes & skill assessments</li>
            <li>✓ Lesson ideas tied to student profile</li>
            <li>✓ Homework assignments</li>
            <li>✓ Live session quick notes</li>
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
