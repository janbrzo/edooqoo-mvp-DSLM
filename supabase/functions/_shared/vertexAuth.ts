// v6.9.65 — Shared Vertex AI access-token helper.
// Extracted from generate-image/index.ts so audit-llm-models can ping
// Vertex publisher-model endpoints with the same service-account JSON.
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pemKey);
  return await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function getVertexAccessToken(serviceAccountJson: string): Promise<string> {
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
  return tokenData.access_token as string;
}

export function getVertexProjectId(serviceAccountJson: string): string {
  const sa = JSON.parse(serviceAccountJson);
  if (!sa.project_id) throw new Error("Service account JSON missing project_id");
  return sa.project_id as string;
}