/**
 * Civicloop — geo-spatial primitives shared by the dedup and triage agents.
 */

import type { BoundingBox, GeoPoint } from '@/types/civic';

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(a: GeoPoint, b: GeoPoint, radiusMeters: number): boolean {
  return haversineMeters(a, b) <= radiusMeters;
}

/** Cheap rectangular prefilter, in degrees, to skip haversine on obviously distant points. */
export function boundingBoxAround(point: GeoPoint, radiusMeters: number): BoundingBox {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos(toRadians(point.lat)) || 1);
  return {
    minLat: point.lat - latDelta,
    maxLat: point.lat + latDelta,
    minLng: point.lng - lngDelta,
    maxLng: point.lng + lngDelta,
  };
}

export function isInsideBoundingBox(point: GeoPoint, box: BoundingBox): boolean {
  return (
    point.lat >= box.minLat &&
    point.lat <= box.maxLat &&
    point.lng >= box.minLng &&
    point.lng <= box.maxLng
  );
}

/** Stable key for the administrative zone a point falls in — the unit the self-healing routing graph learns over. */
export function zoneKeyFor(point: GeoPoint): string {
  return `${point.ward ?? 'Unplaced'}:${point.zone ?? 'Unzoned'}`;
}

/**
 * Ward centroids for the Bangalore neighbourhoods covered by the seed data.
 * There is no live reverse-geocoder wired up, so a citizen's map pin is
 * snapped to the nearest of these (within `WARD_SNAP_RADIUS_METERS`) to fill
 * in `ward`/`zone` — the fields the self-healing routing graph groups on.
 */
const WARD_CENTROIDS: Array<{ ward: string; zone: string; lat: number; lng: number }> = [
  { ward: 'Koramangala', zone: 'BBMP-South', lat: 12.9352, lng: 77.6245 },
  { ward: 'Ejipura', zone: 'BBMP-South', lat: 12.9412, lng: 77.6265 },
  { ward: 'Jayanagar', zone: 'BBMP-South', lat: 12.925, lng: 77.5938 },
  { ward: 'BTM Layout', zone: 'BBMP-Bommanahalli', lat: 12.9169, lng: 77.6165 },
  { ward: 'HSR Layout', zone: 'BBMP-Bommanahalli', lat: 12.9121, lng: 77.6446 },
  { ward: 'Indiranagar', zone: 'BBMP-East', lat: 12.9719, lng: 77.6412 },
  { ward: 'Whitefield', zone: 'BBMP-Mahadevapura', lat: 12.9698, lng: 77.75 },
  { ward: 'Marathahalli', zone: 'BBMP-Mahadevapura', lat: 12.9591, lng: 77.6974 },
];

const WARD_SNAP_RADIUS_METERS = 4_000;

/** Snaps a point to its nearest known ward/zone, or `null` beyond the snap radius. */
export function resolveWardZone(point: GeoPoint): { ward: string; zone: string; distanceMeters: number } | null {
  let nearest: { ward: string; zone: string; distanceMeters: number } | null = null;

  for (const centroid of WARD_CENTROIDS) {
    const distanceMeters = haversineMeters(point, { lat: centroid.lat, lng: centroid.lng });
    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = { ward: centroid.ward, zone: centroid.zone, distanceMeters };
    }
  }

  return nearest && nearest.distanceMeters <= WARD_SNAP_RADIUS_METERS ? nearest : null;
}
