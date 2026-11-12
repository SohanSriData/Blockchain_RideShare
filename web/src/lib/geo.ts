export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_KM = 6371.0088;

/** Great-circle distance. Used as the fallback when the routing service is unavailable. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Suggested fare in wei: distance x governed per-km rate, never below the governed minimum. Editable by the rider. */
export function suggestFare(distanceKm: number, perKmRate: bigint, minFare: bigint): bigint {
  const milliKm = BigInt(Math.ceil(distanceKm * 1000));
  const fare = (milliKm * perKmRate) / 1000n;
  return fare < minFare ? minFare : fare;
}

/** Degrees to the contract's micro-degree integers (it rounds to 3 decimals on-chain). */
export function toMicroDegrees(deg: number): bigint {
  return BigInt(Math.round(deg * 1e6));
}

/** Event coordinates are milli-degrees (3 decimals). */
export function fromMilliDegrees(v: number): number {
  return v / 1000;
}

export function sortByDistance<T extends { pickupLat: number; pickupLng: number }>(
  rides: T[],
  from: LatLng,
): (T & { distanceKm: number })[] {
  return rides
    .map((r) => ({
      ...r,
      distanceKm: haversineKm(from, { lat: fromMilliDegrees(r.pickupLat), lng: fromMilliDegrees(r.pickupLng) }),
    }))
    .sort((x, y) => x.distanceKm - y.distanceKm);
}
