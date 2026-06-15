#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'seo', 'evidence-registry.json'), 'utf8'));
const app = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
const sitemap = fs.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');

const validCases = (registry.cases || []).filter((item) =>
  item?.writtenConsent === true
  && typeof item?.baseline === 'string'
  && item.baseline.trim()
  && typeof item?.outcome === 'string'
  && item.outcome.trim()
  && typeof item?.methodology === 'string'
  && item.methodology.trim());
const evidencePublished = app.includes('path="/evidence"') || sitemap.includes('<loc>https://edooqoo.com/evidence</loc>');
const annualPublished = app.includes('path="/evidence/annual-report"')
  || sitemap.includes('<loc>https://edooqoo.com/evidence/annual-report</loc>');

if (validCases.length < 3 && evidencePublished) {
  throw new Error(`Evidence page is public with only ${validCases.length} consented, measurable cases.`);
}
if (validCases.length >= 3 && !evidencePublished) {
  throw new Error('Evidence threshold reached; implement and review /evidence before the next release.');
}

const validResponses = Number(registry.annualSurvey?.validResponses || 0);
if (validResponses < 100 && annualPublished) {
  throw new Error(`Annual report is public with only ${validResponses} valid survey responses.`);
}
if (validResponses >= 100 && registry.annualSurvey?.methodologyDocumented !== true) {
  throw new Error('Annual survey threshold reached without documented methodology.');
}
if (validResponses >= 100 && !annualPublished) {
  throw new Error('Annual report threshold reached; implement and review the report before the next release.');
}

console.log(`[evidence-audit] PASS evidence=${validCases.length}/3, annualSurvey=${validResponses}/100; unpublished below threshold.`);

