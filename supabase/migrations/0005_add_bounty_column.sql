-- =========================================================================
-- Civicloop — migration 0005: bounty column
--
-- Adds one nullable jsonb column so the CSR-sponsored bounty state (base
-- amount, community pledges, claim/payout status) round-trips through
-- persistTicketAction like every other agent payload on the ticket. Purely
-- additive — safe to run even if some tickets already exist.
-- =========================================================================

alter table public.tickets add column if not exists bounty jsonb;
