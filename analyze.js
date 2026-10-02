#!/usr/bin/env node
// PermitPilot analyzer - OPTIONAL. The demo never depends on this script; the dashboard
// always loads the saved analysis.json.
//
// Re-runs the contract + permit review with Claude when ANTHROPIC_API_KEY is set:
//   npm install            (installs @anthropic-ai/sdk, only needed for this script)
//   ANTHROPIC_API_KEY=... node analyze.js --contract path/to/contract.md \
//        --permits path/to/permits_dir_or_file [more files...] [--out analysis.generated.json]
//   node analyze.js --dry-run     (builds the prompt from sample-data, no API call)
//
// Pipeline: (1) load documents + playbook, (2) one Claude call that extracts, applies each
// playbook rule, reasons across documents and returns JSON in the analysis.json schema,
// (3) evidence guard: every quote is checked verbatim against its source; unverifiable
// items are downgraded to needs_review with lowered confidence, never silently kept.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MODEL = process.env.PERMITPILOT_MODEL || 'claude-opus-5-5';

function parseArgs(argv) {
  const args = { contract: null, permits: [], out: 'analysis.generated.json', dryRun: false, reviewDate: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--contract') args.contract = argv[++i];
    else if (a === '--permits') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) args.permits.push(argv[++i]); }
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--review-date') args.reviewDate = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  if (!args.contract) args.contract = 'sample-data/contract/CONTRACT_Office_FitOut_HRH-FO-2026-012.md';
  if (!args.permits.length) args.permits = ['sample-data/permits'];
  return args;
}

function expandFiles(paths) {
  const out = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    if (fs.statSync(abs).isDirectory()) {
      fs.readdirSync(abs).filter((f) => /\.(md|txt)$/i.test(f)).sort().forEach((f) => out.push(path.join(abs, f)));
    } else out.push(abs);
  }
  return out;
}

