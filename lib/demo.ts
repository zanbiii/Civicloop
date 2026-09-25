import type { CivicTicket } from '@/types/civic';

export function isDemoTicket(ticket: CivicTicket): boolean {
  return ticket.tags.includes('demo-sample') || ticket.beforePhotos.some((photo) => photo.source === 'seed');
}
