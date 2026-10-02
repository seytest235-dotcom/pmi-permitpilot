// Validates an analysis file against the source documents and the playbook.
// Usage: node scripts/validate.js [analysis.json]
// Checks: every quote appears verbatim in its source document, every rule_id exists in
// playbook.md, every playbook rule has a checklist item, linked ids resolve, dates are ISO.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = path.resolve(process.argv[2] || path.join(ROOT, 'analysis.json'));
const a = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const warnings = [];

// Whitespace is collapsed and markdown bold markers removed; the text is otherwise exact.
const norm = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

const docs = {};
for (const d of a.meta.documents) {
  const p = path.join(ROOT, d.file);
  if (!fs.existsSync(p)) { errors.push(`Document ${d.id}: file not found (${d.file})`); continue; }
  docs[d.id] = norm(fs.readFileSync(p, 'utf8'));
}

function checkQuote(where, quote, source) {
  if (!quote) return errors.push(`${where}: missing quote`);
  if (!source || !docs[source.document]) return errors.push(`${where}: unknown source document ${source && source.document}`);
  if (!docs[source.document].includes(norm(quote))) {
    errors.push(`${where}: quote not found verbatim in ${source.document}: "${quote}"`);
  }
}

const playbook = fs.readFileSync(path.join(ROOT, a.meta.playbook || 'playbook.md'), 'utf8');
const ruleIds = [...playbook.matchAll(/^\| ([CP]-[A-Z]+-\d+) \|/gm)].map((m) => m[1]);

const ids = new Set();
const addId = (id, where) => { if (ids.has(id)) errors.push(`Duplicate id ${id} (${where})`); ids.add(id); };
a.checklist_items.forEach((c) => addId(c.id, 'checklist'));
a.cross_checks.forEach((x) => addId(x.id, 'cross_checks'));
a.permits.forEach((p) => addId(p.id, 'permits'));
a.timeline.milestones.forEach((m) => addId(m.id, 'milestones'));
(a.timeline.securities || []).forEach((s) => addId(s.id, 'securities'));

const STATUS = ['pass', 'flag', 'missing', 'needs_review'];
const SEV = ['High', 'Medium', 'Low'];
const covered = new Set();
for (const c of a.checklist_items) {
  const w = `${c.id} (${c.rule_id})`;
  if (!ruleIds.includes(c.rule_id)) errors.push(`${w}: rule_id not in playbook`);
  covered.add(c.rule_id);
  if (!STATUS.includes(c.status)) errors.push(`${w}: bad status ${c.status}`);
  if (!SEV.includes(c.severity)) errors.push(`${w}: bad severity ${c.severity}`);
  if (!(c.confidence >= 0 && c.confidence <= 1)) errors.push(`${w}: confidence out of range`);
  if (c.status === 'needs_review' && c.confidence > 0.75) warnings.push(`${w}: needs_review with high confidence`);
  for (const k of ['category', 'finding', 'suggested_action']) if (!c[k]) errors.push(`${w}: missing ${k}`);
  checkQuote(w, c.evidence_quote, c.source);
}
for (const r of ruleIds) if (!covered.has(r)) errors.push(`Playbook rule ${r} has no checklist item`);

for (const x of a.cross_checks) {
  if (!x.evidence || x.evidence.length < 2) warnings.push(`${x.id}: cross-check has fewer than 2 evidence quotes`);
  const docsUsed = new Set((x.evidence || []).map((e) => e.source.document));
  if (docsUsed.size < 2 && x.type !== 'responsibility_gap' && x.type !== 'security_expiry') {
    warnings.push(`${x.id}: cross-check cites only one document`);
  }
  (x.evidence || []).forEach((e, i) => checkQuote(`${x.id} evidence[${i}]`, e.quote, e.source));
}

const PSTATUS = ['valid', 'expiring', 'expired', 'missing', 'mismatch'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const checkDate = (where, d, nullable) => {
  if (d === null && nullable) return;
  if (!ISO.test(d || '') || isNaN(Date.parse(d))) errors.push(`${where}: bad date ${d}`);
};
for (const p of a.permits) {
  if (!PSTATUS.includes(p.status)) errors.push(`${p.id}: bad permit status ${p.status}`);
  const nullable = p.status === 'missing';
  checkDate(`${p.id}.issue_date`, p.issue_date, nullable);
  checkDate(`${p.id}.expiry_date`, p.expiry_date, nullable);
}
for (const m of a.timeline.milestones) {
  checkDate(`${m.id}.start`, m.start); checkDate(`${m.id}.end`, m.end);
  (m.requires_permits || []).forEach((pid) => { if (!ids.has(pid)) errors.push(`${m.id}: unknown permit ${pid}`); });
}

const linkable = (lst, where) => (lst || []).forEach((id) => { if (!ids.has(id)) errors.push(`${where}: unknown linked id ${id}`); });
a.timeline.conflicts.forEach((t) => {
  linkable(t.linked_finding_ids, t.id);
  if (!ids.has(t.milestone_id)) errors.push(`${t.id}: unknown milestone ${t.milestone_id}`);
  if (!ids.has(t.permit_id)) errors.push(`${t.id}: unknown permit/security ${t.permit_id}`);
});
a.cross_checks.forEach((x) => linkable(x.linked_finding_ids, x.id));
a.actions.forEach((t) => {
  linkable(t.linked_finding_ids, t.id);
  checkDate(`${t.id}.due`, t.due);
  if (!SEV.includes(t.priority)) errors.push(`${t.id}: bad priority ${t.priority}`);
});

const count = (s) => a.checklist_items.filter((c) => c.status === s).length;
console.log(`Checklist: ${a.checklist_items.length} items (pass ${count('pass')}, flag ${count('flag')}, missing ${count('missing')}, needs_review ${count('needs_review')})`);
console.log(`Playbook rules: ${ruleIds.length}, permits: ${a.permits.length}, cross-checks: ${a.cross_checks.length}, conflicts: ${a.timeline.conflicts.length}, actions: ${a.actions.length}`);
warnings.forEach((w) => console.log(`WARN  ${w}`));
errors.forEach((e) => console.log(`ERROR ${e}`));
console.log(errors.length ? `\nFAILED with ${errors.length} error(s)` : '\nOK - all quotes verified verbatim against source documents');
process.exit(errors.length ? 1 : 0);
