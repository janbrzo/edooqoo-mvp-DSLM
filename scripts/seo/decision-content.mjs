import fs from 'node:fs';
import path from 'node:path';

export function getDecisionCases({ root }) {
  const file = path.join(root, 'src', 'data', 'whatToTeachNextCases.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getDecisionContentRoutes({ root }) {
  return [
    '/tools/what-should-i-teach-next',
    ...getDecisionCases({ root }).map((item) => `/what-to-teach-next/${item.slug}`),
  ];
}
