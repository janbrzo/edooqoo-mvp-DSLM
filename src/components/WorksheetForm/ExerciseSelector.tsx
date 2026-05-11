import React, { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LessonTime, ExerciseSelectionMode, MediaType } from './types';

const AVAILABLE_EXERCISES = [
  // Basic exercises
  {
    id: 'reading',
    label: 'Reading Comprehension',
    icon: '📖',
    description: 'Read and answer questions about the text',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'fill-in-blanks',
    label: 'Fill in the Blanks',
    icon: '✏️',
    description: 'Complete sentences with missing words',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'fill-in-blanks-audio',
    label: 'Fill in the Blanks',
    icon: '✏️',
    description: 'Complete transcript while listening',
    requiresPicture: false,
    requiresAudio: true,
    pictureRequired: false,
    audioRequired: true,
    badge: 'Audio',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'multiple-choice',
    label: 'Multiple Choice',
    icon: '📝',
    description: 'Choose the correct answer from options',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'multiple-choice-audio',
    label: 'Multiple Choice',
    icon: '📝',
    description: 'Choose answers based on audio',
    requiresPicture: false,
    requiresAudio: true,
    pictureRequired: false,
    audioRequired: true,
    badge: 'Audio',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'multiple-choice-picture',
    label: 'Multiple Choice',
    icon: '📝',
    description: 'Choose answers based on a picture',
    requiresPicture: true,
    requiresAudio: false,
    pictureRequired: true,
    audioRequired: false,
    badge: 'Picture',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'true-false',
    label: 'True/False Questions',
    icon: '✓✗',
    description: 'Decide if statements are true or false',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'true-false-audio',
    label: 'True/False',
    icon: '✓✗',
    description: 'True or false questions about audio',
    requiresPicture: false,
    requiresAudio: true,
    pictureRequired: false,
    audioRequired: true,
    badge: 'Audio',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'true-false-picture',
    label: 'True/False',
    icon: '✓✗',
    description: 'True or false questions about a picture',
    requiresPicture: true,
    requiresAudio: false,
    pictureRequired: true,
    audioRequired: false,
    badge: 'Picture',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'matching',
    label: 'Matching Exercise',
    icon: '🔗',
    description: 'Match related items',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'dialogue',
    label: 'Dialogue Practice',
    icon: '💬',
    description: 'Practice conversations',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'listening-comprehension',
    label: 'Listening Comprehension',
    icon: '🎧',
    description: 'Listen and answer comprehension questions',
    requiresPicture: false,
    requiresAudio: true,
    pictureRequired: false,
    audioRequired: true,
    badge: 'Audio',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'answer-questions',
    label: 'Answer Questions',
    icon: '❓',
    description: 'Answer comprehension questions',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'answer-questions-audio',
    label: 'Answer Questions',
    icon: '❓',
    description: 'Answer questions based on audio',
    requiresPicture: false,
    requiresAudio: true,
    pictureRequired: false,
    audioRequired: true,
    badge: 'Audio',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'answer-questions-picture',
    label: 'Answer Questions',
    icon: '❓',
    description: 'Answer questions based on a picture',
    requiresPicture: true,
    requiresAudio: false,
    pictureRequired: true,
    audioRequired: false,
    badge: 'Picture',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'describe-picture',
    label: 'Describe Picture',
    icon: '🖼️',
    description: 'Describe what you see in the picture',
    requiresPicture: true,
    requiresAudio: false,
    pictureRequired: true,
    audioRequired: false,
    badge: 'Picture',
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'discussion',
    label: 'Discussion Questions',
    icon: '👥',
    description: 'Engage in meaningful conversation about the topic',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'error-correction',
    label: 'Error Correction',
    icon: '⚠️',
    description: 'Find and correct mistakes in sentences',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'odd-one-out',
    label: 'Odd One Out',
    icon: '🔍',
    description: 'Identify which item doesn\'t belong',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'matching-halves',
    label: 'Matching Halves',
    icon: '🧩',
    description: 'Match sentence halves to complete ideas',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'word-order',
    label: 'Word Order',
    icon: '📋',
    description: 'Arrange words to form correct sentences',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'gap-text',
    label: 'Gap Text (Cloze)',
    icon: '📄',
    description: 'Fill in missing parts of a text',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'negative-prefixes',
    label: 'Negative Prefixes',
    icon: '➖',
    description: 'Practice adding negative prefixes to words',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'categorize',
    label: 'Categorization',
    icon: '📊',
    description: 'Sort words or phrases into categories',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'paraphrasing',
    label: 'Paraphrasing',
    icon: '🔄',
    description: 'Rewrite sentences using different words',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'complete-word',
    label: 'Complete the Word',
    icon: '🅰️',
    description: 'Fill in missing letters to complete words',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'synonyms',
    label: 'Synonyms Matching',
    icon: '🔄',
    description: 'Match words with similar meanings',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'antonyms',
    label: 'Antonyms Matching',
    icon: '↕️',
    description: 'Match words with opposite meanings',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: false,
    deprecated: false,
  },
  {
    id: 'sentence-transformation',
    label: 'Sentence Transformation',
    icon: '🔄',
    description: 'Transform sentences while keeping the same meaning',
    requiresPicture: false,
    requiresAudio: false,
    pictureRequired: false,
    audioRequired: false,
    comingSoon: true,
    deprecated: false,
  },
];

