# PermitPilot — project guide for Claude

## What this is
PermitPilot is an AI-assisted **contract and permit review checklist** shown as a web
dashboard, built for the GenAI Hackathon for Project Managers (PMI Philippines).

A project manager uploads (or selects) a project contract and its permits. PermitPilot
shows a review checklist of what **passed**, what is **flagged**, and what is **missing**,
with every finding linked to the exact source text. The PM verifies each item and exports
an action list to CSV.

It is **decision support, not legal advice**. The PM always has the final say.

The live demo is about 3 minutes, so reliability and clarity beat features.

### Judging criteria we design for
- **40% PM pain point and impact** — time saved and issues caught must be obvious on screen.
- **35% AI tool execution** — clear, well-structured use of Claude: extraction, playbook
  checks, cross-document reasoning, evidence + confidence.
- **25% practice feasibility** — no integrations, runs locally, works on documents PMs
  already have, exports to CSV.

## Repository layout
```
CLAUDE.md            this file
README.md            run instructions + 5-step demo script
playbook.md          editable review rules (PMBOK-aligned, customise per organisation)
analysis.json        saved analysis the dashboard loads (the demo depends only on this)
analyze.js           optional: re-runs the analysis with the Anthropic API
server.js            zero-dependency static server (`npm start`)
web/                 the single-page dashboard (plain HTML/CSS/JS)
sample-data/         fictional contract, permits, and the hidden ANSWER_KEY.md
```

## Design rules
1. **Simple stack.** Plain HTML/CSS/JS, no build step, no framework, no backend required
   for the demo. Node is used only for the tiny static server and the optional `analyze.js`.
2. **No external services needed to run the demo.** No CDNs, web fonts, analytics, or
   APIs at demo time. The dashboard always loads the saved `analysis.json`.
   `analyze.js` is optional and only runs when `ANTHROPIC_API_KEY` is set.
3. **Ask before adding any dependency** that needs an account or a paid service.
4. **Every finding must cite evidence**: an exact quote from the source document plus the
   document and section. If a quote cannot be found verbatim, the item is `needs_review`
   with lowered confidence. Never invent clauses. Missing items cite the absence
   (e.g. the clause or register that should contain it).
5. **Accessible colours.** Text contrast ≥ 4.5:1. Status is never shown by colour alone —
   always pair it with an icon and a text label.
6. **Readable from the back of a room.** Base font ≥ 18px, large headings, clear status
   colours, generous spacing, no clutter.
7. **Everything is fictional.** No real company, person, address, or permit numbers.
8. **Browser-session state only.** Verify / dismiss / notes live in `sessionStorage`.

### Visual identity
| Token        | Value     | Use                                  |
|--------------|-----------|--------------------------------------|
| `--navy`     | `#14213D` | header, headings, primary text       |
| `--navy-2`   | `#1F3A68` | secondary surfaces, links            |
| `--orange`   | `#E8590C` | brand accent, primary buttons        |
| `--white`    | `#FFFFFF` | page and card background             |
| `--pass`     | `#1B7F3B` | pass / valid (✔)                     |
| `--flag`     | `#B54708` | flag / expiring (⚠)                  |
| `--fail`     | `#B42318` | missing / expired / conflict (✖)     |
| `--review`   | `#5B4BB7` | needs review (?)                     |

## Data schema (`analysis.json`)
Dates are ISO `YYYY-MM-DD`. Confidence is a number 0–1.

```jsonc
{
  "meta": {
    "generated_at": "2026-10-02T00:00:00Z",
    "generator": "manual | analyze.js",
    "playbook": "playbook.md",
    "documents": [ { "id": "CON", "title": "...", "file": "sample-data/..." } ],
    "disclaimer": "AI-assisted review. Verify with qualified professionals. Not legal advice."
  },
  "project": {
    "name": "...",
    "contract_ref": "...",
    "site_address": "...",
    "parties": [ { "role": "Employer | Contractor | ...", "name": "..." } ],
    "dates": { "contract_date": "...", "start": "...", "completion": "..." }
  },
  "impact": {
    "documents_reviewed": 7,
    "pages_reviewed": 14,
    "manual_review_minutes_estimate": 240,
    "permitpilot_minutes_estimate": 25,
    "basis": "Estimate: plain-language explanation of the assumption"
  },
  "checklist_items": [ {
    "id": "CHK-01",
    "rule_id": "C-PAY-01",               // must exist in playbook.md
    "category": "Price and payment",
    "title": "Short label",
    "status": "pass | flag | missing | needs_review",
    "severity": "High | Medium | Low",
    "finding": "Plain-language finding",
    "evidence_quote": "Exact text copied from the source",
    "source": { "document": "CON", "section": "Clause 7.2" },
    "confidence": 0.9,
    "suggested_action": "What the PM should do"
  } ],
  "permits": [ {
    "id": "PRM-01",
    "required_permit": "Building Permit",
    "status": "valid | expiring | expired | missing | mismatch",
    "permit_no": "...", "issuing_body": "...", "holder": "...", "site": "...",
    "issue_date": "...", "expiry_date": "...",
    "notes": "...",
    "source": { "document": "PRM-BP", "section": "..." }
  } ],
  "timeline": {
    "range": { "start": "...", "end": "..." },
    "milestones": [ { "id": "MS-1", "name": "...", "start": "...", "end": "...",
                      "requires_permits": ["PRM-02"], "source": { ... } } ],
    "permit_windows": [ { "permit_id": "PRM-01", "name": "...", "start": "...",
                          "end": "...", "status": "valid" } ],
    "conflicts": [ { "id": "TL-1", "milestone_id": "MS-3", "permit_id": "PRM-02",
                     "type": "starts_before_valid | runs_past_expiry | no_permit",
                     "description": "...", "days": 14, "linked_finding_ids": ["XC-01"] } ]
  },
  "cross_checks": [ {
    "id": "XC-01",
    "type": "date_conflict | name_mismatch | address_mismatch | responsibility_gap | condition_vs_schedule | security_expiry",
    "title": "...", "severity": "High", "finding": "...",
    "evidence": [ { "quote": "...", "source": { "document": "CON", "section": "..." } },
                  { "quote": "...", "source": { "document": "PRM-EX", "section": "..." } } ],
    "confidence": 0.95,
    "suggested_action": "..."
  } ],
  "actions": [ {
    "id": "ACT-01", "task": "...", "owner_role": "Project Manager",
    "due": "...", "priority": "High | Medium | Low",
    "linked_finding_ids": ["CHK-04", "XC-01"]
  } ]
}
```

### Status meanings
- `pass` — rule satisfied, evidence quoted.
- `flag` — clause exists but breaches the playbook (e.g. uncapped LDs, 90-day payment).
- `missing` — something required is absent (clause, permit, responsibility).
- `needs_review` — AI is unsure; confidence lowered; PM must read the source.

## Working agreements for Claude
- Keep quotes short and **verbatim**; `npm run validate` (scripts/validate.js) checks that
  every quote exists in its source document and every `rule_id` exists in the playbook.
- Do not make the demo depend on network access or `analyze.js`.
- Keep the UI free of clutter; prefer fewer, larger elements.
