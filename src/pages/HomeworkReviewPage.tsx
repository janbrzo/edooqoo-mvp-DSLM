import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ExerciseSection from "@/components/worksheet/ExerciseSection";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Loader2, Calendar, User, Mail, CheckCircle2, FileText, 
  Send, ArrowLeft, MessageSquare, Clock, Eye
} from "lucide-react";
import { format } from "date-fns";
import { deepFixTextObjects } from "@/utils/textObjectFixer";
import { AiEvaluationBadge, type AiEvaluation } from "@/components/homework/AiEvaluationBadge";

interface HomeworkData {
  id: string;
  title: string;
  selected_exercises: any;
  deadline: string | null;
  created_at: string;
  completed_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  view_count: number;
  viewed_at: string | null;
  teacher_id: string;
  student_id: string;
  share_token: string;
  students?: {
    name: string;
    student_email: string | null;
    english_level: string;
  };
}

interface StudentAnswer {
  exercise_index: number;
  exercise_type: string;
  answers: Record<number, any>;
  is_submitted: boolean;
  submitted_at: string | null;
  ai_evaluation?: AiEvaluation | null;
}

interface TeacherComment {
  exercise_index: number;
  comment_text: string;
}

export default function HomeworkReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswer[]>([]);
  const [teacherComments, setTeacherComments] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [savingComment, setSavingComment] = useState<number | null>(null);

  // Check if user is authenticated teacher
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to review homework");
        navigate("/login");
        return;
      }
    };
    checkAuth();
  }, [navigate]);

  // Load homework data
  useEffect(() => {
    if (!id) {
      toast.error("Invalid homework ID");
      navigate("/dashboard");
      return;
    }
    loadHomework();
  }, [id]);

  const loadHomework = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load homework with student data
      const { data: homeworkData, error: homeworkError } = await supabase
        .from('homework_assignments')
        .select(`
          *,
          students(name, student_email, english_level)
        `)
        .eq('id', id)
        .eq('teacher_id', user.id)
        .single();

      if (homeworkError) throw homeworkError;

      if (!homeworkData) {
        toast.error("Homework not found or you don't have access");
        navigate("/dashboard");
        return;
      }

      // Fix text objects
      const fixedData = {
        ...homeworkData,
        selected_exercises: deepFixTextObjects(homeworkData.selected_exercises, 'homework.selected_exercises')
      };

      setHomework(fixedData as HomeworkData);

      // Load student answers if student email exists
      const studentEmail = homeworkData.students?.student_email;
      if (studentEmail) {
        // Use direct query to get ai_evaluation which RPC might not return
        const { data: answersData, error: answersError } = await supabase
          .from('homework_student_answers')
          .select('exercise_index, exercise_type, answers, is_submitted, submitted_at, ai_evaluation')
          .eq('homework_id', id)
          .eq('student_email', studentEmail);

        if (!answersError && answersData) {
          // Cast answers from JSON to Record<number, any>
          const typedAnswers: StudentAnswer[] = answersData.map((a: any) => ({
            ...a,
            answers: (a.answers || {}) as Record<number, any>,
            ai_evaluation: a.ai_evaluation as AiEvaluation | null
          }));
          setStudentAnswers(typedAnswers);
        }

        // Load existing teacher comments
        const { data: commentsData, error: commentsError } = await supabase
          .rpc('get_homework_comments', {
            p_homework_id: id,
            p_student_email: studentEmail
          });

        if (!commentsError && commentsData) {
          const commentsMap: Record<number, string> = {};
          commentsData.forEach((c: any) => {
            commentsMap[c.exercise_index] = c.comment_text;
          });
          setTeacherComments(commentsMap);
        }
      }
    } catch (error) {
      console.error('Error loading homework:', error);
      toast.error("Failed to load homework");
    } finally {
      setLoading(false);
    }
  };

  // Save teacher comment for an exercise
  const saveComment = useCallback(async (exerciseIndex: number, commentText: string) => {
    if (!homework?.students?.student_email) return;

    setSavingComment(exerciseIndex);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.rpc('save_teacher_comment', {
        p_homework_id: homework.id,
        p_exercise_index: exerciseIndex,
        p_student_email: homework.students.student_email,
        p_teacher_id: user.id,
        p_comment_text: commentText
      });

      toast.success("Comment saved");
    } catch (error) {
      console.error('Error saving comment:', error);
      toast.error("Failed to save comment");
    } finally {
      setSavingComment(null);
    }
  }, [homework]);

  // Send review to student (mark as reviewed)
  const sendReviewToStudent = async () => {
    if (!homework) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update homework as reviewed
      const { error } = await supabase
        .from('homework_assignments')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', homework.id);

      if (error) throw error;

      // Create notification for student (optional - could be email)
      toast.success("Review sent to student! They can now see correct answers and your comments.");
      
      // Reload to reflect changes
      await loadHomework();
    } catch (error) {
      console.error('Error sending review:', error);
      toast.error("Failed to send review");
    } finally {
      setIsSending(false);
    }
  };

  // Get student answer for a specific exercise
  const getStudentAnswerForExercise = (exerciseIndex: number): Record<number, any> => {
    const answer = studentAnswers.find(a => a.exercise_index === exerciseIndex);
    return answer?.answers || {};
  };
  
  // Get AI evaluation for a specific exercise
  const getAiEvaluationForExercise = (exerciseIndex: number): AiEvaluation | null => {
    const answer = studentAnswers.find(a => a.exercise_index === exerciseIndex);
    return answer?.ai_evaluation || null;
  };

  // Check if student has submitted
  const hasStudentSubmitted = studentAnswers.some(a => a.is_submitted);
  const submittedAt = studentAnswers.find(a => a.submitted_at)?.submitted_at;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!homework) {
    return null;
  }

  const studentName = homework.students?.name || 'Unknown Student';
  const studentEmail = homework.students?.student_email;
  const isReviewed = !!homework.reviewed_at;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link 
              to={`/student/${homework.student_id}`}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Student
            </Link>
            
            {!isReviewed && hasStudentSubmitted && (
              <Button 
                onClick={sendReviewToStudent}
                disabled={isSending}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Review to Student
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">
                {homework.title}
              </h1>
              
              {/* Status badges */}
              {isReviewed ? (
                <Badge className="bg-green-500 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Reviewed
                </Badge>
              ) : hasStudentSubmitted ? (
                <Badge className="bg-amber-500 text-white">
                  <Clock className="h-3 w-3 mr-1" />
                  Needs Review
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Waiting for Student
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>Student: <strong>{studentName}</strong></span>
              </div>
              
              {studentEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{studentEmail}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{homework.view_count} views</span>
              </div>
              
              {homework.deadline && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Deadline: {format(new Date(homework.deadline), "PPP HH:mm")}</span>
                </div>
              )}
              
              {submittedAt && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submitted: {format(new Date(submittedAt), "PPP HH:mm")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Exercises answered: </span>
                <strong>{studentAnswers.length}</strong> / {homework.selected_exercises?.length || 0}
              </div>
              {hasStudentSubmitted && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Student has submitted
                </Badge>
              )}
            </div>
            
            {homework.share_token && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/homework/${homework.share_token}`, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View as Student
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Exercises with student answers */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {Array.isArray(homework.selected_exercises) && homework.selected_exercises.map((exercise, index) => {
            const studentAnswer = getStudentAnswerForExercise(index);
            const hasAnswer = Object.keys(studentAnswer).length > 0;
            const aiEvaluation = getAiEvaluationForExercise(index);
            
            return (
              <div key={index} className="space-y-4">
                {/* Exercise */}
                <ExerciseSection
                  exercise={exercise}
                  index={index + 1}
                  isEditing={false}
                  viewMode="teacher"
                  editableWorksheet={{ exercises: homework.selected_exercises }}
                  setEditableWorksheet={() => {}}
                  hideExerciseMedia={false}
                  // Show student answers in read-only mode
                  isInteractive={false}
                  studentAnswers={studentAnswer as any}
                  showCorrectAnswers={true}
                />
                
                {/* AI Evaluation Badge - show for open-ended exercises */}
                {aiEvaluation && (
                  <div className="ml-4 mt-2">
                    <AiEvaluationBadge 
                      evaluation={aiEvaluation} 
                      showFeedback={true} 
                    />
                  </div>
                )}
                
                {/* Teacher comment section */}
                <Card className="p-4 bg-muted/30 border-dashed">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <Label className="font-medium">Your Comment for Exercise {index + 1}</Label>
                      {!hasAnswer && (
                        <Badge variant="secondary" className="text-xs">No student answer yet</Badge>
                      )}
                    </div>
                    
                    <Textarea
                      placeholder="Add feedback for the student about this exercise..."
                      value={teacherComments[index] || ''}
                      onChange={(e) => setTeacherComments(prev => ({
                        ...prev,
                        [index]: e.target.value
                      }))}
                      className="min-h-[80px]"
                    />
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveComment(index, teacherComments[index] || '')}
                      disabled={savingComment === index}
                    >
                      {savingComment === index ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Save Comment
                    </Button>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12">
          {!isReviewed && hasStudentSubmitted ? (
            <Button 
              onClick={sendReviewToStudent}
              disabled={isSending}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Send Review to Student
            </Button>
          ) : isReviewed ? (
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border-2 border-green-500">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                Review Sent!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {homework.reviewed_at && `Reviewed on ${format(new Date(homework.reviewed_at), "PPP HH:mm")}`}
              </p>
            </div>
          ) : (
            <Card className="p-6 bg-muted/30 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                Waiting for student to submit their answers...
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
