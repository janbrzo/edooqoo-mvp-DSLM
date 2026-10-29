// Persist stage of the pipeline: builds the worksheets row and inserts it with
// the service role. The caller decides what a failed insert means (streaming
// throws, regular logs and carries on).
import { supabase } from "./clients.ts";
import type { GenerationRequest, WorksheetPlan } from "./composeRequest.ts";

export interface InsertedWorksheet {
  data: any;
  error: any;
}

export async function insertWorksheetRow(
  request: GenerationRequest,
  plan: WorksheetPlan,
  worksheetData: any,
  aiContent: string | null,
  generationTimeSeconds: number,
): Promise<InsertedWorksheet> {
  const { formData, userId, studentId, teacherEmail, ip, geoData, sanitizedPrompt } = request;
  const { selectedImage, selectedAudio, systemMessage } = plan;

  const fullPrompt = `SYSTEM MESSAGE:\n${systemMessage}\n\nUSER MESSAGE:\n${sanitizedPrompt}`;
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
  const aiResponseLength = aiContent?.length || 0;
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
      prompt: fullPrompt,
      form_data: sanitizedFormData,
      ai_response: aiContent?.substring(0, aiResponseLimit) || "",
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
