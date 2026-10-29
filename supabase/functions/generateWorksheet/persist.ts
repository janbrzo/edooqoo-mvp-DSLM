// Persist stage of the pipeline: builds the worksheets row and inserts it with
// the service role. The caller decides what a failed insert means (streaming
// throws, regular logs and carries on).
import { supabase } from "./clients.ts";
import { ENGINE_PROMPT_VERSION } from "./engineVersion.ts";
import { replaceEmDashesInJsonText } from "./emDash.ts";
import type { GenerationRequest, WorksheetPlan } from "./composeRequest.ts";

export interface InsertedWorksheet {
  data: any;
  error: any;
}

/** Lowercase hex SHA-256 of a text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * What `worksheets.prompt` stores: a version header (which engine prompt and
 * which exact system message produced the row) and the teacher's request. The
 * system message itself is core IP and is not copied into every row.
 */
export async function buildStoredPrompt(systemMessage: string, userMessage: string): Promise<string> {
  const header = `engine_prompt_version=${ENGINE_PROMPT_VERSION}; system_sha256=${await sha256Hex(systemMessage)}`;
  return `${header}\n\nUSER MESSAGE:\n${userMessage}`;
}

export async function insertWorksheetRow(
  request: GenerationRequest,
  plan: WorksheetPlan,
  worksheetData: any,
  aiContent: string | null,
  generationTimeSeconds: number,
): Promise<InsertedWorksheet> {
  const { formData, userId, studentId, teacherEmail, ip, geoData, sanitizedPrompt } = request;
  // The lookup ran beside the model call; it is long settled unless the model was very fast.
  await request.geoReady;
  const { selectedImage, selectedAudio, systemMessage } = plan;

  const storedPrompt = await buildStoredPrompt(systemMessage, sanitizedPrompt);
  const sanitizedFormData = formData ? JSON.parse(JSON.stringify(formData)) : {};

  // 🧹 OPTIMIZATION 3A: Remove base64 data URLs before saving to database
  // This saves ~0.5-3MB per worksheet and drastically reduces egress costs
  const sanitizedImage = selectedImage
    ? {
        ...selectedImage,
        url: selectedImage.url?.startsWith("data:") ? null : selectedImage.url,
        ai_generated_url: selectedImage.ai_generated_url?.startsWith("data:")
          ? null
          : selectedImage.ai_generated_url,
        thumbnail: selectedImage.thumbnail?.startsWith("data:") ? null : selectedImage.thumbnail,
      }
    : null;

  const sanitizedAudio = selectedAudio
    ? {
        ...selectedAudio,
        url: selectedAudio.url?.startsWith("data:") ? null : selectedAudio.url,
        ai_generated_audio_url: selectedAudio.ai_generated_audio_url?.startsWith("data:")
          ? null
          : selectedAudio.ai_generated_audio_url,
      }
    : null;

  // 📊 MONITORING: Log ai_response length for truncation tracking
  // ai_response is what a reopened worksheet displays first, so the em dash cleanup applies to it too.
  const cleanAiContent = aiContent === null ? null : replaceEmDashesInJsonText(aiContent);
  const aiResponseLength = cleanAiContent?.length || 0;
  const aiResponseLimit = 200000;
  const wasTruncated = aiResponseLength > aiResponseLimit;
  console.log(`📊 [MONITORING] ai_response length: ${aiResponseLength} chars, limit: ${aiResponseLimit}, truncated: ${wasTruncated}`);
  if (wasTruncated) {
    console.warn(`⚠️ [MONITORING] Worksheet ai_response TRUNCATED from ${aiResponseLength} to ${aiResponseLimit} chars`);
  }

  // Auto-generate share token at creation time (permanent, no expiration)
  const shareToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const { data, error } = await supabase
    .from("worksheets")
    .insert({
      prompt: storedPrompt,
      form_data: sanitizedFormData,
      ai_response: cleanAiContent?.substring(0, aiResponseLimit) || "",
      html_content: JSON.stringify(worksheetData),
      user_id: userId || null,
      teacher_id: userId || null,
      teacher_email: teacherEmail,
      student_id: studentId || null,
      selected_image: sanitizedImage,
      selected_audio: sanitizedAudio,
      audio_url: selectedAudio?.ai_generated_audio_url || selectedAudio?.url || null,
      audio_transcript: selectedAudio?.transcript || null,
      audio_duration: selectedAudio?.duration || null,
      audio_voice: selectedAudio?.voice || null,
      ip_address: ip,
      status: "created",
      title: worksheetData.title?.substring(0, 255) || "Generated Worksheet",
      generation_time_seconds: generationTimeSeconds,
      country: geoData.country || null,
      city: geoData.city || null,
      share_token: shareToken,
    })
    .select("id, created_at, title, share_token");

  return { data, error };
}
