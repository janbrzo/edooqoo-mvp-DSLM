import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logModelFailure } from "../_shared/modelFailureLogger.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_VERTEX_API_KEY = Deno.env.get("GEMINI_VERTEX_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH CHECK (optional) ──
    // Match generate-audio behavior: allow anonymous users to pre-generate media.
    // Token consumption is enforced separately on the worksheet generation step.
    const authHeader = req.headers.get('Authorization');
    let userId = 'anonymous';
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) userId = user.id;
      } catch (e) {
        console.warn('[GENERATE-IMAGE] Auth resolve failed, continuing anonymously:', (e as Error)?.message ?? e);
      }
    }
    // ── END AUTH CHECK ──

    const { topic, englishLevel = "B1/B2" } = await req.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required for image generation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GEMINI_VERTEX_API_KEY) {
      return new Response(JSON.stringify({ error: "Gemini Vertex API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[GENERATE-IMAGE] Starting image generation for topic: "${topic}", level: ${englishLevel}, user: ${userId}`);

    // STEP 1: Generate image using Vertex AI Imagen 4.0 Fast
    const imagePrompt = createImagePrompt(topic, englishLevel);
    console.log(`[GENERATE-IMAGE] Image prompt: ${imagePrompt.substring(0, 150)}...`);

    // Get access token from service account
    const accessToken = await getVertexAccessToken(GEMINI_VERTEX_API_KEY);

    // Parse project ID from service account JSON
    let projectId = "your-gcp-project";
    try {
      const serviceAccount = JSON.parse(GEMINI_VERTEX_API_KEY);
      projectId = serviceAccount.project_id;
      console.log(`[GENERATE-IMAGE] Using project ID: ${projectId}`);
    } catch {
      throw new Error("GEMINI_VERTEX_API_KEY must be a valid service account JSON");
    }

    const vertexEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`;

    const imageResponse = await fetch(vertexEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: imagePrompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          safetyFilterLevel: "block_few",
          personGeneration: "allow_all",
        },
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error(`[GENERATE-IMAGE] Vertex AI error: ${imageResponse.status} - ${errorText}`);
      await logModelFailure({
        model: 'imagen-4.0-fast-generate-001',
        provider: 'google',
        status: imageResponse.status,
        endpoint: vertexEndpoint,
        error: errorText.slice(0, 500),
        functionName: 'generate-image',
      });
      throw new Error(`Image generation failed: ${imageResponse.status} - ${errorText}`);
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Image) {
      console.error("[GENERATE-IMAGE] No image in Vertex AI response:", JSON.stringify(imageData));
      throw new Error("No valid image data received from Vertex AI");
    }

    // Convert to data URL
    const imageUrl = `data:image/png;base64,${base64Image}`;

    console.log(`[GENERATE-IMAGE] Image generated successfully (${Math.round(base64Image.length / 1024)}KB)`);

    // STEP 2: Generate detailed description using Gemini Pro WITH VISION
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const descriptionModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Pass the actual image to Gemini for VISUAL analysis
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/png",
      },
    };

    const descriptionPrompt = `Analyze this AI-generated image created for an English language worksheet about: "${topic}" at level ${englishLevel}.

CRITICAL: Generate a DETAILED, FACTUAL description 300 words (max 2000 chars) of EXACTLY what you see in the image.

STRUCTURE:
A. PEOPLE Count, positions, clothing (colors/styles), expressions, what they're holding/doing, interactions
B. OBJECTS Main objects (colors/sizes/materials), positions, condition, background objects  
C. ACTIONS Main activity, movements, interactions, purpose
D. SETTING Location type, background, lighting, time indicators

FORMAT:
- Present continuous "is sitting", "are discussing"
- Specific details colors, numbers, positions
- Objective "is smiling" NOT "seems happy"
- Spatial prepositions (in front of, behind, next to)
`;

    const descriptionResult = await descriptionModel.generateContent([
      descriptionPrompt,
      imagePart,
    ]);
    let detailedDescription = descriptionResult.response.text();

    if (!detailedDescription || detailedDescription.length < 100) {
      throw new Error("Generated description is too short or empty");
    }

    if (detailedDescription.length > 2000) {
      detailedDescription = detailedDescription.substring(0, 1997) + "...";
      console.log(`[GENERATE-IMAGE] Description truncated to 2000 chars`);
    }

    console.log(`[GENERATE-IMAGE] Description generated with vision analysis (${detailedDescription.length} chars)`);
    console.log(`[GENERATE-IMAGE] Description preview: ${detailedDescription.substring(0, 200)}...`);

    const finalImageUrl = imageUrl;
    const imageSource = "r2-cloudflare";
    const timestamp = Date.now();

    console.log(`[GENERATE-IMAGE] 🚀 Starting R2 upload...`);

    let finalR2Url = finalImageUrl;
    try {
      const uploadResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/upload-to-r2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          base64Image: imageUrl,
          filename: `worksheets/image_${timestamp}_${topic.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`,
          contentType: "image/png",
        }),
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          console.log(`[GENERATE-IMAGE] ✅ R2 upload successful: ${uploadData.url}`);
          finalR2Url = uploadData.url;
        } else {
          console.warn(`[GENERATE-IMAGE] ⚠️ R2 upload failed, using base64 fallback`);
        }
      } else {
        console.warn(`[GENERATE-IMAGE] ⚠️ R2 upload failed (${uploadResponse.status}), using base64 fallback`);
      }
    } catch (uploadError) {
      console.warn(`[GENERATE-IMAGE] ⚠️ R2 upload error:`, (uploadError as Error)?.message ?? String(uploadError), ", using base64 fallback");
    }

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: `vertex-ai-${timestamp}`,
          url: finalR2Url,
          ai_generated_url: finalR2Url,
          thumbnail: finalR2Url,
          description: detailedDescription.substring(0, 100) + "...",
          detailedDescription: detailedDescription,
          photographer: "AI Generated",
          photographerUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images",
          source: "vertex-ai-generated",
          storageLocation: imageSource,
          generationPrompt: imagePrompt,
          topic: topic,
          englishLevel: englishLevel,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[GENERATE-IMAGE] Error:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error)?.message ?? String(error),
        details: "Failed to generate image or description",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Convert PEM private key to ArrayBuffer
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryString = atob(pemContents);

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Import private key as CryptoKey for JWT signing
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  try {
    const keyData = pemToArrayBuffer(pemKey);

    return await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );
  } catch (error) {
    console.error("[GENERATE-IMAGE] Failed to import private key:", error);
    throw new Error(`Invalid private key format: ${(error as Error)?.message ?? String(error)}`);
  }
}

/**
 * Get OAuth2 access token from service account JSON
 */
async function getVertexAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);

  const privateKey = await importPrivateKey(serviceAccount.private_key);

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: getNumericDate(60 * 60),
      iat: getNumericDate(0),
    },
    privateKey,
  );

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Creates a detailed prompt for Gemini Imagen 3.0
 */
function createImagePrompt(topic: string, englishLevel: string): string {
  const complexity =
    {
      "A1/A2": "simple, clear, basic",
      "B1/B2": "moderate detail, everyday context",
      "C1/C2": "complex, nuanced, sophisticated",
    }[englishLevel] || "moderate detail, everyday context";

  return `Create a photorealistic image about: ${topic}

CRITICAL REQUIREMENTS:
- Style: Photorealistic, NOT artistic or illustrated
- Setting: Real-world, everyday situation (NOT staged or overly perfect)
- People: Include 2-8 people in natural interactions showing clear emotions and body language
- Context: ${complexity} scene with visible details for teaching
- Composition: Clear foreground and background, multiple elements to discuss
- Lighting: Natural, bright enough to see all details clearly
- Objects: Include relevant everyday objects related to ${topic}
- Actions: People actively doing something (not just posing)
- Emotions: Clear, identifiable facial expressions
- Teaching value: Scene should illustrate vocabulary, actions, and situations related to ${topic}

AVOID:
- Multiple pictures in one image
- Artistic filters or effects
- Overly staged or professional photography look
- Empty scenes without people
- Unclear or dark lighting
- Abstract or symbolic imagery
- Text or writing in the image (unless naturally part of scene like signs)

`;
}
