import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineKm, suggestFare, toMicroDegrees, sortByDistance } from "./geo";
import { friendlyError } from "./errors";

test("haversine: one degree of latitude is about 111.19 km", () => {
  const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(d - 111.19) < 0.1, `got ${d}`);
});

test("haversine: same point is zero and is symmetric", () => {
  const a = { lat: 17.385, lng: 78.4867 };
  const b = { lat: 17.54, lng: 78.57 };
  assert.equal(haversineKm(a, a), 0);
  assert.equal(haversineKm(a, b), haversineKm(b, a));
});

test("suggested fare is distance x governed per-km rate", () => {
  const rate = 500_000_000_000_000n; // 0.0005 ETH per km
  assert.equal(suggestFare(10, rate, 1n), 5_000_000_000_000_000n); // 0.005 ETH
});

test("suggested fare never falls below the governed minimum fare", () => {
  const rate = 500_000_000_000_000n;
  const min = 1_000_000_000_000_000n; // 0.001 ETH
  assert.equal(suggestFare(0.1, rate, min), min);
});

test("coordinates convert to micro-degrees for the contract", () => {
  assert.equal(toMicroDegrees(12.345678), 12_345_678n);
  assert.equal(toMicroDegrees(-33.8688), -33_868_800n);
});

test("open rides sort by distance from the driver, nearest first", () => {
  const rides = [
    { id: "1", pickupLat: 17500, pickupLng: 78000 }, // milli-degrees
    { id: "2", pickupLat: 17386, pickupLng: 78487 },
    { id: "3", pickupLat: 17400, pickupLng: 78400 },
  ];
  const sorted = sortByDistance(rides, { lat: 17.385, lng: 78.4867 });
  assert.deepEqual(sorted.map((r) => r.id), ["2", "3", "1"]);
  assert.ok(sorted[0].distanceKm < sorted[1].distanceKm);
});

test("friendly errors explain common reverts", () => {
  assert.match(friendlyError(new Error("... reverted with the following reason: WrongStake()")), /stake/i);
  assert.match(friendlyError(new Error('Error: NotMember()')), /member/i);
  assert.match(friendlyError(new Error("RideInProgress()")), /ride in progress/i);
  assert.match(friendlyError(new Error("User rejected the request.")), /rejected/i);
  assert.match(friendlyError(new Error("weird")), /weird/);
});
