# PermitPilot Review Playbook

**Version:** 1.0 (sample) - **Owner:** PMO / Project Controls

> **Customise this file.** These rules are a starting point based on generally accepted,
> PMBOK-aligned project management good practice. They are **not** an official PMI
> standard and **not** legal advice. Each organisation should edit the thresholds, rules,
> severities and actions to match its own systems, policies, standards, delegation of
> authority and local regulations, and have them reviewed by its legal and compliance teams.

## How the playbook is used

1. PermitPilot (Claude) reads the contract, the permits and this playbook.
2. Every rule below becomes **one checklist item** with a status:
   `pass` · `flag` (present but breaches the rule) · `missing` (required item absent) ·
   `needs_review` (not sure - a person must read the source).
3. Every item must cite an **exact quote** and its **source** (document + clause/section).
4. Rules marked **Cross-document** need both the contract and the permits to check.
5. The PM verifies, dismisses or annotates each item. **The PM has the final say.**

### How to edit
- Change a threshold in **Organisation parameters**; rules refer to them by name.
- Add a rule by adding a row with a new unique `ID` (keep the prefix: `C-` contract, `P-` permit).
- Severity guide: **High** = could stop work, cause a regulatory breach, or create
  uncapped/large financial exposure. **Medium** = material cost, cash-flow or schedule
  risk that can be negotiated or managed. **Low** = housekeeping / good practice.
- Keep the table format (one rule per row) so `analyze.js` and `scripts/validate.js` can read it.

