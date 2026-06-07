import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LessonTime, EnglishLevel, FormData, WorksheetFormProps, ExerciseSelectionMode } from './types';
import { getRandomPlaceholderSet, PlaceholderSet } from './placeholderSets';
import { getRandomSuggestionSets, getSuggestionSetMatchingPlaceholder, SuggestionSet } from './suggestionSets';
import FormField from './FormField';
import AdvancedOptions from './AdvancedOptions';
import ExerciseSelector from './ExerciseSelector';
import TypewriterHint from './TypewriterHint';
import { useIsMobile } from "@/hooks/use-mobile";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useStudents } from "@/hooks/useStudents";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useWorksheetFormPersistence, type WorksheetDraft } from "@/hooks/useWorksheetFormPersistence";
import { normalizeSuggestionPrefill } from "@/lib/dslm/normalizeSuggestionPrefill";
import { NextStepsPresetBanner, type PresetPayload } from "./NextStepsPresetBanner";
import { StudentContextHint } from "./StudentContextHint";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shuffle, Brain, MousePointer, ChevronDown, Image, Headphones, Lock, Eraser, Plus } from "lucide-react";
import { devLog, devWarn } from '@/utils/logger';

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { AddStudentDialog } from "@/components/dashboard/AddStudentDialog";
import type { MediaType } from './types';
export type { FormData };
interface ImageSuggestion {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  photographer: string;
  photographerUrl: string;
}
interface ExtendedWorksheetFormProps extends WorksheetFormProps {
  onStudentChange?: (studentId: string | null) => void;
  preSelectedStudent?: {
    id: string;
    name: string;
  } | null;
  /** Stable userId (resolved by parent FormView). Used as persistence key. */
  userId?: string | null;
}
export default function WorksheetForm({
  onSubmit,
  onStudentChange,
  preSelectedStudent,
  userId: userIdProp,
}: ExtendedWorksheetFormProps) {
  const [lessonTime, setLessonTime] = useState<LessonTime>("60min");
  // v6.9.38 — read autoGenerate intent + prefill topic synchronously so the
  // readiness gate has a deterministic snapshot on the very first render.
  const readAutoGenerateIntent = () => {
    if (typeof window === 'undefined') return null;
    try {
      if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return null;
      const raw = sessionStorage.getItem('autoGenerateWorksheetRequest');
      return raw ? (JSON.parse(raw) as { studentId?: string; suggestionId?: string | null }) : {};
    } catch { return null; }
  };
  const readPrefillTopic = () => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = sessionStorage.getItem('prefillWorksheet');
      if (!raw) return '';
      const p = JSON.parse(raw);
      return typeof p?.topic === 'string' ? p.topic : '';
    } catch { return ''; }
  };
  // v6.9.41 — synchronous reads of DSLM prefill so initial state already contains
  // exercises/focus/media. Eliminates the race where the readiness gate fires
  // before the prefill effect re-runs.
  const readPrefillField = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return (parsed ?? fallback) as T;
    } catch { return fallback; }
  };
  const initialAutoIntentRef = useRef<{ studentId?: string; suggestionId?: string | null } | null>(readAutoGenerateIntent());
  const [lessonTopic, setLessonTopic] = useState<string>(() => readPrefillTopic());
  const [lessonGoal, setLessonGoal] = useState("");
  const [grammarFocus, setGrammarFocus] = useState("");
  const [additionalInformation, setAdditionalInformation] = useState("");
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>("B1/B2");
  const [languageStyle, setLanguageStyle] = useState<number>(3); // Default neutral style
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    () => (initialAutoIntentRef.current?.studentId as string) || preSelectedStudent?.id || "no-student"
  );

  // Initialize selectedExercises based on lessonTime and selectionMode
  const getInitialExercises = (): string[] => {
    const MANUAL_EXERCISES_60MIN = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
    const MANUAL_EXERCISES_45MIN = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out'];
    return lessonTime === '45min' ? MANUAL_EXERCISES_45MIN : MANUAL_EXERCISES_60MIN;
  };
  const [selectedExercises, setSelectedExercises] = useState<string[]>(() => {
    // v6.9.41 — when an auto-generate intent exists, prefer the DSLM exercises
    // saved in sessionStorage so the readiness gate sees them on first render.
    if (initialAutoIntentRef.current) {
      const exFromStorage = readPrefillField<string[]>('prefillExercises', []);
      if (Array.isArray(exFromStorage) && exFromStorage.length > 0) return exFromStorage;
    }
    return getInitialExercises();
  });
  const [selectionMode, setSelectionMode] = useState<ExerciseSelectionMode>('manual');
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<MediaType[]>(() => {
    if (initialAutoIntentRef.current) {
      const media = readPrefillField<MediaType[]>('prefillMediaTypes', []);
      if (Array.isArray(media)) return media as MediaType[];
    }
    return [];
  });
  const [exerciseFocusMap, setExerciseFocusMap] = useState<Record<string, 'vocabulary' | 'grammar'>>(() => {
    if (initialAutoIntentRef.current) {
      const focus = readPrefillField<Record<string, 'vocabulary' | 'grammar'>>('prefillExerciseFocusMap', {});
      if (focus && typeof focus === 'object') return focus;
    }
    return {};
  });
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [currentPlaceholders, setCurrentPlaceholders] = useState<PlaceholderSet>(getRandomPlaceholderSet());
  const [currentSuggestions, setCurrentSuggestions] = useState<SuggestionSet[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activeTab, setActiveTab] = useState<'exercises' | 'advanced' | null>(null);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // v6.9.36 — auto-submit readiness refs (deterministic gate, not timeout).
  const autoSubmitFiredRef = useRef(false);
  const {
    toast
  } = useToast();
  const isMobile = useIsMobile();
  const {
    trackEvent
  } = useEventTracking();
  // v4.6: persistence key derived from a STABLE prop passed by parent (FormView/Index),
  // not from an async hook inside the form. This eliminates the bug where the draft
  // would be saved under the user's id but read back under 'anon' after refresh.
  const userId = userIdProp ?? null;
  const {
    students,
    refetch: refetchStudents
  } = useStudents();
  const {
    refreshProgress
  } = useOnboardingProgress();

  // v6.9.33 — inline "+ Add Student" SelectItem opens this dialog.
  const [inlineAddStudentOpen, setInlineAddStudentOpen] = useState(false);

  // v6.9.15b — `no-next-steps` hint removed from this form because
  // NextStepsPresetBanner already shows the canonical "No learning plan" CTA
  // for the same condition. Keeping both was redundant.

  // Build current draft snapshot for persistence (24h localStorage TTL).
  const draftSnapshot: WorksheetDraft = {
    lessonTime, lessonTopic, lessonGoal, grammarFocus, additionalInformation,
    englishLevel, languageStyle, selectedExercises, selectedMediaTypes,
    exerciseFocusMap, selectionMode,
  };
  const persistenceKey = userId || 'anon';
  const { clear: clearPersistedDraft } = useWorksheetFormPersistence(
    persistenceKey,
    draftSnapshot,
    (draft) => {
      try {
        if (draft.lessonTime === '45min' || draft.lessonTime === '60min') setLessonTime(draft.lessonTime as LessonTime);
        if (typeof draft.lessonTopic === 'string') setLessonTopic(draft.lessonTopic);
        if (typeof draft.lessonGoal === 'string') setLessonGoal(draft.lessonGoal);
        if (typeof draft.grammarFocus === 'string') setGrammarFocus(draft.grammarFocus);
        if (typeof draft.additionalInformation === 'string') setAdditionalInformation(draft.additionalInformation);
        if (draft.englishLevel === 'A1/A2' || draft.englishLevel === 'B1/B2' || draft.englishLevel === 'C1/C2') {
          setEnglishLevel(draft.englishLevel as EnglishLevel);
        }
        if (typeof draft.languageStyle === 'number') setLanguageStyle(draft.languageStyle);
        // v4.6: normalize restored draft via the same helper as DSLM prefill so
        // selectedExercises / selectedMediaTypes / exerciseFocusMap are always coherent.
        if (Array.isArray(draft.selectedExercises) && draft.selectedExercises.length > 0) {
          const norm = normalizeSuggestionPrefill({
            exercises: draft.selectedExercises,
            focusMap: draft.exerciseFocusMap || {},
            mediaTypes: draft.selectedMediaTypes || null,
            lessonTime: (draft.lessonTime as '45min' | '60min') || (lessonTime as '45min' | '60min'),
          });
          setSelectedMediaTypes(norm.selectedMediaTypes as MediaType[]);
          setSelectedExercises(norm.selectedExercises);
          setExerciseFocusMap(norm.exerciseFocusMap);
        }
        if (draft.selectionMode === 'manual' || draft.selectionMode === 'random' || draft.selectionMode === 'smart') {
          setSelectionMode(draft.selectionMode as ExerciseSelectionMode);
        }
        if ((draft.lessonGoal?.length ?? 0) > 0 || (draft.grammarFocus?.length ?? 0) > 0 || (draft.additionalInformation?.length ?? 0) > 0) {
          setShowMoreFields(true);
        }
      } catch (e) {
        devWarn('[WorksheetForm] draft hydration failed', e);
      }
    },
  );

  const clearForm = () => {
    setLessonTopic('');
    setLessonGoal('');
    setGrammarFocus('');
    setAdditionalInformation('');
    setLanguageStyle(3);
    setExerciseFocusMap({});
    setSelectedMediaTypes([]);
    setSelectionMode('manual');
    setSelectedExercises(getInitialExercises());
    clearPersistedDraft();
    toast({ title: 'Form cleared', description: 'All fields reset to defaults.' });
  };

  // REMOVED: Backup initialization to avoid race condition with ExerciseSelector
  // ExerciseSelector is now solely responsible for initialization

  useEffect(() => {
    if (preSelectedStudent) {
      setSelectedStudentId(preSelectedStudent.id);
    }
  }, [preSelectedStudent]);

  // v4.7: clear persisted draft only after a successful worksheet generation.
  // useWorksheetGeneration dispatches `worksheetGenerationSuccess` once the
  // worksheet is saved + token consumed. Failures (network, paywall, AI error)
  // intentionally preserve the draft so the user can retry.
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        clearPersistedDraft();
        devLog('[WorksheetForm] Draft cleared after successful generation');
      } catch (e) {
        devWarn('[WorksheetForm] Failed to clear draft', e);
      }
      // v6.9.10 — if this generation originated from a Next-Step preset chip,
      // propagate to NextStepsPresetBanner so it can mark the suggestion as used.
      try {
        const sid = sessionStorage.getItem('appliedPresetSuggestionId');
        if (sid) {
          const wsId = ((e as CustomEvent)?.detail?.worksheetId as string | undefined) || null;
          window.dispatchEvent(new CustomEvent('markPresetUsed', { detail: { suggestionId: sid, worksheetId: wsId } }));
          sessionStorage.removeItem('appliedPresetSuggestionId');
        }
      } catch (e) {
        devWarn('[WorksheetForm] markPresetUsed dispatch failed', e);
      }
    };
    window.addEventListener('worksheetGenerationSuccess', handler);
    return () => window.removeEventListener('worksheetGenerationSuccess', handler);
  }, [clearPersistedDraft]);

  // Handle prefill from Progress Tab "Use This" button
  useEffect(() => {
    const prefillData = sessionStorage.getItem('prefillWorksheet');
    if (prefillData) {
      try {
        const parsed = JSON.parse(prefillData);
        if (parsed.topic) {
          setLessonTopic(parsed.topic);
        }
        if (parsed.goal) {
          setLessonGoal(parsed.goal);
        }
        if (parsed.additionalInfo) {
          setAdditionalInformation(parsed.additionalInfo);
        }
        if (parsed.grammarFocus) {
          setGrammarFocus(parsed.grammarFocus);
        }
        sessionStorage.removeItem('prefillWorksheet');
        devLog('✅ [WorksheetForm] Pre-filled from Progress Tab:', parsed);
      } catch (error) {
        console.error('Error parsing prefillWorksheet:', error);
        sessionStorage.removeItem('prefillWorksheet');
      }
    }

    // Handle prefill exercises from Layer D suggestions
    // v4.2: filter against ALL_EXERCISE_IDS (drops sentence-transformation / future coming-soon ids).
    // v4.6: unified prefill — read exercises + focus map together, then normalize as
    // a single payload so selectedExercises / selectedMediaTypes / exerciseFocusMap
    // are always coherent (no more "8/8 counter, 6 visible checkboxes").
    const prefillExercisesRaw = sessionStorage.getItem('prefillExercises');
    const prefillFocusRaw = sessionStorage.getItem('prefillExerciseFocusMap');
    const prefillMediaRaw = sessionStorage.getItem('prefillMediaTypes');
    if (prefillExercisesRaw || prefillFocusRaw) {
      try {
        const exercises = prefillExercisesRaw ? JSON.parse(prefillExercisesRaw) : [];
        const focusMap = prefillFocusRaw ? JSON.parse(prefillFocusRaw) : {};
        const mediaTypes = prefillMediaRaw ? JSON.parse(prefillMediaRaw) : null;
        if (Array.isArray(exercises) && exercises.length > 0) {
          const norm = normalizeSuggestionPrefill({
            exercises,
            focusMap,
            mediaTypes,
            lessonTime: lessonTime as '45min' | '60min',
          });
          // ORDER MATTERS: media first, then exercises, then focus map — so the grid
          // re-renders with the correct visible exercise pool BEFORE the checkboxes
          // attempt to highlight them.
          setSelectedMediaTypes(norm.selectedMediaTypes as MediaType[]);
          setSelectedExercises(norm.selectedExercises);
          setExerciseFocusMap(norm.exerciseFocusMap);
          setSelectionMode('manual');
          setActiveTab('exercises');
          devLog('✅ [WorksheetForm] DSLM prefill normalized:', norm);
        }
        sessionStorage.removeItem('prefillExercises');
        sessionStorage.removeItem('prefillExerciseFocusMap');
        sessionStorage.removeItem('prefillMediaTypes');
      } catch (error) {
        console.error('Error parsing DSLM prefill:', error);
        sessionStorage.removeItem('prefillExercises');
        sessionStorage.removeItem('prefillExerciseFocusMap');
        sessionStorage.removeItem('prefillMediaTypes');
      }
    }

    // v6.9.36 — auto-submit if DSLM "Generate worksheet ↗" was clicked.
    // v6.9.38 — intent + studentId + lessonTopic are now read synchronously
    // via lazy useState/useRef initializers above, so the readiness gate
    // has a deterministic snapshot on the very first render. Nothing else
    // is needed here.
    if (initialAutoIntentRef.current) {
      devLog('🚀 [WorksheetForm v6.9.38] autoGenerate intent detected (lazy init)');
    }
  }, []);

  // v6.9.38 — simplified readiness gate. Lazy init guarantees topic +
  // studentId snapshot on first render, so the gate only waits for the
  // exercises array to be normalized and the form ref to mount.
  useEffect(() => {
    if (autoSubmitFiredRef.current) return;
    if (!initialAutoIntentRef.current) return;
    if (!lessonTopic || !lessonTopic.trim()) { devLog('[autoSubmit] waiting: lessonTopic empty'); return; }
    if (!formRef.current) { devLog('[autoSubmit] waiting: no formRef'); return; }
    // v6.9.44 — exercises no longer block: submitForm() auto-completes to 6/8.
    autoSubmitFiredRef.current = true;
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        try {
          devLog('🚀 [WorksheetForm v6.9.44] Auto-submit firing (gate, exercises optional)');
          // v6.9.42 — call submitForm() directly to bypass HTML5 form validation
          // that silently blocked requestSubmit() from 1-Minute Prep.
          submitForm(lessonTopic.trim());
        } catch (e) {
          devWarn('[WorksheetForm] requestSubmit threw', e);
        }
        // v6.9.38 — clear flags AFTER dispatching submit, not before.
        sessionStorage.removeItem('autoGenerateWorksheet');
        sessionStorage.removeItem('autoGenerateWorksheetRequest');
      });
    }, 0);
  }, [lessonTopic, selectedExercises]);

  // v6.9.38 — last-resort watchdog (1500 ms). If lazy init detected an
  // intent but the gate never fired, force submit if minimally ready,
  // otherwise drop the stale sessionStorage flags so manual edits work.
  useEffect(() => {
    const t = setTimeout(() => {
      if (autoSubmitFiredRef.current) return;
      if (!initialAutoIntentRef.current) return;
      // v6.9.41 — last-chance re-hydration from sessionStorage before giving up.
      let topicNow = lessonTopic;
      let exercisesNow = selectedExercises;
      if (!topicNow?.trim()) {
        const recoveredTopic = readPrefillTopic();
        if (recoveredTopic) { topicNow = recoveredTopic; setLessonTopic(recoveredTopic); }
      }
      if (!exercisesNow || exercisesNow.length === 0) {
        const recoveredEx = readPrefillField<string[]>('prefillExercises', []);
        if (Array.isArray(recoveredEx) && recoveredEx.length > 0) {
          exercisesNow = recoveredEx; setSelectedExercises(recoveredEx);
        }
      }
      // v6.9.44 — exercises optional in watchdog too; submitForm() auto-completes.
      const ok = !!topicNow?.trim() && !!formRef.current;
      if (ok) {
        autoSubmitFiredRef.current = true;
        devWarn('[WorksheetForm v6.9.44] watchdog force-submit (direct submitForm, exercises optional)');
        // v6.9.42 — direct submit, no native validation.
        submitForm(topicNow!.trim());
        sessionStorage.removeItem('autoGenerateWorksheet');
        sessionStorage.removeItem('autoGenerateWorksheetRequest');
      } else {
        devWarn('[WorksheetForm v6.9.38] watchdog dropping flag (form not ready)');
        sessionStorage.removeItem('autoGenerateWorksheet');
        sessionStorage.removeItem('autoGenerateWorksheetRequest');
      }
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (selectedStudentId && selectedStudentId !== "no-student") {
      const selectedStudent = students.find(s => s.id === selectedStudentId);
      if (selectedStudent) {
        const studentLevel = selectedStudent.english_level;
        if (studentLevel === 'A1' || studentLevel === 'A2') {
          setEnglishLevel('A1/A2');
        } else if (studentLevel === 'B1' || studentLevel === 'B2') {
          setEnglishLevel('B1/B2');
        } else if (studentLevel === 'C1' || studentLevel === 'C2') {
          setEnglishLevel('C1/C2');
        }
      }
    }
  }, [selectedStudentId, students]);
  useEffect(() => {
    if (onStudentChange) {
      const studentId = selectedStudentId === "no-student" ? null : selectedStudentId;
      onStudentChange(studentId);
    }
  }, [selectedStudentId, onStudentChange]);
  useEffect(() => {
    if (isInitialLoad) {
      const matchingSet = getSuggestionSetMatchingPlaceholder(currentPlaceholders);
      const randomSets = getRandomSuggestionSets(1);
      if (matchingSet) {
        setCurrentSuggestions([matchingSet, randomSets[0]]);
      } else {
        setCurrentSuggestions(getRandomSuggestionSets(2));
      }
      setIsInitialLoad(false);
    }
  }, [currentPlaceholders, isInitialLoad]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // v4.7: defensive read against stale closure during DSLM auto-submit.
    // If React batched setState hasn't flushed yet, lessonTopic may still be ''
    // even though the input element already shows the prefilled value.
    let effectiveTopic = lessonTopic;
    if (!effectiveTopic && formRef.current) {
      const inputEl = formRef.current.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="lessonTopic"]');
      const domValue = inputEl?.value?.trim();
      if (domValue) {
        effectiveTopic = domValue;
        setLessonTopic(domValue);
        devWarn('[WorksheetForm] Recovered lessonTopic from DOM (stale closure path):', domValue);
      }
    }
    if (!effectiveTopic) {
      toast({
        title: 'Lesson topic required',
        description: 'Please fill in the lesson topic before generating.',
        variant: 'destructive',
      });
      return;
    }
    submitForm(effectiveTopic);
  };
  const submitForm = (topicOverride?: string) => {
    const effectiveTopic = topicOverride || lessonTopic;
    // PROBLEM 2: Media-aware exercise auto-complete
    const PICTURE_COMPATIBLE_EXERCISES = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
    const AUDIO_COMPATIBLE_EXERCISES = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'multiple-choice-audio', 'fill-in-blanks-audio'];
    // sentence-transformation is currently disabled — never auto-pick it.
    const GENERAL_EXERCISES = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'discussion', 'error-correction', 'odd-one-out', 'synonyms', 'antonyms', 'word-order', 'gap-text', 'negative-prefixes', 'categorize', 'paraphrasing', 'complete-word', 'matching-halves'];
    
    const isPictureMode = selectedMediaTypes.includes('picture');
    const isAudioMode = selectedMediaTypes.includes('audio');
    
    // Auto-complete exercises if not enough are selected in manual mode
    const maxExercises = lessonTime === '45min' ? 6 : 8;
    let finalExercises = [...selectedExercises];
    if (!finalExercises || finalExercises.length < maxExercises) {
      devLog(`🔧 [WORKSHEET-FORM] Auto-completing exercises: ${finalExercises.length} < ${maxExercises}`);
      devLog(`🔧 [WORKSHEET-FORM] Media mode: picture=${isPictureMode}, audio=${isAudioMode}`);

      // PROBLEM 2.2/2.3: Filter available exercises by media type
      const unusedExercises = GENERAL_EXERCISES.filter(ex => {
        if (finalExercises.includes(ex)) return false;
        // Don't add picture exercises if not in picture mode
        if (!isPictureMode && PICTURE_COMPATIBLE_EXERCISES.includes(ex)) return false;
        // Don't add audio exercises if not in audio mode
        if (!isAudioMode && AUDIO_COMPATIBLE_EXERCISES.includes(ex)) return false;
        return true;
      });

      // Add random exercises to reach the target count
      const remainingSlots = maxExercises - finalExercises.length;
      const shuffledUnused = [...unusedExercises].sort(() => Math.random() - 0.5);
      const autoSelected = shuffledUnused.slice(0, remainingSlots);
      finalExercises = [...finalExercises, ...autoSelected];
      devLog(`🔧 [WORKSHEET-FORM] Auto-completed exercises (media-filtered):`, finalExercises);

      // Update the form state
      setSelectedExercises(finalExercises);

      // Notify user about auto-completion
      if (autoSelected.length > 0) {
        toast({
          title: "Exercises auto-completed",
          description: `Added ${autoSelected.length} additional exercise(s) to reach ${maxExercises} total exercises.`,
          variant: "default"
        });
      }
    }
    trackEvent({
      eventType: 'form_submit',
      eventData: {
        lessonTime,
        lessonTopic: effectiveTopic,
        lessonGoal,
        grammarFocus,
        additionalInformation,
        englishLevel,
        languageStyle,
        timestamp: new Date().toISOString()
      }
    });
    const formData = {
      lessonTime,
      lessonTopic: effectiveTopic,
      lessonGoal,
      teachingPreferences: grammarFocus,
      additionalInformation,
      englishLevel,
      languageStyle,
      studentId: selectedStudentId === "no-student" ? undefined : selectedStudentId || undefined,
      selectedExercises: finalExercises,
      selectedMediaTypes,
      exerciseFocusMap: Object.keys(exerciseFocusMap).length > 0 ? exerciseFocusMap : undefined,
      selectedImage: selectedImage
    };

    // Refresh onboarding progress after successful worksheet generation
    devLog('[WorksheetForm] Triggering onboarding refresh after worksheet generation');
    refreshProgress();
    setTimeout(refreshProgress, 1000);
    setTimeout(refreshProgress, 2000);
    onSubmit(formData);
  };
  const refreshSuggestions = () => {
    setCurrentPlaceholders(getRandomPlaceholderSet());
    setCurrentSuggestions(getRandomSuggestionSets(2));
  };

  // Smart mode loading state
  const [smartLoading, setSmartLoading] = useState(false);

  // Handle selection mode changes
  const handleModeChange = async (mode: ExerciseSelectionMode) => {
    devLog(`🔧 [WORKSHEET-FORM] Changing mode to: ${mode}`);
    setSelectionMode(mode);
    setActiveTab('exercises');
    const maxExercises = lessonTime === '45min' ? 6 : 8;
    const isPictureMode = selectedMediaTypes.includes('picture');
    const isAudioMode = selectedMediaTypes.includes('audio');
    let newExercises: string[];
    if (mode === 'manual') {
      if (isPictureMode) {
        newExercises = lessonTime === '45min' ? ['describe-picture', 'answer-questions-picture', 'fill-in-blanks', 'dialogue', 'matching', 'true-false'] : ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'fill-in-blanks', 'multiple-choice', 'matching', 'dialogue', 'answer-questions'];
      } else if (isAudioMode) {
        newExercises = lessonTime === '45min' ? ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'fill-in-blanks', 'multiple-choice-audio', 'matching'] : ['listening-comprehension', 'answer-questions-audio', 'true-false', 'fill-in-blanks-audio', 'multiple-choice', 'dialogue', 'answer-questions', 'matching'];
      } else {
        newExercises = lessonTime === '45min' ? ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out'] : ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
      }
      setSelectedExercises(newExercises);
    } else if (mode === 'random') {
      const PICTURE_EXERCISES = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
      const AUDIO_EXERCISES = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'multiple-choice-audio', 'fill-in-blanks-audio'];
      // sentence-transformation is disabled — exclude from random picks too.
      const GENERAL_EXERCISES = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'discussion', 'error-correction', 'odd-one-out', 'synonyms', 'antonyms', 'word-order', 'gap-text', 'negative-prefixes', 'categorize', 'paraphrasing', 'complete-word', 'matching-halves'];
      if (isPictureMode) {
        const sp = [...PICTURE_EXERCISES].sort(() => Math.random() - 0.5).slice(0, 2);
        const sg = [...GENERAL_EXERCISES].sort(() => Math.random() - 0.5).slice(0, maxExercises - sp.length);
        newExercises = [...sp, ...sg];
      } else if (isAudioMode) {
        const sa = [...AUDIO_EXERCISES].sort(() => Math.random() - 0.5).slice(0, 2);
        const sg = [...GENERAL_EXERCISES].sort(() => Math.random() - 0.5).slice(0, maxExercises - sa.length);
        newExercises = [...sa, ...sg];
      } else {
        newExercises = [...GENERAL_EXERCISES].sort(() => Math.random() - 0.5).slice(0, maxExercises);
      }
      if (newExercises.length !== maxExercises) {
        const pool = [...GENERAL_EXERCISES].filter(ex => !newExercises.includes(ex));
        while (newExercises.length < maxExercises && pool.length > 0) {
          newExercises.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        }
      }
      setSelectedExercises(newExercises);
    } else {
      // Smart mode → AI selects exercises + V/G focus from form context
      setSmartLoading(true);
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('suggest-exercises', {
          body: {
            lessonTopic, lessonGoal, grammarFocus,
            additionalInformation,
            englishLevel, lessonTime, selectedMediaTypes,
            // v4.7: when no media tile is pre-selected, let AI decide whether
            // the topic justifies picture/audio exercises. Backend then returns
            // recommendedMediaType and we sync the UI tile.
            mediaPreference: (selectedMediaTypes && selectedMediaTypes.length > 0) ? 'forced' : 'auto',
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const aiExercises: string[] = Array.isArray(data?.exercises) ? data.exercises : [];
        const aiFocus: Record<string, 'vocabulary' | 'grammar'> = data?.focusMap || {};
        if (aiExercises.length === 0) throw new Error('AI returned no exercises');
        // v4.7: sync media tile to whatever family the AI chose (auto mode only).
        const recommended: 'picture' | 'audio' | null = data?.recommendedMediaType ?? null;
        if (recommended && (!selectedMediaTypes || selectedMediaTypes.length === 0)) {
          setSelectedMediaTypes([recommended] as MediaType[]);
        }
        setSelectedExercises(aiExercises);
        setExerciseFocusMap(aiFocus);
        // v4.6: KEEP selectionMode = 'smart' after success.
        // Previously we switched back to 'manual' here, which triggered the
        // ExerciseSelector reset effect and overwrote the AI's choice with the
        // canonical first-8 manual defaults. ExerciseSelector now treats 'smart'
        // exactly like 'manual' for editability (checkboxes + V/G toggles).
        const mediaLabel = recommended === 'audio' ? 'audio' : recommended === 'picture' ? 'picture' : 'no';
        toast({ title: 'Smart selection ready', description: `AI picked ${aiExercises.length} exercises with ${mediaLabel} media — adjust V/G or checkboxes as needed.` });
      } catch (err: any) {
        console.error('Smart selection failed', err);
        toast({ title: 'Smart selection failed', description: err?.message || 'Falling back to manual defaults.', variant: 'destructive' });
        const fallback = lessonTime === '45min' ? ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out'] : ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
        setSelectedExercises(fallback);
        setSelectionMode('manual');
      } finally {
        setSmartLoading(false);
      }
    }
  };
  const createSuggestionTiles = (field: 'lessonTopic' | 'lessonFocus' | 'additionalInformation' | 'grammarFocus') => {
    return currentSuggestions.map((set, index) => ({
      id: `${set.id}-${field}-${index}`,
      title: set[field]
    }));
  };

  // v6.9.10 — apply a Next-Step preset (chip click) into form state.
  const applyPreset = (p: PresetPayload) => {
    setLessonTopic(p.topic || '');
    setLessonGoal(p.goal || '');
    if (p.additionalInfo || p.grammarFocus) setShowMoreFields(true);
    setAdditionalInformation(p.additionalInfo || '');
    setGrammarFocus(p.grammarFocus || '');
    const norm = normalizeSuggestionPrefill({
      exercises: p.exercises,
      focusMap: p.exerciseFocusMap,
      mediaTypes: p.mediaTypes,
      lessonTime: lessonTime as '45min' | '60min',
    });
    setSelectedMediaTypes(norm.selectedMediaTypes as MediaType[]);
    setSelectedExercises(norm.selectedExercises);
    setExerciseFocusMap(norm.exerciseFocusMap);
    setSelectionMode('manual');
    setActiveTab('exercises');
    sessionStorage.setItem('appliedPresetSuggestionId', p.sourceSuggestionId);
    toast({ title: 'Preset applied', description: 'Review fields and generate.' });
  };

  return <div className={`w-full ${isMobile ? 'py-2' : 'py-[24px]'}`}>
      <Card className="bg-card/88 backdrop-blur-sm border-border/60 shadow-lg">
        <CardContent className={`${isMobile ? 'p-3' : 'p-8'}`}>
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div className="mb-6">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'} mb-6`}>
                <div className={`${isMobile ? 'text-center' : ''}`}>
                  <h1 className={`font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 ${isMobile ? 'text-xl' : 'text-3xl'} mb-2`}>
                    Create A Worksheet
                  </h1>
                   <p className={`text-gray-600 ${isMobile ? 'text-sm' : 'text-base'}`}>
                     Tailored to your students. In seconds.
                   </p>
                </div>
                
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-14'}`}>
                  <div className={`flex flex-col ${isMobile ? 'items-center' : 'items-start'}`}>
                    <div className={`flex gap-2 ${isMobile ? 'justify-center' : 'w-32'}`}>
                      <Button type="button" variant={lessonTime === "45min" ? "default" : "outline"} onClick={() => setLessonTime("45min")} className={lessonTime === "45min" ? "bg-worksheet-purple hover:bg-worksheet-purpleDark" : ""} size={isMobile ? "sm" : "sm"}>
                        45 min
                      </Button>
                      <Button type="button" variant={lessonTime === "60min" ? "default" : "outline"} onClick={() => setLessonTime("60min")} className={lessonTime === "60min" ? "bg-worksheet-purple hover:bg-worksheet-purpleDark" : ""} size={isMobile ? "sm" : "sm"}>
                        60 min
                      </Button>
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mt-2 ${isMobile ? 'text-center' : ''}`}>
                      Duration: {lessonTime === '45min' ? '6 exercises' : '8 exercises'}
                    </p>
                  </div>
                  
                  <div className={`flex flex-col ${isMobile ? 'items-center' : 'items-end w-80'}`}>
                    <div className={`flex gap-1 mb-1 ${isMobile ? 'flex-wrap justify-center' : ''}`}>
                      <Button type="button" variant={englishLevel === "A1/A2" ? "default" : "outline"} onClick={() => setEnglishLevel("A1/A2")} className={englishLevel === "A1/A2" ? "bg-worksheet-purple hover:bg-worksheet-purpleDark" : ""} size={isMobile ? "sm" : "sm"}>
                        A1/A2
                      </Button>
                      <Button type="button" variant={englishLevel === "B1/B2" ? "default" : "outline"} onClick={() => setEnglishLevel("B1/B2")} className={englishLevel === "B1/B2" ? "bg-worksheet-purple hover:bg-worksheet-purpleDark" : ""} size={isMobile ? "sm" : "sm"}>
                        B1/B2
                      </Button>
                      <Button type="button" variant={englishLevel === "C1/C2" ? "default" : "outline"} onClick={() => setEnglishLevel("C1/C2")} className={englishLevel === "C1/C2" ? "bg-worksheet-purple hover:bg-worksheet-purpleDark" : ""} size={isMobile ? "sm" : "sm"}>
                        C1/C2
                      </Button>
                    </div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 ${isMobile ? 'text-center' : ''}`}>
                      CEFR Scale: {englishLevel === "A1/A2" ? "Beginner/Elementary" : englishLevel === "B1/B2" ? "Intermediate/Upper-Intermediate" : "Advanced/Proficiency"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Typewriter Hint */}
              <TypewriterHint />

              {/* Lesson Topic - Always Visible, with Lesson Focus appearing next to it */}
              <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : showMoreFields ? 'md:grid-cols-2 gap-6' : ''} mb-6`}>
                <FormField name="lessonTopic" label="Lesson topic: General theme or real‑life scenario" placeholder={currentPlaceholders.lessonTopic} value={lessonTopic} onChange={setLessonTopic} suggestions={createSuggestionTiles('lessonTopic')} isRequired={true} />
                
                {/* Lesson Focus appears next to Lesson Topic when expanded */}
                {showMoreFields && <FormField label="Lesson focus: What should your student achieve by the end of the lesson?" placeholder={currentPlaceholders.lessonFocus} value={lessonGoal} onChange={setLessonGoal} suggestions={createSuggestionTiles('lessonFocus')} isOptional={true} />}
              </div>

              {/* Show More Link with Preview - button UNDER the blurred preview */}
              {!showMoreFields && <div className="mb-6">
                  {/* Preview with light blur effect showing only field names - CLICKABLE */}
                  <div className="relative overflow-hidden mb-4 py-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-md px-2" onClick={() => setShowMoreFields(true)} title="Click to expand additional fields">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-foreground/60 cursor-pointer">
                          Additional Information: Extra context & personal or situational details
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground/60 cursor-pointer">
                          Grammar focus
                        </label>
                      </div>
                    </div>
                    
                    {/* Very light blur overlay */}
                    <div className="absolute inset-0 bg-background/30 backdrop-blur-[0.5px] pointer-events-none" />
                  </div>
                  
                  {/* Button under the preview */}
                  <button type="button" onClick={() => setShowMoreFields(true)} className="w-full text-center text-sm font-medium text-primary hover:text-primary/80 underline decoration-2 underline-offset-4 transition-colors flex items-center justify-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    Fill more info - get more accurate
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>}

              {/* Additional Fields - Second Row when expanded */}
              {showMoreFields && <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-2 gap-6'} mb-6`}>
                  <FormField label="Additional Information: Extra context & personal or situational details" placeholder={currentPlaceholders.additionalInformation} value={additionalInformation} onChange={setAdditionalInformation} suggestions={createSuggestionTiles('additionalInformation')} isOptional={true} />

                  <FormField label="Grammar focus" placeholder={currentPlaceholders.grammarFocus} value={grammarFocus} onChange={setGrammarFocus} suggestions={createSuggestionTiles('grammarFocus')} isOptional={true} />
                </div>}

              {/* v6.9.10 — Next-Step preset banner (per selected student) */}
              {userId && selectedStudentId !== 'no-student' && (
                <NextStepsPresetBanner
                  studentId={selectedStudentId}
                  studentName={students.find(s => s.id === selectedStudentId)?.name}
                  teacherId={userId}
                  onApplyPreset={applyPreset}
                />
              )}

              {/* Exercise Selection Cards */}
              <div className="mb-6">
                {/* Card Headers in One Line with Student Selector */}
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-3'} mb-4 items-stretch`}>
                  
                  {/* Student Selection - Lock icon for anonymous/no students, dropdown for authenticated with students */}
                  {userId && students.length > 0 ? (
                    <div className={`${isMobile ? 'w-full' : 'w-[23%]'} flex flex-col justify-center`}>
                      <Select
                        value={selectedStudentId}
                        onValueChange={(v) => {
                          if (v === '__add_student__') {
                            setInlineAddStudentOpen(true);
                            return;
                          }
                          setSelectedStudentId(v);
                        }}
                      >
                        <SelectTrigger
                          className={`w-full ${selectedStudentId === 'no-student'
                            ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50/40 dark:bg-amber-900/10'
                            : ''}`}
                        >
                          <SelectValue placeholder="Choose a student" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-student">No student (generic)</SelectItem>
                          <SelectItem value="__add_student__" className="text-primary font-medium">
                            + Add Student
                          </SelectItem>
                          {students.map(student => <SelectItem key={student.id} value={student.id}>
                              <span className="truncate">{student.name} ({student.english_level})</span>
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedStudentId === 'no-student' && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 leading-tight">
                          Pick a student to unlock personalized goals, level, and Next Steps.
                        </p>
                      )}
                    </div>
                  ) : userId ? (
                    <div className={`${isMobile ? 'w-full' : 'w-[23%]'} flex items-center`}>
                      <a
                        href="/dashboard?action=add-student"
                        className="w-full h-full flex items-center gap-2 px-3 py-2 border-2 border-dashed border-primary/40 rounded-md bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors"
                        title="Add your first student"
                      >
                        <Plus className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">Add your first student</span>
                      </a>
                    </div>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`${isMobile ? 'w-full' : 'w-[23%]'} flex items-center`}>
                            <div className="w-full h-full flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 text-muted-foreground cursor-help">
                              <Lock className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm truncate">Student assignment</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>🔒 Log in to assign worksheets to students</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Exercise Types Card Header */}
                  <Card className={`border-2 cursor-pointer transition-colors ${isMobile ? 'w-full' : 'flex-1'} ${activeTab === 'exercises' ? 'border-worksheet-purple bg-worksheet-purpleLight' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => setActiveTab(activeTab === 'exercises' ? null : 'exercises')}>
                    <div className="p-2.5">
                      {/* Card Header with Title and Mode Selection Tiles */}
                      <div className={isMobile ? 'flex flex-col gap-2' : 'flex items-center justify-between'}>
                         <div className="flex items-center gap-2">
                          <h2 className="font-semibold text-foreground text-base">Exercise Types</h2>
                          <div className="flex gap-1 ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Exclusive selection - tylko jeden na raz
                                const maxExercises = lessonTime === '45min' ? 6 : 8;
                                const PICTURE_EXERCISES_45MIN = ['describe-picture', 'answer-questions-picture', 'fill-in-blanks', 'dialogue', 'matching', 'true-false'];
                                const PICTURE_EXERCISES_60MIN = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'fill-in-blanks', 'multiple-choice', 'matching', 'dialogue', 'answer-questions'];
                                
                                if (selectedMediaTypes.includes('picture')) {
                                  setSelectedMediaTypes([]);
                                  // Reset to default exercises
                                  const defaultExercises = lessonTime === '45min' 
                                    ? ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out']
                                    : ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
                                  setSelectedExercises(defaultExercises);
                                } else {
                                  setSelectedMediaTypes(['picture'] as MediaType[]);
                                  // Select picture exercises
                                  const pictureExercises = lessonTime === '45min' ? PICTURE_EXERCISES_45MIN : PICTURE_EXERCISES_60MIN;
                                  setSelectedExercises(pictureExercises);
                                }
                                if (!activeTab) setActiveTab('exercises');
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${
                                selectedMediaTypes.includes('picture')
                                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              title="Include picture-based exercises"
                            >
                              <input 
                                type="checkbox" 
                                checked={selectedMediaTypes.includes('picture')}
                                onChange={() => {}}
                                className="h-3 w-3 accent-blue-500"
                                aria-label="Include picture-based exercises"
                              />
                              <Image className="h-4 w-4 text-blue-500" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Exclusive selection - tylko jeden na raz
                                const maxExercises = lessonTime === '45min' ? 6 : 8;
                                const AUDIO_EXERCISES_45MIN = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'fill-in-blanks', 'multiple-choice-audio', 'matching'];
                                const AUDIO_EXERCISES_60MIN = ['listening-comprehension', 'answer-questions-audio', 'true-false', 'fill-in-blanks-audio', 'multiple-choice', 'dialogue', 'answer-questions', 'matching'];
                                
                                if (selectedMediaTypes.includes('audio')) {
                                  setSelectedMediaTypes([]);
                                  // Reset to default exercises
                                  const defaultExercises = lessonTime === '45min' 
                                    ? ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out']
                                    : ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
                                  setSelectedExercises(defaultExercises);
                                } else {
                                  setSelectedMediaTypes(['audio'] as MediaType[]);
                                  // Select audio exercises
                                  const audioExercises = lessonTime === '45min' ? AUDIO_EXERCISES_45MIN : AUDIO_EXERCISES_60MIN;
                                  setSelectedExercises(audioExercises);
                                }
                                if (!activeTab) setActiveTab('exercises');
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${
                                selectedMediaTypes.includes('audio')
                                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              title="Include audio-based exercises"
                            >
                              <input 
                                type="checkbox" 
                                checked={selectedMediaTypes.includes('audio')}
                                onChange={() => {}}
                                className="h-3 w-3 accent-orange-500"
                                aria-label="Include audio-based exercises"
                              />
                              <Headphones className="h-4 w-4 text-orange-500" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Mode Selection Tiles */}
                        <div className={isMobile ? 'grid grid-cols-3 gap-1 w-full' : 'flex gap-1'}>
                          <button type="button" onClick={e => {
                          e.stopPropagation();
                          handleModeChange('manual');
                        }} className={`relative flex items-center justify-center gap-1 px-2 py-1 rounded-lg border transition-all text-center group ${selectionMode === 'manual' ? 'border-worksheet-purple bg-worksheet-purple text-white' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                            <MousePointer className="h-3 w-3" />
                            <span className="text-xs font-medium">Manual</span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                              Choose exercises manually
                            </div>
                          </button>
                          
                          <button type="button" onClick={e => {
                          e.stopPropagation();
                          handleModeChange('random');
                        }} className={`relative flex items-center justify-center gap-1 px-2 py-1 rounded-lg border transition-all text-center group ${selectionMode === 'random' ? 'border-worksheet-purple bg-worksheet-purple text-white' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                            <Shuffle className="h-3 w-3" />
                            <span className="text-xs font-medium">Random</span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                              Random exercise selection
                            </div>
                          </button>
                          
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleModeChange('smart'); }}
                            disabled={smartLoading}
                            className={`relative flex items-center justify-center gap-1 px-2 py-1 rounded-lg border transition-all text-center group ${selectionMode === 'smart' ? 'border-worksheet-purple bg-worksheet-purple text-white' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'} ${smartLoading ? 'opacity-60 cursor-wait' : ''}`}
                          >
                            <Brain className={`h-3 w-3 ${smartLoading ? 'animate-pulse' : ''}`} />
                            <span className="text-xs font-medium">{smartLoading ? 'Thinking…' : 'Smart'}</span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                              AI picks exercises + V/G focus from your inputs
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Advanced Options Card Header */}
                  <Card className={`border-2 cursor-pointer transition-colors ${isMobile ? 'w-full' : 'w-[23%]'} ${activeTab === 'advanced' ? 'border-worksheet-purple bg-worksheet-purpleLight' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => setActiveTab(activeTab === 'advanced' ? null : 'advanced')}>
                    <div className="p-2.5">
                      <h2 className="font-semibold text-foreground text-base">Language Style</h2>
                    </div>
                  </Card>
                </div>

                {/* v6.9.15a — Contextual hint about student selection state */}
                {userId && students.length === 0 && (
                  <StudentContextHint variant="no-students" />
                )}
                {userId && students.length > 0 && selectedStudentId === 'no-student' && (
                  <StudentContextHint variant="no-selection" />
                )}

                {/* Card Content - Full Width Below Headers */}
                {activeTab === 'exercises' && <Card className="border-2 border-worksheet-purple">
                    <div className="p-4">
                      <ExerciseSelector lessonTime={lessonTime} selectedExercises={selectedExercises} onChange={setSelectedExercises} selectionMode={selectionMode} selectedMediaTypes={selectedMediaTypes} onMediaTypesChange={setSelectedMediaTypes} exerciseFocusMap={exerciseFocusMap} onFocusChange={(exerciseId, focus) => {
                        setExerciseFocusMap(prev => {
                          const next = { ...prev };
                          if (focus === undefined) {
                            delete next[exerciseId];
                          } else {
                            next[exerciseId] = focus;
                          }
                          return next;
                        });
                      }} />
                    </div>
                  </Card>}

                {activeTab === 'advanced' && <Card className="border-2 border-worksheet-purple">
                    <div className="p-4">
                      <AdvancedOptions languageStyle={languageStyle} onLanguageStyleChange={setLanguageStyle} />
                    </div>
                  </Card>}
              </div>

              <div className={`mb-6 ${isMobile ? 'text-center' : ''}`}>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>
                  GENERAL HINT: To create a truly personalized, student‑focused worksheet, please provide as detailed a description as possible in each field.
                </p>
              </div>

              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between'} pt-4`}>
                <div className={`flex ${isMobile ? 'flex-col w-full' : 'flex-row'} gap-2`}>
                  <Button type="button" variant="outline" onClick={refreshSuggestions} className={`border-worksheet-purple text-worksheet-purple hover:bg-worksheet-purpleLight ${isMobile ? 'w-full' : ''}`} size={isMobile ? "sm" : "default"}>
                    Refresh Suggestions
                  </Button>
                  <Button type="button" variant="ghost" onClick={clearForm} className={`text-muted-foreground hover:text-foreground ${isMobile ? 'w-full' : ''}`} size={isMobile ? "sm" : "default"} title="Clear all form fields">
                    <Eraser className="h-4 w-4 mr-1" /> Clear form
                  </Button>
                </div>
                <Button type="submit" className={`bg-worksheet-purple hover:bg-worksheet-purpleDark ${isMobile ? 'w-full' : ''}`} size={isMobile ? "sm" : "default"}>
                  Generate Custom Worksheet
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* v6.9.33 — inline Add Student dialog: caller controls post-add navigation
          (auto-select the new student instead of navigating to /student/:id). */}
      <AddStudentDialog
        triggerButton={false}
        open={inlineAddStudentOpen}
        onOpenChange={setInlineAddStudentOpen}
        onStudentAdded={(s) => {
          refetchStudents();
          if (s?.id) setSelectedStudentId(s.id);
          setInlineAddStudentOpen(false);
        }}
      />
    </div>;
}