#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write
/**
 * audit-llm-models.ts — Procedure B inventory + live-check (v6.9.21).
 *
 * Scans supabase/functions/**\/*.ts for model references across all LLM/TTS providers,
 * live-pings each provider, and writes two reports:
 *   - docs/closed-loops/LLM_MODEL_INVENTORY.md (static inventory)
 *   - docs/closed-loops/STATUS_LIVE.md          (live check + severity)
 *
 * Usage:
 *   OPENAI_API_KEY=... GEMINI_API_KEY=... ANTHROPIC_API_KEY=... \
 *   ELEVENLABS_API_KEY=... LOVABLE_API_KEY=... \
 *   deno run --allow-net --allow-env --allow-read --allow-write scripts/audit-llm-models.ts
 */

import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

type Provider = "openai" | "google" | "anthropic" | "elevenlabs" | "lovable-gateway";
interface Hit { model: string; provider: Provider; files: Set<string>; }

const PATTERNS: { provider: Provider; re: RegExp }[] = [
  { provider: "openai",          re: /["'`](gpt-[\w.\-]+|o[1-4][\w.\-]*|tts-\d[\w.\-]*|whisper-[\w.\-]+|dall-e-\d[\w.\-]*)["'`]/g },
  { provider: "google",          re: /["'`](gemini-[\w.\-]+|google\/[\w.\-]+)["'`]/g },
  { provider: "anthropic",       re: /["'`](claude-[\w.\-]+|anthropic\/[\w.\-]+)["'`]/g },
  { provider: "elevenlabs",      re: /["'`](eleven[\w._\-]*|elevenlabs[\/_\-][\w.\-]+)["'`]/gi },
  { provider: "lovable-gateway", re: /["'`](lovable\/[\w.\-]+)["'`]/g },
];

const inventory = new Map<string, Hit>();

for await (const entry of walk("supabase/functions", { exts: [".ts"], includeDirs: false })) {
  const text = await Deno.readTextFile(entry.path);
  for (const { provider, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const model = m[1];
      const key = `${provider}:${model}`;
      const hit = inventory.get(key) ?? { model, provider, files: new Set() };
      hit.files.add(entry.path);
      inventory.set(key, hit);
    }
  }
}

console.log(`Found ${inventory.size} unique model references`);

// Inventory output
const invLines = ["# LLM Model Inventory", "", `_Generated: ${new Date().toISOString()}_`, "", "| Model | Provider | Files |", "|---|---|---|"];
for (const h of [...inventory.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))) {
  invLines.push(`| \`${h.model}\` | ${h.provider} | ${[...h.files].map(f => f.replace("supabase/functions/", "")).join(", ")} |`);
}
await Deno.mkdir("docs/closed-loops", { recursive: true });
await Deno.writeTextFile("docs/closed-loops/LLM_MODEL_INVENTORY.md", invLines.join("\n") + "\n");

// Live checks
async function checkOpenAI(model: string): Promise<number> {
  const k = Deno.env.get("OPENAI_API_KEY"); if (!k) return -1;
  const r = await fetch(`https://api.openai.com/v1/models/${model}`, { headers: { Authorization: `Bearer ${k}` } });
  await r.body?.cancel();
  return r.status;
}
async function checkGoogle(model: string): Promise<number> {
  const k = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY"); if (!k) return -1;
  const id = model.replace(/^google\//, "");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${id}?key=${k}`);
  await r.body?.cancel();
  return r.status;
}
async function checkAnthropic(model: string): Promise<number> {
  const k = Deno.env.get("ANTHROPIC_API_KEY"); if (!k) return -1;
  const id = model.replace(/^anthropic\//, "");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: id, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
  });
  const t = await r.text();
  return t.includes("model_not_found") || t.includes("not_found_error") ? 404 : r.status;
}
async function checkElevenLabs(_model: string): Promise<number> {
  const k = Deno.env.get("ELEVENLABS_API_KEY"); if (!k) return -1;
  const r = await fetch("https://api.elevenlabs.io/v1/models", { headers: { "xi-api-key": k } });
  await r.body?.cancel();
  return r.status;
}
async function checkLovable(model: string): Promise<number> {
  const k = Deno.env.get("LOVABLE_API_KEY"); if (!k) return -1;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  });
  await r.body?.cancel();
  return r.status;
}

const liveLines = ["# LLM Model Live Status", "", `_Checked: ${new Date().toISOString()}_`, "", "| Model | Provider | HTTP | Severity | Files |", "|---|---|---|---|---|"];
for (const h of [...inventory.values()]) {
  let status = -1;
  try {
    if (h.provider === "openai") status = await checkOpenAI(h.model);
    else if (h.provider === "google") status = await checkGoogle(h.model);
    else if (h.provider === "anthropic") status = await checkAnthropic(h.model);
    else if (h.provider === "elevenlabs") status = await checkElevenLabs(h.model);
    else if (h.provider === "lovable-gateway") status = await checkLovable(h.model);
  } catch (e) {
    console.error(`[${h.provider}/${h.model}] check failed:`, (e as Error).message);
  }
  const sev = status === -1 ? "SKIPPED (no key)"
            : status === 404 || status === 410 ? "🔴 CRITICAL (deprecated?)"
            : status >= 500 ? "🟡 WARNING (provider 5xx)"
            : status >= 200 && status < 300 ? "✅ OK"
            : `⚠️ ${status}`;
  liveLines.push(`| \`${h.model}\` | ${h.provider} | ${status} | ${sev} | ${[...h.files].length} file(s) |`);
}
await Deno.writeTextFile("docs/closed-loops/STATUS_LIVE.md", liveLines.join("\n") + "\n");
console.log("Wrote docs/closed-loops/LLM_MODEL_INVENTORY.md and STATUS_LIVE.md");