import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from "npm:openai@4.77.0";

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inline golden prompt templates to avoid import issues
const getGoldenPromptForExercise = (exerciseType: string) => {
  const prompts: Record<string, string> = {
    'describe-picture': `{
      "type": "describe-picture",
      "title": "Exercise X: Describe the Picture",
      "icon": "fa-image",
      "time": 10,
      "instructions": "Look at the image carefully and answer the guiding questions below. Use complete sentences and try to include as much detail as possible.",
      "image_url": "[WILL BE ADDED]",
      "image_description": "A detailed description of what the image shows, including key elements, setting, people/objects, colors, and atmosphere.",
      "prompts": [
        "What do you see in this image?",
        "Where do you think this photo was taken?",
        "What are the people/objects doing?",
        "What colors and details stand out to you?",
        "What is the mood or atmosphere of this scene?",
        "What might be happening just before or after this moment?",
        "If you were in this picture, what would you be feeling?",
        "Can you create a short story based on this image?"
      ],
      "useful_vocabulary": [
        "in the foreground/background",
        "on the left/right side",
        "it appears that",
        "it looks like",
        "surrounded by",
        "in the distance"
      ],
      "teacher_tip": "Encourage students to use descriptive adjectives and prepositions of place. Ask follow-up questions to help them elaborate on their answers."
    }`,

    'answer-questions-picture': `{
      "type": "answer-questions",
      "title": "Exercise X: Answer Questions About the Picture",
      "icon": "fa-question-circle",
      "time": 8,
      "instructions": "Answer the following questions based on the image shown.",
      "image_url": "[WILL BE ADDED]",
      "questions": [
        {"question": "What is the main subject of this picture?", "focus": "observation"},
        {"question": "Describe the setting or location shown in the image.", "focus": "description"},
        {"question": "What details can you observe about the people or objects?", "focus": "detail"},
        {"question": "What emotions or mood does this picture convey?", "focus": "interpretation"},
        {"question": "Why do you think the photographer took this picture?", "focus": "analysis"},
        {"question": "What story could this image be telling?", "focus": "inference"},
        {"question": "How does this image relate to our lesson topic?", "focus": "connection"},
        {"question": "What would you title this photograph?", "focus": "synthesis"},
        {"question": "If you could ask someone in this picture a question, what would it be?", "focus": "engagement"},
        {"question": "What do you think happened just before or after this moment?", "focus": "speculation"}
      ],
      "teacher_tip": "These questions progress from simple observation to higher-order thinking. Adjust difficulty based on student level."
    }`,

    'multiple-choice-picture': `{
      "type": "multiple-choice",
      "title": "Exercise X: Multiple Choice About the Picture",
      "icon": "fa-check-square",
      "time": 8,
      "instructions": "Choose the best answer for each question based on the image.",
      "image_url": "[WILL BE ADDED]",
      "questions": [
        {
          "text": "Based on the image, what is most likely happening?",
          "options": [
            {"label": "A", "text": "[Option based on image]", "correct": true},
            {"label": "B", "text": "[Alternative option]", "correct": false},
            {"label": "C", "text": "[Alternative option]", "correct": false},
            {"label": "D", "text": "[Alternative option]", "correct": false}
          ]
        }
      ],
      "teacher_tip": "Create questions that require careful observation of the image. Include visual clues in the options."
    }`,

    'true-false-picture': `{
      "type": "true-false",
      "title": "Exercise X: True or False About the Picture",
      "icon": "fa-balance-scale",
      "time": 5,
      "instructions": "Look at the image carefully and decide if each statement is true or false.",
      "image_url": "[WILL BE ADDED]",
      "statements": [
        {"text": "[Statement about observable detail in image]", "isTrue": true},
        {"text": "[Statement requiring inference from image]", "isTrue": false}
      ],
      "teacher_tip": "Mix obvious visual details with statements requiring interpretation. Discuss why certain statements are true or false."
    }`
  };

  return prompts[exerciseType] || prompts['describe-picture'];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      worksheetId,
      exerciseIndex,
      imageData,
      originalFormData,
      userId
    } = await req.json();

    console.log(`[GENERATE-MEDIA] Starting Phase 2 for worksheet ${worksheetId}, exercise ${exerciseIndex}`);

    // Get current worksheet
    const { data: worksheet, error: fetchError } = await supabase
      .from('worksheets')
      .select('ai_response')
      .eq('id', worksheetId)
      .single();

    if (fetchError || !worksheet) {
      throw new Error('Worksheet not found');
    }

    const worksheetData = JSON.parse(worksheet.ai_response);
    const exercise = worksheetData.exercises[exerciseIndex];

    // Determine exercise type for golden prompt
    const exerciseType = exercise.type === 'multiple-choice' ? 'multiple-choice-picture' :
                        exercise.type === 'true-false' ? 'true-false-picture' :
                        exercise.type === 'answer-questions' ? 'answer-questions-picture' :
                        'describe-picture';

    const goldenPrompt = getGoldenPromptForExercise(exerciseType);

    // Construct regeneration prompt
    const systemPrompt = `You are an expert ESL teacher creating picture-based exercises for English language learners.

CONTEXT FROM ORIGINAL LESSON:
- Topic: ${originalFormData.lessonTopic}
- Goal: ${originalFormData.lessonGoal}
- English Level: ${originalFormData.englishLevel}
- Grammar Focus: ${originalFormData.grammarFocus || 'None'}
- Additional Info: ${originalFormData.additionalInformation || 'None'}

IMAGE INFORMATION:
- Image URL: ${imageData.url}
- Description: ${imageData.description}
- Photographer: ${imageData.photographer}

CURRENT EXERCISE METADATA (Phase 1):
${JSON.stringify(exercise, null, 2)}

YOUR TASK:
Generate complete, rich content for this picture-based exercise. Use the image description and lesson context to create engaging, relevant questions and content.

GOLDEN PROMPT TEMPLATE TO FOLLOW:
${goldenPrompt}

REQUIREMENTS:
1. Replace [WILL BE ADDED] with actual image URL: ${imageData.url}
2. Create exercise content that directly references and describes the image
3. Ensure all questions/prompts relate to both the image AND the lesson topic
4. Match the English level (${originalFormData.englishLevel}) in vocabulary and complexity
5. Include specific visual details from the image description in your questions
6. Maintain the original exercise title and structure
7. Return ONLY valid JSON matching the golden prompt structure

CRITICAL: Return ONLY the JSON exercise object, no additional text or markdown.`;

    console.log('[GENERATE-MEDIA] Calling OpenAI for content generation...');

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the complete picture-based exercise content now." }
      ],
      max_completion_tokens: 2000
    });

    let generatedExercise;
    try {
      const responseText = aiResponse.choices[0].message.content?.trim() || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      generatedExercise = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch (parseError) {
      console.error('[GENERATE-MEDIA] JSON parse error:', parseError);
      throw new Error('Failed to parse AI response');
    }

    // Add media metadata
    generatedExercise.media = {
      type: 'picture',
      url: imageData.url,
      photographer: imageData.photographer,
      photographerUrl: imageData.photographerUrl,
      description: imageData.description
    };

    // Update worksheet with new exercise content
    worksheetData.exercises[exerciseIndex] = generatedExercise;

    const { error: updateError } = await supabase
      .from('worksheets')
      .update({
        ai_response: JSON.stringify(worksheetData),
        html_content: '', // Clear HTML cache
        last_modified_at: new Date().toISOString()
      })
      .eq('id', worksheetId);

    if (updateError) {
      throw updateError;
    }

    console.log('[GENERATE-MEDIA] Phase 2 complete, exercise updated');

    return new Response(
      JSON.stringify({ 
        success: true, 
        exercise: generatedExercise 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GENERATE-MEDIA] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
