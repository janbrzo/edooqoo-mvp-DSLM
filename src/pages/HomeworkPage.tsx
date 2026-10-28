import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import HomeworkExerciseRenderer from "@/components/homework/HomeworkExerciseRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Calendar, User, Mail, CheckCircle2, FileText, Send, Clock, ArrowUp, Volume2, ImageIcon, X, Presentation, Maximize2, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { deepFixTextObjects } from "@/utils/textObjectFixer";
import { useInteractiveHomework } from "@/hooks/useInteractiveHomework";
import { fetchHomeworkState } from '@/lib/homework/homeworkStateRpc';
import { fetchHomeworkExercises, hasHomeworkExercises } from '@/lib/homework/exercisesRpc';
import { fetchStudentReview, type StudentReview } from '@/lib/homework/reviewForStudent';
import { TeacherVerdictsContext, withoutDecidedEvaluations } from '@/lib/answers/teacherVerdicts';
import { StudentEmailVerification } from "@/components/homework/StudentEmailVerification";
import { HomeworkProgressBar } from "@/components/homework/HomeworkProgressBar";
import { StudyModeButton } from "@/components/shared/StudyModeButton";
import MediaSection from "@/components/worksheet/MediaSection";
import { ExerciseNavSidebar } from "@/components/worksheet/ExerciseNavSidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { devLog } from '@/utils/logger';
import { useHardLightSurface } from "@/hooks/useHardLightSurface";

interface HomeworkData {
  id: string;
  title: string;
  selected_exercises: any;
  deadline: string | null;
  created_at: string;
  teacher_email: string;
  teacher_first_name: string;
  teacher_last_name: string;
  student_name: string;
  student_english_level: string;
  source_worksheet_title: string;
  completed_at?: string | null;
  completed_by_teacher?: boolean | null;
  reviewed_at?: string | null;
  selected_image?: { url: string; photographer?: string; photographerUrl?: string } | null;
  selected_audio?: { url: string; transcript?: string } | null;
  audio_url?: string | null;
  source_worksheet_id?: string | null;
}

