-- =========================================================================
-- Civicloop — migration 0004: fix sync_impact_count()
--
-- The real bug behind every "invalid input syntax for type uuid" error so
-- far: this trigger function hardcodes `target uuid` in its body,
-- independent of ticket_supporters.ticket_id's actual column type. Once
-- migration 0002/0003 changed that column to text, every insert into
-- ticket_supporters started failing here — not in PostgREST, not in a
-- cache, but right here in the trigger itself.
-- =========================================================================

create or replace function public.sync_impact_count()
returns trigger
language plpgsql
as $$
declare
  target text := coalesce(new.ticket_id, old.ticket_id);
begin
  update public.tickets t
     set impact_count = 1 + (
           select count(*) from public.ticket_supporters s where s.ticket_id = target
         ),
         updated_at = now()
   where t.id = target;
  return null;
end;
$$;
