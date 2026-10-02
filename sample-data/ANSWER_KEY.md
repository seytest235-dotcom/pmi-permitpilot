# ANSWER KEY - planted issues (hidden from the demo UI)

> For testing PermitPilot only. All documents in /sample-data are fictional.

Review date assumed for the demo: **2 October 2026**.
Project: Level 12 and Level 14 Office Fit-Out, Meridian Point Tower (Agreement No. HRH-FO-2026-012).

## Planted issues (must all be caught)

| # | Issue | Where | Exact evidence | Expected status |
|---|-------|-------|----------------|-----------------|
| 1 | **Expired permit** - Barangay Construction Clearance expired before works start (MS-1 starts 19 October 2026). | PRM-05 | "Valid Until \| 31 August 2026" | Permit `expired`; checklist `flag`, High |
| 2 | **Required permit missing** - Fire Safety Evaluation Clearance is required (Annex C Part A, MS-6) but is not on file or in the Permit Register. | Contract Annex C Part A vs. PERMIT_REGISTER | "Fire Safety Evaluation Clearance" (Annex C) - absent from register | Permit `missing`; checklist `missing`, High |
| 3 | **Uncapped liquidated damages** - 0.5% per day with no cap, and Clause 17.1 carves LDs out of the liability cap. | Contract 12.1, 17.1 | "liquidated damages at the rate of one-half of one percent (0.5%) of the Contract Price for each calendar day of delay" / "save for liquidated damages under Clause 12" | `flag`, High |
| 4 | **Payment terms over 60 days** - 90 days after invoice. | Contract 7.3 | "within ninety (90) days after receipt of a valid invoice" | `flag`, Medium/High |
| 5 | **Name and address mismatch** - Mechanical Permit holder is "Halcyon Ridge Holding Corp." (not "Holdings, Inc.") and address is "86" (not "88") Sampaguita Ridge Avenue. Clause 9.3 requires exact name and address. | PRM-03 vs. Contract 9.3 / 1.1 | "Halcyon Ridge Holding Corp." / "86 Sampaguita Ridge Avenue" | Permit `mismatch`; cross-check, High |
| 6 | **Milestone starts before permit is valid** - MS-3 Electrical rough-in starts 16 November 2026, Electrical Permit is valid only from 1 December 2026 (15 days early). Clause 9.4 forbids this. | Annex B MS-3 vs. PRM-02 | "16 November 2026" / "Valid From \| 1 December 2026" | Timeline conflict; cross-check, High |
| 7 | **Permit required but no one responsible** - Clause 4.6 requires a Signage Permit, but it is in neither Part A nor Part B of Annex C. | Contract 4.6 vs. Annex C | "Exterior signage on the Level 12 facade shall be installed only upon issuance of the Signage Permit by the City." | `missing` (responsibility gap), Medium/High |
| 8 | **Performance bond expires before completion** - bond valid until 28 February 2027; Practical Completion is 31 March 2027 and the Defects Liability Period runs 12 months after that. | Contract 15.2 vs. 1.1 / 13.1 | "The performance bond shall remain valid until 28 February 2027." | `flag`, High |

## Secondary findings (realistic side-effects, acceptable to catch)

- **Signage Permit also not on file** - follows from #7 (needed for MS-7 from 11 January 2027).
- **Sanitary/Plumbing Permit expiring** - valid until 15 April 2027, only 15 days after Practical Completion; its own condition requires renewal 30 days before expiry (by 16 March 2027, during commissioning). Expected permit status `expiring`, Low/Medium.
- **Employer-supplied items "on dates to be agreed"** (Clause 5.3) - deliberately vague; expected `needs_review`, not a planted issue.

## Items that should PASS

| Area | Evidence |
|------|----------|
| Scope defined and bounded | Clause 2.2 + Annex A |
| Fixed lump-sum price | Clause 6.2 |
| Retention 5%, released in halves | Clause 7.4 |
| Written variation procedure with price and time impact | Clauses 10.1-10.2 |
| Extension of time incl. permit delay by authority | Clause 11.1 |
| Defects Liability Period 12 months | Clause 13.1 |
| CAR insurance until end of DLP | Clause 14.1 |
| Indemnities mutual and fault-based | Clauses 16.1-16.2 |
| Subcontracting needs Employer consent | Clause 18.1 |
| Termination rights both sides, with notice | Clauses 19.1-19.2 |
| Force majeure with notice and long-stop | Clause 20 |
| Notices clause | Clause 21 |
| Tiered dispute resolution | Clause 22 |
| No automatic renewal | Clause 23.2 |
| Building Permit valid, name and address match | PRM-01 |
| Building Permit noisy-works condition matches contract | PRM-01 condition 2 vs. Clause 4.5 |
| Electrical and Sanitary permits name/address match | PRM-02, PRM-04 |
