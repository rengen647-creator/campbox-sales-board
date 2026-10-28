# Signed sales release — staged, 28 October 2026

Immutable source backup: `d750e8497f10e028517e06a6de8e559007c5d013`. Restore this commit and the pre-migration database snapshot together; reverting JavaScript alone does not restore database triggers.

`sql/signed-facts.sql` is staging input, not a production migration or backfill. It introduces a read-only signed event register, stable camp identity, shared document identity, deal revisions, audit and explicit period gates. Financial cycles and client launches are separate. All periods start closed and unreconciled. Production code must not switch until the reconciled period has been approved and populated.

The inspected production database has additional triggers absent from this source release: number uniqueness, automatic salary cycles and number propagation. The staged SQL removes these trigger connections without deleting financial data. It retains an independent Sales→CSM branch and records a CSM error without rolling back the confirmed event. Review the exact live definitions again before applying.

Required release order:
1. Preserve a database backup including daily_sales, handoff state, salary cycles and trigger definitions. Code backup alone is insufficient.
2. Generate migration with the pinned Supabase CLI (`migration new`), using reviewed staging SQL. No production write tests.
3. Run the read-only reconciliation SQL and approve the explicit legacy deal→camp→event mapping and resulting monthly totals. No matching by document number alone.
4. Run PostgreSQL and real local Auth/PostgREST tests, shared report exports and responsive/browser evidence on final SHA.
5. Apply approved migration/backfill transaction, open/reconcile approved periods, deploy frontend, verify live read-only counts and event IDs.

No rollback, no backfill and no period approval is executed by this document. A missing/unreconciled period must remain visibly incomplete. Closed-period corrections require a separately approved correction procedure; ordinary employees and normal contract saves cannot bypass closure.

UI acceptance includes signed source separation, cohort denominator, signed-event drill-down, stable save status and compensation receipt labels. Existing finance formulas are intentionally retained. Full aesthetic acceptance, contrast measurements and final screenshots must be reviewed with the final source, not inferred from passing arithmetic tests.
