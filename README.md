# PermitPilot

**AI-assisted contract and permit review checklist for project managers.**
Built for the GenAI Hackathon for Project Managers (PMI Philippines).

A PM loads a project contract and its permits. PermitPilot shows a review checklist of
what **passed**, what is **flagged** and what is **missing**, with every finding linked to
the exact source text. The PM verifies each item and exports an action list to CSV.

> Decision support, **not legal advice**. The PM always has the final say.
> All sample companies, people, sites and permits are **fictional**.

## Run it (one command)

Requires Node.js 18 or later. Nothing to install.

```bash
npm start
```

Open **http://localhost:5173** and click **Load sample project**.

No Node? Open `web/index.html` directly in a browser. It falls back to the embedded copy
of the sample data in `web/sample-bundle.js`.

## 5-step demo script (about 3 minutes)

| # | Step | Say / do | Time |
|---|------|----------|------|
| 1 | **Upload** | "A PM has a fit-out contract and five permits, the documents they already have." Click **Upload contract & permits** and select the files in `sample-data/` (or click **Load sample project**). | 0:00 |
| 2 | **Analysis** | Five steps run: read, extract, apply 30 playbook rules, cross-check, verify quotes. Point at the header: **18 passed, 9 flagged, 2 missing, 1 needs review**, and the impact panel: **about 4 h becomes about 25 min** (an estimate). | 0:20 |
| 3 | **Checklist** | Filter **Flagged** and open **Liquidated damages capped**: "0.5% a day, no cap." Click **Open in document**; the exact clause is highlighted in the contract. Click **Verify**. Note the confidence bar and the one **Needs review** item: the AI says when it isn't sure. | 0:45 |
| 4 | **The date-conflict moment** | Open **Timeline**. Click the first red card: *Electrical rough-in starts 16 Nov, but the Electrical Permit is only valid from 1 Dec*. The milestone and the permit light up together. "Neither document shows this on its own." Then show **Cross-document**: the quotes from both documents sit side by side. | 1:40 |
| 5 | **Export** | Open **Action list**: 10 tasks with owner, due date and priority, each linked to its findings. Click **Export to CSV** and open it in Excel. Close: "Every finding has evidence, and the PM decides." | 2:30 |

Backup if anything fails: **Reset review** clears session state. Opening `web/index.html` directly also works offline.

## What the AI does (and how it's kept honest)

`analyze.js` sends the contract, the permits and `playbook.md` to Claude in one structured
request. In that one call, Claude:

1. **Extracts** parties, site, dates, milestones, permits, bonds and insurance.
2. **Applies every playbook rule** and returns one checklist item per rule with a status, severity, plain-language finding, suggested action and **confidence**.
3. **Reasons across documents**: milestones vs. permit validity, holder name and address vs. the contract, permit responsibility, permit conditions vs. schedule, bond and insurance expiry vs. completion.
4. **Cites evidence**: a short, exact quote plus the document and clause for every finding.

After Claude replies, `analyze.js` runs an **evidence guard**: every quote is matched
word for word against its source. Any item whose quote isn't found is downgraded to
**needs review** with confidence capped at 0.4. The dashboard's **Open in document**
button repeats the same check live.

The demo **never calls the API**. It always loads the saved `analysis.json`, so it
runs offline and gives the same result every time.

### Re-run the analysis on your own documents (optional)

```bash
npm install                       # installs @anthropic-ai/sdk (only needed for analyze.js)
export ANTHROPIC_API_KEY=sk-ant-...
node analyze.js --contract path/to/contract.md --permits path/to/permits/ --out analysis.generated.json
node scripts/validate.js analysis.generated.json   # check every quote and rule ID
cp analysis.generated.json analysis.json && npm run bundle   # show it in the dashboard
```

Text and Markdown input are supported. Convert PDFs or Word files to text first.
`node analyze.js --dry-run` builds the prompt without calling the API.

## Customise the playbook

`playbook.md` holds 30 rules aligned with PMBOK good practice across scope, schedule,
cost, risk, procurement, stakeholder and compliance management. It is meant to be
**edited for each organisation's own systems, policies and standards**:

- change the limits in **Organisation parameters** (e.g. maximum payment days, delay-penalty cap, permit buffer);
- add, remove or reword rules (one table row each, unique ID);
- adjust severities and suggested actions.

## Tests

```bash
npm test     # quote validator + answer-key coverage
```

- `scripts/validate.js` checks that every evidence quote exists verbatim in its source document, every playbook rule has exactly one checklist item, and every ID, date, status and link is valid.
- `scripts/check-answer-key.js` checks that all 8 planted issues in `sample-data/ANSWER_KEY.md` are caught. Current result: **8/8**.

| # | Planted issue | Caught by |
|---|---------------|-----------|
| 1 | Expired permit (Barangay Construction Clearance) | P-VAL-01, permit tracker, timeline, cross-check |
| 2 | Required permit missing (Fire Safety Evaluation Clearance) | P-CMP-01, permit tracker, timeline, cross-check |
| 3 | Uncapped liquidated damages | C-LD-01 (+ C-LIA-01 carve-out) |
| 4 | Payment terms of 90 days | C-PAY-02 |
| 5 | Permit holder name and street-number mismatch | P-NAM-01, P-SIT-01, permit tracker, cross-check |
| 6 | Milestone starts before its permit is valid | P-VAL-02, timeline conflict, cross-check |
| 7 | Signage Permit required but nobody responsible | C-PRM-01, cross-check |
| 8 | Performance bond expires before completion | C-BND-01, timeline, cross-check |

## Deploy to Vercel

The repo is ready to deploy as a static site with no install step. `vercel.json` runs
`node scripts/build-static.js`, which writes `dist/` and **leaves out the hidden
answer key**.

1. Go to <https://vercel.com/new> and import this GitHub repository.
2. Keep the detected settings (they come from `vercel.json`) and click **Deploy**.
3. Open the URL. `/` redirects to the dashboard.

Or deploy from your own terminal with the CLI: `npx vercel` (preview) or `npx vercel --prod`.

## Project structure

```
web/                 dashboard (index.html, styles.css, app.js, sample-bundle.js)
analysis.json        saved analysis the dashboard loads
playbook.md          editable review rules
analyze.js           optional Claude analyzer with evidence guard
server.js            zero-dependency local server (npm start)
scripts/             validate, answer-key check, bundle, static build
sample-data/         fictional contract, 5 permits, permit register, ANSWER_KEY.md
CLAUDE.md            design rules and data schema
```

## Privacy and feasibility

- Runs locally; no accounts, integrations, CDNs or tracking.
- Review state (verify, dismiss, notes, done) stays in the browser session only.
- Works on documents PMs already have; output is a CSV for any tracker or spreadsheet.

---
AI-assisted review. Verify with qualified professionals. Not legal advice.
