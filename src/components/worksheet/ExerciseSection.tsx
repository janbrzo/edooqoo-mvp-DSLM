import React, { useEffect, useCallback, forwardRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { LiveAudioPlayer } from "./LiveAudioPlayer";
import { updateWorksheet } from "@/services/worksheetService";
import { useExerciseRegeneration } from "@/hooks/useExerciseRegeneration";
import TeacherTipSection from "./TeacherTipSection";
import ExerciseRegenerateModal from "./ExerciseRegenerateModal";
import ExerciseHeader from "./ExerciseHeader";
import ExerciseContent from "./ExerciseContent";
import MediaDisplay from "./MediaDisplay";
import ExerciseReading from "./ExerciseReading";
import ExerciseMatching from "./ExerciseMatching";
import ExerciseFillInBlanks from "./ExerciseFillInBlanks";
import ExerciseMultipleChoice from "./ExerciseMultipleChoice";
import ExerciseOddOneOut from "./ExerciseOddOneOut";
import ExerciseDialogue from "./ExerciseDialogue";
import ExerciseDescribe from "./ExerciseDescribe";
import ExerciseWritingTask from "./ExerciseWritingTask";
import ExerciseAnswerQuestions from "./ExerciseAnswerQuestions";
import ExerciseGapText from "./ExerciseGapText";
import ExerciseMatchingHalves from "./ExerciseMatchingHalves";
import ExerciseCompleteWord from "./ExerciseCompleteWord";
import ExerciseCategorize from "./ExerciseCategorize";
import ExerciseParaphrasing from "./ExerciseParaphrasing";
import ExerciseSentenceTransformation from "./ExerciseSentenceTransformation";
import ExerciseNegativePrefixes from "./ExerciseNegativePrefixes";
import ExerciseWordOrder from "./ExerciseWordOrder";
import ExerciseSynonymsAntonyms from "./ExerciseSynonymsAntonyms";
import ExerciseListeningComprehension from "./ExerciseListeningComprehension";
import ExerciseMultipleChoiceAudio from "./ExerciseMultipleChoiceAudio";
import ExerciseTrueFalseAudio from "./ExerciseTrueFalseAudio";
import ExerciseFillInBlanksAudio from "./ExerciseFillInBlanksAudio";
import ExerciseAnswerQuestionsAudio from "./ExerciseAnswerQuestionsAudio";
import NanoSkillMasteryModal, { UndoMarkDoneModal } from "./NanoSkillMasteryModal";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
import { devLog } from '@/utils/logger';
  handleExerciseChange,
  handleQuestionChange,
  handleItemChange,
  handleSentenceChange,
  handleExpressionChange,
  handleTeacherTipChange,
  handleDialogueChange,
  handleStatementChange,
  getMatchedItems,
  renderOtherExerciseTypes
} from "./ExerciseSectionUtils";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { supabase } from "@/integrations/supabase/client";
import { useStudentEvents } from "@/hooks/dslm/useStudentEvents";
import { AiEvaluationBadge, type AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { resolveAiEvaluations } from "@/utils/aiEvaluationMapper";

// Helper: convert liveItemEvaluations array to Record<number, AiEvaluation> for exercise components
const convertLiveEvalsToAiEvals = (items: any[] | undefined): Record<number, AiEvaluation> | undefined => {
  if (!items?.length) return undefined;
  const result: Record<number, AiEvaluation> = {};
  
  // Group by question_index to detect dual scores
  const grouped: Record<number, any[]> = {};
  items.forEach((item: any) => {
    const qIdx = item.question_index ?? 0;
    if (!grouped[qIdx]) grouped[qIdx] = [];
    grouped[qIdx].push(item);
  });
  
  for (const [qIdxStr, groupItems] of Object.entries(grouped)) {
    const qIdx = parseInt(qIdxStr);
    
    if (groupItems.some(item => item.hasValue === false)) {
      result[qIdx] = { is_acceptable: false, quality_score: -1, feedback: '', question_index: qIdx };
      continue;
    }
    
    let baseMastery: number | undefined;
    let writingMastery: number | undefined;
    let speakingMastery: number | undefined;
    let feedback = '';
    
    groupItems.forEach((item: any) => {
      const name = (item.name || '').toLowerCase();
      if (name.endsWith('.writing') || name.includes('.writing.') || name.includes('.wr.')) {
        writingMastery = item.mastery;
      } else if (name.endsWith('.speaking') || name.includes('.speaking.') || name.includes('.sp.')) {
        speakingMastery = item.mastery;
      } else {
        baseMastery = item.mastery;
        // Fallback: read writing_score/speaking_score from item if nano-skill name doesn't indicate type
        if (writingMastery === undefined && item.writing_score !== undefined) {
          writingMastery = Math.round(item.writing_score * 100);
        }
        if (speakingMastery === undefined && item.speaking_score !== undefined) {
          speakingMastery = Math.round(item.speaking_score * 100);
        }
      }
      if (item.feedback) feedback = item.feedback;
    });
    
    const effectiveMastery = baseMastery ?? 
      (writingMastery !== undefined && speakingMastery !== undefined 
        ? Math.round((writingMastery + speakingMastery) / 2) 
        : writingMastery ?? speakingMastery ?? 0);
    
    result[qIdx] = {
      is_acceptable: effectiveMastery >= 70,
      quality_score: effectiveMastery / 100,
      feedback,
      question_index: qIdx,
      writing_score: writingMastery !== undefined ? writingMastery / 100 : undefined,
      speaking_score: speakingMastery !== undefined && speakingMastery >= 0 ? speakingMastery / 100 : undefined,
    };
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
};

// PROBLEM 3: Complete classification of all 29 exercise types
export const EXERCISE_TYPE_CLASSIFICATION = {
  // OPEN-ENDED: Require AI verification or teacher evaluation
  // NOTE: Include BOTH original and normalized versions for proper matching
  open: [
    'dialogue', 'discussion', 
    'describe-picture', 'describe', // Both original and normalized versions
    'answer-questions', 'answer-questions-picture', 'answer-questions-audio',
    'paraphrasing', 'reading',
    'listening-comprehension'
  ],
  // CLOSED: Automatic verification (correct/incorrect)
  closed: [
    'fill-in-blanks', 'fill-in-blanks-audio',
    'multiple-choice', 'multiple-choice-audio', 'multiple-choice-picture',
    'true-false', 'true-false-audio', 'true-false-picture',
    'matching', 'matching-halves',
    'odd-one-out', 'word-order', 'gap-text',
    'negative-prefixes', 'categorize', 'complete-word',
    'sentence-transformation', 'synonyms', 'antonyms', 'synonyms-antonyms',
    'error-correction'
  ]
};

// PROBLEM 1.2: Open-ended exercise types that require AI verification
const OPEN_ENDED_EXERCISE_TYPES = EXERCISE_TYPE_CLASSIFICATION.open;

interface Exercise {
  type: string;
  title: string;
  icon: string;
  time: number;
  instructions: string;
  content?: string;
  questions?: any[];
  items?: any[];
  sentences?: any[];
  dialogue?: any[];
  statements?: any[];
  word_bank?: string[];
  expressions?: string[];
  expression_instruction?: string;
  teacher_tip: string;
  // Soft delete support
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Worksheet {
  title: string;
  subtitle: string;
  introduction: string;
  exercises: Exercise[];
  vocabulary_sheet: {
    term: string;
    meaning: string;
  }[];
}

interface ExerciseSectionProps {
  exercise: any;
  index: number;
  originalIndex?: number;
  isEditing: boolean;
  viewMode: "student" | "teacher" | "live-session";
  editableWorksheet: any;
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>;
  worksheetId?: string;
  originalFormData?: any;
  userId?: string;
  // Exercise management props
  totalExercises?: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDeleteExercise?: () => void;
  // New collapse functionality
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  // New: Hide exercise-level media if Lesson Media section exists
  hideExerciseMedia?: boolean;
  // Interactive homework props
  isInteractive?: boolean;
  studentAnswers?: Record<number, any>;
  onAnswerChange?: (questionIndex: number, value: any) => void;
  showCorrectAnswers?: boolean;
  // PROBLEM 1: Live Session answer prop - passed inline to exercises for blue highlighting
  liveSessionAnswer?: Record<number, any>;
  // Live Session AI evaluation feedback for this exercise
  liveItemEvaluations?: any[];
  // Live Session canonical AI evaluation for this exercise
  liveAiEvaluation?: any;
  // Live Session audio answers for this exercise
  liveAudioAnswers?: Record<number, string>;
  // PROBLEM 5: Mark exercise as done in Live Session
  isMarkedDone?: boolean;
  onMarkDone?: () => void;
  // A3-A5: Disable inputs after homework submission
  disabled?: boolean;
  // DSLM: Student info for mastery evaluation
  studentId?: string;
  teacherId?: string;
}

// Helper function to normalize exercise type (removes -picture suffix for rendering logic)
const normalizeExerciseType = (type: string): string => {
  return type.replace('-picture', '');
};

// Helper function to update exercise number in title for display
const updateExerciseNumber = (title: string, newNumber: number): string => {
  // Match "Exercise X:" at the start of the title
  const match = title.match(/^Exercise\s+\d+:\s*(.*)$/i);
  if (match) {
    // Replace with new number, keeping the rest of the title
    return `Exercise ${newNumber}: ${match[1]}`;
  }
  // If no match, return title as is
  return title;
};

const ExerciseSection = forwardRef<HTMLDivElement, ExerciseSectionProps>(({
  exercise,
  index,
  originalIndex,
  isEditing,
  viewMode,
  editableWorksheet,
  setEditableWorksheet,
  worksheetId,
  originalFormData,
  userId,
  totalExercises = 0,
  onMoveUp,
  onMoveDown,
  onDeleteExercise,
  isCollapsed = false,
  onToggleCollapse,
  hideExerciseMedia = false,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  // PROBLEM 1: Live Session answer prop
  liveSessionAnswer,
  // Live Session AI evaluation feedback
  liveItemEvaluations: liveItemEvalsProp,
  // Live Session canonical AI evaluation
  liveAiEvaluation: liveAiEvalProp,
  // Live Session audio answers
  liveAudioAnswers,
  // PROBLEM 5: Mark Done props from parent
  isMarkedDone: isMarkedDoneProp,
  onMarkDone: onMarkDoneProp,
  // A3-A5: Disable inputs after homework submission
  disabled = false,
  // DSLM: Student info for mastery evaluation
  studentId: studentIdProp,
  teacherId: teacherIdProp,
}, ref) => {
  // PROBLEM 4: Persist Mark Done state to localStorage for Live Session
  // Use worksheetId prop as fallback, ensure we have a valid ID before creating storage key
  const worksheetIdForStorage = (editableWorksheet as any)?.id || worksheetId;
  const exerciseIdx = originalIndex !== undefined ? originalIndex : index;
  
  // Only create storage key if we have a valid worksheet ID
  const storageKey = worksheetIdForStorage 
    ? `exercise-done-${worksheetIdForStorage}-${exerciseIdx}`
    : null;
  
  const [localMarkedDone, setLocalMarkedDone] = React.useState(() => {
    // Don't check localStorage if we don't have a valid key
    if (typeof window === 'undefined' || !storageKey) return false;
    return localStorage.getItem(storageKey) === 'true';
  });
  
  // PROBLEM 4: Update state when worksheetId becomes available
  React.useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey) === 'true';
      setLocalMarkedDone(stored);
    }
  }, [storageKey]);
  
  // DSLM: NanoSkill Mastery Modal state
  const [isMasteryModalOpen, setIsMasteryModalOpen] = useState(false);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
  
  // PROBLEM 1.2: AI evaluation state for open-ended exercises
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, number> | null>(null);
  const [isLoadingAiEvaluation, setIsLoadingAiEvaluation] = useState(false);
  
  // PROBLEM 2 FIX: Validate IDs before passing to hook - use undefined instead of empty string
  const validStudentId = studentIdProp && studentIdProp.trim() !== '' ? studentIdProp : undefined;
  const validTeacherId = teacherIdProp && teacherIdProp.trim() !== '' ? teacherIdProp : undefined;
  
  // Get student events hook if we have student and teacher IDs
  const { addEvent } = useStudentEvents({
    studentId: validStudentId || '',
    teacherId: validTeacherId || ''
  });
  
  const isMarkedDone = isMarkedDoneProp ?? localMarkedDone;
  
  // Extract all nano_skills from exercise for mastery evaluation
  const extractNanoSkillsFromExercise = (ex: any): NanoSkill[] => {
    const skills: NanoSkill[] = [];
    
    // Check questions
    if (ex.questions) {
      ex.questions.forEach((q: any) => {
        const ns = safeGetNanoSkill(q);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check items
    if (ex.items) {
      ex.items.forEach((item: any) => {
        const ns = safeGetNanoSkill(item);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check sentences
    if (ex.sentences) {
      ex.sentences.forEach((s: any) => {
        const ns = safeGetNanoSkill(s);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check statements
    if (ex.statements) {
      ex.statements.forEach((st: any) => {
        const ns = safeGetNanoSkill(st);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check words (for categorize, word order, etc.)
    if (ex.words) {
      ex.words.forEach((w: any) => {
        const ns = safeGetNanoSkill(w);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check expressions (dialogue)
    if (ex.expressions) {
      ex.expressions.forEach((expr: any) => {
        const ns = safeGetNanoSkill(expr);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check categories (categorize)
    if (ex.categories) {
      ex.categories.forEach((cat: any) => {
        const ns = safeGetNanoSkill(cat);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check sentence_halves
    if (ex.sentence_halves) {
      ex.sentence_halves.forEach((sh: any) => {
        const ns = safeGetNanoSkill(sh);
        if (ns && ns.name) skills.push(ns);
      });
    }
    // Check prompts (describe)
    if (ex.prompts) {
      ex.prompts.forEach((p: any) => {
        const ns = safeGetNanoSkill(p);
        if (ns && ns.name) skills.push(ns);
      });
    }
    
    // PROBLEM 1 FIX: DO NOT remove duplicates - we need 1:1 mapping with items
    // Each skill position corresponds to a specific exercise item
    // The mastery modal needs this to match skills with student answers
    return skills;
  };
  
  // PROBLEM 1.2: Handle Mark Done with AI verification for open-ended exercises
  // PROBLEM 4: Open modal IMMEDIATELY, then load AI in background
  const handleMarkDoneWithModal = async () => {
    const exerciseType = normalizeExerciseType(exercise.type);
    
    // PROBLEM 4 FIX: Open modal IMMEDIATELY for instant feedback
    setIsMasteryModalOpen(true);
    
    // Check if this is an open-ended exercise that needs AI verification
    if (OPEN_ENDED_EXERCISE_TYPES.includes(exerciseType) && liveSessionAnswer && Object.keys(liveSessionAnswer).length > 0) {
      setIsLoadingAiEvaluation(true);
      setAiEvaluations(null);
      
      devLog('[AI Evaluation] Starting for exercise type:', exerciseType);
      
      // Prepare answers to evaluate
      const answersToEvaluate = Object.entries(liveSessionAnswer)
        .filter(([_, answer]) => answer && String(answer).trim())
        .map(([idx, answer]) => {
          const qIndex = parseInt(idx);
          // Get question/prompt text based on exercise structure
          let questionText = `Question ${qIndex + 1}`;
          let suggestedAnswer: string | undefined;
          
          // PROBLEM 1 FIX: Check prompts FIRST for describe/describe-picture type
          // Note: exerciseType is normalized, so 'describe-picture' becomes 'describe'
          if ((exerciseType === 'describe' || exercise.type === 'describe-picture') && exercise.prompts?.[qIndex]) {
            const prompt = exercise.prompts[qIndex];
            questionText = typeof prompt === 'string' ? prompt : prompt.prompt || prompt.text || questionText;
            suggestedAnswer = typeof prompt === 'object' ? (prompt.suggested || prompt.answer) : undefined;
            devLog(`[AI Evaluation] Describe-picture using prompts[${qIndex}]:`, questionText);
          } else if (exercise.questions?.[qIndex]) {
            questionText = exercise.questions[qIndex].question || exercise.questions[qIndex].text || questionText;
            suggestedAnswer = exercise.questions[qIndex].answer || exercise.questions[qIndex].suggested;
          } else if (exercise.expressions?.[qIndex]) {
            const expr = exercise.expressions[qIndex];
            questionText = typeof expr === 'string' ? expr : expr.text || questionText;
          } else if (exercise.prompts?.[qIndex]) {
            // Fallback for other exercise types with prompts
            const prompt = exercise.prompts[qIndex];
            questionText = typeof prompt === 'string' ? prompt : prompt.prompt || prompt.text || questionText;
            suggestedAnswer = typeof prompt === 'object' ? (prompt.suggested || prompt.answer) : undefined;
          }
          
          return {
            question_index: qIndex,
            question_text: questionText,
            student_answer: String(answer),
            suggested_answer: suggestedAnswer,
            exercise_type: exerciseType
          };
        });
      
      devLog('[AI Evaluation] Answers to evaluate:', answersToEvaluate.length);
      
      if (answersToEvaluate.length > 0) {
        try {
          // PROBLEM 4.1 FIX: Build comprehensive context with audio transcript and image description
          const contextParts: string[] = [exercise.title || ''];
          if (exercise.audio_transcript) {
            contextParts.push(`Audio transcript: ${exercise.audio_transcript}`);
          }
          if (exercise.image_description || exercise.picture_description) {
            contextParts.push(`Image description: ${exercise.image_description || exercise.picture_description}`);
          }
          if (exercise.content) {
            contextParts.push(`Reading text: ${String(exercise.content).slice(0, 500)}...`);
          }
          const fullContext = contextParts.filter(p => p).join('\n\n');
          
          devLog('[AI Evaluation] Context being sent:', fullContext);
          
          const { data, error } = await supabase.functions.invoke('verify-open-answers', {
            body: {
              answers: answersToEvaluate,
              english_level: originalFormData?.englishLevel || 'B1',
              context: fullContext
            }
          });
          
          if (error) {
            console.error('[AI Evaluation] Error:', error);
          } else if (data?.evaluations) {
            // Convert quality_score (0-1) to percentage (0-100)
            const evaluationsMap: Record<number, number> = {};
            data.evaluations.forEach((e: any) => {
              evaluationsMap[e.question_index] = Math.round(e.quality_score * 100);
            });
            setAiEvaluations(evaluationsMap);
            devLog('[AI Evaluation] Results:', evaluationsMap);
            devLog('[AI Evaluation] FULL Response from AI:', JSON.stringify(data, null, 2));
          }
        } catch (err) {
          console.error('[AI Evaluation] Exception:', err);
        }
      }
      setIsLoadingAiEvaluation(false);
    }
  };
  
  const handleMasterySubmit = async (ratings: { name: string; reason: string; mastery: number; hasValue?: boolean }[]) => {
    // Filter out ratings without explicit value (PROBLEM 1.2)
    const ratingsWithValue = ratings.filter(r => r.hasValue !== false);
    
    // PROBLEM 3: Validate required IDs before attempting to save
    if (!studentIdProp || !teacherIdProp) {
      console.error('❌ Missing studentId or teacherId:', { studentIdProp, teacherIdProp });
      toast({
        title: "Cannot save evaluation",
        description: "Student or teacher information is missing. Please ensure a student is assigned to this worksheet.",
        variant: "destructive"
      });
      // Still mark as done locally even if we can't save to DB
      setLocalMarkedDone(true);
      if (storageKey) localStorage.setItem(storageKey, 'true');
      return;
    }
    
    // Save to student_events if we have ratings with values
    if (ratingsWithValue.length > 0) {
      try {
        const exerciseIdx = originalIndex !== undefined ? originalIndex : index - 1;
        
        devLog('📝 Saving mastery evaluation:', {
          studentId: studentIdProp,
          teacherId: teacherIdProp,
          worksheetId: worksheetIdForStorage,
          exerciseIdx,
          ratingsCount: ratingsWithValue.length
        });
        
        // PROBLEM 3: UPSERT - Check if event already exists for this exercise
        const { data: existingEvents, error: fetchError } = await supabase
          .from('student_events')
          .select('id, event_payload')
          .eq('student_id', studentIdProp)
          .eq('source_id', worksheetIdForStorage || '')
          .eq('event_type', 'mark_done_evaluation')
          .eq('element_type', exercise.type);
        
        if (fetchError) {
          console.error('Error checking existing events:', fetchError);
        }
        
        // Find event with matching exercise_index in payload
        const existingEvent = existingEvents?.find((e: any) => {
          const payload = e.event_payload as any;
          return payload?.exercise_index === exerciseIdx;
        });
        
        if (existingEvent) {
          // UPDATE existing record
          const { error: updateError } = await supabase
            .from('student_events')
            .update({
              event_payload: {
                exercise_index: exerciseIdx,
                exercise_title: exercise.title,
                nano_skill_ratings: ratingsWithValue
              },
              skill_ids: ratingsWithValue.map(r => r.name)
            })
            .eq('id', existingEvent.id);
          
          if (updateError) throw updateError;
          
          devLog('✅ Updated existing mastery evaluation:', existingEvent.id);
        } else {
          // INSERT new record - use direct RPC call with validated props to bypass hook issues
          devLog('📤 [Mastery] Calling add_student_event RPC with:', {
            p_student_id: studentIdProp,
            p_teacher_id: teacherIdProp,
            p_event_type: 'exercise_mastery_evaluation',
            p_source_id: worksheetIdForStorage
          });
          
          const { data: eventResult, error: rpcError } = await supabase.rpc('add_student_event', {
            p_student_id: studentIdProp,
            p_teacher_id: teacherIdProp,
            p_event_type: 'mark_done_evaluation',
            p_event_source: 'teacher',
            p_source_id: worksheetIdForStorage || null,
            p_event_payload: {
              exercise_index: exerciseIdx,
              exercise_title: exercise.title,
              nano_skill_ratings: ratingsWithValue
            } as unknown as Record<string, never>,
            p_skill_ids: ratingsWithValue.map(r => r.name),
            p_element_type: exercise.type,
            p_session_id: null
          });
          
          if (rpcError) {
            console.error('❌ [Mastery] RPC error:', rpcError);
            throw rpcError;
          }
          
          if (!eventResult) {
            console.error('❌ [Mastery] RPC returned null - event may not be saved');
            throw new Error('Event creation returned null');
          }
          
          devLog('✅ [Mastery] Created new mastery evaluation, event ID:', eventResult);
        }
        
        toast({
          title: "Mastery evaluation saved",
          description: `Recorded ${ratingsWithValue.length} skill evaluation(s) to student profile.`
        });
      } catch (error) {
        console.error('❌ Error saving mastery evaluation:', error);
        toast({
          title: "Error saving evaluation",
          description: "Failed to save mastery evaluation. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      devLog('No ratings with values set - skipping save to DB');
    }
    
    // Mark as done locally
    setLocalMarkedDone(true);
    if (storageKey) localStorage.setItem(storageKey, 'true');
    
    if (onMarkDoneProp) {
      onMarkDoneProp();
    }
  };
  
  // Handle Skip - mark as done without saving evaluation
  const handleSkip = () => {
    setLocalMarkedDone(true);
    if (storageKey) localStorage.setItem(storageKey, 'true');
    if (onMarkDoneProp) {
      onMarkDoneProp();
    }
  };
  
  // Handle Undo Mark Done - optionally delete events from database
  const handleUndoConfirm = async (deleteFromEvents: boolean) => {
    if (deleteFromEvents && studentIdProp && worksheetIdForStorage) {
      try {
        const { error } = await supabase
          .from('student_events')
          .delete()
          .eq('student_id', studentIdProp)
          .eq('source_id', worksheetIdForStorage)
          .eq('event_type', 'mark_done_evaluation')
          .contains('event_payload', { exercise_index: originalIndex !== undefined ? originalIndex : index - 1 });
        
        if (error) {
          console.error('Error deleting mastery events:', error);
          toast({
            title: "Warning",
            description: "Failed to delete evaluation from records, but exercise unmarked.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Evaluation deleted",
            description: "Mastery evaluation removed from student records."
          });
        }
      } catch (error) {
        console.error('Error deleting events:', error);
      }
    }
    
    // Unmark exercise
    setLocalMarkedDone(false);
    if (storageKey) localStorage.setItem(storageKey, 'false');
    setIsUndoModalOpen(false);
  };
  
  const handleMarkDone = onMarkDoneProp ?? (() => {
    // If in live-session mode
    if (viewMode === 'live-session') {
      if (isMarkedDone) {
        // Already marked done - open undo modal
        setIsUndoModalOpen(true);
      } else {
        // Not marked done yet - open mastery modal
        handleMarkDoneWithModal();
      }
    } else {
      // Teacher mode - simple toggle
      const newValue = !localMarkedDone;
      setLocalMarkedDone(newValue);
      if (storageKey) localStorage.setItem(storageKey, String(newValue));
    }
  });
  
  // Helper: update nano_skill at specific index in array, or replace entirely for single skills
  const updateNanoSkillValue = (currentItem: any, newSkill: any, skillIndex?: number) => {
    const currentNs = currentItem?.nano_skill;
    if (skillIndex !== undefined && Array.isArray(currentNs) && currentNs.length > 1) {
      return currentNs.map((s: any, i: number) => i === skillIndex ? newSkill : s);
    }
    return newSkill;
  };

  // Get nano skills for mastery modal
  const exerciseNanoSkills = extractNanoSkillsFromExercise(exercise);
  // Use originalIndex for array operations, index for display
  const arrayIndex = originalIndex !== undefined ? originalIndex : index - 1;
  
  // Convert viewMode to exercise-compatible mode (live-session behaves like teacher view)
  const exerciseViewMode: "student" | "teacher" = viewMode === 'live-session' ? 'teacher' : viewMode;
  
  const {
    isModalOpen,
    isLoading,
    loadingExerciseIndex,
    guidelines,
    openModal,
    closeModal,
    setGuidelines,
    regenerateExercise
  } = useExerciseRegeneration();

  // Normalize exercise type for conditional rendering (handle both standard and -picture types)
  const normalizedType = normalizeExerciseType(exercise.type);
  
  // Use canonical ai_evaluation first, fallback to item_evaluations conversion
  const liveAiEvaluations = resolveAiEvaluations(liveAiEvalProp, liveItemEvalsProp);
  
  // DEBUG: Log structure for answer-questions-picture to diagnose editing issues
  if (exercise.type === 'answer-questions-picture') {
    devLog('[DEBUG] Answer Questions Picture exercise structure:', {
      type: exercise.type,
      hasQuestions: !!exercise.questions,
      questionsType: Array.isArray(exercise.questions) ? 'array' : typeof exercise.questions,
      questionsSample: Array.isArray(exercise.questions) ? exercise.questions[0] : exercise.questions,
      keys: Object.keys(exercise),
      fullExercise: exercise
    });
  }
  
  // ✅ Check BOTH sources for selected image (Unsplash OR AI-generated)
  const hasSelectedImage = originalFormData?.selectedImage || editableWorksheet?.selected_image;

  // Calculate showImage: hide if hideExerciseMedia=true OR hasSelectedImage
  const showImage = !hideExerciseMedia && !hasSelectedImage;

  const handleRegenerateClick = () => {
    devLog('🔄 [REGENERATE] Opening modal:', { 
      displayIndex: index, 
      arrayIndex, 
      exerciseType: exercise.type,
      worksheetId,
      hasOriginalFormData: !!originalFormData,
      hasUserId: !!userId
    });
    openModal(arrayIndex); // FIXED: Use arrayIndex instead of index
  };

  const handleRegenerateConfirm = async () => {
    if (!worksheetId || !originalFormData || !userId) {
      console.error('Missing required data for regeneration');
      return;
    }

    await regenerateExercise(
      worksheetId,
      arrayIndex,
      originalFormData,
      exercise,
      editableWorksheet,
      setEditableWorksheet,
      userId
    );
  };

  const isRegenerating = isLoading && loadingExerciseIndex === arrayIndex;
  // Exercise update handlers using the utility functions
  const handleExerciseChangeLocal = (field: string, value: string) => {
    handleExerciseChange(editableWorksheet, setEditableWorksheet, arrayIndex, field, value);
  };

  const handleQuestionChangeLocal = (questionIndex: number, field: string, value: string) => {
    handleQuestionChange(editableWorksheet, setEditableWorksheet, arrayIndex, questionIndex, field, value);
  };

  const handleItemChangeLocal = (itemIndex: number, field: string, value: string) => {
    handleItemChange(editableWorksheet, setEditableWorksheet, arrayIndex, itemIndex, field, value);
  };

  const handleSentenceChangeLocal = (sentenceIndex: number, field: string, value: string) => {
    handleSentenceChange(editableWorksheet, setEditableWorksheet, arrayIndex, sentenceIndex, field, value);
  };

  const handleExpressionChangeLocal = (expressionIndex: number, value: string) => {
    handleExpressionChange(editableWorksheet, setEditableWorksheet, arrayIndex, expressionIndex, value);
  };

  const handleTeacherTipChangeLocal = (value: string) => {
    handleTeacherTipChange(editableWorksheet, setEditableWorksheet, arrayIndex, value);
  };

  const handleDialogueChangeLocal = (dialogueIndex: number, field: string, value: string) => {
    handleDialogueChange(editableWorksheet, setEditableWorksheet, arrayIndex, dialogueIndex, field, value);
  };
  
  const handleStatementChangeLocal = (statementIndex: number, field: string, value: string | boolean) => {
    handleStatementChange(editableWorksheet, setEditableWorksheet, arrayIndex, statementIndex, field, value);
  };

  return (
    <>
      <div ref={ref} className="mb-4 bg-white border rounded-lg shadow-sm relative">
        <ExerciseHeader
          icon={exercise.icon}
          title={updateExerciseNumber(exercise.title, index)}
          isEditing={isEditing}
          time={exercise.time}
          onTitleChange={val => handleExerciseChangeLocal('title', val)}
          canRegenerate={!!(worksheetId && originalFormData && userId)}
          isRegenerating={isRegenerating}
          onRegenerateClick={handleRegenerateClick}
          canMoveUp={index > 0}
          canMoveDown={index < totalExercises - 1}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDeleteExercise}
          // PROBLEM 5: Live Session Done button props
          viewMode={viewMode}
          isMarkedDone={isMarkedDone}
          onMarkDone={handleMarkDone}
          // [V]/[G] focus tag from form data
          exerciseFocus={originalFormData?.exerciseFocusMap?.[exercise.type]}
        />

        <Collapsible open={!isCollapsed} onOpenChange={() => onToggleCollapse?.()}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-5 pb-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={cn("h-4 w-4 mr-2 transition-transform", isCollapsed && "rotate-180")} />
              {isCollapsed ? 'Expand exercise content' : 'Collapse exercise content'}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="p-5 pt-0">
        
        {/* PROBLEM 1 FIXED: Live Session answers are now passed inline to each exercise component */}

        <ExerciseContent
          instructions={exercise.instructions}
          isEditing={isEditing}
          onInstructionsChange={val => handleExerciseChangeLocal('instructions', val)}
          content={exercise.content}
          onContentChange={val => handleExerciseChangeLocal('content', val)}
        />

        {/* Teacher's Tip - directly after instructions, before exercise items */}
        {exercise.teacher_tip && (exerciseViewMode === 'teacher' || viewMode === 'live-session') && (
          <TeacherTipSection
            tip={exercise.teacher_tip}
            isEditing={isEditing}
            onChange={handleTeacherTipChangeLocal}
            viewMode={exerciseViewMode}
          />
        )}

        {normalizedType === 'reading' && exercise.questions && (
          <ExerciseReading
            questions={exercise.questions}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionChange={handleQuestionChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            liveAudioAnswers={liveAudioAnswers}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'matching' && exercise.items && (
          <ExerciseMatching
            items={exercise.items}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            getMatchedItems={() => getMatchedItems(exercise.items, exerciseViewMode)}
            onItemChange={handleItemChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(iIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newItems = [...exercise.items];
              newItems[iIndex] = { ...newItems[iIndex], nano_skill: updateNanoSkillValue(newItems[iIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], items: newItems };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'fill-in-blanks' && exercise.sentences && (
          <ExerciseFillInBlanks
            word_bank={exercise.word_bank}
            sentences={exercise.sentences}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onWordBankChange={(wIndex, value) => {
              const newWordBank = [...exercise.word_bank!];
              newWordBank[wIndex] = value;
              const updatedExercises = [...editableWorksheet.exercises];
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                word_bank: newWordBank
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            onSentenceChange={handleSentenceChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...exercise.sentences];
              const item = newSentences[sIndex];
              newSentences[sIndex] = typeof item === 'object' 
                ? { ...item, nano_skill: updateNanoSkillValue(item, newSkill, skillIndex) }
                : { text: item, nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentences: newSentences };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'multiple-choice' && exercise.questions && (
          <ExerciseMultipleChoice
            questions={exercise.questions}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionTextChange={(qIndex, value) => handleQuestionChangeLocal(qIndex, 'text', value)}
            onOptionTextChange={(qIndex, oIndex, value) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const question = updatedExercises[arrayIndex].questions[qIndex];
              const newOptions = [...question.options];
              newOptions[oIndex] = {
                ...newOptions[oIndex],
                text: value
              };
              updatedExercises[arrayIndex].questions[qIndex] = {
                ...question,
                options: newOptions
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            worksheetId={worksheetId}
            exerciseVariant={exercise.type.includes('-picture') ? 'picture' : exercise.type.includes('-audio') ? 'audio' : 'plain'}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'dialogue' && exercise.dialogue && (
          <ExerciseDialogue
            dialogue={exercise.dialogue}
            expressions={exercise.expressions}
            expression_instruction={exercise.expression_instruction}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onDialogueChange={handleDialogueChangeLocal}
            onExpressionChange={handleExpressionChangeLocal}
            onExpressionInstructionChange={val => handleExerciseChangeLocal('expression_instruction', val)}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            onNanoSkillChange={(eIndex, newSkill, skillIndex) => {
              // Update nano_skill on expressions, not dialogue lines
              const updatedExercises = [...editableWorksheet.exercises];
              const newExpressions = [...(exercise.expressions || [])];
              const item = newExpressions[eIndex];
              newExpressions[eIndex] = typeof item === 'object'
                ? { ...item, nano_skill: updateNanoSkillValue(item, newSkill, skillIndex) }
                : { text: item, nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], expressions: newExpressions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'discussion' && exercise.questions && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-700 mb-2">Discussion Questions:</h3>
            {exercise.questions.map((question: any, qIndex: number) => {
              // CRITICAL FIX: Safely extract text from question (may be string or {text, nano_skill})
              const questionText = typeof question === 'string' ? question : (question?.text || '');
              const studentAnswer = studentAnswers[qIndex] || '';
              const isEmpty = showCorrectAnswers && !studentAnswer;
              const liveAnswer = liveSessionAnswer?.[qIndex];
              // Extract nano skill for badge display
              const nanoSkill = typeof question === 'object' ? safeGetNanoSkill(question) : null;
              // PROBLEM 1 FIX: Show NanoSkill in both teacher AND live-session modes
              const showNanoSkill = (viewMode === 'teacher' || viewMode === 'live-session') && nanoSkill;
              
              return (
                <div key={qIndex} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-start gap-2 flex-wrap mb-2">
                    <p className="leading-snug flex-grow">
                      {isEditing ? (
                        <input
                          type="text"
                          value={questionText}
                          onChange={e => {
                            const updatedExercises = [...editableWorksheet.exercises];
                            const newQuestions = [...exercise.questions!];
                            // Preserve nano_skill if present, update only text
                            if (typeof question === 'object' && question?.nano_skill) {
                              newQuestions[qIndex] = { ...question, text: e.target.value };
                            } else {
                              newQuestions[qIndex] = e.target.value;
                            }
                            updatedExercises[arrayIndex] = {
                              ...updatedExercises[arrayIndex],
                              questions: newQuestions
                            };
                            setEditableWorksheet({
                              ...editableWorksheet,
                              exercises: updatedExercises
                            });
                          }}
                          className="w-full border p-1 editable-content"
                        />
                      ) : (
                        <>{qIndex + 1}. {questionText}</>
                      )}
                    </p>
                    {showNanoSkill && (
                      <NanoSkillBadge
                        nanoSkill={nanoSkill}
                        allNanoSkills={typeof question === 'object' ? safeGetAllNanoSkills(question) : []}
                        onEdit={(newSkill, skillIndex) => {
                          const updatedExercises = [...editableWorksheet.exercises];
                          const newQuestions = [...exercise.questions!];
                          if (typeof question === 'object') {
                            newQuestions[qIndex] = { ...question, nano_skill: updateNanoSkillValue(question, newSkill, skillIndex) };
                          } else {
                            newQuestions[qIndex] = { text: question, nano_skill: newSkill };
                          }
                          updatedExercises[arrayIndex] = {
                            ...updatedExercises[arrayIndex],
                            questions: newQuestions
                          };
                          setEditableWorksheet({
                            ...editableWorksheet,
                            exercises: updatedExercises
                          });
                        }}
                      />
                    )}
                    {/* PROBLEM 7 FIX: Live Session answer display for Discussion Questions */}
                    {viewMode === 'live-session' && liveAnswer !== undefined && liveAnswer !== '' && (
                      <span className="text-blue-600 font-medium text-sm bg-blue-50 px-2 py-1 rounded">
                        [Student: {liveAnswer}]
                      </span>
                    )}
                    {viewMode === 'live-session' && <LiveAudioPlayer audioUrl={liveAudioAnswers?.[qIndex]} />}
                  </div>
                  {isInteractive && (
                    <input
                      type="text"
                      value={studentAnswer}
                      onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                      placeholder="Type your answer..."
                      disabled={disabled}
                      className={`w-full border p-2 rounded h-10 
                        ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                        ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                      `}
                    />
                  )}
                  {/* AI Evaluation Badge for discussion questions in Live Session */}
                  {liveAiEvaluations?.[qIndex] && (
                    <AiEvaluationBadge evaluation={liveAiEvaluations[qIndex]}
                      isLiveSession={viewMode === 'live-session' && !!worksheetIdForStorage && !!validTeacherId}
                      worksheetId={worksheetIdForStorage} exerciseIndex={exerciseIdx}
                      exerciseType={exercise.type} teacherId={validTeacherId} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(normalizedType === 'error-correction' || normalizedType === 'word-formation') && 
          exercise.sentences && renderOtherExerciseTypes(
            exercise, 
            isEditing, 
            exerciseViewMode, 
            handleSentenceChangeLocal,
            isInteractive,
            studentAnswers,
            onAnswerChange,
            showCorrectAnswers,
            liveSessionAnswer,
            // Pass nano skill change handler for error-correction
            (sentenceIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...exercise.sentences];
              const sentence = newSentences[sentenceIndex];
              if (typeof sentence === 'object') {
                newSentences[sentenceIndex] = { ...sentence, nano_skill: updateNanoSkillValue(sentence, newSkill, skillIndex) };
              } else {
                newSentences[sentenceIndex] = { text: sentence, nano_skill: newSkill };
              }
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                sentences: newSentences
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }
          )}
        
        {normalizedType === 'true-false' && exercise.statements && (
          <ExerciseTrueFalseAudio
            statements={exercise.statements}
            audio_url={undefined}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onStatementChange={handleStatementChangeLocal}
            exerciseVariant={exercise.type.includes('-picture') ? 'picture' : exercise.type.includes('-audio') ? 'audio' : 'plain'}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newStatements = [...exercise.statements];
              newStatements[sIndex] = { ...newStatements[sIndex], nano_skill: updateNanoSkillValue(newStatements[sIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                statements: newStatements
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
          />
        )}

        {/* New Phase 1 exercises */}
        {normalizedType === 'odd-one-out' && exercise.questions && (
          <ExerciseOddOneOut
            questions={exercise.questions}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionChange={handleQuestionChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            worksheetId={worksheetId}
            disabled={disabled}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

      {(normalizedType === 'synonyms-antonyms' || normalizedType === 'synonyms' || normalizedType === 'antonyms') && exercise.items && (
          <ExerciseSynonymsAntonyms
            items={exercise.items}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onItemChange={handleItemChangeLocal}
            exerciseType={normalizedType}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(iIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newItems = [...exercise.items];
              newItems[iIndex] = { ...newItems[iIndex], nano_skill: updateNanoSkillValue(newItems[iIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], items: newItems };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'sentence-transformation' && exercise.sentences && (
          <ExerciseSentenceTransformation
            sentences={exercise.sentences}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onSentenceChange={handleSentenceChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
          />
        )}

        {normalizedType === 'word-order' && exercise.sentences && (
          <ExerciseWordOrder
            sentences={exercise.sentences}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onSentenceChange={handleSentenceChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...exercise.sentences];
              newSentences[sIndex] = typeof newSentences[sIndex] === 'object'
                ? { ...newSentences[sIndex], nano_skill: updateNanoSkillValue(newSentences[sIndex], newSkill, skillIndex) }
                : { text: newSentences[sIndex], nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentences: newSentences };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'gap-text' && exercise.sentences && (
          <ExerciseGapText
            sentences={exercise.sentences}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onSentenceChange={handleSentenceChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...exercise.sentences];
              newSentences[sIndex] = typeof newSentences[sIndex] === 'object'
                ? { ...newSentences[sIndex], nano_skill: updateNanoSkillValue(newSentences[sIndex], newSkill, skillIndex) }
                : { text: newSentences[sIndex], nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentences: newSentences };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'negative-prefixes' && exercise.words && (
          <ExerciseNegativePrefixes
            words={exercise.words}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onWordChange={(wIndex, field, value) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newWords = [...exercise.words];
              newWords[wIndex] = {
                ...newWords[wIndex],
                [field]: value
              };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                words: newWords
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(wIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newWords = [...exercise.words];
              newWords[wIndex] = { ...newWords[wIndex], nano_skill: updateNanoSkillValue(newWords[wIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], words: newWords };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {/* New Phase 2 exercises */}
        {normalizedType === 'categorize' && (
          <ExerciseCategorize
            items={exercise.items}
            words={exercise.words}
            categories={exercise.categories}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onWordsChange={(words) => {
              const updatedExercises = [...editableWorksheet.exercises];
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                words: words,
                items: words
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            onCategoryChange={(cIndex, field, value) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newCategories = [...exercise.categories];
              newCategories[cIndex] = {
                ...newCategories[cIndex],
                [field]: value
              };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                categories: newCategories
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(cIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newCategories = [...exercise.categories];
              newCategories[cIndex] = { ...newCategories[cIndex], nano_skill: updateNanoSkillValue(newCategories[cIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], categories: newCategories };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
            onItemNanoSkillChange={(wIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const actualItems = exercise.items?.length > 0 ? [...exercise.items] : [...(exercise.words || [])];
              actualItems[wIndex] = typeof actualItems[wIndex] === 'object'
                ? { ...actualItems[wIndex], nano_skill: updateNanoSkillValue(actualItems[wIndex], newSkill, skillIndex) }
                : { word: actualItems[wIndex], nano_skill: newSkill };
              updatedExercises[arrayIndex] = { 
                ...updatedExercises[arrayIndex], 
                items: actualItems,
                words: actualItems 
              };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'paraphrasing' && exercise.sentences && (
          <ExerciseParaphrasing
            sentences={exercise.sentences}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onSentenceChange={handleSentenceChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...exercise.sentences];
              newSentences[sIndex] = typeof newSentences[sIndex] === 'object'
                ? { ...newSentences[sIndex], nano_skill: updateNanoSkillValue(newSentences[sIndex], newSkill, skillIndex) }
                : { text: newSentences[sIndex], nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentences: newSentences };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'complete-word' && exercise.words && (
          <ExerciseCompleteWord
            words={exercise.words}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onWordChange={(wIndex, field, value) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newWords = [...exercise.words];
              newWords[wIndex] = {
                ...newWords[wIndex],
                [field]: value
              };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                words: newWords
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(wIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newWords = [...exercise.words];
              newWords[wIndex] = { ...newWords[wIndex], nano_skill: updateNanoSkillValue(newWords[wIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], words: newWords };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'matching-halves' && exercise.sentence_halves && (
          <ExerciseMatchingHalves
            sentence_halves={exercise.sentence_halves}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onHalvesChange={(hIndex, field, value) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newHalves = [...exercise.sentence_halves];
              newHalves[hIndex] = {
                ...newHalves[hIndex],
                [field]: value
              };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                sentence_halves: newHalves
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(hIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newHalves = [...exercise.sentence_halves];
              newHalves[hIndex] = { ...newHalves[hIndex], nano_skill: updateNanoSkillValue(newHalves[hIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentence_halves: newHalves };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}
        {/* New additional exercise types */}
        {/* Detect scenario_prompt + tasks format for describe exercises */}
        {normalizedType === 'describe' && (() => {
          // Parse content if it's a JSON string
          let parsedContent = exercise.content;
          if (typeof exercise.content === 'string') {
            try {
              parsedContent = JSON.parse(exercise.content);
            } catch (e) {
              parsedContent = null;
            }
          }
          
          // Check if this is the scenario_prompt + tasks format
          const hasScenarioPromptFormat = 
            parsedContent &&
            typeof parsedContent === 'object' &&
            parsedContent.scenario_prompt && 
            Array.isArray(parsedContent.tasks);
          
          if (hasScenarioPromptFormat) {
            // Render the ExerciseWritingTask component for this format
            return (
              <ExerciseWritingTask
                content={parsedContent}
                isEditing={isEditing}
                viewMode={exerciseViewMode}
                isInteractive={isInteractive}
                studentAnswers={studentAnswers}
                onAnswerChange={onAnswerChange}
                showCorrectAnswers={showCorrectAnswers}
                liveSessionAnswer={liveSessionAnswer}
                disabled={disabled}
                onNanoSkillChange={(taskIdx, qIdx, newSkill, skillIndex) => {
                  // Update nano_skill in the tasks structure
                  const updatedExercises = [...editableWorksheet.exercises];
                  const updatedContent = JSON.parse(JSON.stringify(parsedContent));
                  if (updatedContent.tasks[taskIdx]?.questions?.[qIdx]) {
                    updatedContent.tasks[taskIdx].questions[qIdx].nano_skill = updateNanoSkillValue(updatedContent.tasks[taskIdx].questions[qIdx], newSkill, skillIndex);
                  }
                  updatedExercises[arrayIndex] = {
                    ...updatedExercises[arrayIndex],
                    content: updatedContent
                  };
                  setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
                }}
              />
            );
          }
          
          // Standard describe format - render ExerciseDescribe
          return (
            <ExerciseDescribe
              image_url={exercise.image_url || hasSelectedImage?.unsplash_url || hasSelectedImage?.ai_generated_url}
              questions={exercise.prompts || exercise.questions || []}
              isEditing={isEditing}
              viewMode={exerciseViewMode}
              showImage={true}
              onQuestionChange={(qIndex, field, value) => {
                const updatedExercises = [...editableWorksheet.exercises];
                const newPrompts = [...(exercise.prompts || exercise.questions || [])];
                
                if (field === 'text' || field === 'question') {
                  newPrompts[qIndex] = value;
                }
                
                updatedExercises[arrayIndex] = {
                  ...updatedExercises[arrayIndex],
                  prompts: newPrompts
                };
                
                setEditableWorksheet({
                  ...editableWorksheet,
                  exercises: updatedExercises
                });
              }}
              onImageUrlChange={(url) => handleExerciseChangeLocal('image_url', url)}
              isInteractive={isInteractive}
              studentAnswers={studentAnswers}
              onAnswerChange={onAnswerChange}
              showCorrectAnswers={showCorrectAnswers}
              liveSessionAnswer={liveSessionAnswer}
              liveAudioAnswers={liveAudioAnswers}
              disabled={disabled}
              aiEvaluations={liveAiEvaluations}
              isSharedWorksheet={viewMode === 'live-session'}
              liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
              exerciseVariant={exercise.type.includes('-picture') ? 'picture' : 'plain'}
              onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
                const updatedExercises = [...editableWorksheet.exercises];
                const newPrompts = [...(exercise.prompts || exercise.questions || [])];
                const item = newPrompts[qIndex];
                newPrompts[qIndex] = typeof item === 'object' 
                  ? { ...item, nano_skill: updateNanoSkillValue(item, newSkill, skillIndex) }
                  : { text: item, nano_skill: newSkill };
                updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], prompts: newPrompts };
                setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
              }}
            />
          );
        })()}

        {normalizedType === 'answer-questions' && exercise.questions && (
          <ExerciseAnswerQuestions
            media_url={hasSelectedImage ? undefined : exercise.media_url}
            media_type={exercise.media_type}
            questions={exercise.questions}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            showImage={showImage}
            hideExerciseMedia={hideExerciseMedia}
            onQuestionChange={handleQuestionChangeLocal}
            onMediaUrlChange={(url) => handleExerciseChangeLocal('media_url', url)}
            onMediaTypeChange={(type) => handleExerciseChangeLocal('media_type', type)}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            liveAudioAnswers={liveAudioAnswers}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            exerciseVariant={exercise.type.includes('-picture') ? 'picture' : exercise.type.includes('-audio') ? 'audio' : 'plain'}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              const item = newQuestions[qIndex];
              newQuestions[qIndex] = typeof item === 'object'
                ? { ...item, nano_skill: updateNanoSkillValue(item, newSkill, skillIndex) }
                : { text: item, nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {/* Audio exercises */}
        {normalizedType === 'listening-comprehension' && exercise.questions && (
          <ExerciseListeningComprehension
            questions={exercise.questions}
            audio_url={exercise.audio_url}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionChange={handleQuestionChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            liveAudioAnswers={liveAudioAnswers}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'multiple-choice-audio' && exercise.questions && (
          <ExerciseMultipleChoiceAudio
            questions={exercise.questions}
            audio_url={exercise.audio_url}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionChange={handleQuestionChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            worksheetId={worksheetId}
            disabled={disabled}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {normalizedType === 'true-false-audio' && exercise.statements && (
          <ExerciseTrueFalseAudio
            statements={exercise.statements}
            audio_url={exercise.audio_url}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onStatementChange={handleStatementChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newStatements = [...exercise.statements];
              newStatements[sIndex] = { ...newStatements[sIndex], nano_skill: updateNanoSkillValue(newStatements[sIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                statements: newStatements
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
          />
        )}

        {normalizedType === 'fill-in-blanks-audio' && (
          <ExerciseFillInBlanksAudio
            word_bank={exercise.word_bank}
            sentences={exercise.sentences}
            transcript_with_blanks={exercise.transcript_with_blanks}
            answers={exercise.answers}
            audio_url={exercise.audio_url}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onWordBankChange={(wIndex, value) => {
              const newWordBank = [...(exercise.word_bank || [])];
              newWordBank[wIndex] = value;
              const updatedExercises = [...editableWorksheet.exercises];
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                word_bank: newWordBank
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            onSentenceChange={handleSentenceChangeLocal}
            onTranscriptChange={(value) => handleExerciseChangeLocal('transcript_with_blanks', value)}
            onAnswersChange={(value) => {
              const answersArray = typeof value === 'string' ? value.split(',').map(a => a.trim()) : value;
              const updatedExercises = [...editableWorksheet.exercises];
              updatedExercises[arrayIndex] = {
                ...updatedExercises[arrayIndex],
                answers: answersArray
              };
              setEditableWorksheet({
                ...editableWorksheet,
                exercises: updatedExercises
              });
            }}
            onNanoSkillChange={(sIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newSentences = [...(exercise.sentences || [])];
              newSentences[sIndex] = { ...newSentences[sIndex], nano_skill: updateNanoSkillValue(newSentences[sIndex], newSkill, skillIndex) };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], sentences: newSentences };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            disabled={disabled}
          />
        )}

        {normalizedType === 'answer-questions-audio' && exercise.questions && (
          <ExerciseAnswerQuestionsAudio
            questions={exercise.questions}
            audio_url={exercise.audio_url}
            isEditing={isEditing}
            viewMode={exerciseViewMode}
            onQuestionChange={handleQuestionChangeLocal}
            isInteractive={isInteractive}
            studentAnswers={studentAnswers}
            onAnswerChange={onAnswerChange}
            showCorrectAnswers={showCorrectAnswers}
            liveSessionAnswer={liveSessionAnswer}
            liveAudioAnswers={liveAudioAnswers}
            disabled={disabled}
            aiEvaluations={liveAiEvaluations}
            isSharedWorksheet={viewMode === 'live-session'}
            liveSessionContext={viewMode === 'live-session' && worksheetIdForStorage && validTeacherId ? { worksheetId: worksheetIdForStorage, exerciseIndex: exerciseIdx, exerciseType: exercise.type, teacherId: validTeacherId } : undefined}
            onNanoSkillChange={(qIndex, newSkill, skillIndex) => {
              const updatedExercises = [...editableWorksheet.exercises];
              const newQuestions = [...exercise.questions];
              newQuestions[qIndex] = typeof newQuestions[qIndex] === 'object'
                ? { ...newQuestions[qIndex], nano_skill: updateNanoSkillValue(newQuestions[qIndex], newSkill, skillIndex) }
                : { text: newQuestions[qIndex], nano_skill: newSkill };
              updatedExercises[arrayIndex] = { ...updatedExercises[arrayIndex], questions: newQuestions };
              setEditableWorksheet({ ...editableWorksheet, exercises: updatedExercises });
            }}
          />
        )}

        {/* TeacherTipSection moved to after ExerciseContent (line ~797) */}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Regeneration Modal */}
      <ExerciseRegenerateModal
        isOpen={isModalOpen && loadingExerciseIndex === arrayIndex}
        onClose={closeModal}
        onConfirm={handleRegenerateConfirm}
        guidelines={guidelines}
        onGuidelinesChange={setGuidelines}
        exerciseType={exercise.type}
        exerciseTitle={exercise.title}
      />
      
      {/* NanoSkill Mastery Evaluation Modal */}
      <NanoSkillMasteryModal
        isOpen={isMasteryModalOpen}
        onClose={() => setIsMasteryModalOpen(false)}
        onSubmit={handleMasterySubmit}
        onSkip={handleSkip}
        nanoSkills={exerciseNanoSkills}
        exerciseTitle={exercise.title}
        studentAnswers={liveSessionAnswer}
        exerciseData={exercise}
        aiEvaluations={aiEvaluations}
        isLoadingAiEvaluation={isLoadingAiEvaluation}
      />
      
      {/* Undo Mark Done Modal */}
      <UndoMarkDoneModal
        isOpen={isUndoModalOpen}
        onClose={() => setIsUndoModalOpen(false)}
        onConfirm={handleUndoConfirm}
        exerciseTitle={exercise.title}
      />
    </>
  );
});

ExerciseSection.displayName = "ExerciseSection";

export default ExerciseSection;
