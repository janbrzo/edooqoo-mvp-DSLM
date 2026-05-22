
// Exercise validation functions

/**
 * Validates a single exercise based on its type
 * Now with LENIENT mode for new exercise types to prevent 500 errors
 */
export function validateExercise(exercise: any): void {
  if (!exercise || typeof exercise !== 'object') {
    throw new Error('Exercise must be an object');
  }
  
  if (!exercise.type || typeof exercise.type !== 'string') {
    throw new Error('Exercise must have a valid type');
  }

  // NEW EXERCISE TYPES - Use lenient validation (warnings instead of errors)
  const NEW_EXERCISE_TYPES = [
    'odd-one-out', 'synonyms', 'antonyms', 'synonyms-antonyms', 'sentence-transformation', 
    'word-order', 'gap-text', 'negative-prefixes', 'paraphrasing',
    'complete-word', 'categorize', 'matching-halves',
    // Picture mode variants
    'multiple-choice-picture', 'true-false-picture', 'matching-picture',
    'fill-in-blanks-picture', 'categorize-picture', 'word-order-picture',
    'describe-picture', 'answer-questions-picture',
    // Audio mode variants
    'listening-comprehension', 'multiple-choice-audio', 'true-false-audio',
    'fill-in-blanks-audio', 'answer-questions-audio'
  ];
  
  const isNewExercise = NEW_EXERCISE_TYPES.includes(exercise.type);
  
  // Type-specific validation
  try {
    switch (exercise.type) {
    case 'reading':
      validateReadingExercise(exercise);
      break;
    case 'matching':
      validateMatchingExercise(exercise);
      break;
    case 'fill-in-blanks':
      validateFillInBlanksExercise(exercise);
      break;
    case 'multiple-choice':
      validateMultipleChoiceExercise(exercise);
      break;
    case 'dialogue':
      validateDialogueExercise(exercise);
      break;
    case 'true-false':
      validateTrueFalseExercise(exercise);
      break;
    case 'discussion':
      validateDiscussionExercise(exercise);
      break;
    case 'error-correction':
      validateErrorCorrectionExercise(exercise);
      break;
    // New Phase 1 exercise validations
    case 'odd-one-out':
      validateOddOneOutExercise(exercise);
      break;
    case 'synonyms':
      validateSynonymsAntonymsExercise(exercise);
      break;
    case 'antonyms':
      validateSynonymsAntonymsExercise(exercise);
      break;
    case 'synonyms-antonyms':
      validateSynonymsAntonymsExercise(exercise);
      break;
    case 'sentence-transformation':
      validateSentenceTransformationExercise(exercise);
      break;
    case 'word-order':
      validateWordOrderExercise(exercise);
      break;
    case 'gap-text':
      validateGapTextExercise(exercise);
      break;
    case 'negative-prefixes':
      validateNegativePrefixesExercise(exercise);
      break;
    // LENIENT: Handle new exercise types that might not have validators yet
    case 'paraphrasing':
    case 'complete-word':
    case 'categorize':
    case 'matching-halves':
      validateBasicExerciseStructure(exercise);
      break;
    case 'describe-picture':
      validateDescribePictureExercise(exercise);
      break;
    case 'answer-questions':
      validateAnswerQuestionsExercise(exercise);
      break;
    // Picture mode variants - use same validators as base exercises
    case 'multiple-choice-picture':
      validateMultipleChoiceExercise(exercise);
      break;
    case 'true-false-picture':
      validateTrueFalseExercise(exercise);
      break;
    case 'answer-questions-picture':
      validateAnswerQuestionsExercise(exercise);
      break;
    // Audio exercises
    case 'listening-comprehension':
      validateListeningComprehensionExercise(exercise);
      break;
    case 'multiple-choice-audio':
      validateMultipleChoiceExercise(exercise);
      break;
    case 'true-false-audio':
      validateTrueFalseExercise(exercise);
      break;
    case 'fill-in-blanks-audio':
      validateFillInBlanksAudioExercise(exercise);
      break;
    case 'answer-questions-audio':
      validateAnswerQuestionsExercise(exercise);
      break;
    default:
      console.warn(`🔧 [VALIDATOR] Unknown exercise type: ${exercise.type} - allowing with basic validation`);
      validateBasicExerciseStructure(exercise);
    }
  } catch (validationError) {
    if (isNewExercise) {
      // LENIENT MODE: Convert errors to warnings for new exercise types
      const errorMessage = validationError instanceof Error ? validationError.message : 'Unknown validation error';
      console.warn(`Validation warning for ${exercise.type}: ${errorMessage}`);
    } else {
      // STRICT MODE: Still throw errors for established exercise types
      throw validationError;
    }
  }
}

