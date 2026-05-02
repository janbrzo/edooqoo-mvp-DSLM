import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

interface InteractiveExerciseWrapperProps {
  children: ReactNode;
  exerciseIndex: number;
  exerciseTitle: string;
  teacherComment?: string;
  hasAnswers: boolean;
}

export const InteractiveExerciseWrapper = ({
  children,
  exerciseIndex,
  exerciseTitle,
  teacherComment,
  hasAnswers
}: InteractiveExerciseWrapperProps) => {
  return (
    <div className="relative">
      {/* Answer status indicator */}
      {hasAnswers && (
        <Badge 
          variant="outline" 
          className="absolute -top-2 right-2 bg-green-50 text-green-700 border-green-300"
        >
          Answered
        </Badge>
      )}

      {/* Exercise content */}
      {children}

      {/* Teacher comment (if viewing submitted homework) */}
      {teacherComment && (
        <Card className="mt-4 p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <Label className="text-sm font-medium text-blue-800">
                Teacher's Comment
              </Label>
              <p className="text-sm text-blue-700 mt-1">{teacherComment}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
