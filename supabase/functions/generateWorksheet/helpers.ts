// Helper functions used in the worksheet generator

/**
 * Gets exercise types based on count of exercises needed
 * Now uses constant sets for consistent generation
 * UPDATED: Moved true-false to position 2 (after reading)
 * ENHANCED: Supports custom selected exercises from form
 */
export function getExerciseTypesForCount(count: number, selectedExercises?: string[]): string[] {
  // If custom exercises are selected, validate and use them
  if (selectedExercises && selectedExercises.length > 0) {
    return validateAndFilterExercises(selectedExercises, count);
  }
  
  // Standard 8-exercise set (60 min lessons) - NEW ORDER with true-false as Exercise 2
  const fullSet = [
    'reading',           // Exercise 1
    'true-false',        // Exercise 2 - Now directly after reading
    'matching',          // Exercise 3 - Was 2
    'fill-in-blanks',    // Exercise 4 - Was 3
    'multiple-choice',   // Exercise 5 - Was 4
    'dialogue',          // Exercise 6 - Was 5
    'discussion',        // Exercise 7 - Was 7 (unchanged)
    'error-correction'   // Exercise 8 - Was 8 (unchanged)
  ];
  
  return fullSet.slice(0, count);
}

/**
 * Normalizes exercise ID by removing -picture or -audio suffix
 * Returns both the base ID and flags for picture/audio requirements
 */
export function normalizeExerciseId(exerciseId: string): { baseId: string; usePicture: boolean; useAudio: boolean } {
  if (exerciseId.endsWith('-picture')) {
    return {
      baseId: exerciseId.replace('-picture', ''),
      usePicture: true,
      useAudio: false
    };
  }
  if (exerciseId.endsWith('-audio')) {
    return {
      baseId: exerciseId.replace('-audio', ''),
      usePicture: false,
      useAudio: true
    };
  }
  // Special case: listening-comprehension is audio-only but doesn't have -audio suffix
  if (exerciseId === 'listening-comprehension') {
    return {
      baseId: exerciseId,
      usePicture: false,
      useAudio: true
    };
  }
  return {
    baseId: exerciseId,
    usePicture: false,
    useAudio: false
  };
}

/**
 * Validates and filters selected exercises from the form
 * Ensures exercises exist and respects count limit
 * UPDATED: Now handles -picture suffix
 */
export function validateAndFilterExercises(selectedExercises: string[], maxCount: number): string[] {
  // All available exercise types (matching individual-exercises.ts)
  const availableTypes = [
    'reading', 'true-false', 'matching', 'fill-in-blanks', 
    'multiple-choice', 'dialogue', 'discussion', 'error-correction',
    'odd-one-out', 'synonyms', 'antonyms', 'synonyms-antonyms', 'sentence-transformation', 
    'word-order', 'gap-text', 'negative-prefixes', 'categorize',
    'paraphrasing', 'complete-word', 'matching-halves', 
    'describe-picture', 'answer-questions',
    // Picture versions
    'true-false-picture', 'multiple-choice-picture', 'answer-questions-picture',
    // Audio versions
    'listening-comprehension', 'multiple-choice-audio', 'true-false-audio', 
    'fill-in-blanks-audio', 'answer-questions-audio'
  ];
  
  // Filter out invalid exercise types
  const validExercises = selectedExercises.filter(type => availableTypes.includes(type));
  
  // Respect the count limit
  return validExercises.slice(0, maxCount);
}

/**
 * Gets missing exercise types from what we already have
 * Simplified since we now always generate the full set
 */
export function getExerciseTypesForMissing(existingExercises: any[], allTypes: string[]): string[] {
  const existingTypes = new Set(existingExercises.map(ex => ex.type));
  return allTypes.filter(type => !existingTypes.has(type));
}

/**
 * Assigns icon based on exercise type
 */
export function getIconForType(type: string): string {
  const iconMap: {[key: string]: string} = {
    'multiple-choice': 'fa-check-square',
    'reading': 'fa-book-open',
    'matching': 'fa-link',
    'fill-in-blanks': 'fa-pencil-alt',
    'dialogue': 'fa-comments',
    'discussion': 'fa-users',
    'error-correction': 'fa-exclamation-triangle',
    'true-false': 'fa-balance-scale',
    'odd-one-out': 'fa-search',
    'synonyms': 'fa-equals',
    'antonyms': 'fa-not-equal',
    'synonyms-antonyms': 'fa-exchange-alt',
    'sentence-transformation': 'fa-random',
    'word-order': 'fa-sort',
    'gap-text': 'fa-text-width',
    'negative-prefixes': 'fa-minus-circle',
    // Audio exercises
    'listening-comprehension': 'fa-headphones',
    'multiple-choice-audio': 'fa-check-square',
    'true-false-audio': 'fa-balance-scale',
    'fill-in-blanks-audio': 'fa-pencil-alt',
    'answer-questions-audio': 'fa-question-circle'
  };
  
  return iconMap[type] || 'fa-tasks';
}