function loadDocuments(args) {
  const docs = [{ id: 'CON', file: path.resolve(args.contract) }];
  let n = 1;
  for (const f of expandFiles(args.permits)) {
    const id = /register/i.test(path.basename(f)) ? 'REG' : `PRM-${String(n++).padStart(2, '0')}`;
    docs.push({ id, file: f });
  }
  return docs.map((d) => {
    const text = fs.readFileSync(d.file, 'utf8');
    const title = (text.match(/^#\s+(.+)$/m) || [, path.basename(d.file)])[1].trim();
    return { ...d, title, text, relFile: path.relative(ROOT, d.file) };
  });
}

const SCHEMA_HINT = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8')
  .split('## Data schema (`analysis.json`)')[1].split('## Working agreements')[0];

function buildPrompt(docs, playbook, reviewDate) {
  const system = [
    'You are PermitPilot, a careful contract and permit review assistant for project managers.',
    'You provide decision support, not legal advice. The project manager makes every final decision.',
    'Rules you must follow:',
    '- Produce exactly one checklist item per playbook rule (use the rule IDs as given).',
    '- evidence_quote must be copied character-for-character from the named source document. Keep quotes short (one sentence or table cell run). Table rows may be quoted with their " | " separators.',
    '- If you cannot find clear evidence, set status "needs_review" and confidence at or below 0.5. Never invent clauses, dates or names.',
    '- For "missing" items, quote the text that creates the requirement and explain what is absent.',
    '- Look specifically for findings that need two documents: milestone vs. permit dates, names and addresses, responsibility gaps, permit conditions vs. schedule, bond/insurance expiry vs. completion.',
    '- Dates in ISO YYYY-MM-DD. Plain, short language a PM can read from a projector.',
    'Return ONLY a JSON object (no prose, no code fences) that follows this schema:',
    SCHEMA_HINT,
  ].join('\n');

  const docBlocks = docs.map((d) => `<document id="${d.id}" title="${d.title}">\n${d.text}\n</document>`).join('\n\n');
  const user = [
    `Review date: ${reviewDate}.`,
    'Here is the organisation playbook:',
    `<playbook>\n${playbook}\n</playbook>`,
    'Here are the documents:',
    docBlocks,
    'Analyse the documents against every playbook rule and return the JSON object.',
  ].join('\n\n');
  return { system, user };
}

// Evidence guard: same normalisation as scripts/validate.js
const norm = (s) => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

function applyEvidenceGuard(result, docs) {
  const byId = Object.fromEntries(docs.map((d) => [d.id, norm(d.text)]));
  const found = (q, src) => src && byId[src.document] && q && byId[src.document].includes(norm(q));
  let downgraded = 0;
  for (const c of result.checklist_items || []) {
    if (!found(c.evidence_quote, c.source)) {
      downgraded++;
      c.status = 'needs_review';
      c.confidence = Math.min(Number(c.confidence) || 0.5, 0.4);
      c.finding = `[Quote not verified in source - read the document] ${c.finding || ''}`;
    }
  }
  for (const x of result.cross_checks || []) {
    const bad = (x.evidence || []).filter((e) => !found(e.quote, e.source));
    if (bad.length) {
      downgraded++;
      x.confidence = Math.min(Number(x.confidence) || 0.5, 0.4);
      x.finding = `[${bad.length} quote(s) not verified in source] ${x.finding || ''}`;
    }
  }
  return downgraded;
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in model response');
  return JSON.parse(text.slice(start, end + 1));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 12).join('\n'));
    return;
  }
  const reviewDate = args.reviewDate || new Date().toISOString().slice(0, 10);
  const docs = loadDocuments(args);
  const playbook = fs.readFileSync(path.join(ROOT, 'playbook.md'), 'utf8');
  const { system, user } = buildPrompt(docs, playbook, reviewDate);

  console.log(`Documents: ${docs.map((d) => `${d.id}=${path.basename(d.file)}`).join(', ')}`);
  if (args.dryRun) {
    console.log(`Dry run: system ${system.length} chars, user ${user.length} chars. No API call made.`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. The dashboard still works with the saved analysis.json.');
    process.exit(1);
  }

  let Anthropic;
  try { Anthropic = require('@anthropic-ai/sdk'); } catch {
    console.error('Missing @anthropic-ai/sdk. Run "npm install" first (only needed for analyze.js).');
    process.exit(1);
  }
  const client = new Anthropic();

  console.log(`Calling ${MODEL} ... (this can take a few minutes)`);
  let message;
  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // re-run on Anthropic's recommended model if a safety classifier declines
      output_config: { effort: 'high' },
      system,
      messages: [{ role: 'user', content: user }],
    });
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error('Invalid API key.');
    else if (err instanceof Anthropic.RateLimitError) console.error('Rate limited - try again shortly.');
    else if (err instanceof Anthropic.APIError) console.error(`API error ${err.status}: ${err.message}`);
    else console.error(err);
    process.exit(1);
  }

  if (message.stop_reason === 'refusal') {
    console.error('The model declined this request. No output written.');
    process.exit(1);
  }
  if (message.stop_reason === 'max_tokens') console.warn('Warning: response hit max_tokens; output may be incomplete.');

  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const result = extractJson(text);

  result.meta = {
    ...(result.meta || {}),
    generated_at: new Date().toISOString(),
    review_date: reviewDate,
    generator: `analyze.js (${message.model})`,
    playbook: 'playbook.md',
    documents: docs.map((d) => ({ id: d.id, title: d.title, file: d.relFile })),
    disclaimer: 'AI-assisted review. Verify with qualified professionals. Not legal advice.',
  };
  const downgraded = applyEvidenceGuard(result, docs);

  const outPath = path.resolve(args.out);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), outPath)} (${(result.checklist_items || []).length} checklist items; ${downgraded} item(s) downgraded by the evidence guard).`);
  console.log(`Check it with: node scripts/validate.js ${path.relative(ROOT, outPath)}`);
  console.log('To show it in the dashboard, review it and copy it over analysis.json.');
}

if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exit(1); });
module.exports = { applyEvidenceGuard, loadDocuments, parseArgs, extractJson };
