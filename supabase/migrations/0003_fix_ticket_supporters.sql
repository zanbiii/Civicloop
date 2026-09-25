-- =========================================================================
-- Civicloop — migration 0003: fix ticket_supporters column types
--
-- Migration 0002 reported success but ticket_supporters.ticket_id (and its
-- siblings) never actually changed type — verified live against the REST
-- API. This re-does just that table's portion of 0002, idempotently, so it
-- is safe to run even if some of it already partially applied.
-- =========================================================================

alter table public.ticket_supporters drop constraint if exists ticket_supporters_ticket_id_fkey;
alter table public.ticket_supporters drop constraint if exists ticket_supporters_source_ticket_id_fkey;
alter table public.ticket_supporters drop constraint if exists ticket_supporters_supporter_id_fkey;
drop policy if exists supporters_insert on public.ticket_supporters;

alter table public.ticket_supporters
  alter column id               type text,
  alter column id               set default gen_random_uuid()::text,
  alter column ticket_id        type text,
  alter column source_ticket_id type text,
  alter column supporter_id     type text;

alter table public.ticket_supporters
  add constraint ticket_supporters_ticket_id_fkey
    foreign key (ticket_id) references public.tickets (id) on delete cascade,
  add constraint ticket_supporters_source_ticket_id_fkey
    foreign key (source_ticket_id) references public.tickets (id) on delete set null;

create policy supporters_insert on public.ticket_supporters
  for insert with check (supporter_id = (auth.uid())::text);

alter table public.ticket_supporters
  add column if not exists supporter jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
