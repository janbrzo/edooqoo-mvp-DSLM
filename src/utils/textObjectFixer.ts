// Enhanced deep fix for {text} objects and nano_skill structures
export const deepFixTextObjects = (obj: any, path: string = 'root'): any => {
  console.log(`🔧 Checking path: ${path}, type: ${typeof obj}`);
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // If it's a primitive, return as-is
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Special case: {text: "something"} object with ONLY text key - convert to string
  if (typeof obj === 'object' && obj.hasOwnProperty('text') && Object.keys(obj).length === 1) {
    console.log(`🔧 FIXED {text} object at ${path}:`, obj, '→', obj.text);
    return obj.text;
  }
  
  // NEW: Handle objects with text + nano_skill (keep structure but ensure text is string)
  if (typeof obj === 'object' && obj.hasOwnProperty('text') && obj.hasOwnProperty('nano_skill')) {
    // This is an item like {text: "...", nano_skill: {...}} - keep it as object
    // but ensure nested text is flattened if needed
    if (typeof obj.text === 'object' && obj.text?.text) {
      console.log(`🔧 FLATTENED nested text at ${path}:`, obj.text, '→', obj.text.text);
      return { ...obj, text: obj.text.text };
    }
    // Keep the object as-is - it has valid structure
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, index) => deepFixTextObjects(item, `${path}[${index}]`));
  }
  
  // Handle regular objects
  const fixed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Handle warmup_questions array
    if (key === 'warmup_questions' && Array.isArray(value)) {
      console.log(`🔧 ${path}.${key}: Processing warmup questions array`);
      fixed[key] = value.map((question, index) => {
        if (typeof question === 'string') {
          return question;
        }
        if (typeof question === 'object' && question.text) {
          return question.text;
        }
        return `Question ${index + 1}`;
      });
      continue;
    }
    
    fixed[key] = deepFixTextObjects(value, `${path}.${key}`);
  }
  
  return fixed;
};

// ENHANCED: Helper to safely extract text from potentially wrapped objects
// Use this in rendering components to get displayable text
// CRITICAL: This function ALWAYS returns a string, never undefined
export const safeGetText = (item: any): string => {
  // Handle null/undefined - return empty string
  if (item === null || item === undefined) {
    return '';
  }
  
  // If it's already a string, return it
  if (typeof item === 'string') {
    return item;
  }
  
  // If it's an object, try to extract text
  if (typeof item === 'object') {
    // Direct text property
    if (typeof item.text === 'string') {
      return item.text;
    }
    // Nested text object
    if (typeof item.text === 'object' && item.text !== null) {
      return safeGetText(item.text);
    }
    // Alternative: question property (some exercises use this)
    if (typeof item.question === 'string') {
      return item.question;
    }
  }
  
  // Fallback: convert to string
  return String(item || '');
};

// Safely extract word text from potentially wrapped objects
// Handles: "string", {word: "string"}, {word: "string", nano_skill: {...}}
export const safeGetWord = (item: any): string => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    // Handle {word: "..."} structure
    if (typeof item.word === 'string') return item.word;
    // Fallback to text property
    if (typeof item.text === 'string') return item.text;
  }
  return String(item || '');
};

// Interface for NanoSkill
interface NanoSkill {
  name: string;
  confidence: number;
  reason: string;
}

// ENHANCED: Helper to safely extract nano_skill from an item
// Handles both object and array formats (Gemini sometimes returns array)
export const safeGetNanoSkill = (item: any): NanoSkill | null => {
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  
  const ns = item.nano_skill;
  if (!ns) {
    return null;
  }
  
  // If nano_skill is an array, take the first element
  if (Array.isArray(ns)) {
    return ns[0] || null;
  }
  
  // If it's an object, return it directly
  if (typeof ns === 'object') {
    return ns;
  }
  
  return null;
};

// NEW: Helper to safely extract ALL nano_skills from an item (for dual nano_skill support)
// Returns array of all nano_skills (primary + writing)
export const safeGetAllNanoSkills = (item: any): NanoSkill[] => {
  if (typeof item !== 'object' || item === null) {
    return [];
  }
  
  const ns = item.nano_skill;
  if (!ns) {
    return [];
  }
  
  // If nano_skill is an array, return all elements
  if (Array.isArray(ns)) {
    return ns.filter((s: any) => s && typeof s === 'object' && s.name);
  }
  
  // If it's a single object, wrap in array
  if (typeof ns === 'object' && ns.name) {
    return [ns];
  }
  
  return [];
};
