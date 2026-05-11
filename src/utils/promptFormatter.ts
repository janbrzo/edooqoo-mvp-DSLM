
import { FormData } from "@/components/WorksheetForm";

export const formatPromptForAI = (data: FormData): string => {
  console.log('📝 Formatting prompt for AI with data:', data);
  
  // Build array of prompt lines for easy filtering of empty values
  const promptLines = [];

  // Add required fields
  promptLines.push(`lessonTopic: ${data.lessonTopic}`);
  promptLines.push(`lessonGoal: ${data.lessonGoal}`);
  promptLines.push(`englishLevel: ${data.englishLevel}`);

  // Add language style parameter
  const languageStyle = data.languageStyle || 3;
  promptLines.push(`languageStyle: ${languageStyle}/5 ${getLanguageStyleDescription(languageStyle)}`);

  // Add optional grammar focus only if provided
  if (data.teachingPreferences) {
    promptLines.push(`grammarFocus: ${data.teachingPreferences}`);
  }

  if (data.additionalInformation) {
    promptLines.push(`additionalInformation: ${data.additionalInformation}`);
  }

  // Add selected exercises information
  if (data.selectedExercises && data.selectedExercises.length > 0) {
    promptLines.push(`selectedExercises: ${data.selectedExercises.join(', ')}`);
    console.log('📝 [FORMAT-PROMPT] Adding selectedExercises to AI prompt:', data.selectedExercises);
  } else {
    console.log('📝 [FORMAT-PROMPT] No selectedExercises provided, AI will use defaults');
  }

  // Add exercise focus map (V/G tags) if provided
  if (data.exerciseFocusMap && Object.keys(data.exerciseFocusMap).length > 0) {
    promptLines.push(`exerciseFocusMap: ${JSON.stringify(data.exerciseFocusMap)}`);
    console.log('📝 [FORMAT-PROMPT] Adding exerciseFocusMap:', data.exerciseFocusMap);
  }

  // Add detailed language style instructions
  promptLines.push(`\nLANGUAGE STYLE GUIDELINES (${languageStyle}/5):`);
  if (languageStyle === 1) {
    promptLines.push(`- Use very casual, conversational language with heavy use of contractions (I'm, you're, can't, won't, that's)`);
    promptLines.push(`- Include everyday slang, informal expressions, and colloquialisms where appropriate`);
    promptLines.push(`- Use shorter, simpler sentences with relaxed grammar and informal structure`);
    promptLines.push(`- Embrace conversational fillers and natural speech patterns`);
    promptLines.push(`- Examples: "Hey, what's up?", "That's totally awesome!", "No way!", "Wanna grab a coffee?", "I'm like totally into that"`);
  } else if (languageStyle === 2) {
    promptLines.push(`- Use casual, relaxed language with regular contractions and friendly tone`);
    promptLines.push(`- Include common informal expressions and everyday language`);
    promptLines.push(`- Keep sentences moderately simple but well-structured`);
    promptLines.push(`- Examples: "How's it going?", "That sounds really great!", "I'd love to", "Let's hang out", "It's pretty cool"`);
  } else if (languageStyle === 3) {
    promptLines.push(`- Use neutral, balanced language that's neither too casual nor too formal`);
    promptLines.push(`- Mix contractions with full forms naturally and appropriately`);
    promptLines.push(`- Use standard expressions and commonly understood idioms`);
    promptLines.push(`- Examples: "How are you doing?", "That sounds excellent!", "I would like to", "Let's meet up", "It's interesting"`);
  } else if (languageStyle === 4) {
    promptLines.push(`- Use formal, professional language with proper grammar and structure`);
    promptLines.push(`- Prefer full forms over contractions (I am, you are, cannot, will not)`);
    promptLines.push(`- Use sophisticated vocabulary and well-constructed sentences`);
    promptLines.push(`- Examples: "How are you today?", "That is excellent!", "I would be delighted to", "Shall we arrange a meeting?", "It is quite remarkable"`);
  } else {
    promptLines.push(`- Use very formal, academic language with sophisticated vocabulary and complex structures`);
    promptLines.push(`- Strictly avoid contractions and maintain formal grammatical constructions throughout`);
    promptLines.push(`- Employ elevated vocabulary, complex sentence structures, and academic tone`);
    promptLines.push(`- Use precise, scholarly language and formal expressions`);
    promptLines.push(`- Examples: "How do you do?", "That is most exceptional!", "I would be most honored to", "Shall we schedule a formal appointment?", "It is extraordinarily fascinating"`);
  }

  // Add detailed CEFR level instructions
  promptLines.push(`\nCEFR LEVEL GUIDELINES (${data.englishLevel}):`);
  if (data.englishLevel === 'A1/A2') {
    promptLines.push(`- Use simple, basic vocabulary and elementary grammatical structures appropriate for beginners`);
    promptLines.push(`- Focus on everyday topics, common situations, and concrete subjects (family, food, weather, hobbies)`);
    promptLines.push(`- Keep sentences short and straightforward with present simple, present continuous, and basic past tense`);
    promptLines.push(`- Avoid complex clauses, abstract concepts, and advanced vocabulary`);
    promptLines.push(`- Examples: "I like pizza", "She is working now", "We went to the park yesterday"`);
  } else if (data.englishLevel === 'B1/B2') {
    promptLines.push(`- Use intermediate vocabulary with more varied grammatical structures including conditionals and perfect tenses`);
    promptLines.push(`- Include topics related to work, travel, personal experiences, opinions, and abstract ideas`);
    promptLines.push(`- Use compound and some complex sentences with relative clauses and linking words`);
    promptLines.push(`- Introduce phrasal verbs, idiomatic expressions, and more nuanced vocabulary`);
    promptLines.push(`- Examples: "If I had known, I would have come earlier", "I've been learning English for five years", "Although it was raining, we decided to go out"`);
  } else if (data.englishLevel === 'C1/C2') {
    promptLines.push(`- Use advanced, sophisticated vocabulary with complex grammatical structures and subtle nuances`);
    promptLines.push(`- Include abstract topics, professional contexts, academic discussions, and complex social issues`);
    promptLines.push(`- Employ complex sentence structures with multiple clauses, inversion, and advanced discourse markers`);
    promptLines.push(`- Use idiomatic language, collocations, and precise terminology appropriate to the context`);
    promptLines.push(`- Examples: "Had I known the implications, I would have reconsidered my decision", "Not only did she excel academically, but she also demonstrated exceptional leadership qualities"`);
  }

  // Join lines with newlines for clean key-value format
  const formattedPrompt = promptLines.join('\n');
  
  console.log('📝 Formatted prompt (key-value format):', formattedPrompt);
  return formattedPrompt;
};

