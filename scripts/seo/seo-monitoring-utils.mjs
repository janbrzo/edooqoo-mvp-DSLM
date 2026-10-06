import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export function argValue(argv, name) {
  const exactIndex = argv.indexOf(name);
  if (exactIndex >= 0) return argv[exactIndex + 1];
  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : null;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function csvEscape(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function writeRunFiles({ root, category, date = todayIso(), report, markdown }) {
  const dir = path.join(root, 'docs', 'seo', 'runs', category);
  await fs.mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${date}.json`);
  const mdPath = path.join(dir, `${date}.md`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');
  return { jsonPath, mdPath };
}

export function readJsonIfExists(file) {
  try {
    return JSON.parse(fsSync.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function latestRun(root, category) {
  const dir = path.join(root, 'docs', 'seo', 'runs', category);
  if (!fsSync.existsSync(dir)) return null;
  const files = fsSync.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));
  if (!files.length) return null;
  const file = path.join(dir, files[0]);
  return { file, report: readJsonIfExists(file) };
}

export function bearerToken(env = process.env) {
  return env.GSC_ACCESS_TOKEN ||
    env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ||
    env.GOOGLE_ACCESS_TOKEN ||
    '';
}

/**
 * Service-account auth for the Search Console API (read-only).
 *
 * Put the downloaded key file's content in GSC_SERVICE_ACCOUNT_JSON (raw JSON or base64 of it).
 * The key never leaves this process: we sign a short-lived JWT with it and exchange that for an
 * access token. Nothing here logs or returns the private key, and error messages never contain it.
 * Setup steps: docs/seo/gsc-api-access.md.
 */
export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export function parseServiceAccount(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  let parsed;
  try {
    parsed = JSON.parse(text.startsWith('{') ? text : Buffer.from(text, 'base64').toString('utf8'));
  } catch {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is neither valid JSON nor base64-encoded JSON.');
  }
  if (!parsed?.client_email || !parsed?.private_key) {
    throw new Error('GSC_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }
  return {
    client_email: parsed.client_email,
    // Keys pasted through some secret stores arrive with literal "\n" sequences.
    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri || DEFAULT_TOKEN_URI,
  };
}

const base64url = (input) => Buffer.from(input).toString('base64url');

export function buildJwtAssertion(serviceAccount, { now = Math.floor(Date.now() / 1000), scope = GSC_READONLY_SCOPE } = {}) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope,
    aud: serviceAccount.token_uri || DEFAULT_TOKEN_URI,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  let signature;
  try {
    signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key);
  } catch {
    // Do not forward the underlying error: it can echo key material.
    throw new Error('Could not sign the JWT: the private_key in GSC_SERVICE_ACCOUNT_JSON is not a valid RSA private key.');
  }
  return `${unsigned}.${base64url(signature)}`;
}

export async function exchangeServiceAccountToken(serviceAccount, { fetchImpl = fetch, now } = {}) {
  const assertion = buildJwtAssertion(serviceAccount, { now });
  const response = await fetchImpl(serviceAccount.token_uri || DEFAULT_TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok || !json?.access_token) {
    const detail = json?.error_description || json?.error || `HTTP ${response.status}`;
    throw new Error(`Google token exchange failed: ${detail}`);
  }
  return json.access_token;
}

/**
 * Resolve a bearer token. Precedence: a ready access token in the environment, then a service
 * account. Never throws: returns { token, source, error } so the monitoring scripts can record
 * a "skipped" run with a reason instead of crashing the workflow.
 */
export async function resolveBearerToken({ env = process.env, fetchImpl = fetch, now } = {}) {
  const direct = bearerToken(env);
  if (direct) return { token: direct, source: 'access-token-env', error: '' };
  try {
    const serviceAccount = parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON);
    if (!serviceAccount) return { token: '', source: 'none', error: '' };
    const token = await exchangeServiceAccountToken(serviceAccount, { fetchImpl, now });
    return { token, source: 'service-account', error: '' };
  } catch (error) {
    return { token: '', source: 'service-account', error: error.message };
  }
}

export async function googleJsonFetch(url, { token, method = 'POST', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const message = json?.error?.message || text || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return json;
}
