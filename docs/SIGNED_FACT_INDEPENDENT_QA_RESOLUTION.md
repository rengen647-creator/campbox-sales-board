# Independent signing QA — 28 October 2026

This revision stays in PR #24. No production write tests or deployment are authorized by the QA workflow. The earlier migration attempts failed before applying the schema; production migration remains a separate release gate. The user approved the historical mapping in the prior turn and selected **new camp, counted once** as the plan unit in this turn.

- P0-02 / P1-01 / P1-02: legacy signing funnel, maximal scenario and priorities now use registry models. Launch totals remain separate; signing-to-launch conversion is explicitly unmeasured without deal-level links.
- P0-03: unavailable and unreconciled periods produce null fact/forecast/risk in the shared model, legacy KPIs, coach and report. PDF/XLSX export of unsound signing totals is blocked. Empty reconciled scope is a real zero.
- P1-03: editor offers existing camp selection. The database rejects a new camp with an existing normalized name; a repeat agreement reuses camp identity and has `plan_eligible=false`. Unique indexes and a camp advisory lock prevent a second new-camp achievement. Shared documents across distinct camps remain allowed. This is exact-name candidate detection, not fuzzy entity resolution; distinct spelling still requires human identity review.
- P1-04: active managers can open a new empty current/future period, close a period or reopen a reconciled period, with reason, optimistic revision and append-only period audit. Unsigned employees cannot operate it. Historical unreconciled periods and legacy signatures still require reconciliation. Signing-date corrections require a manager; closed periods require audited reopening first, then correction and re-closing. The month page shows next-month readiness.
- P1-05: registry read failures return `error`; daily data can load independently but the global status never asserts complete freshness. Failed registry reads do not mutate daily drafts.
- P1-06: delegated shared-scope handling synchronizes the main, analytics, coach and report selectors and refreshes their models.

Acceptance additions: unavailable and incomplete pure-model cases; coach null derivatives; browser simulated registry outage, unreconciled period, source preservation and scope parity; PostgreSQL duplicate camp, repeat contract, employee period denial, next-month opening, stale revision and period audit.

P0-01 remains blocked until the operational migration service works, the updated migration is tested against a private production-state copy, and the deployment is verified. The prior synthetic CI alone is not acceptance of a production-copy migration. Do not describe the entire original TZ as closed merely because the code checks pass.