## Organisation parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `MAX_PAYMENT_DAYS` | 60 | Longest acceptable payment term after a valid invoice |
| `MAX_RETENTION_PCT` | 10 | Maximum retention, with a defined release |
| `MAX_LD_CAP_PCT` | 10 | Liquidated damages must be capped at or below this % of contract price |
| `MIN_DLP_MONTHS` | 12 | Minimum defects liability period |
| `BOND_MIN_COVER` | Practical Completion + 28 days | Performance security must remain valid at least this long |
| `PERMIT_BUFFER_DAYS` | 60 | Permits should remain valid this long after the latest finish of the work they cover |
| `PERMIT_RENEWAL_LEAD_DAYS` | 30 | Start renewal at least this many days before expiry (or the permit's own rule, if longer) |
| `MAX_DELAY_NOTICE_DAYS` | 28 | Longest acceptable notice period for delay / claims events |

## PMBOK alignment

| PermitPilot category | PMBOK knowledge area / performance domain |
|----------------------|-------------------------------------------|
| Scope | Scope Management · Delivery domain |
| Price and payment | Cost Management · Measurement domain |
| Schedule and milestones | Schedule Management · Planning domain |
| Delay penalties | Cost / Risk Management |
| Change management | Integrated Change Control · Planning domain |
| Warranties | Quality Management · Delivery domain |
| Insurance and bonds | Risk Management · Uncertainty domain |
| Liability and indemnity | Risk Management · Uncertainty domain |
| Termination | Procurement Management |
| Force majeure | Risk Management · Uncertainty domain |
| Disputes | Procurement / Stakeholder Management |
| Subcontracting | Procurement Management |
| Notices | Communications Management · Stakeholder domain |
| Renewal | Procurement Management |
| Permit responsibility | Compliance (Risk / Procurement) · Stakeholder domain |
| Permit validity, match, scope, conditions, completeness, renewal | Compliance · Schedule / Risk Management |

---

## Contract rules

| ID | Category | Check | Severity | Suggested PM action |
|----|----------|-------|----------|---------------------|
| C-SCO-01 | Scope | The scope of works is defined in a schedule or annex, and work outside it is handled as a variation. | High | Confirm the scope annex matches the approved design and tender; list any exclusions in the scope baseline. |
| C-SCO-02 | Scope | Employer-supplied items and interfaces (furniture, equipment, access, information) have firm dates or a defined lead time. | Medium | Agree and record firm dates for employer-supplied items in the baseline schedule; add them to the stakeholder/interface register. |
| C-PAY-01 | Price and payment | The price basis (lump sum, remeasured, cost-plus) is stated, with the limited grounds for adjustment. | Medium | Record the price basis and allowed adjustments in the cost baseline. |
| C-PAY-02 | Price and payment | Payment is due within `MAX_PAYMENT_DAYS` days of a valid invoice. | Medium | Negotiate payment terms down to 60 days or less, or plan cash flow and contingency for the longer cycle. |
| C-PAY-03 | Price and payment | Retention is at or below `MAX_RETENTION_PCT`% and has a defined release (e.g. half at completion, half after the defects period). | Low | Track retention amounts and release dates in the cost log. |
| C-SCH-01 | Schedule and milestones | Commencement date, completion date and a milestone schedule are stated, with an obligation to submit and update a programme. | High | Load contract milestones into the schedule baseline and set programme update reminders. |
| C-SCH-02 | Schedule and milestones | Extension of time is available for employer delays, variations, force majeure and delays by authorities in issuing permits. | Medium | Set up an extension-of-time register; diarise notice deadlines. |
| C-LD-01 | Delay penalties | Liquidated damages are stated as a rate **and** are capped at or below `MAX_LD_CAP_PCT`% of the contract price, and are within the overall liability cap. | High | Negotiate an LD cap (typically 5-10% of contract price); until then, record uncapped LD exposure in the risk register and escalate. |
| C-CHG-01 | Change management | Variations must be instructed in writing, priced, and assessed for time impact before the work proceeds. | Medium | Use a change log; require written instructions and quotations before any changed work starts. |
| C-WAR-01 | Warranties | A defects liability period of at least `MIN_DLP_MONTHS` months, with response times, and manufacturer warranties assigned to the employer. | Medium | Diarise the end of the defects period; collect warranties at handover. |
| C-INS-01 | Insurance and bonds | Contractor's All Risk and third-party liability insurance cover the full contract value and run until the end of the defects period. | High | Obtain certificates before mobilisation and set expiry reminders. |
| C-BND-01 | Insurance and bonds | The performance security remains valid until at least `BOND_MIN_COVER` (or the end of the defects period, if policy requires). | High | Require the bond to be extended to cover completion plus the buffer before mobilisation; add bond expiry to the risk register. |
| C-LIA-01 | Liability and indemnity | Total liability is capped, consequential loss is excluded, and carve-outs from the cap are limited and reasonable. | Medium | Have legal review the cap and its exceptions against company policy. |
| C-IND-01 | Liability and indemnity | Indemnities are mutual and fault-based (each party covers its own negligence). | Medium | Confirm indemnities with legal; check insurance responds to them. |
| C-TRM-01 | Termination | Both parties have termination rights with defined grounds, notice periods and payment for work done. | Medium | Record termination triggers and notice periods in the contract summary. |
| C-FM-01 | Force majeure | Force majeure covers locally relevant events (e.g. typhoon, flood, earthquake), with a notice period and a long-stop termination right. | Medium | Add typhoon-season risks to the risk register; diarise force majeure notice periods. |
| C-DIS-01 | Disputes | A tiered dispute process (negotiation, mediation, then arbitration or courts) exists and work continues during disputes. | Low | Record the escalation path and contacts in the stakeholder plan. |
| C-SUB-01 | Subcontracting | Subcontracting requires employer consent and the contractor stays responsible for subcontractors. | Low | Keep an approved-subcontractor list; check each subcontractor's licences. |
| C-NOT-01 | Notices | Notices must be in writing, with addresses and deemed-receipt rules; delay/claim notice periods are no longer than `MAX_DELAY_NOTICE_DAYS` days. | Low | Set up a correspondence register and notice deadline reminders. |
| C-REN-01 | Renewal | The contract does not renew automatically, or renewal requires advance written notice and agreement. | Low | Diarise the end date and any renewal notice deadline. |
| C-PRM-01 | Permit responsibility | **Every** permit the contract requires is assigned to a named party (employer or contractor) to obtain. | High | Assign each unassigned permit by written instruction or contract amendment; add it to the responsibility matrix (RACI). |
| C-PRM-02 | Permit responsibility | The contract requires permits in the correct legal name and site address, forbids work before permits are valid, and requires conditions to be followed. | Medium | Brief the site team; make "permit valid?" a gate in the work-start checklist. |

## Permit rules

| ID | Category | Check | Severity | Suggested PM action |
|----|----------|-------|----------|---------------------|
| P-VAL-01 | Permit validity | Each permit on file is in force today and is not expired before the work it covers starts. | High | Renew or re-apply immediately; do not start the related work until a valid permit is on file. |
| P-VAL-02 | Permit validity | **Cross-document:** each permit's valid-from and valid-until dates cover every milestone that needs it (no work before a permit is valid). | High | Re-sequence the affected milestone or expedite the permit; record the conflict in the risk register and the schedule. |
| P-NAM-01 | Permit name and site match | **Cross-document:** the permit holder name matches the contracting party's exact legal name. | High | Ask the issuing office to correct the permit holder name before the related work starts or inspection. |
| P-SIT-01 | Permit name and site match | **Cross-document:** the permit site address matches the contract site address exactly (building, floor, street number). | High | Request a corrected permit from the issuing office; keep the correspondence on file. |
| P-SCO-01 | Permit scope match | **Cross-document:** the permit's scope of work covers the matching contract scope for that trade. | Medium | Compare permit scope with the scope annex; apply for an amendment if work is not covered. |
| P-CON-01 | Permit conditions | **Cross-document:** permit conditions (working hours, inspections, hold points) are compatible with the contract schedule and methods. | Medium | Add permit conditions and inspection hold points to the schedule and the site induction. |
| P-CMP-01 | Permit completeness | **Cross-document:** every permit required by the contract (permit schedule, milestones, clauses) is on file in the permit register. | High | Apply for the missing permit now; track it weekly until issued; block the dependent milestone. |
| P-REN-01 | Permit renewal | Permits that expire within `PERMIT_BUFFER_DAYS` days after the latest finish of their work have a renewal planned at least `PERMIT_RENEWAL_LEAD_DAYS` days before expiry. | Medium | Set a renewal reminder and assign an owner; add renewal to the schedule. |
