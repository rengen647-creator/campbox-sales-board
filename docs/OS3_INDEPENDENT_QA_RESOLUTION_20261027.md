# Independent QA follow-up — 27 October 2026

Source review: `CampBox_Sales_OS_3_Independent_QA_2026-10-27(1).md` supplied by owner. Base: `619e310477abbd5ed476c8b14f92b93620313e78`. Rollback: `backup/sales-board-before-qa-20261027`.

## Findings and implementation

| Finding | Change | Verification / limit |
|---|---|---|
| P0-A report context | `os3-report.js` normalizes period, cutoff, scope, working-day forecast, source rows. Preview, print, report Excel and global Excel use that model. Chart rendered independently of analytics. Future facts excluded, gaps preserved. Native Excel overview charts use matching source sheets; null chart caches do not become zero. | 16 context combinations; real workbook download read back in CI; four print artifacts. No historical financial formulas changed. |
| P0-B contracting plan | Owner explicitly selected **minimum plan** on 27 October. Existing min_plan calculation and finalized-month behavior preserved. UI names the basis. | Business function equality and existing threshold tests. No retrospective adjustment required by this decision. |
| P1-C CI | Dedicated OS3 workflow runs every PR, full node suite, generated full application fixture, screenshots for ten screens × eight widths × two themes, expanded disclosures at 125%/200%, Excel comparisons, PDF artifacts and keyboard point inspection. | Merge only after successful latest checks. Repository branch protection requires separate administrative configuration; workflow existence alone is not branch protection. |
| P1-D subsection navigation | Every static screen exposes “Перейти к подразделу”: opens ancestor disclosures, focuses and scrolls to original content. Finance and salary retain native tabs. | Screen → disclosure → subsection (three actions); finance/salary screen → tab (two). Original controls and saves remain canonical. |
| P1-E depth | Four conversion sparklines, day/week/month grouping, analytics scope; finance client/month inspector and sorting; salary confirmed/preliminary amounts, excluded receipts count/value, lifecycle events; client action lists in funnel/team and manager-specific finance link. Shared pure components and isolated state catalog. | **Partial architecture closure:** old CSS files still support legacy components. Full removal of historical style layers and a complete component rewrite are not represented as finished. |
| P2-F fixture | CI generates fixture explicitly; harness now labels local generation prerequisite. In-memory finance/salary adapter is injected only in generated fixture. | No production auth tokens, no real writes; generated app remains ignored. |

## RLS read verification

Against the linked Sales Board project, executed read-only transactions with `SET LOCAL ROLE authenticated` and the existing active manager/employee identity in transaction-local JWT subject configuration. Every transaction rolled back. No names, IDs, business rows or credentials are included in this report.

- Manager recognized; visible contract and finance counts exactly match privileged reference counts.
- Employee not recognized as manager; foreign contracts, finance charges and audit rows hidden.
- Employee contract count exactly matches reference count for own contracts (positive own-record visibility still needs a seeded test fixture).
- Relevant salary/finance/profile/month tables have RLS enabled.
- Existing `daily_sales` policy intentionally permits active staff to read the current month's team activity; edits are restricted to own current-month rows or manager. Policy unchanged.

This verifies selected database read policies, **not** end-to-end sign-in, save/reload, denial of writes, or Sales→CSM trigger execution under browser sessions. There is no existing Supabase test branch. Production was not used for test writes.

## Acceptance boundary

Do not mark the full blueprint accepted yet. Remaining work requires a disposable integration environment / test accounts for real save/reload, forbidden writes and idempotent handoff; historical CSS removal requires parity review beyond the responsive checks. Screenshots are review evidence plus layout assertions, not a maintained pixel baseline. The component gallery covers reusable states and charts; it is not a claim that every legacy input was rewritten.

## Verified automated run

Run 40498311693 at commit 56887b4 passed OS3 browser checks: 160 screen/theme/width states, 20 expanded zoom states, four downloaded workbooks with cell-by-cell equality, four print artifacts, financial inspector and keyboard chart. Six existing workflows also passed. Subsequent scope-label refinements require the same checks on the final head before merge.
