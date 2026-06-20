import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnswerToEvaluate {
  question_index: number;
  question_text: string;
  student_answer: string;
  suggested_answer?: string;
  exercise_type: string;
  exercise_index?: number;
  // Speaking data
  audio_transcription?: string;
  audio_duration_seconds?: number;
  audio_word_count?: number;
}

interface EvaluationResult {
  question_index: number;
  exercise_index?: number;
  quality_score: number;
  is_acceptable: boolean;
  feedback: string;
  writing_score?: number;
  speaking_score?: number;
}

serve(async (req) => {
  console.log("[verify-open-answers] Function invoked, method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    console.log("[verify-open-answers] ========== FULL REQUEST ==========");
    console.log("[verify-open-answers] Request body:", JSON.stringify(body, null, 2));

    const { answers, english_level, context } = body as {
      answers: AnswerToEvaluate[];
      english_level: string;
      context?: string;
    };

    console.log("[verify-open-answers] Parsed: answers=", answers?.length, "level=", english_level);

    if (!answers || answers.length === 0) {
      return new Response(JSON.stringify({ error: "No answers to evaluate" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any answers have audio transcription
    const hasAnySpeaking = answers.some(a => a.audio_transcription);

    const systemPrompt = `You are a STRICT English language teacher evaluating student answers.
The student's English level is: ${english_level || "Intermediate"}

Your task is to evaluate each answer based on:
1. Relevance - Does it answer the question?
2. Language quality - Is the grammar and vocabulary appropriate for the student's level?
3. Completeness - Is the answer sufficiently developed?
${hasAnySpeaking ? `
4. SPEAKING EVALUATION (only when audio_transcription is provided):
   - Fluency: Calculate words per second (audio_word_count / audio_duration_seconds). 
     A2 target: 1.0-1.5 wps. B1 target: 1.5-2.0 wps. B2+: 2.0+ wps.
     Score 0.9+ if above target, 0.7-0.9 if near target, below 0.5 if very slow (<0.5 wps).
   - Coherence: Does the transcribed speech form logical, complete sentences?
   - Grammar accuracy: Are sentences grammatically correct for the level?
   - Task completion: Does the spoken response address the question/prompt?
   - Pronunciation proxy: Whisper transcription accuracy suggests pronunciation clarity.
` : ''}

For each answer, provide:
- quality_score: A number from 0.0 to 1.0 (0.7+ is acceptable)
- is_acceptable: true if quality_score >= 0.7
- feedback: Specific, constructive feedback in English (max 50 words). When BOTH written and spoken answers are provided, you MUST write TWO separate sentences with prefixes: "Writing: [feedback about writing]. Speaking: [feedback about speaking]." Each sentence should be a complete, standalone evaluation. Do NOT combine them into one sentence. When only one modality is present, write a single sentence without prefix. Focus on WHAT the student did well or WHAT specifically needs improvement. Mention grammar errors by name, suggest better vocabulary, or point out missing content.
- writing_score: (0.0-1.0) Score for the WRITTEN answer only. Omit if no written answer provided.
- speaking_score: (0.0-1.0) Score for the SPOKEN answer (from transcription). Omit if no audio transcription provided.

STRICT SCORING RULES (these override everything else):
1. NON-ANSWERS (ALWAYS score 0.0-0.05): "I don't know", "idk", "nie wiem", "no idea", "no se", "не знаю", "dunno", "I have no idea", "I'm not sure", any equivalent in ANY language, or any response that does not attempt to answer the question. Score: 0.0. Feedback should be: "No answer provided. Try to form at least one sentence about the topic."
2. WRONG LANGUAGE (score 0.05-0.10): Answer written entirely in a non-English language (Polish, Spanish, etc.) unless translation was explicitly requested. Feedback: "Please answer in English."
3. MINIMAL EFFORT (score 0.1-0.4): Only 1-2 generic words like "yes", "no", "ok", "good", "bad" that don't demonstrate understanding. Feedback should suggest what to add.
4. PARTIAL ANSWER (score 0.4-0.7): Shows some understanding but is incomplete, has significant errors, or doesn't fully address the question.
5. ACCEPTABLE ANSWER (score 0.7-0.85): Genuine attempt with mostly correct English that addresses the topic. Minor errors are OK at the student's level.
6. STRONG ANSWER (score 0.85-1.0): Well-structured, accurate, comprehensive response.
${hasAnySpeaking ? `
SPEAKING-SPECIFIC SCORING:
- If audio_transcription is provided but is empty/gibberish: speaking_score 0.0-0.1
- If audio is very short (<3 words for 10+ seconds): speaking_score 0.1-0.3 (hesitant/minimal)
- If audio has good content but slow pace: speaking_score 0.5-0.7
- If audio is fluent with correct grammar: speaking_score 0.7-0.9
- If audio is fluent, accurate, and natural: speaking_score 0.9-1.0
` : ''}
IMPORTANT: Be demanding but fair. A score of 0.7+ means the student genuinely tried and produced meaningful English. Do NOT give 0.7+ to lazy or empty responses under any circumstances.

CRITICAL: Return ONLY a valid JSON array. No markdown code blocks. No extra text. Just the array.`;

    const userPrompt = `Evaluate these ${answers.length} student answers:

${answers
  .map(
    (a, i) => `[Answer ${i + 1}]
Question: ${a.question_text}
Student's written answer: ${a.student_answer || "(no written answer)"}
${a.audio_transcription ? `Student's spoken answer (transcription): ${a.audio_transcription}` : ""}
${a.audio_duration_seconds ? `Audio duration: ${a.audio_duration_seconds} seconds` : ""}
${a.audio_word_count ? `Spoken word count: ${a.audio_word_count}` : ""}
${a.suggested_answer ? `Suggested answer: ${a.suggested_answer}` : ""}
Exercise type: ${a.exercise_type}
`,
  )
  .join("\n")}
${context ? `Context: ${context}` : ""}

Return exactly ${answers.length} evaluation objects in a JSON array:
[{"question_index": 0, "quality_score": 0.85, "is_acceptable": true, "feedback": "...", "writing_score": 0.80, "speaking_score": 0.75}]`;

    console.log("[verify-open-answers] ========== PROMPTS ==========");
    console.log("[verify-open-answers] System prompt length:", systemPrompt.length);
    console.log("[verify-open-answers] User prompt length:", userPrompt.length);

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      console.error("[verify-open-answers] ERROR: LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }, { primaryModel: "google/gemini-2.5-flash", functionName: "verify-open-answers" });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[verify-open-answers] AI API error:", errorText);
      return new Response(JSON.stringify({ error: "AI evaluation failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "[]";

    console.log("[verify-open-answers] ========== RAW AI RESPONSE ==========");
    console.log("[verify-open-answers] Raw content length:", rawContent.length);
    console.log("[verify-open-answers] Raw content:", rawContent);

    let evaluations: EvaluationResult[];
    try {
      let cleanContent = rawContent.trim();

      // Strip markdown code blocks
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      // FIX 2.2: Truncate after last complete JSON array bracket
      const lastBracket = cleanContent.lastIndexOf("]");
      if (lastBracket !== -1 && lastBracket < cleanContent.length - 1) {
        console.log("[verify-open-answers] Truncating trailing content after position", lastBracket);
        cleanContent = cleanContent.substring(0, lastBracket + 1);
      }

      // FIX 2.2: Try to repair incomplete JSON - close unclosed braces
      let openBraces = (cleanContent.match(/{/g) || []).length;
      let closeBraces = (cleanContent.match(/}/g) || []).length;
      if (closeBraces < openBraces) {
        console.log("[verify-open-answers] Repairing JSON: adding", openBraces - closeBraces, "closing braces");
        // Find last ']' position, insert closing braces before it
        const lastArr = cleanContent.lastIndexOf("]");
        if (lastArr !== -1) {
          const before = cleanContent.substring(0, lastArr);
          const missingBraces = "}".repeat(openBraces - closeBraces);
          cleanContent = before + missingBraces + "]";
        }
      }

      // FIX 2.2: Handle truncated strings - remove last incomplete object if parse fails
      let parsedContent: any;
      try {
        parsedContent = JSON.parse(cleanContent);
      } catch (firstParseError) {
        console.log("[verify-open-answers] First parse failed, trying to remove last incomplete object");
        // Find last complete object (last '},' or last '}]')
        const lastCompleteObj = cleanContent.lastIndexOf("},");
        if (lastCompleteObj !== -1) {
          cleanContent = cleanContent.substring(0, lastCompleteObj + 1) + "]";
          console.log("[verify-open-answers] Retrying parse with truncated content");
          parsedContent = JSON.parse(cleanContent);
        } else {
          throw firstParseError;
        }
      }

      // Handle object wrapper
      if (!Array.isArray(parsedContent) && parsedContent.evaluations) {
        parsedContent = parsedContent.evaluations;
      }
      if (!Array.isArray(parsedContent)) {
        parsedContent = [parsedContent];
      }

      // Map using ORIGINAL indices from request
      evaluations = parsedContent.map((e: any, idx: number) => {
        let qualityScore = parseFloat(e.quality_score);
        if (isNaN(qualityScore)) qualityScore = 0.7;
        qualityScore = Math.max(0, Math.min(1, qualityScore));

        // PROBLEM 3 FIX: Server-side non-answer detection - override AI score
        // Use audio_transcription as fallback if student_answer is empty (audio-only questions)
        const rawStudentAnswer = answers[idx]?.student_answer?.toLowerCase().trim() || "";
        const audioTranscription = answers[idx]?.audio_transcription?.toLowerCase().trim() || "";
        const studentAnswer = rawStudentAnswer || audioTranscription;
        const nonAnswerPatterns = [
          /^i\s*don'?t\s*know/i,
          /^idk$/i,
          /^nie\s*wiem/i,
          /^no\s*idea/i,
          /^no\s*se$/i,
          /^не\s*знаю/i,
          /^dunno$/i,
          /^i\s*have\s*no\s*idea/i,
          /^i'?m?\s*not\s*sure$/i,
          /^no\s*lo\s*se$/i,
          /^je\s*ne\s*sais\s*pas$/i,
          /^ich\s*wei(ss|ß)\s*nicht$/i,
          /^não\s*sei$/i,
          /^nwm$/i,
          /^i\s*dont\s*know/i,
          /^no\s*answer/i,
          /^n\/a$/i,
          /^-$/i,
          /^\.+$/i,
          /^x+$/i,
          /^asdf/i,
          /^test$/i,
          /^nothing$/i,
          /^none$/i,
        ];
        const isNonAnswer = nonAnswerPatterns.some((p) => p.test(studentAnswer)) || studentAnswer.length === 0;

        if (isNonAnswer && qualityScore > 0.05) {
          console.log(
            `[verify-open-answers] SERVER-SIDE OVERRIDE: Non-answer detected for idx ${idx}: "${studentAnswer}" → forcing score 0.0`,
          );
          qualityScore = 0.0;
        }

        // Also catch very short non-English answers
        if (studentAnswer.length <= 2 && qualityScore > 0.3) {
          qualityScore = Math.min(qualityScore, 0.2);
        }

        let feedback = e.feedback;
        if (!feedback || feedback.length < 10 || feedback === "Thank you for your answer.") {
          if (isNonAnswer) {
            feedback = "No answer provided. Try to form at least one sentence about the topic.";
          } else if (qualityScore >= 0.9) {
            feedback = "Excellent answer! Well structured and comprehensive.";
          } else if (qualityScore >= 0.8) {
            feedback = "Very good answer with strong understanding shown.";
          } else if (qualityScore >= 0.7) {
            feedback = "Good answer with some room for improvement.";
          } else if (qualityScore >= 0.5) {
            feedback = "Partially correct. Review the suggested answer for guidance.";
          } else {
            feedback = "This answer needs improvement. Check the suggested answer for reference.";
          }
        }

        // Override feedback for non-answers regardless
        if (isNonAnswer) {
          feedback = "No answer provided. Try to form at least one sentence about the topic.";
        }

        // Extract writing and speaking scores
        const writingScore = e.writing_score !== undefined ? parseFloat(e.writing_score) : undefined;
        const speakingScore = e.speaking_score !== undefined ? parseFloat(e.speaking_score) : undefined;

        return {
          exercise_index: answers[idx]?.exercise_index,
          question_index: answers[idx]?.question_index,
          quality_score: qualityScore,
          is_acceptable: !isNonAnswer && (e.is_acceptable ?? qualityScore >= 0.7),
          feedback: feedback,
          ...(writingScore !== undefined && !isNaN(writingScore) ? { writing_score: Math.max(0, Math.min(1, writingScore)) } : {}),
          ...(speakingScore !== undefined && !isNaN(speakingScore) ? { speaking_score: Math.max(0, Math.min(1, speakingScore)) } : {}),
        };
      });

      console.log("[verify-open-answers] Successfully parsed", evaluations.length, "evaluations");
      console.log("[verify-open-answers] Evaluations:", JSON.stringify(evaluations, null, 2));
    } catch (parseError) {
      console.error("[verify-open-answers] Failed to parse AI response:", parseError);
      console.error("[verify-open-answers] Raw content was:", rawContent);

      // FIX 2.2: Dynamic fallback instead of generic
      evaluations = answers.map((a) => ({
        exercise_index: a.exercise_index,
        question_index: a.question_index,
        quality_score: 0.7,
        is_acceptable: true,
        feedback: "Good effort on this answer. Your teacher will provide detailed feedback.",
      }));
    }

    const result = {
      evaluated_at: new Date().toISOString(),
      model: "google/gemini-2.5-flash",
      evaluations,
    };

    console.log("[verify-open-answers] Evaluation complete:", evaluations.length, "answers processed");

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[verify-open-answers] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
