# Follow-up to independent ReQA — 27 October 2026

Source: owner-supplied `CampBox_Sales_OS3_ReQA_2026-10-27(1).md`, reviewed release c5ab253.

## Salary headline

The personal report headline and employee cards in the salary team view show confirmed accruals (source statuses `confirmed` and `paid`). Preliminary accruals remain separate. Every aggregate that includes preliminary amounts is explicitly labelled as a calculated total including preliminary amounts. The Excel summary uses the same status split. Calculation functions, historical rows, minimum-plan denominator and payouts are unchanged.

The UI deliberately says “Подтверждённые начисления”, not “Остаток к выплате”: source receipt/accrual statuses are not an independently reconciled payroll payment ledger. Confirmation and actual salary settlement must not be conflated.

## Minimum-plan documentation

The existing implementation uses `month_settings.min_plan`. Earlier release notes recorded an owner decision in the working conversation. No primary approval message or signed compensation regulation is attached to this repository. Therefore the UI no longer claims that an audited regulation was approved on a particular date. This note supersedes such approval claims in prior release notes; it is a technical description, not a newly approved compensation policy. No basis exists here to change the formula or historical amounts.

## PDF evidence

CI generates real PDFs and extracts their text with Poppler. It compares report dates/method, four KPI values, and every displayed table row in order to the shared report context also used in the downloaded XLSX. The matrix is 2 roles × 2 periods × 2 formats = 8 PDFs and 8 workbooks. A mismatch fails CI; creating a PDF alone no longer counts as content verification.

## Boundaries retained

This change addresses the concrete salary UX error and PDF verification gap. It does not represent all 160 screenshots as independently reviewed by a designer, certify a complete component rewrite, reconcile production bank statements, or certify the entire CSM Hub. These need their own evidence and source data. The generated local QA fixture remains documented and generated in CI.

Branch protection configuration is paused at the owner's direction; no authentication or repository administration changes are part of this follow-up. Existing workflow checks remain in place.
