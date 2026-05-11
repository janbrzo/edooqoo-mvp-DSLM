/**
 * Media Service - Frontend media generation
 * 
 * This service moves media generation (audio & image) to the frontend
 * to avoid 546 WORKER_LIMIT errors in the generateWorksheet Edge Function.
 * 
 * Media is now pre-generated before worksheet generation, reducing
 * backend processing time from 60s+ to under 30s.
 */

import { supabase } from '@/integrations/supabase/client';
import { FormData } from '@/components/WorksheetForm';

/**
 * Generate audio for a worksheet before worksheet generation
 * 
 * @param formData - Worksheet form data
 * @returns Audio data object or null if generation fails
 */
export const generateAudioForWorksheet = async (formData: FormData) => {
  console.log('🎵 [MEDIA-SERVICE] Starting audio pre-generation');
  
  const startTime = Date.now();
  
  try {
    const response = await supabase.functions.invoke('generate-audio', {
      body: {
        topic: formData.lessonTopic || 'general English lesson',
        englishLevel: formData.englishLevel || 'B1/B2',
        lessonFocus: formData.lessonGoal || '',
        additionalInformation: formData.additionalInformation || '',
        grammarFocus: formData.teachingPreferences || '',
        duration: 90
      }
    });
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    if (response.error) {
      console.error('🎵 [MEDIA-SERVICE] Audio generation failed after ' + duration + 's:', response.error);
      throw new Error('Audio generation failed: ' + response.error.message);
    }
    
    console.log('🎵 [MEDIA-SERVICE] Audio generated successfully in ' + duration + 's');
    return response.data.audioData;
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error('🎵 [MEDIA-SERVICE] Audio generation error after ' + duration + 's:', error);
    throw error;
  }
};

/**
 * Generate image for a worksheet before worksheet generation
 * 
 * @param formData - Worksheet form data
 * @returns Image data object or null if generation fails
 */
export const generateImageForWorksheet = async (formData: FormData) => {
  console.log('🎨 [MEDIA-SERVICE] Starting image pre-generation');
  
  const startTime = Date.now();
  
  try {
    const response = await supabase.functions.invoke('generate-image', {
      body: {
        topic: formData.lessonTopic || 'general English lesson',
        englishLevel: formData.englishLevel || 'B1/B2'
      }
    });
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    if (response.error) {
      console.error('🎨 [MEDIA-SERVICE] Image generation failed after ' + duration + 's:', response.error);
      throw new Error('Image generation failed: ' + response.error.message);
    }
    
    if (response.data?.success && response.data?.image) {
      console.log('🎨 [MEDIA-SERVICE] Image generated successfully in ' + duration + 's');
      return response.data.image;
    } else {
      throw new Error('Invalid response from generate-image function');
    }
    
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.error('🎨 [MEDIA-SERVICE] Image generation error after ' + duration + 's:', error);
    throw error;
  }
};