// Helper function to get language style description
const getLanguageStyleDescription = (value: number): string => {
  if (value === 1) return "(very casual - slang, contractions)";
  if (value === 2) return "(casual - relaxed, friendly)";
  if (value === 3) return "(neutral - balanced style)";
  if (value === 4) return "(formal - professional tone)";
  return "(very formal - academic style)";
};

export const createFormDataForStorage = (prompt: FormData) => {
  console.log('🔧 [PROMPT-FORMATTER] createFormDataForStorage - input selectedExercises:', prompt.selectedExercises);
  console.log('🔧 [PROMPT-FORMATTER] createFormDataForStorage - input selectedExercises type:', typeof prompt.selectedExercises);
  console.log('🔧 [PROMPT-FORMATTER] createFormDataForStorage - full prompt object:', prompt);
  
  const formDataForStorage = {
    lessonTopic: prompt.lessonTopic,
    lessonGoal: prompt.lessonGoal,
    teachingPreferences: prompt.teachingPreferences || null,
    additionalInformation: prompt.additionalInformation || null,
    englishLevel: prompt.englishLevel || null,
    languageStyle: prompt.languageStyle || 3,
    lessonTime: prompt.lessonTime,
    selectedExercises: prompt.selectedExercises || [],
    exerciseFocusMap: prompt.exerciseFocusMap || null,
    selectedImage: prompt.selectedImage || null,
    selectedAudio: prompt.selectedAudio || null
  };
  
  console.log('🔧 [PROMPT-FORMATTER] createFormDataForStorage - output selectedExercises:', formDataForStorage.selectedExercises);
  console.log('🔧 [PROMPT-FORMATTER] createFormDataForStorage - output object:', formDataForStorage);
  
  return formDataForStorage;
};