function validateReadingExercise(exercise: any): void {
  if (!exercise.content || typeof exercise.content !== 'string') {
    throw new Error('Reading exercise must have content');
  }
  
  const wordCount = exercise.content.split(/\s+/).filter(Boolean).length;
  if (wordCount < 200 || wordCount > 400) {
    console.warn(`Reading exercise word count (${wordCount}) outside recommended range of 200-400 words`);
  }
  
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length < 5) {
    throw new Error('Reading exercise must have at least 5 questions');
  }
}

function validateMatchingExercise(exercise: any): void {
  if (!exercise.items || !Array.isArray(exercise.items) || exercise.items.length < 5) {
    throw new Error('Matching exercise must have at least 5 items');
  }
  
  for (const item of exercise.items) {
    if (!item.term || !item.definition) {
      throw new Error('Each matching item must have both term and definition');
    }
  }
}

function validateFillInBlanksExercise(exercise: any): void {
  if (!exercise.sentences || !Array.isArray(exercise.sentences) || exercise.sentences.length < 5) {
    throw new Error('Fill-in-blanks exercise must have at least 5 sentences');
  }
  
  if (!exercise.word_bank || !Array.isArray(exercise.word_bank) || exercise.word_bank.length < 5) {
    throw new Error('Fill-in-blanks exercise must have a word bank with at least 5 words');
  }
}

function validateMultipleChoiceExercise(exercise: any): void {
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length < 5) {
    throw new Error('Multiple choice exercise must have at least 5 questions');
  }
  
  for (const question of exercise.questions) {
    if (!question.options || !Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error('Each multiple choice question must have exactly 4 options');
    }
    
    const correctCount = question.options.filter((opt: any) => opt.correct).length;
    if (correctCount !== 1) {
      throw new Error('Each multiple choice question must have exactly one correct answer');
    }
  }
}

function validateDialogueExercise(exercise: any): void {
  if (!exercise.dialogue || !Array.isArray(exercise.dialogue) || exercise.dialogue.length < 5) {
    throw new Error('Dialogue exercise must have at least 5 exchanges');
  }
  
  if (!exercise.expressions || !Array.isArray(exercise.expressions) || exercise.expressions.length < 5) {
    throw new Error('Dialogue exercise must have at least 5 expressions');
  }
}

function validateTrueFalseExercise(exercise: any): void {
  if (!exercise.statements || !Array.isArray(exercise.statements) || exercise.statements.length < 5) {
    throw new Error('True/False exercise must have at least 5 statements');
  }
  
  for (const statement of exercise.statements) {
    if (typeof statement.isTrue !== 'boolean') {
      throw new Error('Each true/false statement must have a boolean isTrue property');
    }
  }
}

function validateDiscussionExercise(exercise: any): void {
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length < 5) {
    throw new Error('Discussion exercise must have at least 5 questions');
  }
}

function validateErrorCorrectionExercise(exercise: any): void {
  if (!exercise.sentences || !Array.isArray(exercise.sentences) || exercise.sentences.length < 5) {
    throw new Error('Error correction exercise must have at least 5 sentences');
  }
  
  for (const sentence of exercise.sentences) {
    if (!sentence.text || !sentence.correction) {
      throw new Error('Each error correction sentence must have both text and correction');
    }
  }
}

// New Phase 1 exercise validation functions (RELAXED FOR TESTING)
function validateOddOneOutExercise(exercise: any): void {
  // ✅ Changed from 'groups' to 'questions' to match frontend component
  if (!exercise.questions || !Array.isArray(exercise.questions)) {
    throw new Error('Odd One Out exercise must have questions array');
  }
  
  // Check for exactly 10 questions (as per requirements)
  if (exercise.questions.length !== 10) {
    console.warn(`⚠️ [VALIDATOR] Odd One Out has ${exercise.questions.length} questions (expected: 10)`);
  }
  
  // Validate each question has 5 options and a correct_answer
  for (const question of exercise.questions) {
    if (!question.options || !Array.isArray(question.options) || question.options.length !== 5) {
      throw new Error('Each Odd One Out question must have exactly 5 options');
    }
    if (!question.correct_answer || typeof question.correct_answer !== 'string') {
      throw new Error('Each Odd One Out question must have a correct_answer');
    }
  }
}