// Picture-compatible exercises
const PICTURE_COMPATIBLE_EXERCISES = ['multiple-choice-picture', 'true-false-picture', 'answer-questions-picture', 'describe-picture'];

// Audio-compatible exercises
const AUDIO_COMPATIBLE_EXERCISES = [
  'listening-comprehension',
  'multiple-choice-audio',
  'true-false-audio',
  'fill-in-blanks-audio',
  'answer-questions-audio'
];

// Predefined exercise sets for Manual mode
const MANUAL_EXERCISES_60MIN = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'answer-questions', 'discussion'];
const MANUAL_EXERCISES_45MIN = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'answer-questions'];

// Picture mode defaults
const MANUAL_EXERCISES_60MIN_PICTURE = [
  'describe-picture',
  'answer-questions-picture',
  'true-false',
  'fill-in-blanks',
  'multiple-choice',
  'matching',
  'dialogue',
  'answer-questions'
];
const MANUAL_EXERCISES_45MIN_PICTURE = [
  'describe-picture',
  'answer-questions-picture',
  'true-false',
  'fill-in-blanks',
  'multiple-choice',
  'matching'
];

// Audio mode defaults
const MANUAL_EXERCISES_60MIN_AUDIO = [
  'listening-comprehension',
  'answer-questions-audio',
  'true-false',
  'fill-in-blanks-audio',
  'multiple-choice',
  'dialogue',
  'dialogue', // ✅ Changed from 'answer-questions' to avoid image icon in audio mode
  'matching'
];
const MANUAL_EXERCISES_45MIN_AUDIO = [
  'listening-comprehension',
  'answer-questions-audio',
  'true-false-audio',
  'fill-in-blanks',
  'multiple-choice-audio',
  'matching'
];

const MEDIA_ENHANCED_OPTIONS = [
  {
    id: 'video',
    label: 'Video',
    icon: '🎥'
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '🎵'
  },
  {
    id: 'picture',
    label: 'Picture',
    icon: '🖼️'
  }
];

interface ExerciseSelectorProps {
  lessonTime: LessonTime;
  selectedExercises: string[];
  onChange: (exercises: string[]) => void;
  selectionMode: ExerciseSelectionMode;
  selectedMediaTypes: MediaType[];
  onMediaTypesChange: (mediaTypes: MediaType[]) => void;
  exerciseFocusMap?: Record<string, 'vocabulary' | 'grammar'>;
  onFocusChange?: (exerciseId: string, focus: 'vocabulary' | 'grammar' | undefined) => void;
}

