
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, FileText, ArrowUp, Image, X, Maximize2, Headphones, Home, User, ArrowLeft, Unlock, Save, RotateCcw, LayoutDashboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import SharedWorksheetContent from '@/components/shared/SharedWorksheetContent';
import { SharedWorksheetEmailVerification } from '@/components/shared/SharedWorksheetEmailVerification';
import { StudyModeButton } from '@/components/shared/StudyModeButton';
import { SharedWorksheetProgressBar } from '@/components/shared/SharedWorksheetProgressBar';
import { useInteractiveSharedWorksheet } from '@/hooks/useInteractiveSharedWorksheet';
import { ExerciseNavSidebar } from '@/components/worksheet/ExerciseNavSidebar';
import { useWorksheetNavigation } from '@/hooks/useWorksheetNavigation';
import { DrawingToggleButton, DrawingToolbar, DrawingOverlay, type DrawingOverlayRef } from '@/components/drawing';
// useDrawingCanvas not needed - DrawingOverlay handles saving internally
import type { SharedWorksheetData } from '@/types/interactiveSharedWorksheet';
import type { DrawingTool, DrawingColor, StrokeWidth, DrawingState } from '@/types/drawing';
import { DRAWING_COLORS, STROKE_WIDTHS } from '@/types/drawing';

