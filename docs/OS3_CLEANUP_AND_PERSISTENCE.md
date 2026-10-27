# CSS consolidation and authenticated persistence

## Runtime

`sales-board.css` is now the only application stylesheet. Nine historical CSS files and three inline head blocks have been removed. Rules were consolidated with CSSO 5.0.5 (including redundant declaration/rule reduction). The reviewed source is retained in Git at `cff8660a156671ac5562c751d1554eff0b3cf235`, not shipped as parallel runtime assets. Edit the canonical file directly; `scripts/consolidate-css.cjs` documents the one-time migration, not a routine build step.

`salaryLifecycle` uses the schema's `resumed_at` field. A scheduled pause end is not presented as an actual resumption. Compensation calculations are unchanged. The owner-approved minimum plan remains the contracting basis.

## Visual gate

The PR workflow generates the full synthetic application. For ten screens × eight widths × two themes, it swaps the reviewed and canonical CSS on the same DOM and data, compares all visible element rectangles (0.01 CSS-pixel precision), and compares full-page PNG pixels. Pixelmatch uses a 0.05 perceptual color tolerance, includes antialias pixels, and permits zero differing pixels above that tolerance. An initial byte comparison found up to 66 pixels with RGB differences of 1–2 and one 20-pixel text-antialias difference; screenshots were inspected before choosing this explicit tolerance. Dimensions must still match exactly.

The baseline commit is immutable and independent of the PR. Update it only after reviewing intentional visual changes. Failure images and JSON diagnostics are retained as workflow artifacts. Existing 160 responsive states, 20 expanded zoom states, report workbook comparisons, print artifacts and keyboard graph checks also run.

## Authenticated integration gate

A pinned Supabase CLI starts an unlinked, disposable stack on the GitHub runner. Actual Supabase Auth, PostgREST and PostgreSQL are used. The test applies repository Sales/salary/finance/retention schema and signed-handoff migration, creates active employee/manager accounts, and serves the original application with only configuration/CDN/PWA adaptations. Original init, login, input handlers, saveCurrent, saveContracts and reload paths are unchanged.

- Both roles enter all five daily facts, wait for the values in PostgreSQL, reload, and verify values/date/month.
- Both roles save a signed contract through the original editor, reload, and verify persistence.
- Repeating the signed save creates exactly one CSM card and no salary cycle.
- Employee sees a positive own salary-contract fixture; manager sees both fixtures.
- Direct employee requests to save another user's row, change the monthly plan and escalate profile role are rejected or affect zero rows, with database confirmation.

The CSM sink uses the deployed `campbox_internal.apply_salary_client` function read on 27 October, with its real conflict/link behavior, and a minimal relational CSM table fixture. This verifies the Sales handoff boundary, not the entire separate CSM application's UI or every CSM table constraint. Production received no test writes or schema changes.

Only loopback API/database URLs are accepted. Browser requests to external hosts are blocked, and generated HTML must not contain a hosted Supabase URL. Local test service credentials stay in the runner environment; they are never sent to the browser, committed or uploaded as artifacts. The stack is destroyed after the job.

## Release

Merge only after all checks on the final head pass. Rollback source: `backup/sales-board-before-cleanup-20261027`. PWA cache and stylesheet/salary asset versions advance together. Branch-protection administration is outside the connector's permissions; successful workflow runs alone do not imply a protected branch. Canonical business handlers remain in the existing application modules; this cleanup does not claim a complete framework rewrite.
