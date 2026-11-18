-- 2026-11-18. Two independent, one-off site motivation events per contract:
-- (1) first website-development invoice (11%), (2) website launch (4025 RUB).
-- Legacy site invoices with payment_number IS NULL are treated as the first invoice.
-- Excluded/voided records do not block subsequent verified events.
-- No historical salaries or receipts are rewritten by this migration.
CREATE UNIQUE INDEX IF NOT EXISTS salary_site_first_invoice_once_idx
  ON public.salary_payments(contract_id)
  WHERE product_type = 'site'
    AND event_type = 'payment'
    AND COALESCE(payment_number,1) = 1
    AND status <> 'excluded';

CREATE UNIQUE INDEX IF NOT EXISTS salary_site_launch_once_idx
  ON public.salary_payments(contract_id)
  WHERE product_type = 'site'
    AND event_type = 'site_live'
    AND status <> 'excluded';
