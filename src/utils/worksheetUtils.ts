export const getExpectedExerciseCount = (lessonTime: string): number => {
  if (lessonTime.includes('45')) {
    return 6;
  }
  // Always expect 8 exercises from backend for 60/90 min lessons
  return 8;
};

export const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Picture exercise types
const pictureExercises = [
  'multiple-choice-picture',
  'true-false-picture',
  'answer-questions-picture',
  'describe-picture'
];

// Audio exercise types
const audioExercises = [
  'listening-comprehension',
  'answer-questions-audio',
  'true-false-audio',
  'fill-in-blanks-audio',
  'multiple-choice-audio'
];

// Check if worksheet has an image
export const hasImage = (worksheet: any): boolean => {
  // Priority 1: Check form_data.selectedExercises for picture exercises
  if (worksheet?.form_data?.selectedExercises && Array.isArray(worksheet.form_data.selectedExercises)) {
    const hasPictureExercise = worksheet.form_data.selectedExercises.some((exerciseId: string) =>
      pictureExercises.includes(exerciseId)
    );
    if (hasPictureExercise) return true;
  }
  
  // Priority 2: Check form_data.selectedImage
  if (worksheet?.form_data?.selectedImage && 
      worksheet.form_data.selectedImage !== null &&
      typeof worksheet.form_data.selectedImage === 'object') {
    return true;
  }
  
  // Priority 3: Parse ai_response if it's a string (skip if not available)
  let exercises = worksheet?.exercises;
  
  if (!exercises && worksheet?.ai_response) {
    try {
      const parsed = typeof worksheet.ai_response === 'string' 
        ? JSON.parse(worksheet.ai_response) 
        : worksheet.ai_response;
      exercises = parsed?.exercises;
    } catch (e) {
      console.warn('Failed to parse ai_response for image detection:', e);
      return false;
    }
  } else if (!exercises && !worksheet?.ai_response) {
    // In listView mode, ai_response is not loaded, skip this check
    return false;
  }
  
  // Priority 4: Check if any exercise has an image or is a picture exercise type
  if (exercises && Array.isArray(exercises)) {
    return exercises.some((ex: any) => 
      pictureExercises.includes(ex.type) || ex.image || ex.imageUrl || ex.image_url
    );
  }
  
  return false;
};

// Check if worksheet has audio
export const hasAudio = (worksheet: any): boolean => {
  // Priority 1: Check form_data.selectedExercises for audio exercises
  if (worksheet?.form_data?.selectedExercises && Array.isArray(worksheet.form_data.selectedExercises)) {
    const hasAudioExercise = worksheet.form_data.selectedExercises.some((exerciseId: string) =>
      audioExercises.includes(exerciseId)
    );
    if (hasAudioExercise) return true;
  }
  
  // Priority 2: Check form_data.selectedAudio
  if (worksheet?.form_data?.selectedAudio && 
      worksheet.form_data.selectedAudio !== null &&
      typeof worksheet.form_data.selectedAudio === 'object') {
    return true;
  }
  
  // Priority 3: Parse ai_response if it's a string (skip if not available)
  let exercises = worksheet?.exercises;
  
  if (!exercises && worksheet?.ai_response) {
    try {
      const parsed = typeof worksheet.ai_response === 'string' 
        ? JSON.parse(worksheet.ai_response) 
        : worksheet.ai_response;
      exercises = parsed?.exercises;
    } catch (e) {
      console.warn('Failed to parse ai_response for audio detection:', e);
      return false;
    }
  } else if (!exercises && !worksheet?.ai_response) {
    // In listView mode, ai_response is not loaded, skip this check
    return false;
  }
  
  // Priority 4: Check if any exercise is audio-based
  if (exercises && Array.isArray(exercises)) {
    return exercises.some((ex: any) => 
      audioExercises.includes(ex.type) || ex.audio || ex.audioUrl || ex.audio_url
    );
  }
  
  return false;
};

export const createSampleVocabulary = (count: number) => {
  const terms = [
    'Abundant', 'Benevolent', 'Concurrent', 'Diligent', 'Ephemeral', 
    'Fastidious', 'Gregarious', 'Haphazard', 'Impeccable', 'Juxtapose', 
    'Kinetic', 'Luminous', 'Meticulous', 'Nostalgia', 'Omnipotent'
  ];
  const meanings = [
    'Existing in large quantities', 'Kind and generous', 'Occurring at the same time', 
    'Hardworking', 'Lasting for a very short time', 'Paying attention to detail', 
    'Sociable', 'Random or lacking organization', 'Perfect, flawless', 
    'To place side by side', 'Related to motion', 'Full of light', 
    'Showing great attention to detail', 'Sentimental longing for the past', 
    'Having unlimited power'
  ];
  
  return Array(Math.min(count, terms.length)).fill(null).map((_, i) => ({
    term: terms[i],
    meaning: meanings[i]
  }));
};

export const validateWorksheet = (worksheetData: any, expectedCount: number): boolean => {
  console.log('🔍 Frontend validation - Expected exercises:', expectedCount);
  console.log('🔍 Frontend validation - Received exercises:', worksheetData?.exercises?.length || 0);
  console.log('🔍 Frontend validation - Worksheet data structure:', {
    hasWorksheet: !!worksheetData,
    hasExercises: !!worksheetData?.exercises,
    isArray: Array.isArray(worksheetData?.exercises),
    exerciseCount: worksheetData?.exercises?.length || 0
  });
  
  if (!worksheetData || !worksheetData.exercises || !Array.isArray(worksheetData.exercises)) {
    console.log('❌ Frontend validation - FAILED: Missing or invalid exercises array');
    return false;
  }
  
  const result = worksheetData.exercises.length >= 6; // Accept 6, 7, or 8 exercises
  console.log('🔍 Frontend validation - Result:', result);
  return result;
};