const SharedWorksheet = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [worksheet, setWorksheet] = useState<SharedWorksheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { toast } = useToast();

  // Interactive shared worksheet state
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [needsStudentAssignment, setNeedsStudentAssignment] = useState(false);
  const [answerVisibility, setAnswerVisibility] = useState<'all' | 'closed' | 'open' | 'hidden'>('all');

  // PROBLEM 5: Check localStorage for remembered email on mount
  useEffect(() => {
    if (!token || isTeacher) return;
    
    const storedData = localStorage.getItem(`worksheet_email_${token}`);
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        // Check if not expired (48h = 172800000ms)
        if (parsed.email && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          console.log('[SharedWorksheet] Found remembered email:', parsed.email);
          setVerifiedEmail(parsed.email);
        } else {
          // Clean up expired data
          localStorage.removeItem(`worksheet_email_${token}`);
        }
      } catch (e) {
        localStorage.removeItem(`worksheet_email_${token}`);
      }
    }
  }, [token, isTeacher]);

  // PROBLEM 2: Pin media state (like WorksheetContainer)
  const [isPinned, setIsPinned] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // PROBLEM 3: Teacher edit mode and student info
  const [teacherEditMode, setTeacherEditMode] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [editableWorksheet, setEditableWorksheet] = useState<any>(null);
  const [originalWorksheet, setOriginalWorksheet] = useState<any>(null);
  const [isSavingTeacherEdits, setIsSavingTeacherEdits] = useState(false);

  // DRAWING OVERLAY: State for drawing mode (Live Session only)
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [currentDrawingTool, setCurrentDrawingTool] = useState<DrawingTool>('marker');
  const [currentDrawingColor, setCurrentDrawingColor] = useState<DrawingColor>(DRAWING_COLORS[0]);
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<StrokeWidth>(STROKE_WIDTHS[1]);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const drawingOverlayRef = useRef<DrawingOverlayRef>(null);

  // Parse exercises count from worksheet data
  const worksheetData = useMemo(() => {
    if (!worksheet?.ai_response) return null;
    try {
      return JSON.parse(worksheet.ai_response);
    } catch {
      return null;
    }
  }, [worksheet?.ai_response]);

  const totalExercises = worksheetData?.exercises?.length || 0;
  
  // Calculate exercise question counts for progress
  const exerciseQuestionCounts = useMemo(() => {
    if (!worksheetData?.exercises) return {};
    const counts: Record<number, number> = {};
    worksheetData.exercises.forEach((exercise: any, index: number) => {
      counts[index] = exercise.questions?.length || 
                      exercise.items?.length || 
                      exercise.sentences?.length ||
                      exercise.statements?.length ||
                      exercise.words?.length ||
                      exercise.sentence_halves?.length ||   // PROBLEM 5.1 FIX
                      exercise.expressions?.length ||       // PROBLEM 5.1 FIX
                      exercise.prompts?.length ||            // PROBLEM 5.1 FIX
                      1;
    });
    return counts;
  }, [worksheetData]);

  // Initialize interactive hook (only when verified)
  const interactiveHook = useInteractiveSharedWorksheet({
    worksheetId: worksheet?.id || '',
    studentEmail: verifiedEmail || '',
    totalExercises,
    exerciseQuestionCounts,
    exercises: worksheetData?.exercises || [] // PROBLEM 1/2 FIX: Pass exercises for mastery calculation
  });

  // PROBLEM 3: Navigation sidebar for shared worksheet
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const exercises = worksheetData?.exercises || [];
  const navigation = useWorksheetNavigation({ exercises });

  // DRAWING: Stan zapisywania (aktualizowany przez DrawingOverlay przez callback)
  const [drawingIsSaving, setDrawingIsSaving] = useState(false);
  const [drawingLastSavedAt, setDrawingLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share token');
      setIsLoading(false);
      return;
    }

    loadSharedWorksheet();
    checkIfTeacher();
  }, [token]);

  // Handle scroll-to-top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const checkIfTeacher = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        // Check if user is the teacher who owns this worksheet
        const { data: worksheetData } = await supabase
          .from('worksheets')
          .select('teacher_id')
          .eq('share_token', token)
          .single();
        
        if (worksheetData && worksheetData.teacher_id === user.id) {
          console.log('[SharedWorksheet] User is the teacher - bypassing email verification');
          setIsTeacher(true);
          setVerifiedEmail(user.email || 'teacher');
          // DRAWING: Save teacher ID for drawing canvas
          setCurrentTeacherId(user.id);
        }
      }
    } catch (error) {
      console.error('[SharedWorksheet] Error checking teacher status:', error);
    }
  };

  const loadSharedWorksheet = async () => {
    try {
      setIsLoading(true);
      
      // Call the existing RPC function
      const { data, error: rpcError } = await supabase.rpc('get_worksheet_by_share_token' as any, {
        p_share_token: token
      });

      if (rpcError) throw rpcError;

      if (!data || data.length === 0) {
        throw new Error('Worksheet not found or link has expired');
      }

      const worksheetRow = data[0];
      
      // Check if worksheet has assigned student and get student name
      const { data: fullWorksheet } = await supabase
        .from('worksheets')
        .select('student_id, share_recipient_email')
        .eq('id', worksheetRow.id)
        .single();
      
      if (!fullWorksheet?.student_id) {
        setNeedsStudentAssignment(true);
      } else {
        // PROBLEM 3: Fetch student name for teacher toolbar
        const { data: studentData } = await supabase
          .from('students')
          .select('name')
          .eq('id', fullWorksheet.student_id)
          .single();
        
        if (studentData?.name) {
          setStudentName(studentData.name);
        }
      }

      const worksheetData = {
        ...worksheetRow,
        student_id: fullWorksheet?.student_id,
        share_recipient_email: fullWorksheet?.share_recipient_email
      };
      
      setWorksheet(worksheetData);
      
      // PROBLEM 3: Initialize editable worksheet for teacher edit mode
      try {
        const parsedContent = JSON.parse(worksheetRow.ai_response);
        setEditableWorksheet(parsedContent);
        setOriginalWorksheet(parsedContent);
      } catch (e) {
        console.error('Error parsing worksheet content:', e);
      }
      
      toast({
        title: "Worksheet loaded",
        description: "You're viewing a shared worksheet",
        className: "bg-green-50 border-green-200"
      });
    } catch (error) {
      console.error('Error loading shared worksheet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load worksheet';
      setError(errorMessage);
      
      toast({
        title: "Failed to load worksheet",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailVerified = (email: string) => {
    console.log('[SharedWorksheet] Email verified:', email);
    setVerifiedEmail(email);
    
    // PROBLEM 5: Remember email for 48 hours
    localStorage.setItem(`worksheet_email_${token}`, JSON.stringify({
      email: email,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000 // 48 hours
    }));
    
    toast({
      title: "Email verified!",
      description: "You can now start studying.",
      className: "bg-green-50 border-green-200"
    });
  };

  const handleStartStudy = () => {
    console.log('[SharedWorksheet] Starting study mode');
    setIsStudyMode(true);
  };

  // PROBLEM 3: Teacher edit mode handlers
  const handleSaveTeacherChanges = async () => {
    if (!worksheet?.id || !editableWorksheet) return;
    
    setIsSavingTeacherEdits(true);
    try {
      const { error } = await supabase
        .from('worksheets')
        .update({ ai_response: JSON.stringify(editableWorksheet) })
        .eq('id', worksheet.id);
      
      if (error) throw error;
      
      setOriginalWorksheet(editableWorksheet);
      setTeacherEditMode(false);
      
      toast({
        title: "Changes saved",
        description: "Your edits have been saved successfully.",
        className: "bg-green-50 border-green-200"
      });
    } catch (error) {
      console.error('Error saving teacher changes:', error);
      toast({
        title: "Save failed",
        description: "Could not save changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingTeacherEdits(false);
    }
  };

  const handleDiscardTeacherChanges = () => {
    setEditableWorksheet(originalWorksheet);
    setTeacherEditMode(false);
    toast({
      title: "Changes discarded",
      description: "All edits have been reverted.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-worksheet-purple" />
          <p className="text-gray-600">Loading shared worksheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Worksheet Not Available
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            The share link may have expired or the worksheet may have been removed.
          </p>
        </div>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No worksheet data available</p>
        </div>
      </div>
    );
  }

  // Check if worksheet needs assigned student
  if (needsStudentAssignment && !isTeacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Student Not Assigned
          </h1>
          <p className="text-gray-600 mb-4">
            This worksheet doesn't have a student assigned yet.
          </p>
          <p className="text-sm text-gray-500">
            Please ask your teacher to assign a student to this worksheet before you can access it.
          </p>
        </div>
      </div>
    );
  }

  // Parse the AI response to get the worksheet title if needed
  const worksheetTitle = worksheet.title || worksheetData?.title || 'English Worksheet';

  // Student needs to verify email (unless they are the teacher)
  const showEmailVerification = !isTeacher && !verifiedEmail;
  
  // PROBLEM 3: Teacher sees same view but read-only (automatically in study mode)
  // After verification, show Study button (unless in study mode or teacher)
  const showStudyButton = verifiedEmail && !isStudyMode && !isTeacher;
  
  // Teacher is always in "view" mode (like study mode but read-only)
  const effectiveStudyMode = isStudyMode || isTeacher;

  return (
    <div className="min-h-screen bg-background">
      {/* Email Verification Modal */}
      {showEmailVerification && (
        <SharedWorksheetEmailVerification
          onVerified={handleEmailVerified}
          verifyEmail={interactiveHook.verifyStudentEmail}
          worksheetId={worksheet.id}
          worksheetTitle={worksheetTitle}
          teacherEmail={worksheet.teacher_email}
        />
      )}

      {/* Big Study Button (after email verified) */}
      {showStudyButton && (
        <StudyModeButton
          onStartStudy={handleStartStudy}
          worksheetTitle={worksheetTitle}
        />
      )}

      {/* Progress Bar (only in study mode for students, not for teachers) */}
      {isStudyMode && !isTeacher && (
        <SharedWorksheetProgressBar
          progress={interactiveHook.getProgress()}
          isSaving={interactiveHook.isSaving}
          lastSavedAt={interactiveHook.lastSavedAt}
        />
      )}
      
      {/* PROBLEM 3: Teacher toolbar with Back, Dashboard, Student Name, Edit buttons */}
      {isTeacher && (
        <div className="sticky top-0 bg-white border-b shadow-sm py-3 px-4 z-[60] flex items-center justify-between">
          {/* Left side: Navigation buttons - PROBLEM 2: Add ml-14 to avoid overlap with ExerciseNavSidebar Menu button */}
          <div className="flex items-center gap-2 ml-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link to="/dashboard">
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            {worksheet?.student_id && (
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link to={`/student/${worksheet.student_id}`}>
                  <User className="h-4 w-4 mr-1" />
                  {studentName || 'Student'}
                </Link>
              </Button>
            )}
          </div>
          
          {/* Right side: Drawing button and Edit mode buttons */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-md mr-2">
              👀 Live Session
            </span>
            
            {/* DRAWING: Toggle button for drawing mode */}
            <DrawingToggleButton
              isEnabled={isDrawingEnabled}
              onToggle={() => setIsDrawingEnabled(!isDrawingEnabled)}
            />
            
            {!teacherEditMode ? (
              <Button 
                onClick={() => setTeacherEditMode(true)}
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Unlock className="h-3 w-3 mr-1" />
                Unlock Editing
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleSaveTeacherChanges}
                  disabled={isSavingTeacherEdits}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSavingTeacherEdits ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
                <Button 
                  onClick={handleDiscardTeacherChanges}
                  disabled={isSavingTeacherEdits}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Discard
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* DRAWING: Toolbar when drawing mode is enabled (teacher only) */}
      {isTeacher && isDrawingEnabled && (
        <DrawingToolbar
          state={{
            isEnabled: isDrawingEnabled,
            activeTool: currentDrawingTool,
            activeColor: currentDrawingColor,
            strokeWidth: currentStrokeWidth,
            canUndo: canUndo,
            canRedo: canRedo,
            isSaving: drawingIsSaving,
            lastSavedAt: drawingLastSavedAt
          }}
          onToolChange={setCurrentDrawingTool}
          onColorChange={setCurrentDrawingColor}
          onStrokeWidthChange={setCurrentStrokeWidth}
          onUndo={() => drawingOverlayRef.current?.undo()}
          onRedo={() => drawingOverlayRef.current?.redo()}
          onClearAll={() => drawingOverlayRef.current?.clearAll()}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4 flex-1">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {worksheetTitle}
                  </h1>
                  {worksheet.share_recipient_email && (
                    <p className="text-sm text-muted-foreground mt-1">
                      From worksheet: {worksheetTitle}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  {studentName && (
                    <div className="flex items-center gap-2">
                      <span>For: <strong>{studentName}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span>Shared by: <strong>{worksheet.teacher_email}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Created: <strong>{new Date(worksheet.created_at).toLocaleDateString()}</strong></span>
                  </div>
                  {isStudyMode && verifiedEmail && (
                    <div className="flex items-center gap-2">
                      <span className="text-worksheet-purple font-medium">
                        Studying as: {verifiedEmail}
                      </span>
                    </div>
                  )}
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

      {/* Main Content - styled to match HTML export */}
      <div className="max-w-6xl mx-auto px-2 py-8 relative">
        {/* PROBLEM 3: Exercise Navigation Sidebar */}
        {exercises.length > 0 && (
          <ExerciseNavSidebar
            exercises={exercises.map((exercise: any) => ({
              title: exercise.title,
              icon: exercise.icon,
              estimated_time: exercise.time
            }))}
            activeExercise={navigation.activeExercise}
            collapsedExercises={navigation.collapsedExercises}
            onScrollToExercise={navigation.scrollToExercise}
            onToggleExercise={navigation.toggleExercise}
            onCollapseAll={navigation.collapseAll}
            onExpandAll={navigation.expandAll}
            isAllCollapsed={navigation.isAllCollapsed}
            isAllExpanded={navigation.isAllExpanded}
            hideCollapseControls={true}
            isOpen={sidebarOpen}
            setIsOpen={setSidebarOpen}
            hasGrammar={!!worksheetData?.grammar_rules}
            hasVocabulary={!!worksheetData?.vocabulary_sheet}
            isGrammarActive={navigation.isGrammarActive}
            isVocabularyActive={navigation.isVocabularyActive}
          />
        )}

        {/* Answer visibility toggle - fixed on right sidebar */}
        {interactiveHook.isSubmittedForReview && (
          <div className="fixed top-[50%] right-4 z-50 -translate-y-1/2 flex flex-col gap-1 bg-white border rounded-lg shadow-lg p-2">
            <span className="text-xs text-muted-foreground text-center mb-1">Answers</span>
            <Button 
              variant={answerVisibility === 'all' ? 'default' : 'outline'} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setAnswerVisibility('all')}
            >All</Button>
            <Button 
              variant={answerVisibility === 'closed' ? 'default' : 'outline'} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setAnswerVisibility('closed')}
            >Closed</Button>
            <Button 
              variant={answerVisibility === 'open' ? 'default' : 'outline'} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setAnswerVisibility('open')}
            >Open</Button>
            <Button 
              variant={answerVisibility === 'hidden' ? 'default' : 'outline'} 
              size="sm" 
              className="text-xs h-7"
              onClick={() => setAnswerVisibility('hidden')}
            >Hide</Button>
          </div>
        )}

        <div className="relative" ref={contentWrapperRef}>
          {/* Content wrapper */}
          <div className="worksheet-content">
            {/* PROBLEM 2: Pass exerciseRefs for navigation sidebar */}
            <SharedWorksheetContent 
              worksheet={worksheet}
              isInteractive={effectiveStudyMode}
              isReadOnly={isTeacher && !teacherEditMode}
              studentAnswers={interactiveHook.answers}
              onAnswerChange={(isTeacher && !teacherEditMode) ? undefined : interactiveHook.updateAnswer}
              onBlur={(isTeacher && !teacherEditMode) ? undefined : interactiveHook.saveOnBlur}
              exerciseRefs={navigation.exerciseRefs}
              itemEvaluations={interactiveHook.itemEvaluations}
              aiEvaluations={interactiveHook.aiEvaluations}
              audioAnswers={interactiveHook.audioAnswers}
              onAudioAnswerChange={(isTeacher && !teacherEditMode) ? undefined : (exIdx, qIdx, url) => interactiveHook.updateAudioAnswer(exIdx, qIdx, url)}
              showCorrectAnswers={interactiveHook.isSubmittedForReview}
              answerVisibilityFilter={answerVisibility}
              disabled={false}
              mediaPinned={isPinned}
              onMediaTogglePin={() => setIsPinned(!isPinned)}
              mediaFullScreen={isFullScreen}
              onMediaToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
            />
          </div>
          
          {/* DRAWING OVERLAY: Nakładka canvas do rysowania (tylko dla nauczyciela w Live Session) */}
          {worksheet?.id && currentTeacherId && (
            <DrawingOverlay
              ref={drawingOverlayRef}
              worksheetId={worksheet.id}
              teacherId={currentTeacherId}
              isTeacher={isTeacher}
              isEnabled={isDrawingEnabled}
              externalTool={currentDrawingTool}
              externalColor={currentDrawingColor}
              externalStrokeWidth={currentStrokeWidth}
              hideToolbar={true}
              onHistoryChange={(newCanUndo, newCanRedo) => {
                setCanUndo(newCanUndo);
                setCanRedo(newCanRedo);
              }}
              onSaveStatusChange={(isSaving, lastSavedAt) => {
                setDrawingIsSaving(isSaving);
                setDrawingLastSavedAt(lastSavedAt);
              }}
            />
          )}
        </div>

      </div>

      {/* PROBLEM 2: Fixed action buttons in bottom right (like WorksheetContainer) */}
      {showScrollTop && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
          {/* Pin Image button - only show if image exists and no audio */}
          {(worksheet.selected_image || worksheetData?.selected_image) && 
           !(worksheet.selected_audio || worksheetData?.selected_audio) && (
            <button 
              onClick={() => setIsPinned(!isPinned)}
              className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              aria-label={isPinned ? "Unpin image" : "Pin image"}
              title={isPinned ? "Unpin image" : "Pin image"}
            >
              <Image className="h-5 w-5" />
            </button>
          )}
          
          {/* Pin Audio button - only show if audio exists */}
          {(worksheet.selected_audio || worksheet.audio_url || worksheetData?.selected_audio) && (
            <button 
              onClick={() => setIsPinned(!isPinned)}
              className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
              aria-label={isPinned ? "Unpin audio player" : "Pin audio player"}
              title={isPinned ? "Unpin audio player" : "Pin audio player"}
            >
              <Headphones className="h-5 w-5" />
            </button>
          )}
          
          {/* Scroll to top button */}
          <button 
            onClick={scrollToTop}
            className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* PROBLEM 2: Pinned image in bottom right corner (like WorksheetContainer) */}
      {isPinned && (worksheet.selected_image || worksheetData?.selected_image) && 
       !(worksheet.selected_audio || worksheetData?.selected_audio) && (
        <div 
          className="fixed bottom-6 right-24 z-40 bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
          style={{ width: '300px' }}
        >
          <div className="relative">
            <img
              src={(worksheet.selected_image || worksheetData?.selected_image)?.url}
              alt={(worksheet.selected_image || worksheetData?.selected_image)?.description || 'Lesson image'}
              className="w-full h-auto object-contain max-h-[200px]"
            />
            <div className="absolute top-1 right-1 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullScreen(true)}
                className="bg-white/80 hover:bg-white"
                title="Expand image"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPinned(false)}
                className="bg-white/80 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PROBLEM 2: Full screen modal for pinned image (like WorksheetContainer) */}
      {isFullScreen && (worksheet.selected_image || worksheetData?.selected_image) && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setIsFullScreen(false)}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsFullScreen(false);
            }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={(worksheet.selected_image || worksheetData?.selected_image)?.url}
            alt={(worksheet.selected_image || worksheetData?.selected_image)?.description || 'Lesson image'}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* PROBLEM 2: Pinned Audio Player (like WorksheetContainer) */}
      {isPinned && (worksheet.selected_audio || worksheet.audio_url || worksheetData?.selected_audio) && (
        <div className="fixed bottom-6 right-24 z-40 bg-white border-2 border-worksheet-purple rounded-lg shadow-2xl p-4 w-80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              🎧 Pinned Audio Player
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPinned(false)}
              className="h-7 w-7 p-0 hover:bg-gray-100"
              title="Unpin audio player"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <audio
            controls
            src={
              worksheet.audio_url || 
              worksheet.selected_audio?.ai_generated_audio_url || 
              worksheet.selected_audio?.url ||
              worksheetData?.selected_audio?.ai_generated_audio_url ||
              worksheetData?.selected_audio?.url ||
              ''
            }
            className="w-full"
            controlsList="nodownload"
            style={{ 
              height: '40px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px'
            }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="bg-white border-t py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">
            {isStudyMode ? (
              "Your answers are automatically saved as you type."
            ) : (
              <>
                This is a read-only view of a shared worksheet. 
                <a 
                  href="/" 
                  className="text-worksheet-purple hover:underline ml-1 font-medium"
                >
                  Create your own worksheets at edooqoo.com
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedWorksheet;
