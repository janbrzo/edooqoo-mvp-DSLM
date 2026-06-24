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

export function bearerToken() {
  return process.env.GSC_ACCESS_TOKEN ||
    process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ||
    process.env.GOOGLE_ACCESS_TOKEN ||
    '';
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
