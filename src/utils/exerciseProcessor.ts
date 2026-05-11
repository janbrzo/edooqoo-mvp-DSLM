
import { shuffleArray, createSampleVocabulary } from "./worksheetUtils";
import { getExerciseTimeByType, validateWorksheetTimes } from "./timeCalculator";

/**
 * PROBLEM 4 FIX: Official exercise type names for consistent titles
 */
const EXERCISE_TYPE_NAMES: Record<string, string> = {
  'reading': 'Reading Comprehension',
  'true-false': 'True/False Questions',
  'true-false-picture': 'True/False (Picture)',
  'true-false-audio': 'True/False (Audio)',
  'matching': 'Vocabulary Matching',
  'matching-halves': 'Matching Halves',
  'fill-in-blanks': 'Fill in the Blanks',
  'fill-in-blanks-audio': 'Fill in the Blanks (Audio)',
  'multiple-choice': 'Multiple Choice',
  'multiple-choice-picture': 'Multiple Choice (Picture)',
  'multiple-choice-audio': 'Multiple Choice (Audio)',
  'dialogue': 'Dialogue Practice',
  'discussion': 'Discussion Questions',
  'answer-questions': 'Answer Questions',
  'answer-questions-picture': 'Answer Questions (Picture)',
  'answer-questions-audio': 'Answer Questions (Audio)',
  'describe-picture': 'Describe Picture',
  'listening-comprehension': 'Listening Comprehension',
  'paraphrasing': 'Paraphrasing',
  'sentence-transformation': 'Sentence Transformation',
  'word-order': 'Word Order',
  'gap-text': 'Gap Text (Cloze)',
  'error-correction': 'Error Correction',
  'odd-one-out': 'Odd One Out',
  'negative-prefixes': 'Negative Prefixes',
  'categorize': 'Categorization',
  'complete-word': 'Complete Word',
  'synonyms': 'Synonyms',
  'antonyms': 'Antonyms',
  'synonyms-antonyms': 'Synonyms/Antonyms',
  'writing-task': 'Writing Task',
  'essay': 'Essay',
  'speaking': 'Speaking Practice',
};

