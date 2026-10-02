// Checks that every planted issue in sample-data/ANSWER_KEY.md is caught by analysis.json.
// Usage: node scripts/check-answer-key.js [analysis.json]
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const a = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || path.join(ROOT, 'analysis.json')), 'utf8'));
const key = fs.readFileSync(path.join(ROOT, 'sample-data', 'ANSWER_KEY.md'), 'utf8');

const planted = [...key.matchAll(/^\| (\d) \| \*\*(.+?)\*\*/gm)].map((m) => ({ n: Number(m[1]), name: m[2] }));

const item = (rule) => a.checklist_items.find((c) => c.rule_id === rule);
const permit = (name) => a.permits.find((p) => p.required_permit === name);
const xc = (type, re) => a.cross_checks.find((x) => x.type === type && re.test(x.title + ' ' + x.finding) && x.status !== 'ok');
const conflict = (ms, type) => a.timeline.conflicts.find((c) => c.milestone_id === ms && c.type === type);
const issue = (c) => c && c.status !== 'pass';
const has = (c, s) => c && c.evidence_quote.includes(s);

// Expected detection per planted issue (from ANSWER_KEY.md). Each check returns [ok, where].
const expect = {
  1: () => [issue(item('P-VAL-01')) && has(item('P-VAL-01'), '31 August 2026') && permit('Barangay Construction Clearance').status === 'expired',
    'CHK P-VAL-01 + permit tracker (expired) + XC/timeline'],
  2: () => [item('P-CMP-01').status === 'missing' && permit('Fire Safety Evaluation Clearance').status === 'missing' && !!xc('missing_permit', /Fire Safety/),
    'CHK P-CMP-01 (missing) + permit tracker + cross-check'],
  3: () => [issue(item('C-LD-01')) && has(item('C-LD-01'), '0.5%'), 'CHK C-LD-01 (flag)'],
  4: () => [issue(item('C-PAY-02')) && has(item('C-PAY-02'), 'ninety (90) days'), 'CHK C-PAY-02 (flag)'],
  5: () => [issue(item('P-NAM-01')) && issue(item('P-SIT-01')) && permit('Mechanical Permit').status === 'mismatch' && !!xc('name_mismatch', /Holding Corp/),
    'CHK P-NAM-01 + P-SIT-01 + permit tracker (mismatch) + cross-check'],
  6: () => [issue(item('P-VAL-02')) && !!conflict('MS-3', 'starts_before_valid') && !!xc('date_conflict', /Electrical/),
    'CHK P-VAL-02 + timeline conflict + cross-check'],
  7: () => [item('C-PRM-01').status === 'missing' && has(item('C-PRM-01'), 'Signage Permit') && !!xc('responsibility_gap', /Signage/),
    'CHK C-PRM-01 (missing) + cross-check'],
  8: () => [issue(item('C-BND-01')) && has(item('C-BND-01'), '28 February 2027') && !!xc('security_expiry', /bond/i),
    'CHK C-BND-01 (flag) + cross-check + timeline'],
};

let caught = 0;
console.log(`Planted issues in ANSWER_KEY.md: ${planted.length}\n`);
for (const p of planted) {
  let ok = false; let where = 'no expectation defined';
  try { [ok, where] = expect[p.n] ? expect[p.n]() : [false, where]; } catch (e) { where = `error: ${e.message}`; }
  if (ok) caught++;
  console.log(`${ok ? 'CAUGHT ' : 'MISSED '} #${p.n} ${p.name.padEnd(42)} ${where}`);
}
console.log(`\n${caught}/${planted.length} planted issues caught.`);
process.exit(caught === planted.length && planted.length > 0 ? 0 : 1);
