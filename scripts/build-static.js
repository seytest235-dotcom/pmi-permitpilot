// Builds the static site into dist/ for hosting (e.g. Vercel). No dependencies.
// Copies the dashboard, the saved analysis, the playbook and the sample documents.
// The hidden ANSWER_KEY.md is deliberately NOT published.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const EXCLUDE = new Set(['ANSWER_KEY.md']);

fs.rmSync(DIST, { recursive: true, force: true });
function copy(rel) {
  const src = path.join(ROOT, rel);
  const dst = path.join(DIST, rel);
  if (fs.statSync(src).isDirectory()) {
    fs.readdirSync(src).filter((f) => !EXCLUDE.has(f)).forEach((f) => copy(path.join(rel, f)));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}
require('./bundle.js'); // refresh the offline bundle first
['web', 'analysis.json', 'playbook.md', 'sample-data'].forEach(copy);
fs.writeFileSync(path.join(DIST, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=web/"><title>PermitPilot</title><a href="web/">Open PermitPilot</a>\n');
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`Built dist/ (${count(DIST)} files). ANSWER_KEY.md excluded.`);
