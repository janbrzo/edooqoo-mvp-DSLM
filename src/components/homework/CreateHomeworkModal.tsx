import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2, Copy, Check, Mail, ExternalLink, Clock, AlertCircle, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useHomeworkExerciseGeneration } from "@/hooks/useHomeworkExerciseGeneration";

interface CreateHomeworkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetTitle: string;
  exercises: any[];
  teacherId: string;
  students: Array<{
    id: string;
    name: string;
    english_level: string;
    student_email?: string | null;
  }>;
  preselectedStudent?: string;
  worksheetFormData?: any;
  // PROBLEM 1.1: Media availability for exercise type filtering
  worksheetHasPicture?: boolean;
  worksheetHasAudio?: boolean;
}

// PROBLEM 1.1: Exercise type categories for filtering
// PROBLEM 4.2: Removed 'describe' duplicate - only 'describe-picture' exists
const PICTURE_EXERCISES = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
const AUDIO_EXERCISES = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'multiple-choice-audio', 'fill-in-blanks-audio'];
const GENERAL_EXERCISES = [
  'fill-in-blanks', 'multiple-choice', 'matching', 'true-false', 'word-order', 
  'gap-text', 'answer-questions', 'paraphrasing', 'sentence-transformation', 
  'odd-one-out', 'synonyms-antonyms', 'matching-halves', 'complete-word', 
  'categorize', 'negative-prefixes', 'dialogue', 'discussion', 'error-correction', 'reading'
];

