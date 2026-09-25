/**
 * Server-only data access for Supabase persistence. Every function here
 * either returns a value or throws — callers (app/actions.ts) decide what
 * "Supabase not configured" or "a write failed" means for the user.
 */

import { getServiceSupabase } from '@/lib/supabase/client';
import {
  agentLogToRow,
  overrideToRow,
  routingEventToRow,
  rowToAgentLog,
  rowToRoutingOverride,
  rowToTicket,
  supporterToRow,
  ticketToRow,
  type AgentLogRow,
  type RoutingEventRow,
  type RoutingOverrideRow,
  type SupporterRow,
  type TicketRow,
} from '@/lib/supabase/mappers';
import type { AgentAuditLog, CivicTicket, RoutingEvent, RoutingOverride, TicketSupporter } from '@/types/civic';

const AGENT_LOG_LIMIT = 500;

function requireClient() {
  const client = getServiceSupabase();
  if (!client) throw new Error('Supabase is not configured.');
  return client;
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown Supabase error'}`);
}

/** Fetches every ticket, fully assembled with its supporters and routing history. */
export async function listTickets(now: Date = new Date()): Promise<CivicTicket[]> {
  const client = requireClient();

  const [tickets, supporters, events] = await Promise.all([
    client.from('tickets').select('*').order('created_at', { ascending: false }),
    client.from('ticket_supporters').select('*').order('joined_at', { ascending: true }),
    client.from('routing_events').select('*').order('created_at', { ascending: true }),
  ]);
  if (tickets.error) fail('listTickets', tickets.error);
  if (supporters.error) fail('listTickets (supporters)', supporters.error);
  if (events.error) fail('listTickets (routing events)', events.error);

  const supportersByTicket = new Map<string, SupporterRow[]>();
  for (const row of (supporters.data ?? []) as SupporterRow[]) {
    const bucket = supportersByTicket.get(row.ticket_id);
    if (bucket) bucket.push(row);
    else supportersByTicket.set(row.ticket_id, [row]);
  }

  const eventsByTicket = new Map<string, RoutingEventRow[]>();
  for (const row of (events.data ?? []) as RoutingEventRow[]) {
    const bucket = eventsByTicket.get(row.ticket_id);
    if (bucket) bucket.push(row);
    else eventsByTicket.set(row.ticket_id, [row]);
  }

  return ((tickets.data ?? []) as TicketRow[]).map((row) =>
    rowToTicket(row, supportersByTicket.get(row.id) ?? [], eventsByTicket.get(row.id) ?? [], now),
  );
}

export async function listRoutingOverrides(): Promise<RoutingOverride[]> {
  const client = requireClient();
  const { data, error } = await client.from('routing_overrides').select('*').order('weight', { ascending: false });
  if (error) fail('listRoutingOverrides', error);
  return ((data ?? []) as RoutingOverrideRow[]).map(rowToRoutingOverride);
}

export async function listAgentLogs(limit = AGENT_LOG_LIMIT): Promise<AgentAuditLog[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('agent_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('listAgentLogs', error);
  return ((data ?? []) as AgentLogRow[]).reverse().map(rowToAgentLog);
}

export async function isEmpty(): Promise<boolean> {
  const client = requireClient();
  const { count, error } = await client.from('tickets').select('id', { count: 'exact', head: true });
  if (error) fail('isEmpty', error);
  return (count ?? 0) === 0;
}

/* ------------------------------------------------------------------------- */
/* Writes                                                                     */
/* ------------------------------------------------------------------------- */

export async function upsertTicket(ticket: CivicTicket): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('tickets').upsert(ticketToRow(ticket));
  if (error) fail(`upsertTicket(${ticket.id})`, error);
}

export async function insertSupporter(supporter: TicketSupporter): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('ticket_supporters').insert(supporterToRow(supporter));
  if (error) fail(`insertSupporter(${supporter.id})`, error);
}

export async function insertRoutingEvent(event: RoutingEvent): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('routing_events').insert(routingEventToRow(event));
  if (error) fail(`insertRoutingEvent(${event.id})`, error);
}

export async function upsertRoutingOverride(override: RoutingOverride): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('routing_overrides').upsert(overrideToRow(override));
  if (error) fail(`upsertRoutingOverride(${override.id})`, error);
}

export async function insertAgentLogs(logs: AgentAuditLog[]): Promise<void> {
  if (logs.length === 0) return;
  const client = requireClient();
  const { error } = await client.from('agent_audit_logs').insert(logs.map(agentLogToRow));
  if (error) fail('insertAgentLogs', error);
}

/** Wipes every table (children first, for the FKs) and reseeds from scratch. */
export async function resetAll(): Promise<void> {
  const client = requireClient();
  const tables = ['agent_audit_logs', 'routing_events', 'ticket_supporters', 'tickets', 'routing_overrides'];
  for (const table of tables) {
    const { error } = await client.from(table).delete().not('id', 'is', null);
    if (error) fail(`resetAll(${table})`, error);
  }
}

export interface SeedBundle {
  tickets: CivicTicket[];
  routingOverrides: RoutingOverride[];
  agentLogs: AgentAuditLog[];
}

/** One-time bulk load, used both at first boot and after a demo reset. */
export async function seedAll(bundle: SeedBundle): Promise<void> {
  const client = requireClient();

  const ticketRows = bundle.tickets.map(ticketToRow);
  const supporterRows = bundle.tickets.flatMap((ticket) => ticket.supporters.map(supporterToRow));
  const eventRows = bundle.tickets.flatMap((ticket) => ticket.routingHistory.map(routingEventToRow));
  const overrideRows = bundle.routingOverrides.map(overrideToRow);
  const logRows = bundle.agentLogs.map(agentLogToRow);

  const ticketsResult = await client.from('tickets').insert(ticketRows);
  if (ticketsResult.error) fail('seedAll(tickets)', ticketsResult.error);

  const [supportersResult, eventsResult, overridesResult, logsResult] = await Promise.all([
    supporterRows.length ? client.from('ticket_supporters').insert(supporterRows) : Promise.resolve({ error: null }),
    eventRows.length ? client.from('routing_events').insert(eventRows) : Promise.resolve({ error: null }),
    overrideRows.length ? client.from('routing_overrides').insert(overrideRows) : Promise.resolve({ error: null }),
    logRows.length ? client.from('agent_audit_logs').insert(logRows) : Promise.resolve({ error: null }),
  ]);
  if (supportersResult.error) fail('seedAll(ticket_supporters)', supportersResult.error);
  if (eventsResult.error) fail('seedAll(routing_events)', eventsResult.error);
  if (overridesResult.error) fail('seedAll(routing_overrides)', overridesResult.error);
  if (logsResult.error) fail('seedAll(agent_audit_logs)', logsResult.error);
}
