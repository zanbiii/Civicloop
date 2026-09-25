-- =========================================================================
-- Civicloop — migration 0002: app-native identity columns
--
-- schema.sql modeled reporter_id / assigned_officer / supporter_id /
-- corrected_by / every primary key as `uuid`, on the assumption that
-- Supabase Auth would mint them. The app never adopted Supabase Auth — its
-- agents mint their own stable string ids (ticket ids like "tkt-...",
-- routing-override ids like "override-hsr-drain", citizen ids like
-- "citizen-8816"). This migration relaxes those columns to `text` so the
-- app's own ids can be stored directly, and adds two columns (`reporter` on
-- tickets, `supporter` on ticket_supporters) to hold the privacy-preserving
-- PublicReporter JSON the app already builds, since no such column existed.
--
-- Additive and non-destructive: no rows are dropped, only column types and
-- constraints change. Safe to run once against the schema.sql base.
-- =========================================================================

-- sla_watchlist selects tickets.id directly, so Postgres refuses the type
-- change underneath it. Drop it now, recreate it verbatim at the end.
drop view if exists public.sla_watchlist;

-- tickets_citizen_insert compares reporter_id to auth.uid() (uuid), which
-- would no longer typecheck once reporter_id is text. Drop it now, recreate
-- with an explicit cast at the end. (In practice this app only ever writes
-- through the service-role key, which bypasses RLS entirely — this policy
-- only matters if a real Supabase Auth session is added later.)
drop policy if exists tickets_citizen_insert on public.tickets;

-- supporters_insert compares supporter_id to auth.uid() (uuid) — same
-- problem, on ticket_supporters. Drop and recreate with a cast, same reasoning.
drop policy if exists supporters_insert on public.ticket_supporters;

-- Drop the FKs that assumed a real auth.users-backed profiles.id uuid.
alter table public.agent_audit_logs   drop constraint if exists agent_audit_logs_ticket_id_fkey;
alter table public.routing_events     drop constraint if exists routing_events_ticket_id_fkey;
alter table public.ticket_supporters  drop constraint if exists ticket_supporters_ticket_id_fkey;
alter table public.ticket_supporters  drop constraint if exists ticket_supporters_source_ticket_id_fkey;
alter table public.ticket_supporters  drop constraint if exists ticket_supporters_supporter_id_fkey;
alter table public.tickets            drop constraint if exists tickets_master_ticket_id_fkey;
alter table public.tickets            drop constraint if exists tickets_reporter_id_fkey;
alter table public.tickets            drop constraint if exists tickets_assigned_officer_fkey;
alter table public.routing_overrides  drop constraint if exists routing_overrides_corrected_by_fkey;

-- Relax every identity/reference column the app populates with its own ids.
alter table public.tickets
  alter column id                 type text,
  alter column id                 set default gen_random_uuid()::text,
  alter column master_ticket_id   type text,
  alter column reporter_id        type text,
  alter column assigned_officer   type text;

alter table public.ticket_supporters
  alter column id                 type text,
  alter column id                 set default gen_random_uuid()::text,
  alter column ticket_id          type text,
  alter column source_ticket_id   type text,
  alter column supporter_id       type text;

alter table public.routing_events
  alter column id                 type text,
  alter column id                 set default gen_random_uuid()::text,
  alter column ticket_id          type text;

alter table public.agent_audit_logs
  alter column id                 type text,
  alter column id                 set default gen_random_uuid()::text,
  alter column ticket_id          type text;

alter table public.routing_overrides
  alter column id                 type text,
  alter column id                 set default gen_random_uuid()::text,
  alter column corrected_by       type text;

-- Re-add referential integrity, now text-to-text within our own id space.
alter table public.tickets
  add constraint tickets_master_ticket_id_fkey
    foreign key (master_ticket_id) references public.tickets (id) on delete set null;

alter table public.ticket_supporters
  add constraint ticket_supporters_ticket_id_fkey
    foreign key (ticket_id) references public.tickets (id) on delete cascade,
  add constraint ticket_supporters_source_ticket_id_fkey
    foreign key (source_ticket_id) references public.tickets (id) on delete set null;

alter table public.routing_events
  add constraint routing_events_ticket_id_fkey
    foreign key (ticket_id) references public.tickets (id) on delete cascade;

alter table public.agent_audit_logs
  add constraint agent_audit_logs_ticket_id_fkey
    foreign key (ticket_id) references public.tickets (id) on delete cascade;

-- The privacy-preserving PublicReporter JSON (id, displayName, maskedPhone,
-- verified, ward) — never the raw phone number — has no column to live in yet.
alter table public.tickets
  add column if not exists reporter jsonb not null default '{}'::jsonb;

alter table public.ticket_supporters
  add column if not exists supporter jsonb not null default '{}'::jsonb;

-- Recreate sla_watchlist verbatim (schema.sql's definition) now that tickets.id is text.
create or replace view public.sla_watchlist as
  select
    t.id,
    t.reference_code,
    t.category,
    t.severity,
    t.status,
    t.assigned_department,
    t.impact_count,
    t.sla_due_at,
    t.escalation_level,
    case
      when t.sla_started_at is null or t.sla_hours = 0 then 0
      else round(
        extract(epoch from (now() - t.sla_started_at)) / (t.sla_hours * 3600.0) * 100
      )::numeric
    end as percent_elapsed,
    case
      when t.status in ('Resolved', 'Rejected') then 'met'
      when t.sla_due_at is null then 'on_track'
      when now() >= t.sla_due_at then 'breached'
      when now() >= t.sla_started_at + (t.sla_due_at - t.sla_started_at) * 0.75 then 'warning'
      else 'on_track'
    end as computed_health
  from public.tickets t
  where t.is_master
    and t.status not in ('Resolved', 'Rejected')
  order by percent_elapsed desc;

-- Recreate tickets_citizen_insert with an explicit cast, now that reporter_id is text.
create policy tickets_citizen_insert on public.tickets
  for insert with check (reporter_id = (auth.uid())::text);

-- Recreate supporters_insert with an explicit cast, now that supporter_id is text.
create policy supporters_insert on public.ticket_supporters
  for insert with check (supporter_id = (auth.uid())::text);
