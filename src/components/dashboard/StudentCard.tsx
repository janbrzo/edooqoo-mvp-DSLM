
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tables } from '@/integrations/supabase/types';
import { User, BookOpen, ChevronDown, ChevronRight, FileText, Calendar, ExternalLink, Trash2 } from 'lucide-react';
import { useWorksheetHistory } from '@/hooks/useWorksheetHistory';
import { DeleteWorksheetButton } from '@/components/DeleteWorksheetButton';
import { MediaBadges } from '@/components/worksheet/MediaBadges';
import { hasImage, hasAudio } from '@/utils/worksheetUtils';
import { useAllWorksheetHomework } from '@/hooks/useAllWorksheetHomework';
import { WorksheetHomeworkSection } from '@/components/worksheet/WorksheetHomeworkSection';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

type Student = Tables<'students'>;

interface StudentCardProps {
  student: Student;
  onViewHistory?: (studentId: string) => void;
  onOpenWorksheet?: (worksheet: any) => void;
  onDeleteStudent?: (studentId: string) => void;
}

export const StudentCard = ({ student, onViewHistory, onOpenWorksheet, onDeleteStudent }: StudentCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  // ✅ FIX: Use lightweight mode to avoid timeout
  const { worksheets, loading, getRecentWorksheets, deleteWorksheet, totalCount } = useWorksheetHistory(student.id, true);
  const recentWorksheets = getRecentWorksheets(3);
  
  // Fetch homework for recent worksheets
  const worksheetIds = recentWorksheets.map(w => w.id);
  const { homeworkByWorksheet } = useAllWorksheetHomework(worksheetIds, student.id);

  const formatGoal = (goal: string) => {
    const goalMap: Record<string, string> = {
      'work': 'Work/Business',
      'exam': 'Exam Preparation',
      'general': 'General English',
      'travel': 'Travel',
      'academic': 'Academic'
    };
    return goalMap[goal] || goal;
  };

  const handleWorksheetClick = (worksheet: any, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onOpenWorksheet) {
      onOpenWorksheet(worksheet);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-1 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Link to={`/student/${student.id}`} className="hover:underline">
              <CardTitle className="text-lg hover:text-primary transition-colors cursor-pointer">
                {student.name}
              </CardTitle>
            </Link>
          </div>
          <Badge variant="secondary">{student.english_level}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-1 pb-3">
        <div className="text-sm text-muted-foreground">
          <strong>Goal:</strong> {formatGoal(student.main_goal)}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>{totalCount} worksheets</span>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              asChild
              className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <Link to={`/student/${student.id}`}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View Profile
              </Link>
            </Button>
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                  Recent
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
        
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent>
            {loading ? (
              <div className="text-center py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : recentWorksheets.length > 0 ? (
              <div className="space-y-2 mt-2">
                {recentWorksheets.map((worksheet) => (
                  <React.Fragment key={worksheet.id}>
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors">
                      <div
                        className="flex items-center space-x-2 flex-1 min-w-0"
                        onClick={(e) => handleWorksheetClick(worksheet, e)}
                      >
                        {hasImage(worksheet) || hasAudio(worksheet) ? (
                          <MediaBadges 
                            hasImage={hasImage(worksheet)} 
                            hasAudio={hasAudio(worksheet)}
                            size="sm"
                            className="shrink-0"
                          />
                        ) : (
                          <FileText className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium truncate">
                          {worksheet.title || 'Untitled Worksheet'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(worksheet.created_at), 'MMM dd')}</span>
                        </div>
                        <DeleteWorksheetButton
                          worksheetId={worksheet.id}
                          worksheetTitle={worksheet.title || 'Untitled Worksheet'}
                          onDelete={deleteWorksheet}
                          size="sm"
                        />
                      </div>
                    </div>
                    <WorksheetHomeworkSection 
                      worksheetId={worksheet.id}
                      homework={homeworkByWorksheet[worksheet.id]}
                      compact={true}
                    />
                  </React.Fragment>
                ))}
                <Button
                  variant="link"
                  size="sm"
                  className="w-full text-xs mt-1"
                  asChild
                >
                  <Link to={`/student/${student.id}`}>
                    View All ({totalCount} total)
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2 mt-2">
                No worksheets generated yet
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
