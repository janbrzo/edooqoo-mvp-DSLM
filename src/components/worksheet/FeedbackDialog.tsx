
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface FeedbackDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    selected: number | null;
    feedback: string;
    setFeedback: (feedback: string) => void;
    submitting: boolean;
    handleSubmit: () => void;
}

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
    isOpen,
    onOpenChange,
    selected,
    feedback,
    setFeedback,
    submitting,
    handleSubmit,
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" data-no-pdf="true">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-bold mb-1">
                        Your feedback is important!
                    </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center mt-3 mb-4">
                    {selected === 5 ? (
                        <ThumbsUp size={38} className="text-blue-500" />
                    ) : (
                        <ThumbsDown size={38} className="text-blue-500" />
                    )}
                </div>
                <label className="block text-base font-semibold mb-1 mt-2" htmlFor="feedbackTextarea">
                    What did you think about this worksheet? (optional)
                </label>
                <Textarea id="feedbackTextarea" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Your feedback helps us improve our worksheet generator" rows={4} className="mb-3" />
                <div className="flex justify-end space-x-2 mt-2">
                    <DialogClose asChild>
                        <Button size="sm" variant="outline" disabled={submitting}>Cancel</Button>
                    </DialogClose>
                    <Button
                        size="sm"
                        variant="default"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="bg-[#3d348b] text-white hover:bg-[#3d348b]/90"
                    >
                        {submitting ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default FeedbackDialog;