export const getOfficialExerciseName = (type: string): string => {
  if (EXERCISE_TYPE_NAMES[type]) {
    return EXERCISE_TYPE_NAMES[type];
  }
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export const processExercises = (exercises: any[], lessonTime: string = '45min', hasGrammar: boolean = true): any[] => {
  console.log('🔧 Processing exercises - Starting with:', exercises.length, 'exercises');
  console.log('🔧 Lesson config:', { lessonTime, hasGrammar });
  
  // Normalize lesson time format to remove spaces
  const normalizedLessonTime = lessonTime.replace(/\s+/g, '');
  console.log('🔧 Normalized lesson time:', normalizedLessonTime);
  
  const processedExercises = exercises.map((exercise: any, index: number) => {
    console.log(`🔧 Processing exercise ${index + 1}: ${exercise.type}`);
    
    // PROBLEM 6 FIX: Preserve AI-generated description in exercise titles
    const officialName = getOfficialExerciseName(exercise.type);
    const aiTitle = exercise.title || '';
    const cleanAiTitle = aiTitle.replace(/^Exercise\s+\d+:\s*/i, '').trim();
    const aiDesc = cleanAiTitle
      .replace(new RegExp(`^${officialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-:]?\\s*`, 'i'), '')
      .trim();
    exercise.title = aiDesc 
      ? `Exercise ${index + 1}: ${officialName}: ${aiDesc}` 
      : `Exercise ${index + 1}: ${officialName}`;
    
    // Assign fixed time based on exercise type, lesson duration, and grammar presence
    exercise.time = getExerciseTimeByType(exercise.type, normalizedLessonTime, hasGrammar);
    console.log(`🔧 Assigned ${exercise.time} minutes to ${exercise.type} exercise (lessonTime: ${normalizedLessonTime}, hasGrammar: ${hasGrammar})`);
    
    if (exercise.type === "matching" && exercise.items) {
      exercise.originalItems = [...exercise.items];
      exercise.shuffledTerms = shuffleArray([...exercise.items]);
      console.log(`🔧 Processed matching exercise with ${exercise.items.length} items`);
    }
    
    // FIXED: Multiple choice questions processing with randomized correct answer positions
    if (exercise.type === "multiple-choice" && exercise.questions) {
      exercise.questions = exercise.questions.map((question: any) => {
        if (question.options && question.options.length >= 2) {
          console.log('🔧 Processing multiple choice question options');
          
          // Get all unique option texts while preserving their correct status
          const uniqueTexts = new Set();
          const uniqueOptions = [];
          
          // First, collect all unique options with their original correct status
          question.options.forEach((opt: any) => {
            if (!uniqueTexts.has(opt.text)) {
              uniqueTexts.add(opt.text);
              uniqueOptions.push({
                text: opt.text,
                correct: opt.correct || false // Preserve original correct status
              });
            }
          });
          
          // Add generic options if we don't have enough unique ones
          while (uniqueOptions.length < 4) {
            const genericText = `Option ${uniqueOptions.length + 1}`;
            if (!uniqueTexts.has(genericText)) {
              uniqueOptions.push({
                text: genericText,
                correct: false // Generic options are never correct
              });
            }
          }
          
          // Take only first 4 options
          const fourOptions = uniqueOptions.slice(0, 4);
          
          // FIXED: Randomize the position of the correct answer for equal ABCD distribution
          const correctAnswerIndex = fourOptions.findIndex(opt => opt.correct);
          
          // If we have a correct answer, randomize its position
          if (correctAnswerIndex !== -1) {
            const correctAnswer = fourOptions[correctAnswerIndex];
            
            // Remove the correct answer from its current position
            fourOptions.splice(correctAnswerIndex, 1);
            
            // Generate a random position (0-3) for the correct answer
            const randomPosition = Math.floor(Math.random() * 4);
            
            // Insert the correct answer at the random position
            fourOptions.splice(randomPosition, 0, correctAnswer);
            
            console.log(`🔧 Moved correct answer to position ${randomPosition + 1} (${String.fromCharCode(65 + randomPosition)})`);
          } else {
            // If no correct answer exists, make the first option correct and randomize its position
            fourOptions[0].correct = true;
            const correctAnswer = fourOptions[0];
            fourOptions.splice(0, 1);
            
            const randomPosition = Math.floor(Math.random() * 4);
            fourOptions.splice(randomPosition, 0, correctAnswer);
            
            console.log(`🔧 Set first option as correct and moved to position ${randomPosition + 1} (${String.fromCharCode(65 + randomPosition)})`);
          }
          
          // Ensure only one option is marked as correct
          fourOptions.forEach((opt, idx) => {
            if (idx === fourOptions.findIndex(o => o.correct)) {
              opt.correct = true;
            } else {
              opt.correct = false;
            }
          });
          
          // Assign labels A, B, C, D to the final options
          const finalOptions = fourOptions.map((opt, idx) => ({
            text: opt.text,
            correct: opt.correct,
            label: String.fromCharCode(65 + idx) // A, B, C, D
          }));
          
          question.options = finalOptions;
          console.log('🔧 Fixed multiple choice options:', question.options.map(o => `${o.label}: ${o.text} (${o.correct ? 'CORRECT' : 'incorrect'})`));
        }
        return question;
      });
      console.log(`🔧 Processed multiple-choice exercise with ${exercise.questions.length} questions`);
    }

    // New Phase 1 exercise processing
    if (exercise.type === "odd-one-out" && exercise.questions) {
      exercise.questions = exercise.questions.map((question: any) => {
        // Ensure each question has 5 options and a correct answer
        if (!question.options || question.options.length < 5) {
          question.options = question.options || [];
          while (question.options.length < 5) {
            question.options.push(`Option ${question.options.length + 1}`);
          }
        }
        // Ensure correct answer is specified (usually the last option)
        if (!question.correct_answer) {
          question.correct_answer = "E"; // Default to E
        }
        return question;
      });
      console.log(`🔧 Processed odd-one-out exercise with ${exercise.questions.length} questions`);
    }

    if (exercise.type === "synonyms" || exercise.type === "antonyms" || exercise.type === "synonyms-antonyms" && exercise.items) {
      // Shuffle items for variety but maintain pairs
      exercise.originalItems = [...exercise.items];
      console.log(`🔧 Processed ${exercise.type} exercise with ${exercise.items.length} pairs`);
    }

    if (exercise.type === "sentence-transformation" && exercise.sentences) {
      // Ensure each sentence has the required fields
      exercise.sentences = exercise.sentences.map((sentence: any) => {
        if (!sentence.instruction) {
          sentence.instruction = "Transform the sentence as indicated";
        }
        return sentence;
      });
      console.log(`🔧 Processed sentence-transformation exercise with ${exercise.sentences.length} sentences`);
    }

    if (exercise.type === "word-order" && exercise.sentences) {
      // Ensure scrambled words format is consistent
      exercise.sentences = exercise.sentences.map((sentence: any) => {
        if (sentence.scrambled_words && typeof sentence.scrambled_words === 'string') {
          // Ensure proper formatting with " / " separators
          sentence.scrambled_words = sentence.scrambled_words.replace(/\s*\/\s*/g, ' / ');
        }
        return sentence;
      });
      console.log(`🔧 Processed word-order exercise with ${exercise.sentences.length} sentences`);
    }

    if (exercise.type === "gap-text" && exercise.sentences) {
      // Shuffle word bank if provided
      if (exercise.word_bank && exercise.word_bank.length > 0) {
        exercise.originalWordBank = [...exercise.word_bank];
        exercise.word_bank = shuffleArray([...exercise.word_bank]);
      }
      console.log(`🔧 Processed gap-text exercise with ${exercise.sentences.length} sentences`);
    }

    if (exercise.type === "negative-prefixes" && exercise.words) {
      // Ensure each word has required fields
      exercise.words = exercise.words.map((word: any) => {
        if (!word.base_word || !word.prefix) {
          console.warn(`🔧 Missing base_word or prefix for negative prefix word:`, word);
        }
        return word;
      });
      console.log(`🔧 Processed negative-prefixes exercise with ${exercise.words.length} words`);
    }

    // PROBLEM 4 FIX: Process describe-picture exercises to ensure prompts exist
    if (exercise.type === 'describe-picture' || exercise.type === 'describe') {
      const prompts = exercise.prompts || exercise.questions || [];
      console.log(`🔧 Processing describe-picture exercise, found ${prompts.length} prompts`);
      
      // If no prompts/questions exist, generate default guiding questions
      if (prompts.length === 0) {
        exercise.prompts = [
          "What do you see in the image? Describe the main elements.",
          "What is happening in the scene? Describe any actions or activities.",
          "What colors, shapes, or patterns can you identify?",
          "How would you describe the mood or atmosphere of this image?",
          "What might have happened before this moment? Make a prediction.",
          "What might happen next? Use your imagination.",
          "If you could step into this image, what would you hear, smell, or feel?",
          "How does this image make you feel? Explain your emotional response.",
          "What questions would you ask about this image?",
          "Create a short story or narrative inspired by this image."
        ];
        console.log(`🔧 Added 10 default prompts to describe-picture exercise`);
      } else if (prompts.length < 5) {
        // Ensure at least 5 prompts
        const additionalPrompts = [
          "What additional details can you observe in the image?",
          "How would you describe the setting or location?",
          "What is the most interesting element in this image and why?",
          "Compare and contrast different elements you see.",
          "What title would you give this image and why?"
        ];
        while (exercise.prompts && exercise.prompts.length < 5 && additionalPrompts.length > 0) {
          exercise.prompts.push(additionalPrompts.shift()!);
        }
        console.log(`🔧 Padded describe-picture prompts to ${exercise.prompts.length}`);
      } else {
        // Prompts exist - ensure they're in the right field
        exercise.prompts = prompts;
      }
    }
    
    if (exercise.type === 'reading' && exercise.content) {
      const wordCount = exercise.content.split(/\s+/).filter(Boolean).length;
      console.log(`🔧 Reading exercise word count: ${wordCount}`);
      
      if (!exercise.questions || exercise.questions.length < 5) {
        if (!exercise.questions) exercise.questions = [];
        while (exercise.questions.length < 5) {
          exercise.questions.push({
            text: `Additional question ${exercise.questions.length + 1} about the text.`,
            answer: "Answer would be based on the text content."
          });
        }
        console.log(`🔧 Added missing questions to reading exercise`);
      }
    }
    
    return exercise;
  });
  
  // Validate total exercise times
  const exerciseTimes = processedExercises.map(ex => ex.time || 0);
  const targetTime = normalizedLessonTime === '45min' ? 45 : 60;
  const warmupTime = 5;
  const grammarTime = hasGrammar ? (normalizedLessonTime === '45min' ? 10 : 15) : 0;
  
  const validation = validateWorksheetTimes(warmupTime, grammarTime, exerciseTimes, targetTime);
  
  console.log(`🔧 Exercise times breakdown:`, {
    exercises: processedExercises.map((ex, idx) => `${ex.type}: ${ex.time}min`),
    totalExerciseTime: exerciseTimes.reduce((sum, time) => sum + time, 0),
    warmup: warmupTime,
    grammar: grammarTime,
    actualTotal: validation.actualTime,
    targetTotal: targetTime
  });
  
  if (!validation.isValid) {
    console.warn(`⚠️ Worksheet time validation failed:`, {
      target: targetTime,
      actual: validation.actualTime,
      difference: validation.difference,
      breakdown: {
        warmup: warmupTime,
        grammar: grammarTime,
        exercises: exerciseTimes,
        exercisesSum: exerciseTimes.reduce((sum, time) => sum + time, 0)
      }
    });
  } else {
    console.log(`✅ Worksheet times validated successfully: ${validation.actualTime}/${targetTime} minutes`);
  }
  
  console.log('🔧 Processing exercises - Completed with:', processedExercises.length, 'exercises');
  return processedExercises;
};
