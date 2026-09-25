/**
 * Civic Bounty Network — pure bounty math, kept separate from
 * `triageRoutingAgent.ts` so the well-tested department-routing logic stays
 * untouched. Triage decides the department + severity; this module turns
 * that decision into a CSR-sponsored payout.
 */

import {
  GOLD_TIER_RATING_THRESHOLD,
  SILVER_TIER_RATING_THRESHOLD,
  type ComplaintCategory,
  type GeoPoint,
  type Severity,
  type VolunteerProfile,
  type VolunteerTier,
} from '@/types/civic';
import { haversineMeters } from '@/lib/haversine';

const MIN_BOUNTY_INR = 350;
const MAX_BOUNTY_INR = 750;
export const GOLD_TIER_BONUS_INR = 100;

/** Materials + effort estimate per category, before the severity multiplier. */
const BASE_BY_CATEGORY: Record<ComplaintCategory, number> = {
  Pothole: 450,
  'Damaged road': 650,
  'Garbage accumulation': 350,
  'Broken streetlight': 400,
  'Overflowing drain': 500,
  'Fallen tree': 700,
  'Water leakage': 550,
  'Traffic obstruction': 400,
  'Damaged public infrastructure': 500,
};

const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  Emergency: 1.4,
  'Very High': 1.2,
  High: 1.0,
  Medium: 0.9,
  Low: 0.8,
};

/** Base payout, ₹350–750, from repair-effort estimate × urgency. Deterministic — same inputs, same bounty every time. */
export function computeBaseBounty(category: ComplaintCategory, severity: Severity): number {
  const raw = BASE_BY_CATEGORY[category] * SEVERITY_MULTIPLIER[severity];
  return Math.round(Math.min(MAX_BOUNTY_INR, Math.max(MIN_BOUNTY_INR, raw)) / 10) * 10;
}

export function tierForRating(rating: number): VolunteerTier {
  if (rating >= GOLD_TIER_RATING_THRESHOLD) return 'gold';
  if (rating >= SILVER_TIER_RATING_THRESHOLD) return 'silver';
  return 'bronze';
}

/** +₹100 automatic bonus once a volunteer's rating clears the gold threshold. */
export function goldBonusFor(rating: number): number {
  return rating >= GOLD_TIER_RATING_THRESHOLD ? GOLD_TIER_BONUS_INR : 0;
}

/** Recomputes a rolling average rating after one new 1–5 star review. */
export function nextRating(currentRating: number, currentCount: number, newStars: number): number {
  const total = currentRating * currentCount + newStars;
  return Math.round((total / (currentCount + 1)) * 10) / 10;
}

export function generateTransactionId(): string {
  return `#CSR-${Math.floor(10_000 + Math.random() * 89_999)}-BLR`;
}

export interface NearbyVolunteer {
  volunteer: VolunteerProfile;
  distanceMeters: number;
}

/** Volunteers within `radiusMeters` of a bounty, nearest first — used to show "N CoVs nearby" on a task card. */
export function findNearbyVolunteers(location: GeoPoint, volunteers: VolunteerProfile[], radiusMeters = 5_000): NearbyVolunteer[] {
  return volunteers
    .map((volunteer) => ({ volunteer, distanceMeters: haversineMeters(location, volunteer.homeBase) }))
    .filter((entry) => entry.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