function validateSynonymsAntonymsExercise(exercise: any): void {
  // Handle both 'pairs' and 'items' field names (items is the new standard)
  const dataArray = exercise.items || exercise.pairs;
  
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length < 5) {
    throw new Error('Synonyms/Antonyms exercise must have at least 5 pairs');
  }
  
  for (const pair of dataArray) {
    // Support both old format (word/match) and new format (term/definition)
    const hasOldFormat = pair.word && pair.match;
    const hasNewFormat = pair.term && pair.definition;
    
    if (!hasOldFormat && !hasNewFormat) {
      throw new Error('Each synonym/antonym pair must have either (word, match) or (term, definition) properties');
    }
  }
}

function validateSentenceTransformationExercise(exercise: any): void {
  const dataArray = exercise.transformations || exercise.sentences;
  if (!dataArray || !Array.isArray(dataArray) || dataArray.length < 5) {
    throw new Error('Sentence Transformation exercise must have at least 5 transformations');
  }
  
  for (const item of dataArray) {
    if (!item.original) {
      throw new Error('Each transformation must have an original sentence');
    }
  }
}

function validateWordOrderExercise(exercise: any): void {
  if (!exercise.sentences || !Array.isArray(exercise.sentences) || exercise.sentences.length < 5) {
    throw new Error('Word Order exercise must have at least 5 sentences');
  }
  
  for (const sentence of exercise.sentences) {
    if (!sentence.scrambled_words && !sentence.correct_order) {
      throw new Error('Each word order sentence must have scrambled_words or correct_order');
    }
  }
}

function validateGapTextExercise(exercise: any): void {
  if (!exercise.sentences || !Array.isArray(exercise.sentences) || exercise.sentences.length < 5) {
    throw new Error('Gap Text exercise must have at least 5 sentences');
  }
  
  for (const sentence of exercise.sentences) {
    if (!sentence.text) {
      throw new Error('Each gap text sentence must have text');
    }
  }
}

function validateNegativePrefixesExercise(exercise: any): void {
  if (!exercise.words || !Array.isArray(exercise.words) || exercise.words.length < 5) {
    throw new Error('Negative Prefixes exercise must have at least 5 words');
  }
  
  for (const word of exercise.words) {
    if (!word.base_word) {
      throw new Error('Each negative prefix word must have base_word');
    }
  }
}

function validateDescribePictureExercise(exercise: any): void {
  if (!exercise.instructions && !exercise.description) {
    throw new Error('Describe Picture exercise must have instructions or description');
  }
  
  // INFO: image_url is optional - image is provided via selectedImage prop to MediaSection
  if (!exercise.image_url) {
    console.info('[INFO] Describe Picture exercise without image_url field (image will be provided via selectedImage in MediaSection)');
  }
}

function validateAnswerQuestionsExercise(exercise: any): void {
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length < 3) {
    throw new Error('Answer Questions exercise must have at least 3 questions');
  }
  
  for (const question of exercise.questions) {
    if (!question.question && !question.text) {
      throw new Error('Each question must have question or text property');
    }
  }
}

/**
 * FALLBACK: Basic validation for unknown or new exercise types
 * This ensures any exercise can be saved even if it doesn't have a specific validator
 */
function validateBasicExerciseStructure(exercise: any): void {
  if (!exercise.time || typeof exercise.time !== 'number') {
    exercise.time = 10; // Set default time
  }
  
  if (!exercise.icon) {
    exercise.icon = 'fa-tasks'; // Set default icon
  }
}

/**
 * Validates Listening Comprehension exercise (audio)
 */
function validateListeningComprehensionExercise(exercise: any): void {
  if (!exercise.questions || !Array.isArray(exercise.questions) || exercise.questions.length < 8) {
    throw new Error('Listening Comprehension exercise must have at least 8 questions');
  }
  
  for (const question of exercise.questions) {
    if (!question.text || typeof question.text !== 'string') {
      throw new Error('Each question must have a text property');
    }
    if (!question.answer || typeof question.answer !== 'string') {
      throw new Error('Each question must have an answer property');
    }
  }
}

/**
 * Validates Fill in Blanks Audio exercise (dictation)
 */
function validateFillInBlanksAudioExercise(exercise: any): void {
  if (!exercise.transcript_with_blanks || typeof exercise.transcript_with_blanks !== 'string') {
    throw new Error('Fill in Blanks Audio must have transcript_with_blanks');
  }
  
  if (!exercise.answers || !Array.isArray(exercise.answers) || exercise.answers.length < 10) {
    throw new Error('Fill in Blanks Audio must have at least 10 answers');
  }
  
  if (!exercise.full_transcript || typeof exercise.full_transcript !== 'string') {
    throw new Error('Fill in Blanks Audio must have full_transcript');
  }
}
