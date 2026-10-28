// Shared clients and constants of the generateWorksheet Edge Function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

export const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

// OpenAI fallback model (used only when Gemini fails). gpt-5-mini-2025-08-07 shuts
// down on 2026-12-11; gpt-5.6-terra is OpenAI's recommended replacement.
// Keep in sync with supabase/functions/_shared/modelRegistry.ts.
export const OPENAI_FALLBACK_MODEL = "gpt-5.6-terra";

// Initialize Gemini AI (primary model for faster generation)
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
export const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
