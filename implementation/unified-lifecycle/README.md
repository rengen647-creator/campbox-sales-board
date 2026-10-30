# CampBox unified lifecycle — Sales workstream

Status: implementation branch, NOT deployed. Plan: 2026-10-30.

## Scope (first release)
- S-01: organization / camp / contract relation; never treat contract_number as unique camp ID.
- S-02: signed event must be idempotent; reconcile daily_sales JSON vs salary_contracts before changing month KPI.
- S-03–05: confirmed training date, attendees, customer acknowledgement and handoff receipt; unknown != confirmed.
- S-07: timestamps for contact, signature, onboarding, launch, first booking, charge, payment from authoritative sources only.

## Verified baseline (read-only inspection)
Project ref: kcjzrwmznahhischkrah. Existing entities: daily_sales, salary_clients, salary_contracts, csm_camps, sales_handoff_statuses, csm_onboarding_tasks, salary_retentions. Existing csm_camps.sales_client_id, salary_contracts.sales_source_contract_key, sales_handoff_statuses.contract_key.

## Invariants
1. One contract can serve multiple camps; store distinct IDs and link records.
2. Persist one confirmed signing event per stable deal/camp relation, not contract number.
3. Signed, training scheduled, trained, launched, booking and paid are independent facts.
4. A missing handoff field is marked missing and assigned for resolution; do not delete or lose signed record.
5. No adjustment of salary/plan for 90-day nonlaunch without explicit business approval.
6. No deployment or production DDL before full DB backup and restore test.

## First checks
- Capture production baseline using the read-only SQL in CSM workstream.
- Compare existing 74 salary_contracts and 77 csm_camps (counts at inspection, not contractual truth).
- Validate uniqueness in existing sync functions and RLS before approving migrations.
- Test one contract/three camps, duplicated signed event, delayed training, RLS, salary vs UI vs export.

See unified approved plan for the remaining stages. Do not publish main until full E2E is green.
