#!/usr/bin/env node
/**
 * submit-indexnow.mjs — tell Bing (and other IndexNow engines) which URLs changed.
 *
 * ChatGPT search relies in part on Bing's index, so fast Bing recrawling of new, changed,
 * redirected and de-indexed URLs helps AI visibility. IndexNow keys are public by design:
 * the key file public/b0d429545b2a03cc5e81ab5521f7df9f.txt must be reachable at https://edooqoo.com/b0d429545b2a03cc5e81ab5521f7df9f.txt BEFORE sending.
 *
 *   npm run seo:indexnow -- --file=docs/seo/indexnow-urls-2026-10.txt          # dry run (default)
 *   npm run seo:indexnow -- --file=docs/seo/indexnow-urls-2026-10.txt --send    # actually submit
 *   npm run seo:indexnow -- --urls=/a,/b --send
 *
 * Operator-run on purpose: sending publishes URLs to a third-party service. Max 10,000 URLs per call.
 * Only edooqoo.com URLs are accepted; paths are expanded against the canonical host.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOST = 'edooqoo.com';
const KEY = 'b0d429545b2a03cc5e81ab5521f7df9f';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

export function toUrls(entries) {
  const urls = new Set();
  for (const raw of entries.map((e) => e.trim()).filter((e) => e && !e.startsWith('#'))) {
    const url = raw.startsWith('http') ? raw : `https://${HOST}${raw.startsWith('/') ? raw : `/${raw}`}`;
    const parsed = new URL(url);
    if (parsed.hostname !== HOST) throw new Error(`Refusing non-${HOST} URL: ${raw}`);
    urls.add(parsed.toString());
  }
  return [...urls];
}

async function main() {
  const entries = [
    ...(arg('urls') ? arg('urls').split(',') : []),
    ...(arg('file') ? fs.readFileSync(path.resolve(ROOT, arg('file')), 'utf8').split('\n') : []),
  ];
  const urlList = toUrls(entries);
  if (!urlList.length) {
    console.error('Pass --urls=/a,/b or --file=path (one URL or path per line, # for comments).');
    process.exit(2);
  }
  if (urlList.length > 10000) throw new Error('IndexNow accepts at most 10,000 URLs per request.');
  console.log(`[indexnow] ${urlList.length} URL(s) for ${HOST}; key file ${KEY_LOCATION}`);

  const keyCheck = await fetch(KEY_LOCATION).catch(() => null);
  const keyText = keyCheck?.ok ? (await keyCheck.text()).trim() : '';
  if (keyText !== KEY) {
    console.error(`[indexnow] Key file not live at ${KEY_LOCATION} (got ${keyCheck ? keyCheck.status : 'no response'}). Deploy first.`);
    process.exit(1);
  }
  if (!args.includes('--send')) {
    console.log('[indexnow] Dry run. First 5:\n  ' + urlList.slice(0, 5).join('\n  ') + '\nAdd --send to submit.');
    return;
  }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  console.log(`[indexnow] HTTP ${response.status} (200 or 202 = accepted)`);
  if (![200, 202].includes(response.status)) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
