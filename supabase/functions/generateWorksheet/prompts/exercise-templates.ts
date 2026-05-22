/**
 * Exercise templates - dynamically compose exercises based on count
 * EXACT content from original prompt - modularized for flexibility
 */

import { exerciseFunctions, exerciseOrder, getVocabularySheet } from "./individual-exercises.ts";
import { normalizeExerciseId } from "../helpers.ts";

export const getExerciseTemplates = (
  hasGrammarFocus: boolean,
  grammarFocus: string | null,
  exerciseCount: number = 8,
  selectedExercises?: string[],
  hasSelectedImage?: boolean,
  hasSelectedAudio?: boolean,
) => {
  let finalExercises: string[];

  // Use custom selected exercises if provided, otherwise use default order
  if (selectedExercises && selectedExercises.length > 0) {
    // ✅ Keep ORIGINAL exercise types (with -picture suffix if present)
    finalExercises = selectedExercises.slice(0, exerciseCount);
  } else {
    // Select the first N exercises from the default order
    finalExercises = exerciseOrder.slice(0, exerciseCount);
  }

  // ETAP 2: Generate exercise JSON fragments preserving -picture suffix in type
  const exerciseFragments = finalExercises.map((originalType) => {
    // ✅ Try original type first, then try normalized
    let exerciseFunction = exerciseFunctions[originalType as keyof typeof exerciseFunctions];
    
    if (!exerciseFunction) {
      // Fallback: normalize and try base type
      const normalized = normalizeExerciseId(originalType);
      const baseType = normalized.baseId;
      exerciseFunction = exerciseFunctions[baseType as keyof typeof exerciseFunctions];
    }
    
    if (!exerciseFunction) {
      console.warn(`[EXERCISE-TEMPLATES] No function found for type: ${originalType}`);
      return "";
    }
    
    // Get template (already has correct type from individual-exercises.ts)
    let template = exerciseFunction();
    
    // ✅ NO NEED to replace type - template already has correct type from ETAP 2 fix
    
    return template;
  }).filter(Boolean);
  return `23. Generate a structured JSON worksheet with this EXACT format:
EXAMPLE OUTPUT (IGNORE CONTENT, FOCUS ON STRUCTURE):

IMPORTANT: Include a "warmup_questions" array with exactly 4 conversation starter questions that are personal and opinion-based, directly related to the lesson topic. Make questions 1-2 generic and questions 3-4 specific to engage students at the beginning of the lesson.

{
  "title": "In a restaurant",
  "subtitle": "Making a complaint about your dish in a restaurant: adjectives practice",
  "introduction": "In this lesson, you'll practice a restaurant role-play, learn how to order food, and make a complaint about an incorrect order. You'll also review grammar related to adjectives in their comparative and superlative forms.",
  "warmup_questions": [
    "Generic question 1 related to the lesson topic",
    "Generic question 2 related to the lesson topic",
    "Specific question 3 directly about the lesson context",
    "Specific question 4 directly about the lesson context"
  ],
  ${
    hasGrammarFocus
      ? `"grammar_rules": {
    "title": "Grammar Focus: ${grammarFocus}",
    "introduction": "Adjectives are words that describe or modify nouns, providing information about qualities such as size, color, shape, age, and many others. When we want to compare people, objects, or ideas, we use adjectives in their comparative or superlative forms.\\n\\nComparatives are used to compare two things or people, showing that one has a higher or lower degree of a particular quality than the other. For example, when saying \\"John is taller than Mike,\\" the adjective \\"taller\\" is in the comparative form, indicating a comparison between two individuals. Comparatives are often followed by the word \\"than\\" to introduce the second element of comparison.\\n\\nSuperlatives, on the other hand, are used to describe the extreme or highest degree of a quality among three or more things or people. For example, \\"Anna is the tallest in her class\\" uses the superlative form \\"tallest\\" to indicate that Anna has the greatest height compared to all others in the group. Superlatives are usually preceded by the definite article \\"the\\".\\n\\nThe formation of comparatives and superlatives depends largely on the length and ending of the adjective. One-syllable adjectives usually form comparatives and superlatives by adding the suffixes \\"-er\\" and \\"-est\\". For adjectives with two syllables or more, especially those with three or more syllables, the words \\"more\\" and \\"most\\" are used before the adjective instead of adding suffixes.\\n\\nSome adjectives have irregular comparative and superlative forms that must be memorized as they do not follow standard patterns. For instance, \\"good\\" becomes \\"better\\" (comparative) and \\"best\\" (superlative).\\n\\nIn addition to indicating comparisons of difference, adjectives can also be used to express equality, using the structure \\"as + adjective + as\\" to show that two things share the same degree of a quality.\\n\\nUnderstanding and correctly using comparatives and superlatives is essential for effective communication, enabling speakers and writers to accurately compare qualities and express degrees of difference or similarity.",
    "rules": [
      {
        "title": "Forming Comparatives for One-Syllable Adjectives",
        "explanation": "Most one-syllable adjectives form their comparative by adding the suffix \\"-er\\" to the base adjective. If the adjective ends with a single consonant preceded by a single vowel, double the consonant before adding \\"-er\\". When the adjective ends with \\"-e\\", just add \\"-r\\".",
        "examples": ["food → colder food", "dish → spicier dish", "service → slower service"]
      },
      {
        "title": "Forming Superlatives for One-Syllable Adjectives",
        "explanation": "One-syllable adjectives form the superlative by adding the suffix \\"-est\\" to the base adjective. Similar spelling rules apply as with comparatives.",
        "examples": ["food → coldest food", "dish → spiciest dish", "service → slowest service"]
      },
      {
        "title": "Forming Comparatives and Superlatives for Adjectives with Two or More Syllables",
        "explanation": "Adjectives with two or more syllables generally form comparatives and superlatives by using \\"more\\" before the adjective for comparatives, and \\"most\\" before the adjective for superlatives. Some two-syllable adjectives can also take \\"-er\\" and \\"-est\\" if they end with \\"-y\\" or certain other endings.",
        "examples": ["delicious → more delicious → most delicious", "uncomfortable → more uncomfortable → most uncomfortable", "friendly staff → friendlier staff → friendliest staff"]
      },
      {
        "title": "Irregular Comparatives and Superlatives",
        "explanation": "Some adjectives have irregular forms that do not follow the usual patterns and must be memorized. These are common and important adjectives.",
        "examples": ["good service → better service → best service", "bad coffee → worse coffee → worst coffee", "far table → farther table → farthest table"]
      },
      {
        "title": "Using \\"than\\" in Comparatives",
        "explanation": "Comparative adjectives are usually followed by \\"than\\" to introduce the second element being compared.",
        "examples": ["This soup is colder than it should be.", "The second waiter was more polite than the first one."]
      },
      {
        "title": "Using \\"the\\" with Superlatives",
        "explanation": "Superlative adjectives are usually preceded by the definite article \\"the\\" to show that one thing is the highest or lowest in a group.",
        "examples": ["That was the worst pasta I've ever eaten.", "This is the most expensive restaurant in the area."]
      },
      {
        "title": "Comparing Equality with \\"as...as\\"",
        "explanation": "To show that two things are equal in some quality, use the structure \\"as + adjective + as\\".",
        "examples": ["This dish is not as hot as I expected.", "The new waiter is as friendly as the old one."]
      }
    ]
  },`
      : ""
  }
  "exercises": [
${exerciseFragments.join(",\n")}
  ],
${getVocabularySheet()}
}
END OF EXAMPLE`;
};
