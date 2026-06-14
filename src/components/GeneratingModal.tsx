import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Progress } from "@/components/ui/progress";
import { Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import GenerationContextPanel from "@/components/generation/GenerationContextPanel";
import WorkflowSummaryCard from "@/components/generation/WorkflowSummaryCard";
import { generationModalSlides } from "@/components/generation/generationModalSlides";

interface GeneratingModalProps {
  isOpen: boolean;
  requiresAudio?: boolean;
  requiresImage?: boolean;
  hasGrammar?: boolean;
  streamProgress?: {
    exercisesGenerated: number;
    expectedTotal: number;
  } | null;
  mediaGenerating?: boolean;
  onCancel?: () => void;
  selectedExercises?: string[];
  errorMessage?: string | null;
  onRetry?: () => void;
  isAnonymous?: boolean;
  studentName?: string;
  studentEmail?: string | null;
  /**
   * v6.9.57 — true when the modal was rehydrated after a page refresh
   * because the backend is still generating in the background. Shows a
   * dedicated banner and skips the "expected time" hint since we no longer
   * own the original startedAt.
   */
  isResumed?: boolean;
  /**
   * v6.9.58 — epoch ms when generation actually started. Used to seed
   * elapsed time + progress bar after a refresh so the user sees live
   * values instead of 0.
   */
  startedAt?: number;
  /**
   * v6.9.58 — student id used to deep-link the student name in the
   * "For {student}" header to their profile in a new tab.
   */
  studentId?: string | null;
  /**
   * v6.9.58 — jobId of the underlying generation job. Dispatched in the
   * `generation-modal:mount` / `:unmount` events so the global mini panel
   * can hide ONLY the job represented by this modal (not all jobs).
   */
  jobId?: string | null;
}

// Section completion status
interface SectionStatus {
  label: string;
  status: 'pending' | 'generating' | 'done';
  isExerciseItem?: boolean; // PROBLEM 5: Flag for individual exercise items
  exerciseIndex?: number;    // PROBLEM 5: Exercise number (1-8)
}

// Format exercise type to readable name
const formatExerciseType = (type: string): string => {
  return type
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Dynamic generation sections based on selected media and grammar
const getGenerationSections = (
  requiresAudio: boolean, 
  requiresImage: boolean, 
  hasGrammar: boolean,
  selectedExercises?: string[]
): SectionStatus[] => {
  const sections: SectionStatus[] = [];
  
  // Media first (if required by exercises)
  if (requiresAudio) {
    sections.push({ label: 'Audio', status: 'pending' });
  }
  if (requiresImage) {
    sections.push({ label: 'Image', status: 'pending' });
  }
  
  // Core sections
  sections.push({ label: 'Warmup', status: 'pending' });
  
  // Grammar Rules - only if selected in form
  if (hasGrammar) {
    sections.push({ label: 'Grammar Rules', status: 'pending' });
  }
  
  // PROBLEM 5: Add individual exercise items if we have selectedExercises
  if (selectedExercises && selectedExercises.length > 0) {
    sections.push({ label: 'Exercises', status: 'pending' });
    
    // Add each exercise as a sub-item
    selectedExercises.forEach((exerciseType, idx) => {
      sections.push({
        label: `Exercise ${idx + 1}: ${formatExerciseType(exerciseType)}`,
        status: 'pending',
        isExerciseItem: true,
        exerciseIndex: idx
      });
    });
  } else {
    // Fallback if no selectedExercises provided
    sections.push({ label: 'Exercises', status: 'pending' });
  }
  
  sections.push({ label: 'Vocabulary Sheet', status: 'pending' });
  
  return sections;
};

// PROBLEM 3: Improved time calculator - rounded to 10s
const calculateExpectedTime = (
  requiresAudio: boolean,
  requiresImage: boolean,
  hasGrammar: boolean,
  exerciseCount: number
): number => {
  let time = 45; // Base time in seconds
  
  // Media adds time
  if (requiresAudio) time += 25; // TTS generation + upload
  if (requiresImage) time += 20; // Image generation + upload
  
  // Grammar adds time
  if (hasGrammar) time += 8;
  
  // Extra exercises beyond 6 add time
  const extraExercises = Math.max(0, exerciseCount - 6);
  time += extraExercises * 4;
  
  // Round to nearest 10 seconds
  return Math.ceil(time / 10) * 10;
};

// PROBLEM 3: Format expected time nicely
const formatExpectedTime = (seconds: number): string => {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `~${mins}:${secs < 10 ? '0' : ''}${secs} min` : `~${mins} min`;
};

export default function GeneratingModal({ 
  isOpen, 
  requiresAudio = false, 
  requiresImage = false,
  hasGrammar = true,
  streamProgress = null,
  mediaGenerating = false,
  selectedExercises,
  errorMessage,
  onRetry,
  isAnonymous = false,
  studentName,
  studentEmail,
  isResumed = false,
  startedAt,
  studentId,
  jobId,
}: GeneratingModalProps) {
  // v6.9.58 — seed live values from startedAt so a refresh resumes the bar
  // and timer instead of restarting them from zero.
  const initialElapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(initialElapsed);
  const [sections, setSections] = useState<SectionStatus[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // PROBLEM 3: Calculate expected time based on configuration
  const exerciseCount = selectedExercises?.length || 6;
  const expectedSeconds = calculateExpectedTime(requiresAudio, requiresImage, hasGrammar, exerciseCount);

  // v6.9.57 — Notify global listeners (mini panel) that the in-page modal is
  // currently mounted so they can avoid duplicating UI. v6.9.58: include
  // jobId in the event detail so the panel hides ONLY the matching job.
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent('generation-modal:mount', { detail: { jobId: jobId ?? null } }));
    } catch { /* ignore */ }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('generation-modal:unmount', { detail: { jobId: jobId ?? null } }));
      } catch { /* ignore */ }
    };
  }, [isOpen, jobId]);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setElapsedTime(0);
      setSections([]);
      setActiveSlideIndex(0);
      setIsCarouselPaused(false);
      return;
    }

    // Initialize sections with grammar condition and selected exercises
    setSections(getGenerationSections(requiresAudio, requiresImage, hasGrammar, selectedExercises));

    // v6.9.58 — seed both timer and progress from startedAt (if known) so a
    // refresh-resumed modal continues from realistic values.
    const seedElapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
    setElapsedTime(seedElapsed);
    setProgress(Math.min(99, (seedElapsed / Math.max(1, expectedSeconds)) * 100));

    const progressIncrement = 100 / Math.max(1, expectedSeconds);
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + progressIncrement, 99));
    }, 1000);
    const timerInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(timerInterval);
    };
  }, [isOpen, requiresAudio, requiresImage, hasGrammar, selectedExercises, expectedSeconds, startedAt]);

  useEffect(() => {
    if (!isOpen || errorMessage || isCarouselPaused) return;

    const carouselInterval = setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % generationModalSlides.length);
    }, 15000);

    return () => clearInterval(carouselInterval);
  }, [isOpen, errorMessage, isCarouselPaused]);

  // Update sections based on progress - SEQUENTIAL ACTIVATION with exercise details
  useEffect(() => {
    if (sections.length === 0) return;

    setSections(prev => {
      const updated = [...prev];
      const hasMedia = requiresAudio || requiresImage;
      const warmupIndex = updated.findIndex(s => s.label === 'Warmup');
      const grammarIndex = updated.findIndex(s => s.label === 'Grammar Rules');
      const exercisesHeaderIndex = updated.findIndex(s => s.label === 'Exercises');
      const vocabIndex = updated.findIndex(s => s.label === 'Vocabulary Sheet');
      
      // PHASE 1: Media generating
      if (hasMedia && mediaGenerating) {
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].label === 'Audio' || updated[i].label === 'Image') {
            updated[i].status = 'generating';
          }
        }
        return updated;
      }
      
      // PHASE 2A: Media done OR no media - Warmup+Grammar generating
      // (before first exercise)
      if ((!hasMedia || !mediaGenerating) && (!streamProgress || streamProgress.exercisesGenerated === 0)) {
        // Mark media as done (if exists)
        for (let i = 0; i < updated.length; i++) {
          if (updated[i].label === 'Audio' || updated[i].label === 'Image') {
            updated[i].status = 'done';
          }
        }
        // Activate Warmup + Grammar (they generate before exercises)
        if (warmupIndex !== -1) updated[warmupIndex].status = 'generating';
        if (grammarIndex !== -1) updated[grammarIndex].status = 'generating';
        return updated;
      }
      
      // PHASE 3: Exercises generating (exercisesGenerated > 0)
      if (streamProgress && streamProgress.exercisesGenerated > 0) {
        // All prior sections done
        for (let i = 0; i < updated.length; i++) {
          if (['Audio', 'Image', 'Warmup', 'Grammar Rules'].includes(updated[i].label)) {
            updated[i].status = 'done';
          }
        }
        
        // Exercises header - generating while any exercise is in progress
        if (exercisesHeaderIndex !== -1) {
          if (streamProgress.exercisesGenerated >= streamProgress.expectedTotal) {
            updated[exercisesHeaderIndex].status = 'done';
          } else {
            updated[exercisesHeaderIndex].status = 'generating';
          }
        }
        
        // PROBLEM 5: Update individual exercise statuses
        updated.forEach((section, idx) => {
          if (section.isExerciseItem && section.exerciseIndex !== undefined) {
            const exIdx = section.exerciseIndex;
            if (exIdx < streamProgress.exercisesGenerated - 1) {
              // Completed exercises
              updated[idx].status = 'done';
            } else if (exIdx === streamProgress.exercisesGenerated - 1) {
              // Current exercise just completed
              updated[idx].status = 'done';
            } else if (exIdx === streamProgress.exercisesGenerated) {
              // Currently generating
              updated[idx].status = 'generating';
            }
            // else: still pending
          }
        });
        
        // If all exercises done - Vocabulary generating
        if (streamProgress.exercisesGenerated >= streamProgress.expectedTotal) {
          if (vocabIndex !== -1) updated[vocabIndex].status = 'generating';
        }
      }
      
      return updated;
    });
  }, [streamProgress, mediaGenerating, sections.length, requiresAudio, requiresImage]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // ERROR STATE
  if (errorMessage) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-[520px] mx-4 space-y-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-16 w-16 text-destructive" />
            <h2 className="text-2xl font-semibold text-center text-foreground">
              {errorMessage?.includes('Invalid JSON') || errorMessage?.includes('repair')
                ? "We couldn't finish generating this worksheet"
                : "Something Went Wrong"}
            </h2>
          </div>

          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              {errorMessage?.includes('Invalid JSON') || errorMessage?.includes('repair')
                ? "The AI response was incomplete on our side. This happens occasionally with complex worksheets."
                : "We're sorry — an error occurred during worksheet generation."}
            </p>
            <p className="text-sm font-medium text-foreground">
              No token was consumed. Your form data is preserved.
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onRetry}>
              Close
            </Button>
            <Button onClick={onRetry}>
              Try Again
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground/60 break-all">
            Error: {errorMessage}
          </p>
        </div>
      </div>,
      document.body
    );
  }

  // NORMAL PROGRESS STATE
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 overflow-y-auto lg:overflow-hidden">
        <div
          className={cn(
            'bg-white rounded-lg shadow-xl mx-4 w-full',
            // Mobile: allow internal scroll if needed.
            'max-h-[calc(100vh-2rem)] overflow-y-auto',
            // Desktop (lg+): cap height AND hide scrollbar — content is sized
            // to fit a 720p viewport without a scrollbar.
            'lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden',
            'max-w-[520px] lg:max-w-[1080px]'
          )}
        >
        <div
          className={cn(
            'p-6',
            'space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.88fr)] lg:gap-4 lg:space-y-0 lg:p-5 lg:min-h-0'
          )}
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onFocusCapture={() => setIsCarouselPaused(true)}
          onBlurCapture={() => setIsCarouselPaused(false)}
        >
          <div className="flex flex-col h-full space-y-2.5 min-w-0 min-h-0">
        <div className="text-center space-y-0.5">
          <h2 className="text-xl lg:text-2xl font-semibold bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 bg-clip-text text-transparent">
            Generating Your Worksheet
          </h2>
          {studentName ? (
            <p className="text-xs lg:text-sm text-muted-foreground">
              For{' '}
              {studentId ? (
                <a
                  href={`/student/${studentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {studentName}
                </a>
              ) : (
                <span className="font-medium text-foreground">{studentName}</span>
              )}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              <span className="font-normal text-foreground/80 break-all">
                {studentEmail && studentEmail.trim().length > 0
                  ? studentEmail
                  : 'no student email set'}
              </span>
            </p>
          ) : null}
        </div>

        <Progress
          value={progress}
          className="h-3 bg-gray-200"
          indicatorClassName="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500"
        />

        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Time: {formatTime(elapsedTime)}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs flex items-center justify-between gap-3',
            isResumed
              ? 'border-amber-300/60 bg-amber-50/80 text-amber-900'
              : 'border-muted bg-muted/40 text-muted-foreground',
          )}
        >
          <span className="leading-snug">
            {isResumed && <strong className="mr-1">Generation resumed.</strong>}
            Generation runs in the background — keep prepping for
            {studentName ? (
              <>
                {' '}
                <span className="font-medium text-foreground">{studentName}</span>
              </>
            ) : (
              ' your students'
            )}
            {' '}or another student while you wait.
          </span>
          <Button asChild size="sm" variant="outline" className="h-7 text-[11px] shrink-0">
            <a href="/dashboard" target="_blank" rel="noopener noreferrer">
              Open dashboard ↗
            </a>
          </Button>
        </div>

        <div className="space-y-1 bg-muted/30 p-2 rounded-lg max-h-[44vh] lg:max-h-[46vh] overflow-y-auto">
          {sections.map((section, index) => (
            <div 
              key={index} 
              className={`flex items-center gap-2 ${section.isExerciseItem ? 'ml-5' : ''}`}
            >
              <div className={`flex items-center justify-center ${section.isExerciseItem ? 'w-5 h-5' : 'w-6 h-6'}`}>
                {section.status === 'pending' && (
                  <Circle className={`${section.isExerciseItem ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground stroke-[1.5]`} />
                )}
                {section.status === 'generating' && (
                  <Loader2 className={`${section.isExerciseItem ? 'h-4 w-4' : 'h-5 w-5'} text-primary animate-spin`} />
                )}
                {section.status === 'done' && (
                  <CheckCircle2 className={`${section.isExerciseItem ? 'h-4 w-4' : 'h-5 w-5'} text-green-600`} />
                )}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${section.isExerciseItem ? 'text-xs' : 'text-sm'} ${
                  section.status === 'generating' 
                    ? 'text-primary' 
                    : section.status === 'done'
                      ? 'text-green-600'
                      : 'text-muted-foreground'
                }`}>
                  {section.label}
                  {section.label === 'Exercises' && streamProgress && (
                    <span className="ml-2 font-bold">
                      ({streamProgress.exercisesGenerated}/{streamProgress.expectedTotal})
                    </span>
                  )}
                </div>
              </div>
              {section.status === 'generating' && !section.isExerciseItem && (
                <div className="text-xs text-primary animate-pulse">Generating...</div>
              )}
              {section.status === 'done' && !section.isExerciseItem && (
                <div className="text-xs text-green-600">Done</div>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400">
          Expected time: {formatExpectedTime(expectedSeconds)}
          {(requiresAudio || requiresImage) && (
            <span className="ml-1">
              (with {requiresAudio && requiresImage ? 'audio & image' : requiresAudio ? 'audio' : 'image'})
            </span>
          )}
        </p>
        <WorkflowSummaryCard
          activeSlideIndex={activeSlideIndex}
          onSlideChange={setActiveSlideIndex}
          className="mt-auto"
        />
          </div>
          <GenerationContextPanel
            variant={isAnonymous ? 'anonymous' : 'authenticated'}
            activeSlideIndex={activeSlideIndex}
            onSlideChange={setActiveSlideIndex}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