/**
 * PROBLEM 4 FIX: Official exercise type names for consistent titles
 * Maps exercise type IDs to their official display names
 */
export const EXERCISE_TYPE_NAMES: Record<string, string> = {
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

/**
 * Get the official display name for an exercise type
 */
export function getOfficialExerciseName(type: string): string {
  if (EXERCISE_TYPE_NAMES[type]) {
    return EXERCISE_TYPE_NAMES[type];
  }
  // Fallback: capitalize and replace dashes with spaces
  return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================
// JSON RECOVERY PIPELINE
// 3-layer parsing: extract → deterministic repair → parse
// ============================================================

/**
 * Layer 1: Extract clean JSON string from raw AI output
 * Strips markdown, BOM, control characters, smart quotes
 */
export function extractJSONString(raw: string): string {
  let content = raw;
  
  // Remove BOM
  content = content.replace(/^\uFEFF/, '');
  
  // Remove markdown code fences
  content = content.replace(/^```json?\s*/im, '');
  content = content.replace(/```\s*$/im, '');
  
  // Normalize smart quotes to standard quotes
  content = content.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  content = content.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  
  // Remove control characters (except newline, tab, carriage return)
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Extract from first { to last }
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    content = content.substring(firstBrace, lastBrace + 1);
  }
  
  return content;
}

/**
 * Layer 2: Deterministic JSON repair for common AI output issues
 * Targeted fixes that don't alter content semantics
 */
export function repairJSONStringDeterministic(content: string): string {
  let repaired = content;
  
  // 1. Remove trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  
  // 2. Fix missing commas between objects: }{ -> },{
  repaired = repaired.replace(/}(\s*){/g, '},{');
  
  // 3. Fix missing commas between arrays: ][ -> ],[
  repaired = repaired.replace(/](\s*)\[/g, '],[');
  
  // 4. Fix missing colon between a property-like key and value on the next line.
  // v6.9.64: previous broad rule `"(\s*)\n\s*"` turned any two adjacent
  // quoted strings into a key:value pair, which silently corrupted valid
  // string arrays. Restrict to identifier-like keys followed by a JSON
  // value start.
  repaired = repaired.replace(
    /"([A-Za-z_][A-Za-z0-9_]{0,60})"\s*\n\s*("|\{|\[|true|false|null|-?\d)/g,
    '"$1":\n$2'
  );
  // More targeted: "key" followed by "value" on same line without colon
  repaired = repaired.replace(/"([^"]+)"\s+"([^"]*)"(?=\s*[,}\]])/g, (match, key, val) => {
    // Heuristic: if key looks like a JSON property name (no spaces or short), add colon
    if (key.length < 50 && !key.includes(',')) {
      return `"${key}": "${val}"`;
    }
    return match;
  });
  
  // 5. Fix missing colon: "key" { -> "key": {
  repaired = repaired.replace(/"([^"]+)"\s+(\{)/g, '"$1": $2');
  
  // 6. Fix missing colon: "key" [ -> "key": [
  repaired = repaired.replace(/"([^"]+)"\s+(\[)/g, '"$1": $2');
  
  // 7. Fix missing colon: "key" true/false/null/number
  repaired = repaired.replace(/"([^"]+)"\s+(true|false|null|\d+)(?=\s*[,}\]])/g, '"$1": $2');
  
  // 8. Ensure balanced braces/brackets
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/]/g) || []).length;
  
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }
  
  return repaired;
}

/**
 * Parses and cleans JSON content from AI response
 * 3-layer pipeline: extract → deterministic repair → parse
 * Returns parsed object or throws with detailed context
 */
export function parseAIResponse(jsonContent: string): any {
  // Layer 1: Extract clean JSON
  const extracted = extractJSONString(jsonContent);
  
  // Attempt 1: Parse extracted content directly
  try {
    const result = JSON.parse(extracted);
    console.log('✅ JSON parsed successfully on first attempt');
    return result;
  } catch (firstError) {
    console.warn('⚠️ json_parse_initial_failed:', (firstError as Error).message);
  }
  
  // Attempt 2: Deterministic repair
  const repaired = repairJSONStringDeterministic(extracted);
  try {
    const result = JSON.parse(repaired);
    console.log('✅ json_repair_deterministic_succeeded');
    return result;
  } catch (secondError) {
    console.warn('⚠️ json_repair_deterministic_failed:', (secondError as Error).message);
  }
  
  // Both attempts failed — throw with rich context for AI repair pass
  console.error('❌ All local JSON repair attempts failed');
  console.error('❌ Content length:', extracted.length);
  console.error('❌ Content preview (first 500 chars):', extracted.substring(0, 500));
  console.error('❌ Content preview (last 500 chars):', extracted.substring(extracted.length - 500));
  
  const error = new Error(`Invalid JSON from AI: unable to parse after deterministic repair`);
  (error as any).rawContent = extracted;
  (error as any).rawLength = extracted.length;
  throw error;
}