export default function ExerciseSelector({
  lessonTime,
  selectedExercises,
  onChange,
  selectionMode,
  selectedMediaTypes,
  onMediaTypesChange,
  exerciseFocusMap = {},
  onFocusChange
}: ExerciseSelectorProps) {
  const maxExercises = lessonTime === '45min' ? 6 : 8;
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Get default exercises for manual mode
  const manualDefaults = useMemo(() => {
    const isPictureMode = selectedMediaTypes.includes('picture');
    const isAudioMode = selectedMediaTypes.includes('audio');
    
    if (isPictureMode) {
      return lessonTime === '45min' ? MANUAL_EXERCISES_45MIN_PICTURE : MANUAL_EXERCISES_60MIN_PICTURE;
    }
    if (isAudioMode) {
      return lessonTime === '45min' ? MANUAL_EXERCISES_45MIN_AUDIO : MANUAL_EXERCISES_60MIN_AUDIO;
    }
    return lessonTime === '45min' ? MANUAL_EXERCISES_45MIN : MANUAL_EXERCISES_60MIN;
  }, [lessonTime, selectedMediaTypes]);

  // Generate random exercises for random mode
  const generateRandomExercises = useCallback(() => {
    const isPictureMode = selectedMediaTypes.includes('picture');
    const isAudioMode = selectedMediaTypes.includes('audio');
    
    if (isPictureMode) {
      // Get ALL picture exercises (ensure we have at least 2)
      const availablePictureExercises = AVAILABLE_EXERCISES
        .filter(ex => !ex.comingSoon && PICTURE_COMPATIBLE_EXERCISES.includes(ex.id))
        .map(ex => ex.id);
      
      const availableOtherExercises = AVAILABLE_EXERCISES
        .filter(ex => !ex.comingSoon && !PICTURE_COMPATIBLE_EXERCISES.includes(ex.id) && ex.id !== 'reading')
        .map(ex => ex.id);
      
      // Always select exactly 2 picture exercises
      const shuffledPicture = [...availablePictureExercises].sort(() => Math.random() - 0.5);
      const selectedPicture = shuffledPicture.slice(0, Math.min(2, availablePictureExercises.length));
      
      // Fill remaining slots with other exercises
      const remainingSlots = maxExercises - selectedPicture.length;
      const shuffledOther = [...availableOtherExercises].sort(() => Math.random() - 0.5);
      const selectedOther = shuffledOther.slice(0, remainingSlots);
      
      console.log('🎲 [RANDOM-PICTURE] Selected picture exercises:', selectedPicture);
      console.log('🎲 [RANDOM-PICTURE] Selected other exercises:', selectedOther);
      return [...selectedPicture, ...selectedOther];
    } else if (isAudioMode) {
      // Get ALL audio exercises (ensure we have at least 2)
      const availableAudioExercises = AVAILABLE_EXERCISES
        .filter(ex => !ex.comingSoon && AUDIO_COMPATIBLE_EXERCISES.includes(ex.id))
        .map(ex => ex.id);
      
      const availableOtherExercises = AVAILABLE_EXERCISES
        .filter(ex => !ex.comingSoon && !AUDIO_COMPATIBLE_EXERCISES.includes(ex.id))
        .map(ex => ex.id);
      
      // Always select exactly 2 audio exercises
      const shuffledAudio = [...availableAudioExercises].sort(() => Math.random() - 0.5);
      const selectedAudio = shuffledAudio.slice(0, Math.min(2, availableAudioExercises.length));
      
      // Fill remaining slots with other exercises
      const remainingSlots = maxExercises - selectedAudio.length;
      const shuffledOther = [...availableOtherExercises].sort(() => Math.random() - 0.5);
      const selectedOther = shuffledOther.slice(0, remainingSlots);
      
      console.log('🎲 [RANDOM-AUDIO] Selected audio exercises:', selectedAudio);
      console.log('🎲 [RANDOM-AUDIO] Selected other exercises:', selectedOther);
      return [...selectedAudio, ...selectedOther];
    } else {
      const availableExercises = AVAILABLE_EXERCISES
        .filter(ex => !ex.comingSoon && !ex.pictureRequired && !ex.audioRequired)
        .map(ex => ex.id);
      const shuffled = [...availableExercises].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, maxExercises);
    }
  }, [maxExercises, selectedMediaTypes]);

  // Initialize exercises based on mode
  useEffect(() => {
    if (selectedExercises.length === 0) {
      let initialExercises: string[];
      if (selectionMode === 'manual') {
        initialExercises = manualDefaults;
      } else if (selectionMode === 'random') {
        initialExercises = generateRandomExercises();
      } else {
        initialExercises = manualDefaults;
      }
      onChange(initialExercises);
    }
  }, [lessonTime, selectionMode, selectedExercises.length, onChange, manualDefaults, generateRandomExercises]);

  // Handle lesson time and selection mode changes (but NOT user's manual selections)
  const prevLessonTimeRef = useRef(lessonTime);
  const prevSelectionModeRef = useRef(selectionMode);
  
  useEffect(() => {
    // Only reset if lessonTime or selectionMode actually changed (not just selectedExercises)
    const lessonTimeChanged = prevLessonTimeRef.current !== lessonTime;
    const selectionModeChanged = prevSelectionModeRef.current !== selectionMode;
    
    if (lessonTimeChanged || selectionModeChanged) {
      if (selectedExercises.length > 0) {
        if (selectionMode === 'manual') {
          onChange(manualDefaults);
        } else if (selectionMode === 'random') {
          onChange(generateRandomExercises());
        }
        // v4.6: NEVER reset for 'smart' — Smart writes its AI result and must persist.
        // Previously this branch implicitly fell through and Smart selections survived,
        // but the parent used to flip the mode back to 'manual' immediately, which
        // re-triggered this effect and clobbered the AI result with manualDefaults.
        // Now Smart stays Smart, so we must not reset here either.
      }
      prevLessonTimeRef.current = lessonTime;
      prevSelectionModeRef.current = selectionMode;
    }
  }, [lessonTime, selectionMode, generateRandomExercises, onChange, manualDefaults, selectedExercises.length]);

  const handleExerciseToggle = useCallback((exerciseId: string, checked: boolean) => {
    // v4.6: allow editing in both 'manual' AND 'smart' — teacher can always
    // tweak the AI's picks. Random remains read-only (re-roll instead).
    if (selectionMode === 'random') return;

    let newSelection = [...selectedExercises];
    if (checked && !newSelection.includes(exerciseId) && newSelection.length < maxExercises) {
      newSelection.push(exerciseId);
    } else if (!checked && newSelection.includes(exerciseId)) {
      newSelection = newSelection.filter(id => id !== exerciseId);
    }
    onChange(newSelection);
  }, [selectedExercises, maxExercises, onChange, selectionMode]);

  const handleMediaToggle = useCallback((mediaType: MediaType) => {
    // Toggle logic: if already selected, deselect; otherwise select
    const newMediaTypes = selectedMediaTypes.includes(mediaType) 
      ? [] 
      : [mediaType];
    
    onMediaTypesChange(newMediaTypes);
    
    // Reset exercises based on media selection AND selection mode
    let newExercises: string[];
    
    // CRITICAL FIX: In Random mode, generate random exercises with media priority
    if (selectionMode === 'random') {
      // Temporarily update selectedMediaTypes for generateRandomExercises to use
      // We need to regenerate with the new media types
      const tempMediaTypes = newMediaTypes;
      
      // Generate random exercises with new media types
      if (tempMediaTypes.includes('picture')) {
        const availablePictureExercises = AVAILABLE_EXERCISES
          .filter(ex => !ex.comingSoon && PICTURE_COMPATIBLE_EXERCISES.includes(ex.id))
          .map(ex => ex.id);
        const availableOtherExercises = AVAILABLE_EXERCISES
          .filter(ex => !ex.comingSoon && !PICTURE_COMPATIBLE_EXERCISES.includes(ex.id) && ex.id !== 'reading')
          .map(ex => ex.id);
        
        const shuffledPicture = [...availablePictureExercises].sort(() => Math.random() - 0.5);
        const selectedPicture = shuffledPicture.slice(0, Math.min(2, availablePictureExercises.length));
        
        const remainingSlots = maxExercises - selectedPicture.length;
        const shuffledOther = [...availableOtherExercises].sort(() => Math.random() - 0.5);
        const selectedOther = shuffledOther.slice(0, remainingSlots);
        
        newExercises = [...selectedPicture, ...selectedOther];
        console.log('🎲 [MEDIA-TOGGLE-RANDOM-PICTURE] Selected exercises:', newExercises);
      } else if (tempMediaTypes.includes('audio')) {
        const availableAudioExercises = AVAILABLE_EXERCISES
          .filter(ex => !ex.comingSoon && AUDIO_COMPATIBLE_EXERCISES.includes(ex.id))
          .map(ex => ex.id);
        const availableOtherExercises = AVAILABLE_EXERCISES
          .filter(ex => !ex.comingSoon && !AUDIO_COMPATIBLE_EXERCISES.includes(ex.id))
          .map(ex => ex.id);
        
        const shuffledAudio = [...availableAudioExercises].sort(() => Math.random() - 0.5);
        const selectedAudio = shuffledAudio.slice(0, Math.min(2, availableAudioExercises.length));
        
        const remainingSlots = maxExercises - selectedAudio.length;
        const shuffledOther = [...availableOtherExercises].sort(() => Math.random() - 0.5);
        const selectedOther = shuffledOther.slice(0, remainingSlots);
        
        newExercises = [...selectedAudio, ...selectedOther];
        console.log('🎲 [MEDIA-TOGGLE-RANDOM-AUDIO] Selected exercises:', newExercises);
      } else {
        const availableExercises = AVAILABLE_EXERCISES
          .filter(ex => !ex.comingSoon && !ex.pictureRequired && !ex.audioRequired)
          .map(ex => ex.id);
        const shuffled = [...availableExercises].sort(() => Math.random() - 0.5);
        newExercises = shuffled.slice(0, maxExercises);
        console.log('🎲 [MEDIA-TOGGLE-RANDOM-NONE] Selected exercises:', newExercises);
      }
    } else {
      // Manual mode: use predefined defaults
      if (newMediaTypes.includes('picture')) {
        newExercises = lessonTime === '45min' ? MANUAL_EXERCISES_45MIN_PICTURE : MANUAL_EXERCISES_60MIN_PICTURE;
      } else if (newMediaTypes.includes('audio')) {
        newExercises = lessonTime === '45min' ? MANUAL_EXERCISES_45MIN_AUDIO : MANUAL_EXERCISES_60MIN_AUDIO;
      } else {
        newExercises = lessonTime === '45min' ? MANUAL_EXERCISES_45MIN : MANUAL_EXERCISES_60MIN;
      }
    }
    
    onChange(newExercises);
  }, [selectedMediaTypes, lessonTime, onChange, onMediaTypesChange, selectionMode, maxExercises]);

  return (
    <div className="space-y-4">
      {/* Media Enhanced Options */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Media Enhanced</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {MEDIA_ENHANCED_OPTIONS.map(media => {
            const isSelected = selectedMediaTypes.includes(media.id as MediaType);
            const isPicture = media.id === 'picture';
            const isAudio = media.id === 'audio';
            const isDisabled = !isPicture && !isAudio;
            
            return (
              <button 
                key={media.id} 
                type="button" 
                disabled={isDisabled}
                onClick={() => !isDisabled && handleMediaToggle(media.id as MediaType)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isDisabled
                    ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-worksheet-purple bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-worksheet-purple hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">{media.icon}</span>
                  <span className={`font-medium text-sm ${isSelected ? 'text-worksheet-purple' : isDisabled ? 'text-gray-500' : 'text-gray-700'}`}>
                    {media.label}
                  </span>
                  {isDisabled && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded ml-auto">Coming Soon</span>
                  )}
                  {isSelected && !isDisabled && (
                    <span className="text-xs bg-worksheet-purple text-white px-2 py-1 rounded ml-auto">Active</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* All Exercise Types */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Exercise Types</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedExercises.length}/{maxExercises}
            </span>
            {selectedExercises.length < maxExercises && (
              <span className="text-xs text-worksheet-purple font-medium">
                Select {maxExercises - selectedExercises.length} more exercises
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {AVAILABLE_EXERCISES
            .filter(ex => !ex.deprecated)
            .filter(ex => {
              const isPictureMode = selectedMediaTypes.includes('picture');
              const isAudioMode = selectedMediaTypes.includes('audio');
              
              // Picture mode: Show picture-required + basic exercises (exclude audio-only)
              if (isPictureMode) {
                return ex.pictureRequired || (!ex.audioRequired && !ex.pictureRequired);
              }
              
              // Audio mode: Show audio-required + basic exercises (exclude picture-only)
              if (isAudioMode) {
                return ex.audioRequired || (!ex.audioRequired && !ex.pictureRequired);
              }
              
              // No media mode: Show ONLY basic exercises (exclude both picture and audio)
              return !ex.pictureRequired && !ex.audioRequired;
            })
            .map(exercise => {
              const isSelected = selectedExercises.includes(exercise.id);
              const isPictureMode = selectedMediaTypes.includes('picture');
              const isAudioMode = selectedMediaTypes.includes('audio');
              const isPictureExercise = exercise.pictureRequired;
              const isAudioExercise = exercise.audioRequired;
              // v4.6: editing allowed in both manual AND smart (teacher can tweak AI picks).
              const isEditable = selectionMode === 'manual' || selectionMode === 'smart';
              const canSelect = isEditable && (isSelected || selectedExercises.length < maxExercises) && !exercise.comingSoon;
              const isDisabled = !isEditable || (exercise.comingSoon || (!isSelected && selectedExercises.length >= maxExercises));
              
              return (
                <div key={exercise.id} className={`relative group flex items-start gap-1.5 p-2 rounded-lg border transition-colors overflow-hidden ${
                  exercise.comingSoon 
                    ? 'bg-gray-100 border-gray-200 opacity-60' 
                    : isSelected
                    ? (isPictureMode && isPictureExercise) || (isAudioMode && isAudioExercise)
                      ? 'bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 border-worksheet-purple shadow-sm'
                      : 'bg-worksheet-purpleLight border-worksheet-purple'
                    : canSelect 
                    ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                    : 'bg-gray-100 border-gray-200 opacity-50'
                }`}>
                  <Checkbox 
                    id={exercise.id} 
                    checked={isSelected} 
                    onCheckedChange={checked => handleExerciseToggle(exercise.id, !!checked)} 
                    disabled={isDisabled} 
                    className="flex-shrink-0 mt-0.5 data-[state=checked]:bg-worksheet-purple data-[state=checked]:border-worksheet-purple" 
                  />
                  <label htmlFor={exercise.id} className={`flex-1 min-w-0 flex items-center gap-1.5 text-xs font-medium cursor-pointer ${exercise.comingSoon ? 'text-gray-400' : canSelect || isSelected ? 'text-gray-700' : 'text-gray-400'}`}>
                    <span className="text-base flex-shrink-0">{exercise.icon}</span>
                    <span className="leading-tight truncate">{exercise.label}</span>
                    {exercise.badge && (
                      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        exercise.badge === 'Picture' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'bg-blue-500 text-white'
                      }`}>
                        {exercise.badge}
                      </span>
                    )}
                    {exercise.comingSoon && (
                      <span className="flex-shrink-0 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Soon</span>
                    )}
                  </label>

                  {/* V/G Focus toggles — stacked vertically next to Audio/Picture badge to avoid overlap */}
                  {isSelected && isEditable && (
                    <div className="flex flex-col gap-0.5 flex-shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusChange?.(exercise.id, 
                            exerciseFocusMap?.[exercise.id] === 'vocabulary' ? undefined : 'vocabulary'
                          );
                        }}
                        className={`text-[9px] leading-none px-1 py-0.5 rounded font-bold transition-colors ${
                          exerciseFocusMap?.[exercise.id] === 'vocabulary'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-500 hover:bg-blue-100'
                        }`}
                        title="Vocabulary Focus"
                      >
                        V
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFocusChange?.(exercise.id, 
                            exerciseFocusMap?.[exercise.id] === 'grammar' ? undefined : 'grammar'
                          );
                        }}
                        className={`text-[9px] leading-none px-1 py-0.5 rounded font-bold transition-colors ${
                          exerciseFocusMap?.[exercise.id] === 'grammar'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 text-gray-500 hover:bg-purple-100'
                        }`}
                        title="Grammar Focus"
                      >
                        G
                      </button>
                    </div>
                  )}
                  
                  {/* Tooltip */}
                  <div 
                    className="absolute left-1/2 bottom-full transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10 pointer-events-none max-w-xs text-center"
                    style={{ transitionDelay: '1s' }}
                  >
                    {exercise.description}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Selection Info */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Current mode:</span> {selectionMode.charAt(0).toUpperCase() + selectionMode.slice(1)}
          {selectionMode === 'manual' && " - Select and deselect exercises by clicking the checkboxes above"}
          {selectionMode === 'random' && " - A new random selection will be generated each time you switch to this mode"}
        </p>
        
        {selectedMediaTypes.includes('picture') && selectionMode === 'manual' && (
          <p className="mt-2 text-sm text-blue-700 font-medium bg-blue-50 p-2 rounded">
            📸 Picture Mode Active: Please select at least one picture-based exercise (marked with "Picture" badge)
          </p>
        )}
        
        {selectedMediaTypes.includes('audio') && selectionMode === 'manual' && (
          <p className="mt-2 text-sm text-blue-700 font-medium bg-blue-50 p-2 rounded">
            🎧 Audio Mode Active: Please select at least one audio-based exercise (marked with "Audio" badge)
          </p>
        )}
        
        {selectedExercises.length === maxExercises && (
          <p className="mt-2 text-sm text-worksheet-purple font-medium">
            Perfect! You have selected all {maxExercises} exercises for your {lessonTime} lesson.
          </p>
        )}
      </div>
    </div>
  );
}