export function CreateHomeworkModal({
  open,
  onOpenChange,
  worksheetId,
  worksheetTitle,
  exercises,
  teacherId,
  students,
  preselectedStudent,
  worksheetFormData,
  worksheetHasPicture = false,
  worksheetHasAudio = false
}: CreateHomeworkModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedExercises, setSelectedExercises] = useState<Set<number>>(new Set());
  const [deadline, setDeadline] = useState<Date | undefined>(() => {
    // Default deadline: current time + 6 days (keeps current hour/minute)
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 6);
    return defaultDeadline;
  });
  const [deadlineTime, setDeadlineTime] = useState<string>(() => {
    // Default time: current hour and minute (e.g., "14:30")
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [sendReminder, setSendReminder] = useState<boolean>(true);
  const [reminderHours, setReminderHours] = useState<string>("24");
  const [sendToTeacher, setSendToTeacher] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [studentEmailFromDB, setStudentEmailFromDB] = useState<string>("");
  const [studentEmailInput, setStudentEmailInput] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [createdHomeworkId, setCreatedHomeworkId] = useState<string>('');
  const [existingHomework, setExistingHomework] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState<string | null>(null);
  const [selectedGeneratedTypes, setSelectedGeneratedTypes] = useState<string[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [generationSeconds, setGenerationSeconds] = useState(0);
  
  // Initialize exercise generation hook
  const {
    generatedExercises,
    isGenerating: isGeneratingExercises,
    generateSimilarExercises,
    toggleExerciseSelection,
    clearGeneratedExercises,
    getSelectedGeneratedExercises,
    lastPrompt
  } = useHomeworkExerciseGeneration();
  
  // Set preselected student when modal opens
  useEffect(() => {
    if (preselectedStudent && open) {
      setSelectedStudentId(preselectedStudent);
    }
  }, [preselectedStudent, open]);

  // Fetch teacher email when modal opens
  useEffect(() => {
    if (open && teacherId && !teacherEmail) {
      const fetchTeacherEmail = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', teacherId)
          .maybeSingle();
        
        if (!error && data?.email) {
          setTeacherEmail(data.email);
        }
      };
      fetchTeacherEmail();
    }
  }, [open, teacherId, teacherEmail]);

  // Timer for generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingExercises) {
      setGenerationSeconds(0);
      interval = setInterval(() => {
        setGenerationSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingExercises]);

  // Check for existing homework when modal opens
  useEffect(() => {
    if (open && worksheetId) {
      checkForExistingHomework();
    }
  }, [open, worksheetId]);

  const checkForExistingHomework = async () => {
    try {
      setCheckingDuplicate(true);
      const { data, error } = await supabase
        .from('homework_assignments')
        .select('id, title, share_token, created_at')
        .eq('source_worksheet_id', worksheetId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setExistingHomework(data);
    } catch (error) {
      console.error('Error checking for existing homework:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const toggleExercise = (index: number) => {
    const newSelected = new Set(selectedExercises);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedExercises(newSelected);
  };

  const handleCopyUrl = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Homework link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const sendHomeworkEmail = async (homeworkId: string, studentEmail: string, isReminder: boolean = false) => {
    try {
      setIsSendingEmail(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('send-homework-email', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          homeworkId,
          studentEmail,
          updateStudentEmail: !studentEmailFromDB, // Update if email wasn't in DB
          isReminder, // Pass isReminder flag
        },
      });

      if (error) throw error;

      toast.success(`Homework notification sent to ${studentEmail}`);
      
      // If sendToTeacher is enabled, send email to teacher as well
      if (sendToTeacher && teacherEmail && !isReminder) {
        console.log('[CreateHomeworkModal] Sending email to teacher:', teacherEmail);
        const { error: teacherEmailError } = await supabase.functions.invoke('send-homework-email', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: {
            homeworkId,
            studentEmail: teacherEmail,
            updateStudentEmail: false,
            isReminder: false,
          },
        });
        
        if (teacherEmailError) {
          console.error('Error sending email to teacher:', teacherEmailError);
          // Don't fail the whole operation if teacher email fails
        } else {
          console.log('[CreateHomeworkModal] Email sent to teacher successfully');
        }
      }
    } catch (error: any) {
      console.error('Error sending homework email:', error);
      toast.error(error.message || "Failed to send homework email. You can still share the link manually.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const generateHomework = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student");
      return;
    }

    // Check if at least one exercise (original OR generated) is selected
    const hasOriginalExercises = selectedExercises.size > 0;
    const hasGeneratedExercises = getSelectedGeneratedExercises().length > 0;
    
    if (!hasOriginalExercises && !hasGeneratedExercises) {
      toast.error("Please select at least one exercise (original or generated)");
      return;
    }

    setIsGenerating(true);

    try {
      // AI evaluation already triggered by WorksheetDisplay.handleCreateHomework (before modal opened)

      const student = students.find(s => s.id === selectedStudentId);
      
      // Get selected exercises data from both original and generated
      const originalExercisesData = Array.from(selectedExercises)
        .sort((a, b) => a - b)
        .map(index => exercises[index])
        .filter(Boolean);
      
      const selectedGeneratedExercisesData = getSelectedGeneratedExercises();
      
      // Combine original and generated exercises
      const exercisesData = [...originalExercisesData, ...selectedGeneratedExercisesData];
      
      // Get student email from DB
      const { data: studentData } = await supabase
        .from('students')
        .select('student_email')
        .eq('id', selectedStudentId)
        .single();
      
      const studentEmail = studentData?.student_email || '';

      // Create homework assignment
      // IMPORTANT: deadline time from user's time picker
      let finalDeadline: string | null = null;
      if (deadline && deadlineTime) {
        // Combine: date from calendar + time from time picker
        const selectedDate = new Date(deadline);
        const [hours, minutes] = deadlineTime.split(':').map(Number);
        
        selectedDate.setHours(hours, minutes, 0, 0);
        
        finalDeadline = selectedDate.toISOString();
        console.log('[CreateHomeworkModal] Final deadline:', finalDeadline, 'Local:', selectedDate, 'Time:', deadlineTime);
      }

      const { data: homework, error: insertError } = await supabase
        .from('homework_assignments')
        .insert({
          teacher_id: teacherId,
          student_id: selectedStudentId,
          source_worksheet_id: worksheetId,
          title: `${worksheetTitle} - Homework for ${student?.name}`,
          selected_exercises: exercisesData,
          deadline: finalDeadline,
          reminder_hours: sendReminder ? parseInt(reminderHours) : null,
          prompt: lastPrompt || null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Generate share token
      const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_homework_share_token', {
          p_homework_id: homework.id,
          p_teacher_id: teacherId
        });

      if (tokenError) throw tokenError;

      const baseUrl = window.location.origin;
      const url = `${baseUrl}/homework/${tokenData}`;
      setShareUrl(url);
      setCreatedHomeworkId(homework.id);
      setStudentEmailFromDB(studentEmail);
      setStudentEmailInput(studentEmail); // Pre-fill email input
      setShowSuccessView(true); // Always show success view instead of auto-sending

      // AI evaluations already processed before homework creation (see above)

      // Emit event for other components to refresh
      window.dispatchEvent(
        new CustomEvent("homeworkCreated", {
          detail: {
            homeworkId: homework.id,
            studentId: selectedStudentId,
            worksheetId,
          },
        })
      );

      toast.success("Homework assignment created successfully!");
    } catch (error: any) {
      console.error('Error creating homework:', error);
      toast.error(error.message || "Failed to create homework assignment");
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSendEmailFromSuccess = async () => {
    if (!studentEmailInput) {
      toast.error("Please enter the student's email address.");
      return;
    }
    
    await sendHomeworkEmail(createdHomeworkId, studentEmailInput);
  };
  
  const handleClose = () => {
    setSelectedStudentId("");
    setSelectedExercises(new Set());
    setDeadline(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)); // Reset to +6 days
    setSendReminder(true);
    setReminderHours("24");
    setSendToTeacher(false);
    setIsGenerating(false);
    setShareUrl("");
    setCopied(false);
    setShowSuccessView(false);
    setStudentEmailFromDB('');
    setStudentEmailInput('');
    setIsSendingEmail(false);
    setCreatedHomeworkId('');
    setExistingHomework(null);
    onOpenChange(false);
  };

  const handleOpenInNewTab = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Homework Assignment</DialogTitle>
          <DialogDescription>
            Create a homework assignment from "{worksheetTitle}"
          </DialogDescription>
        </DialogHeader>

        {/* Existing Homework Alert */}
        {existingHomework && !showSuccessView && (
          <Alert className="border-amber-500 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This worksheet already has homework created:{" "}
              <strong>{existingHomework.title}</strong>
              {existingHomework.share_token && (
                <>
                  {" • "}
                  <Link 
                    to={`/homework/${existingHomework.share_token}`}
                    target="_blank"
                    className="underline hover:text-amber-900"
                  >
                    View existing homework
                  </Link>
                </>
              )}
              {" • Created: " + format(new Date(existingHomework.created_at), 'MMM dd, yyyy')}
            </AlertDescription>
          </Alert>
        )}

        {showSuccessView ? (
          // Success view with email option
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center text-green-500 mb-4">
              <Check className="h-16 w-16" />
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Homework Created!</h3>
              <p className="text-sm text-muted-foreground">
                Share this link with {selectedStudent?.name}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Shareable Link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="flex-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  title="Copy link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleOpenInNewTab}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this link or open homework in new tab to preview.
              </p>
            </div>

            {/* Email section */}
            <div className="space-y-3 pt-4 border-t">
              <Label htmlFor="student-email">Send Email Notification</Label>
              <Input
                id="student-email"
                type="email"
                placeholder="student@example.com"
                value={studentEmailInput}
                onChange={(e) => setStudentEmailInput(e.target.value)}
                disabled={isSendingEmail}
              />
              
              {/* Checkbox "send also to me" - show teacher email */}
              {teacherEmail && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="send-to-teacher"
                    checked={sendToTeacher}
                    onCheckedChange={(checked) => setSendToTeacher(checked as boolean)}
                  />
                  <Label htmlFor="send-to-teacher" className="text-sm font-normal cursor-pointer">
                    Send also to me ({teacherEmail})
                  </Label>
                </div>
              )}
              
              {!studentEmailFromDB && (
                <p className="text-xs text-muted-foreground">
                  This student doesn't have an email saved. Enter it to send notification.
                </p>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSendEmailFromSuccess}
                  disabled={isSendingEmail || !studentEmailInput}
                  className="flex-1"
                  variant="secondary"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full" variant="outline">
              Done (skip sending email)
            </Button>
          </div>
        ) : (
          // Creation form
          <div className="space-y-6 py-4">
            {/* Student Selection */}
            <div className="space-y-2">
              <Label htmlFor="student">Select Student</Label>
              <select
                id="student"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">Choose a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.english_level})
                  </option>
                ))}
              </select>
            </div>

            {/* Exercise Selection */}
            <div className="space-y-2">
              <Label>Select Exercises from Worksheet</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                These are the exact exercises from the original worksheet
              </p>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                {exercises.map((exercise, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`exercise-${index}`}
                      checked={selectedExercises.has(index)}
                      onCheckedChange={() => toggleExercise(index)}
                    />
                    <Label
                      htmlFor={`exercise-${index}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      Exercise {index + 1}: {exercise.type || 'Unknown'}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedExercises.size} exercise{selectedExercises.size !== 1 ? 's' : ''} selected
              </p>
            </div>

            {/* Generate More Exercises Section */}
            {worksheetFormData && (
              <div className="space-y-3 border-t pt-4">
                <Label>Generate Additional Exercises</Label>
                
                {/* Exercise Type Selection - SHOW ALL 21 TYPES */}
                <div className="space-y-2">
                  <Label className="text-sm">Select Exercise Types:</Label>
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-1.5">
                    {(() => {
                      // PROBLEM 1.1: All exercise types with labels
                      // PROBLEM 4.2: Removed 'describe' duplicate entry
                      const EXERCISE_TYPES_MAP: Record<string, string> = {
                        // General exercises (always available)
                        'fill-in-blanks': 'Fill in the Blanks',
                        'multiple-choice': 'Multiple Choice',
                        'matching': 'Matching',
                        'true-false': 'True/False',
                        'word-order': 'Word Order',
                        'gap-text': 'Gap Text',
                        'answer-questions': 'Answer Questions',
                        'paraphrasing': 'Paraphrasing',
                        'sentence-transformation': 'Sentence Transformation',
                        'odd-one-out': 'Odd One Out',
                        'synonyms-antonyms': 'Synonyms & Antonyms',
                        'matching-halves': 'Matching Halves',
                        'complete-word': 'Complete Word',
                        'categorize': 'Categorize',
                        'negative-prefixes': 'Negative Prefixes',
                        'dialogue': 'Dialogue Practice',
                        'discussion': 'Discussion Questions',
                        'error-correction': 'Error Correction',
                        'reading': 'Reading Comprehension',
                        // Picture exercises (only if worksheet has picture)
                        'describe-picture': 'Describe Picture',
                        'answer-questions-picture': 'Answer Questions (Picture)',
                        'true-false-picture': 'True/False (Picture)',
                        'multiple-choice-picture': 'Multiple Choice (Picture)',
                        // Audio exercises (only if worksheet has audio)
                        'listening-comprehension': 'Listening Comprehension',
                        'answer-questions-audio': 'Answer Questions (Audio)',
                        'true-false-audio': 'True/False (Audio)',
                        'multiple-choice-audio': 'Multiple Choice (Audio)',
                        'fill-in-blanks-audio': 'Fill in the Blanks (Audio)',
                      };
                      
                      // PROBLEM 1.1: Filter available types based on worksheet media
                      const getAvailableTypes = () => {
                        let available = [...GENERAL_EXERCISES];
                        if (worksheetHasPicture) {
                          available = [...available, ...PICTURE_EXERCISES];
                        }
                        if (worksheetHasAudio) {
                          available = [...available, ...AUDIO_EXERCISES];
                        }
                        return available;
                      };
                      
                      const availableTypes = getAvailableTypes();
                      
                      return Object.entries(EXERCISE_TYPES_MAP)
                        .filter(([exerciseId]) => availableTypes.includes(exerciseId))
                        .map(([exerciseId, exerciseName]) => (
                        <div key={exerciseId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`gen-type-${exerciseId}`}
                            checked={selectedGeneratedTypes.includes(exerciseId)}
                            disabled={!selectedGeneratedTypes.includes(exerciseId) && selectedGeneratedTypes.length >= 6}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // PROBLEM 4.4: Max 6 exercise types
                                if (selectedGeneratedTypes.length >= 6) {
                                  toast.error("Maximum 6 exercise types can be selected");
                                  return;
                                }
                                setSelectedGeneratedTypes(prev => [...prev, exerciseId]);
                              } else {
                                setSelectedGeneratedTypes(prev => prev.filter(t => t !== exerciseId));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`gen-type-${exerciseId}`}
                            className={`text-sm font-normal cursor-pointer ${!selectedGeneratedTypes.includes(exerciseId) && selectedGeneratedTypes.length >= 6 ? 'opacity-50' : ''}`}
                          >
                            {exerciseName}
                          </Label>
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedGeneratedTypes.length} type{selectedGeneratedTypes.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                
                {/* Additional Instructions Field */}
                <div className="space-y-2">
                  <Label htmlFor="additionalInstructions">
                    Additional Instructions for AI (Optional)
                  </Label>
                  <Textarea
                    id="additionalInstructions"
                    placeholder="e.g., Focus more on business vocabulary, include idioms, make exercises more challenging..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Provide specific instructions to customize generated exercises
                  </p>
                </div>
              
              {/* Generate Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (selectedGeneratedTypes.length === 0) {
                    toast.error("Please select at least one exercise type");
                    return;
                  }
                  generateSimilarExercises(worksheetFormData, teacherId, {
                    targetTypes: selectedGeneratedTypes,
                    countPerType: 1,
                    additionalInstructions: additionalInstructions.trim() || undefined
                    });
                  }}
                  disabled={isGeneratingExercises || selectedGeneratedTypes.length === 0}
                >
                  {isGeneratingExercises ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating... ({generationSeconds}s)
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Selected
                    </>
                  )}
                </Button>
                {isGeneratingExercises && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {/* PROBLEM 4.6: Better time prediction - 25s base + 7s per type */}
                    Expected time: ~{(() => {
                      const expectedSeconds = 25 + selectedGeneratedTypes.length * 7;
                      if (expectedSeconds >= 60) {
                        const mins = Math.floor(expectedSeconds / 60);
                        const secs = expectedSeconds % 60;
                        return `${mins}:${secs.toString().padStart(2, '0')} min`;
                      }
                      return `${expectedSeconds}s`;
                    })()}
                  </p>
                )}
                
                {/* Clear Button */}
                {generatedExercises.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={clearGeneratedExercises}
                  >
                    Clear Generated
                  </Button>
                )}
                
                {/* Generated Exercises List */}
                {generatedExercises.length > 0 && (
                  <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2 bg-amber-50/30">
                    <p className="text-xs text-muted-foreground mb-2">
                      Generated exercises (select to include):
                    </p>
                    {generatedExercises.map((exercise) => (
                      <div key={exercise.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={exercise.id}
                          checked={exercise.selected}
                          onCheckedChange={() => toggleExerciseSelection(exercise.id)}
                        />
                        <Label
                          htmlFor={exercise.id}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {exercise.title || `${exercise.type} exercise`}
                        </Label>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      {getSelectedGeneratedExercises().length} generated exercise{getSelectedGeneratedExercises().length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Deadline Selection */}
            <div className="space-y-2">
              <Label>Deadline (Optional)</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deadline ? format(deadline, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={setDeadline}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Time Picker */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            {/* Reminder Hours Dropdown */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="send-reminder" 
                    checked={sendReminder}
                    onCheckedChange={setSendReminder}
                  />
                  <Label htmlFor="send-reminder" className="cursor-pointer">Send Reminder Before Deadline</Label>
                </div>
              </div>
              
              {sendReminder && (
                <div className="space-y-2">
                  <Label htmlFor="reminder-hours" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Send Reminder Before Deadline
                  </Label>
                  <Select value={reminderHours} onValueChange={setReminderHours}>
                    <SelectTrigger id="reminder-hours">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        // Calculate hours until deadline using effective deadline (selected date + current time)
                        const hoursUntilDeadline = deadline 
                          ? (() => {
                              const now = new Date();
                              const effectiveDeadline = new Date(deadline);
                              effectiveDeadline.setHours(
                                now.getHours(),
                                now.getMinutes(),
                                now.getSeconds(),
                                now.getMilliseconds()
                              );
                              return Math.floor((effectiveDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
                            })()
                          : null;
                        
                        return (
                          <>
                    <SelectItem value="6" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 6}>
                      6 hours before
                    </SelectItem>
                    <SelectItem value="12" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 12}>
                      12 hours before
                    </SelectItem>
                    <SelectItem value="23" disabled={hoursUntilDeadline !== null && hoursUntilDeadline < 23}>
                      23 hours before
                    </SelectItem>
                    <SelectItem value="24" disabled={hoursUntilDeadline !== null && hoursUntilDeadline <= 24}>
                      24 hours before (default)
                    </SelectItem>
                    <SelectItem value="48" disabled={hoursUntilDeadline !== null && hoursUntilDeadline <= 48}>
                      2 days before
                    </SelectItem>
                    <SelectItem value="72" disabled={hoursUntilDeadline !== null && hoursUntilDeadline <= 72}>
                      3 days before
                    </SelectItem>
                    <SelectItem value="96" disabled={hoursUntilDeadline !== null && hoursUntilDeadline <= 96}>
                      4 days before
                    </SelectItem>
                    <SelectItem value="120" disabled={hoursUntilDeadline !== null && hoursUntilDeadline <= 120}>
                      5 days before
                    </SelectItem>
                          </>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={generateHomework}
                disabled={isGenerating || isGeneratingExercises || !selectedStudentId || (selectedExercises.size === 0 && getSelectedGeneratedExercises().length === 0)}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Homework"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
