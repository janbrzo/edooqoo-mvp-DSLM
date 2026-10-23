#!/usr/bin/env node
/**
 * Rewrites internal links that point at retired (merge/retire) routes so that
 * indexable public HTML never links to a 301 stub. Resource-list entries
 * (`<li>` containing only the retired link) are removed, because their anchor
 * text describes the retired topic; inline links are pointed at the redirect
 * target. Deterministic and idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_OVERRIDES } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const ORIGIN = 'https://edooqoo.com';

export function getRetiredRedirects(overrides = CONTENT_OVERRIDES) {
  const map = new Map();
  for (const [route, override] of Object.entries(overrides)) {
    if ((override.state === 'merge' || override.state === 'retire') && override.redirectTo) {
      map.set(route, override.redirectTo);
    }
  }
  return map;
}

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function rewriteRetiredLinks(html, redirects) {
  let out = html;
  for (const [route, target] of redirects) {
    const href = `(?:${escapeRe(ORIGIN)})?${escapeRe(route)}`;
    const listItem = new RegExp(`[ \\t]*<li>\\s*<a href=["']${href}["'][^>]*>[\\s\\S]*?<\\/a>[^<]*(?:<span[^>]*>[^<]*<\\/span>)?\\s*<\\/li>[ \\t]*\\r?\\n?`, 'g');
    out = out.replace(listItem, '');
    out = out.replace(new RegExp(`href=(["'])(${escapeRe(ORIGIN)})?${escapeRe(route)}\\1`, 'g'), (_m, q, origin) => `href=${q}${origin || ''}${target}${q}`);
  }
  return out;
}

function isRedirectStub(html) {
  return /<title>Moved \| Edooqoo<\/title>/.test(html);
}

function walk(dir, files = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, files);
    else if (item.name.endsWith('.html')) files.push(full);
  }
  return files;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const redirects = getRetiredRedirects();
  let changed = 0;
  for (const file of walk(PUBLIC)) {
    const html = fs.readFileSync(file, 'utf8');
    if (isRedirectStub(html)) continue;
    const next = rewriteRetiredLinks(html, redirects);
    if (next !== html) {
      fs.writeFileSync(file, next, 'utf8');
      changed += 1;
    }
  }
  console.log(`[retired-links] rewrote ${changed} file(s) for ${redirects.size} retired route(s)`);
}