export default function HomeworkPage() {
  // v6.9.55: Homework must NEVER invert to dark mode, regardless of any
  // teacher theme preference or system setting.
  useHardLightSurface('homework-page');
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [homework, setHomework] = useState<HomeworkData | null>(null);
  const [loading, setLoading] = useState(true);
  // Invalid/expired links and network failures render an in-place card (students must not land on the teacher marketing page).
  const [loadError, setLoadError] = useState<'missing' | 'network' | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [studentEmailForTeacher, setStudentEmailForTeacher] = useState<string | null>(null);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studentIdForTeacher, setStudentIdForTeacher] = useState<string | null>(null);
  const [studentReview, setStudentReview] = useState<StudentReview | null>(null);
  
  // PROBLEM 2 FIX: Check localStorage for remembered email on mount
  useEffect(() => {
    if (!token || isTeacher) return;
    
    const storageKey = `homework_email_${token}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const { email, expiresAt } = JSON.parse(stored);
        if (new Date(expiresAt) > new Date()) {
          devLog('[HomeworkPage] Using remembered email from localStorage:', email);
          setVerifiedEmail(email);
        } else {
          // Expired - remove it
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
  }, [token, isTeacher]);
  
  // Teacher presentation mode state (replaces edit mode)
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationAnswers, setPresentationAnswers] = useState<Record<number, any>>({});
  
  // Navigation state
  const [activeExercise, setActiveExercise] = useState<number | null>(null);
  const [collapsedExercises, setCollapsedExercises] = useState<Map<number, boolean>>(new Map());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isGrammarActive, setIsGrammarActive] = useState(false);
  const [isVocabularyActive, setIsVocabularyActive] = useState(false);
  
  // Pinned media state (Problem 3) - separate states for audio and image panels
  const [showPinnedAudioPanel, setShowPinnedAudioPanel] = useState(false);
  const [showPinnedImagePanel, setShowPinnedImagePanel] = useState(false);
  const [isImageFullScreen, setIsImageFullScreen] = useState(false);
  
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Interactive homework hook - only active after email verification
  const totalExercises = Array.isArray(homework?.selected_exercises) 
    ? homework.selected_exercises.length 
    : 0;

  // Calculate question counts for each exercise (for progress tracking)
  const exerciseQuestionCounts: Record<number, number> = {};
  if (Array.isArray(homework?.selected_exercises)) {
    homework.selected_exercises.forEach((ex: any, idx: number) => {
      const count = ex.questions?.length || ex.sentences?.length || 
                    ex.statements?.length || ex.items?.length || 
                    ex.pairs?.length || ex.words?.length ||
                    ex.expressions?.length || ex.prompts?.length || 1;
      exerciseQuestionCounts[idx] = count;
    });
  }

  // For teacher: use student's email to load their answers. For student: use verified email
  const exercisesLoaded = hasHomeworkExercises(homework?.selected_exercises);
  const emailForAnswers = isTeacher ? (studentEmailForTeacher || '') : (exercisesLoaded ? (verifiedEmail || '') : '');
  
  const {
    answers,
    audioAnswers,
    aiEvaluations,
    isLoading: answersLoading,
    isSaving,
    saveFailed,
    lastSavedAt,
    isSubmitted,
    submittedAt,
    isWaitingForAiEval,
    isLocked,
    accessRevoked,
    updateAnswer,
    updateAudioAnswer,
    saveOnBlur,
    submitHomework,
    verifyStudentEmail,
    getProgress
  } = useInteractiveHomework({
    homeworkId: homework?.id || '',
    sourceWorksheetId: homework?.source_worksheet_id || undefined,
    studentEmail: emailForAnswers,
    totalExercises,
    exerciseQuestionCounts,
    exercises: Array.isArray(homework?.selected_exercises) ? homework.selected_exercises : [],
    shareToken: token,
    readOnly: isTeacher
  });

  useEffect(() => {
    if (!token) {
      setLoadError('missing');
      setLoading(false);
      return;
    }

    loadHomework();
  }, [token]);

  useEffect(() => {
    if (homework?.completed_at) {
      setIsCompleted(true);
    }
  }, [homework]);

  // After the teacher sent the review the student sees the comments and the decisions on items
  // the answer key could not judge (the server answers null before that or for another email).
  const reviewedAt = homework?.reviewed_at;
  useEffect(() => {
    if (!token || !verifiedEmail || verifiedEmail === 'teacher' || isTeacher || !reviewedAt || !exercisesLoaded) return;
    let cancelled = false;
    fetchStudentReview(token, verifiedEmail)
      .then((review) => { if (!cancelled) setStudentReview(review); })
      .catch((error) => console.error('Error loading homework review:', error));
    return () => { cancelled = true; };
  }, [token, verifiedEmail, isTeacher, reviewedAt, exercisesLoaded]);

  // The link alone does not carry the exercises (and their answer keys): a student gets them once
  // the assigned email is verified. A remembered email that no longer matches is dropped.
  const awaitingExercises = !!homework && !!verifiedEmail && verifiedEmail !== 'teacher' && !isTeacher && !exercisesLoaded;
  useEffect(() => {
    if (!awaitingExercises || !token || !verifiedEmail) return;
    let cancelled = false;
    fetchHomeworkExercises(token, verifiedEmail)
      .then((payload) => {
        if (cancelled) return;
        if (!payload) {
          try { localStorage.removeItem(`homework_email_${token}`); } catch { /* storage unavailable */ }
          setVerifiedEmail(null);
          return;
        }
        setHomework(prev => prev ? {
          ...prev,
          selected_exercises: deepFixTextObjects(payload.selected_exercises, 'homework.selected_exercises'),
          selected_image: (payload.selected_image as HomeworkData['selected_image']) ?? null,
          selected_audio: (payload.selected_audio as HomeworkData['selected_audio']) ?? null,
          audio_url: payload.audio_url ?? null,
        } : prev);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error loading homework exercises:', error);
        setLoadError('network');
      });
    return () => { cancelled = true; };
  }, [awaitingExercises, token, verifiedEmail]);

  // The server no longer accepts the remembered e-mail (the teacher changed the address, or the
  // homework was removed): forget it and ask for the e-mail again instead of retrying forever.
  useEffect(() => {
    if (!accessRevoked || !token || isTeacher) return;
    try { localStorage.removeItem(`homework_email_${token}`); } catch { /* storage unavailable */ }
    setVerifiedEmail(null);
    toast.error("Please confirm your e-mail again", {
      description: "This link no longer accepts the address you used. Ask your teacher for a new link if it keeps happening.",
    });
  }, [accessRevoked, token, isTeacher]);

  // The server refused a write or a submit: re-read why (submitted elsewhere or closed by the teacher).
  useEffect(() => {
    if (!isLocked || !token) return;
    void fetchHomeworkState(token).then((state) => {
      if (!state) return;
      setHomework(prev => prev ? {
        ...prev,
        reviewed_at: state.reviewed_at,
        completed_at: state.completed_at,
        completed_by_teacher: state.completed_by_teacher,
      } : prev);
    });
  }, [isLocked, token]);

  // Check if logged-in user is the teacher (skip email verification) and get student email for answer loading
  useEffect(() => {
    const checkTeacher = async () => {
      if (!homework) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch teacher_id and student info from homework
        const { data: homeworkData } = await supabase
          .from('homework_assignments')
          .select('teacher_id, student_id')
          .eq('id', homework.id)
          .single();
        
        if (homeworkData && homeworkData.teacher_id === user.id) {
          devLog('[HomeworkPage] Logged-in user is teacher, skipping email verification');
          setIsTeacher(true);
          setVerifiedEmail('teacher');
          
          // Fetch student email so teacher can see student's answers
          if (homeworkData.student_id) {
            setStudentIdForTeacher(homeworkData.student_id);
            
            const { data: studentData } = await supabase
              .from('students')
              .select('student_email')
              .eq('id', homeworkData.student_id)
              .single();
            
            if (studentData?.student_email) {
              devLog('[HomeworkPage] Loaded student email for teacher view:', studentData.student_email);
              setStudentEmailForTeacher(studentData.student_email);
            }
          }
        }
      }
    };
    
    checkTeacher();
  }, [homework?.id]);

  // Scroll tracking for navigation and scroll-up button (Problem 3: removed auto-show media on scroll)
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
      
      // Track active exercise
      exerciseRefs.current.forEach((ref, index) => {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.35 && rect.bottom > 100) {
            setActiveExercise(index);
          }
        }
      });

      // Track Grammar section
      const grammarEl = document.querySelector('#grammar-rules-section, [data-section="grammar"]');
      if (grammarEl) {
        const rect = grammarEl.getBoundingClientRect();
        setIsGrammarActive(rect.top <= window.innerHeight * 0.35 && rect.bottom > 100);
      }

      // Track Vocabulary section
      const vocabEl = document.querySelector('#vocabulary-sheet-section, [data-section="vocabulary"]');
      if (vocabEl) {
        const rect = vocabEl.getBoundingClientRect();
        setIsVocabularyActive(rect.top <= window.innerHeight * 0.35 && rect.bottom > 100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Teacher presentation mode handlers - NO SAVING, just local display
  const handleStartPresentation = () => {
    setPresentationAnswers(JSON.parse(JSON.stringify(answers)));
    setPresentationMode(true);
    toast.info("Presentation mode started. Changes are NOT saved.");
  };

  const handleEndPresentation = () => {
    setPresentationAnswers({});
    setPresentationMode(false);
    toast.info("Presentation ended.");
  };

  // Teacher's local answer change handler (does NOT save anything)
  const handlePresentationAnswerChange = (exerciseIndex: number, exerciseType: string) => 
    (questionIndex: number, value: any) => {
      setPresentationAnswers(prev => ({
        ...prev,
        [exerciseIndex]: {
          ...(prev[exerciseIndex] || {}),
          [questionIndex]: value
        }
      }));
    };

  // Navigation functions
  const scrollToExercise = useCallback((index: number) => {
    const ref = exerciseRefs.current[index];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveExercise(index);
    }
  }, []);

  const toggleExercise = useCallback((index: number) => {
    setCollapsedExercises(prev => {
      const newMap = new Map(prev);
      newMap.set(index, !prev.get(index));
      return newMap;
    });
  }, []);

  const collapseAll = useCallback(() => {
    if (!homework?.selected_exercises) return;
    const newMap = new Map<number, boolean>();
    homework.selected_exercises.forEach((_: any, index: number) => {
      newMap.set(index, true);
    });
    setCollapsedExercises(newMap);
  }, [homework?.selected_exercises]);

  const expandAll = useCallback(() => {
    setCollapsedExercises(new Map());
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadHomework = async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .rpc('get_homework_by_share_token', { p_share_token: token })
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setLoadError('missing');
        return;
      }

      // Fix nested {text: "..."} objects that cause React error #31
      const fixedData = {
        ...data,
        selected_exercises: deepFixTextObjects(data.selected_exercises, 'homework.selected_exercises')
      };

      devLog('[HomeworkPage] Loaded and fixed homework data:', {
        id: fixedData.id,
        exerciseCount: Array.isArray(fixedData.selected_exercises) ? fixedData.selected_exercises.length : 0
      });

      setHomework(fixedData as HomeworkData);
      
      // Fetch the lifecycle state (reviewed_at, completed_at, completed_by_teacher) and
      // source_worksheet_id separately (not in the main RPC); share-token scoped.
      const homeworkState = await fetchHomeworkState(token);
      if (homeworkState) {
        setHomework(prev => prev ? {
          ...prev,
          reviewed_at: homeworkState.reviewed_at,
          completed_at: homeworkState.completed_at,
          completed_by_teacher: homeworkState.completed_by_teacher,
          source_worksheet_id: homeworkState.source_worksheet_id
        } : null);
      }
    } catch (error) {
      console.error('Error loading homework:', error);
      setLoadError('network');
    } finally {
      setLoading(false);
    }
  };

  // Submitting is irreversible and always an explicit click: a countdown that submitted by itself
  // sent work the student had only stopped looking at. Nothing answered yet cannot be submitted.
  const handleSubmitClick = () => {
    const progress = getProgress();
    if (progress.answeredTasks === 0) {
      toast.error("Answer at least one question before you submit.");
      return;
    }
    if (progress.percentageComplete < 100) {
      setShowIncompleteModal(true);
    } else {
      setShowCompleteModal(true);
    }
  };

  const handleCloseCompleteModal = () => setShowCompleteModal(false);

  const handleMarkCompleted = async () => {
    if (!homework) return;

    // If we have interactive answers, use submitHomework instead
    if (verifiedEmail && verifiedEmail !== 'teacher') {
      const success = await submitHomework();
      if (success) {
        setIsCompleted(true);
      }
      return;
    }

    // Fallback to original behavior for non-interactive mode or teacher
    setIsCompleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || 'anonymous';

      const { data, error } = await supabase.rpc('mark_homework_completed', {
        p_homework_id: homework.id,
        p_user_id: userId,
        p_is_teacher: isTeacher
      });

      if (error) throw error;
      const result = data as { success?: boolean; error?: string; already_completed?: boolean } | null;
      if (!result?.success) {
        toast.error(result?.error || "Failed to mark homework as completed");
        return;
      }
      if (result.already_completed) {
        toast.info("This homework was already returned. Nothing changed.");
        return;
      }

      setIsCompleted(true);
      toast.success("Homework marked as completed!");
    } catch (error: any) {
      console.error('Error marking homework as completed:', error);
      toast.error(error.message || "Failed to mark homework as completed");
    } finally {
      setIsCompleting(false);
    }
  };

  // Handle answer change for interactive mode
  const handleAnswerChange = (exerciseIndex: number, exerciseType: string) => 
    (questionIndex: number, value: any) => {
      updateAnswer(exerciseIndex, exerciseType, questionIndex, value);
    };

  // Handle blur for immediate save
  const handleExerciseBlur = (exerciseIndex: number, exerciseType: string) => () => {
    saveOnBlur(exerciseIndex, exerciseType);
  };

  // Extract media from homework (worksheet-level and exercise-level)
  const extractMediaFromHomework = (homework: HomeworkData) => {
    const media = {
      images: [] as string[],
      audios: [] as { url: string; transcript?: string }[],
      hasImageMedia: false,
      hasAudioMedia: false
    };
    
    devLog('[HomeworkPage] Extracting media from homework:', homework);
    
    // First, check homework-level media (from source worksheet)
    if (homework.selected_image?.url) {
      devLog('[HomeworkPage] Found homework-level image:', homework.selected_image.url);
      media.images.push(homework.selected_image.url);
      media.hasImageMedia = true;
    }
    
    if (homework.selected_audio?.url) {
      devLog('[HomeworkPage] Found homework-level audio (selected_audio):', homework.selected_audio.url);
      media.audios.push({
        url: homework.selected_audio.url,
        transcript: homework.selected_audio.transcript
      });
    } else if (homework.audio_url) {
      devLog('[HomeworkPage] Found homework-level audio (audio_url):', homework.audio_url);
      media.audios.push({ url: homework.audio_url });
    }
    
    // Then, check exercise-level media
    if (!Array.isArray(homework.selected_exercises)) {
      devLog('[HomeworkPage] No exercises array found');
      return media;
    }
    
    devLog('[HomeworkPage] Checking', homework.selected_exercises.length, 'exercises for media');
    
    homework.selected_exercises.forEach((exercise, index) => {
      devLog(`[HomeworkPage] Exercise ${index}:`, {
        type: exercise.type,
        hasImageUrl: !!exercise.image_url,
        hasAudioUrl: !!exercise.audio_url,
        keys: Object.keys(exercise)
      });
      
      // Extract images from picture exercises
      const pictureTypes = ['picture', 'image', 'describe', 'answer-questions-picture', 'describe-picture'];
      if (pictureTypes.includes(exercise.type) && exercise.image_url && !media.images.includes(exercise.image_url)) {
        devLog('[HomeworkPage] Found exercise image:', exercise.image_url);
        media.images.push(exercise.image_url);
      }
      
      // Extract audio from listening exercises
      const audioTypes = ['listening', 'audio', 'listening-comprehension', 'answer-questions-audio', 'true-false-audio'];
      if (audioTypes.includes(exercise.type) && exercise.audio_url) {
        const existingAudio = media.audios.find(a => a.url === exercise.audio_url);
        if (!existingAudio) {
          devLog('[HomeworkPage] Found exercise audio:', exercise.audio_url);
          media.audios.push({
            url: exercise.audio_url,
            transcript: exercise.audio_transcript
          });
        }
      }
    });
    
    devLog('[HomeworkPage] Media extraction complete:', {
      images: media.images.length,
      audios: media.audios.length
    });
    
    return media;
  };

  const media = homework ? extractMediaFromHomework(homework) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !homework) {
    const isNetwork = loadError === 'network';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <h1 className="text-lg font-semibold">
            {isNetwork ? "We couldn't load this homework" : 'Homework not available'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNetwork
              ? 'Check your connection and try again.'
              : 'This homework link is invalid or has expired. Ask your teacher to send you a new link, or open your Student Hub.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {isNetwork && (
              <Button
                onClick={() => {
                  setLoading(true);
                  loadHomework();
                }}
              >
                Try again
              </Button>
            )}
            <Button variant={isNetwork ? 'outline' : 'default'} onClick={() => navigate('/my')}>
              Open Student Hub
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (awaitingExercises) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const teacherName = homework.teacher_first_name && homework.teacher_last_name
    ? `${homework.teacher_first_name} ${homework.teacher_last_name}`
    : homework.teacher_email;

  // Prepare exercises for nav sidebar
  const exercisesForNav = Array.isArray(homework.selected_exercises) 
    ? homework.selected_exercises.map((ex: any) => ({
        title: ex.title || ex.type || 'Exercise',
        icon: ex.icon || 'FileText',
        estimated_time: ex.estimated_time
      }))
    : [];
    
  const isAllCollapsed = exercisesForNav.length > 0 && 
    exercisesForNav.every((_: any, idx: number) => collapsedExercises.get(idx));
  const isAllExpanded = collapsedExercises.size === 0;

  // Get progress for progress bar
  const progress = getProgress();
  const finalIsSubmitted = isSubmitted || isCompleted || isLocked;
  // The teacher marked it done and the student never returned it.
  const closedByTeacher = homework.completed_by_teacher === true && !isSubmitted;
  
  // Student sees correct answers immediately after submitting
  const showCorrectAnswersToStudent = finalIsSubmitted;
  
  // Check if email verification is needed
  const needsEmailVerification = !verifiedEmail && !isTeacher;
  
  // Show Start button after email verification (like Study button on shared worksheet)
  const showStartButton = verifiedEmail && !isStudyMode && !isTeacher && verifiedEmail !== 'teacher';

  return (
    <div className="min-h-screen bg-background">
      {/* Email verification overlay - homework visible behind with blur */}
      {needsEmailVerification && (
        <StudentEmailVerification
          homeworkId={homework.id}
          studentName={homework.student_name}
          teacherName={teacherName}
          verifyEmail={verifyStudentEmail}
          onVerified={(email) => {
            // PROBLEM 2 FIX: Remember email for 24 hours in localStorage
            if (token && email) {
              const storageKey = `homework_email_${token}`;
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + 24);
              localStorage.setItem(storageKey, JSON.stringify({ email, expiresAt: expiresAt.toISOString() }));
              devLog('[HomeworkPage] Saved email to localStorage for 24h:', email);
            }
            setVerifiedEmail(email);
          }}
        />
      )}

      {/* Big Start Button (after email verified, before study mode) */}
      {showStartButton && (
        <StudyModeButton
          onStartStudy={() => setIsStudyMode(true)}
          worksheetTitle={homework.title}
        />
      )}
      
      {/* Main homework content - blocked when verification needed */}
      <div className={needsEmailVerification ? 'pointer-events-none' : ''}>
      {/* Progress Bar with Teacher Presentation Controls */}
      <HomeworkProgressBar
        progress={progress}
        isSaving={isSaving}
        saveFailed={saveFailed}
        lastSavedAt={lastSavedAt}
        isSubmitted={finalIsSubmitted}
        isTeacher={isTeacher}
        presentationMode={presentationMode}
        onStartPresentation={handleStartPresentation}
        onEndPresentation={handleEndPresentation}
        studentName={homework.student_name}
        studentId={studentIdForTeacher || undefined}
      />

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4 flex-1">
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {homework.title}
                  </h1>
                  {homework.source_worksheet_title && (
                    <p className="text-sm text-muted-foreground">
                      From worksheet: {homework.source_worksheet_title}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {homework.student_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>For: <strong>{homework.student_name}</strong></span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Teacher: <strong>{teacherName}</strong></span>
                  </div>
                  
                  {homework.deadline && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Deadline: <strong>{format(new Date(homework.deadline), "PPP HH:mm")}</strong>
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Created: <strong>{format(new Date(homework.created_at), "MMM dd, yyyy HH:mm")}</strong>
                    </span>
                  </div>
                </div>
              </div>
              {verifiedEmail && !isTeacher && (
                <a href="/my" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 text-primary hover:text-primary/80 transition-colors shrink-0 mt-2">
                  <LayoutDashboard className="h-10 w-10" />
                  <span className="text-xs font-medium">My Hub</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exercise Navigation Sidebar */}
      {exercisesForNav.length > 0 && (
        <ExerciseNavSidebar
          exercises={exercisesForNav}
          activeExercise={activeExercise}
          collapsedExercises={collapsedExercises}
          onScrollToExercise={scrollToExercise}
          onToggleExercise={toggleExercise}
          onCollapseAll={collapseAll}
          onExpandAll={expandAll}
          isAllCollapsed={isAllCollapsed}
          isAllExpanded={isAllExpanded}
          hideCollapseControls={true}
          isGrammarActive={isGrammarActive}
          isVocabularyActive={isVocabularyActive}
        />
      )}

      {/* Lesson Media Section - use MediaSection component */}
      {media && (media.images.length > 0 || media.audios.length > 0) && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <MediaSection
            selectedImage={homework.selected_image ? { 
              ...homework.selected_image, 
              id: 'homework-image',
              description: ''
            } : null}
            selectedAudio={homework.selected_audio ? {
              ...homework.selected_audio,
              id: 'homework-audio'
            } : (homework.audio_url ? { url: homework.audio_url, id: 'homework-audio-url' } : null)}
            isDownloadUnlocked={true}
            isPinned={showPinnedImagePanel}
            onTogglePin={() => setShowPinnedImagePanel(!showPinnedImagePanel)}
            isFullScreen={isImageFullScreen}
            onToggleFullScreen={() => setIsImageFullScreen(!isImageFullScreen)}
          />
        </div>
      )}

      {/* Exercises */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {Array.isArray(homework.selected_exercises) && homework.selected_exercises.map((exercise, index) => (
            <div 
              key={index} 
              ref={el => exerciseRefs.current[index] = el}
              onBlur={handleExerciseBlur(index, exercise.type)}
              data-exercise-index={index}
            >
              <TeacherVerdictsContext.Provider value={studentReview?.verdicts[index] ?? {}}>
              <HomeworkExerciseRenderer
                exercise={exercise}
                index={index}
                homeworkId={homework.source_worksheet_id || homework.id}
                isInteractive={true}
                studentAnswers={
                  isTeacher && presentationMode 
                    ? (presentationAnswers[index] || answers[index] || {}) as any
                    : (answers[index] || {}) as any
                }
                onAnswerChange={
                  isTeacher 
                    ? (presentationMode 
                        ? (qIndex: number, value: any) => handlePresentationAnswerChange(index, exercise.type)(qIndex, value)
                        : () => {})
                    : (finalIsSubmitted 
                        ? () => {} 
                        : (qIndex: number, value: any) => handleAnswerChange(index, exercise.type)(qIndex, value))
                }
                showCorrectAnswers={isTeacher || showCorrectAnswersToStudent}
                disabled={finalIsSubmitted && !isTeacher}
                viewMode={isTeacher ? "teacher" : "student"}
                aiEvaluation={withoutDecidedEvaluations(aiEvaluations[index], studentReview?.verdicts[index])}
                isWaitingForAiEval={isWaitingForAiEval}
                audioAnswers={audioAnswers[index]}
                onAudioAnswerChange={
                  finalIsSubmitted 
                    ? ((_qIndex: number, _audioUrl: string) => {})
                    : (qIndex: number, audioUrl: string) => updateAudioAnswer(index, qIndex, audioUrl)
                }
              />
              </TeacherVerdictsContext.Provider>
              {!isTeacher && studentReview?.comments[index] && (
                <Card className="mt-3 p-4 border-primary/30 bg-primary/5">
                  <p className="text-sm font-medium text-primary mb-1">Comment from {teacherName}</p>
                  <p className="text-sm whitespace-pre-wrap">{studentReview.comments[index]}</p>
                </Card>
              )}
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 space-y-4">
          {/* Submit button - only for students */}
          {!isTeacher && !finalIsSubmitted && (
            <Button 
              onClick={handleSubmitClick}
              disabled={isCompleting}
              className="w-full"
              size="lg"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Submit Homework
                </>
              )}
            </Button>
          )}
          
          {/* Teacher view section with Presentation Mode controls */}
          {isTeacher && (
            <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-500">
              <div className="flex items-center justify-center gap-2 mb-4">
                <User className="h-8 w-8 text-purple-500" />
                <p className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                  Teacher View
                </p>
              </div>
              
              {/* Teacher Presentation Mode Buttons */}
              <div className="flex flex-wrap justify-center gap-3 mb-4">
                {!presentationMode ? (
                  <Button 
                    onClick={handleStartPresentation}
                    variant="outline"
                    className="border-purple-500 text-purple-600 hover:bg-purple-50"
                  >
                    <Presentation className="h-4 w-4 mr-2" />
                    Start Presentation
                  </Button>
                ) : (
                  <Button 
                    onClick={handleEndPresentation}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <X className="h-4 w-4 mr-2" />
                    End Presentation
                  </Button>
                )}
              </div>
              
              <p className="text-sm text-purple-600 dark:text-purple-400 text-center">
                {presentationMode 
                  ? "Presentation mode ON. You can type answers to demonstrate - nothing is saved."
                  : "You are viewing student's answers. Use 'Start Presentation' to demo answers on screen."}
              </p>
            </div>
          )}
          
          {/* Submitted state for students */}
          {!isTeacher && finalIsSubmitted && !closedByTeacher && (
            <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border-2 border-green-500">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                Homework Submitted!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Check the correct answers above. Discuss any questions with your teacher.
              </p>
            </div>
          )}

          {!isTeacher && closedByTeacher && (
            <div className="p-6 bg-muted rounded-lg text-center border-2 border-border">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-lg font-semibold text-foreground">
                Closed by your teacher
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your teacher marked this homework as done, so it can no longer be changed. The correct answers are shown above.
              </p>
            </div>
          )}
          
          <div className="p-6 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              {isTeacher 
                ? "This is a preview of the student homework. Click exercise titles to navigate."
                : closedByTeacher
                  ? "This homework is closed. Review the correct answers above."
                  : finalIsSubmitted 
                  ? "Your homework is complete. Review the correct answers above."
                  : "Your answers are automatically saved. Click 'Submit Homework' when you're done."}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed AI Evaluation waiting sidebar */}
      {!isTeacher && finalIsSubmitted && isWaitingForAiEval && (
        <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-card border-2 border-blue-300 rounded-xl shadow-2xl p-5 w-56 animate-pulse">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <div>
              <p className="text-sm font-semibold text-blue-700">AI is evaluating...</p>
              <p className="text-xs text-blue-500 mt-1">Your open-ended answers are being reviewed</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating UI Elements */}
      {/* Scroll to top button */}
      {showScrollTop && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
          {media && media.images.length > 0 && (
            <button 
              onClick={() => setShowPinnedImagePanel(!showPinnedImagePanel)}
              className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              title={showPinnedImagePanel ? "Unpin image" : "Pin image"}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
          )}
          {media && media.audios.length > 0 && (
            <button 
              onClick={() => setShowPinnedAudioPanel(!showPinnedAudioPanel)}
              className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              title={showPinnedAudioPanel ? "Unpin audio" : "Pin audio"}
            >
              <Volume2 className="h-5 w-5" />
            </button>
          )}
          <button 
            onClick={scrollToTop}
            className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
            title="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Pinned Audio Panel - shows only on button click */}
      {showPinnedAudioPanel && media && media.audios.length > 0 && (
        <div className="fixed bottom-20 right-20 z-50 bg-background border-2 border-primary/20 rounded-lg shadow-2xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Lesson Audio</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPinnedAudioPanel(false)}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <audio controls className="w-full" style={{ height: '40px' }}>
            <source src={media.audios[0].url} type="audio/mpeg" />
          </audio>
        </div>
      )}

      {/* Pinned Image Panel - medium size with X and Maximize buttons */}
      {showPinnedImagePanel && !isImageFullScreen && media && media.images.length > 0 && (
        <div className="fixed bottom-20 right-20 z-50 bg-background border-2 border-primary/20 rounded-lg shadow-2xl p-2 max-w-md">
          <div className="flex justify-end gap-1 mb-1">
            <Button 
              onClick={() => setIsImageFullScreen(true)} 
              size="sm" 
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => setShowPinnedImagePanel(false)} 
              size="sm" 
              variant="ghost"
              className="h-7 w-7 p-0"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <img 
            src={media.images[0]} 
            alt="Lesson image" 
            className="max-w-full max-h-80 object-contain rounded mx-auto"
          />
        </div>
      )}

      {/* Full screen image modal */}
      {isImageFullScreen && media && media.images.length > 0 && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImageFullScreen(false)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white h-10 w-10 rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
          <img 
            src={media.images[0]} 
            alt="Lesson image enlarged" 
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}

      {/* Incomplete Homework Modal */}
      <AlertDialog open={showIncompleteModal} onOpenChange={setShowIncompleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Not all exercises completed</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You have only completed {progress.answeredExercises} out of {progress.totalExercises} exercises ({progress.percentageComplete}%).
              </p>
              <p className="font-semibold text-orange-600 dark:text-orange-400">
                ⚠️ Warning: After submission you will NOT be able to continue editing. 
                If you haven't finished, you can close this and complete your work later.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Working</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleMarkCompleted(); setShowIncompleteModal(false); }}>
              Submit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Homework Modal with Countdown */}
      <AlertDialog open={showCompleteModal} onOpenChange={(open) => !open && handleCloseCompleteModal()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              Ready to submit?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                All exercises completed! Great work! 🎉
              </p>
              <p className="font-semibold text-orange-600 dark:text-orange-400">
                ⚠️ After submission you will NOT be able to edit your answers.
                You will see the correct answers immediately.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseCompleteModal}>
              Wait, I need more time
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleMarkCompleted(); setShowCompleteModal(false); }}>
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
