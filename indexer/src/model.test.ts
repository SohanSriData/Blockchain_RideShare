import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadModel } from "./model.js";
import type { IndexedEvent } from "./events.js";

const A = "0x00000000000000000000000000000000000000a1";
const B = "0x00000000000000000000000000000000000000b2";
const C = "0x00000000000000000000000000000000000000c3";
const GOV = "0x00000000000000000000000000000000000000d4";

let block = 0n;
function ev(name: string, args: Record<string, unknown>, b?: bigint): IndexedEvent {
  block = b ?? block + 1n;
  return { name, args, blockNumber: block, logIndex: 0 };
}

const requested = (id: bigint, rider = A, fare = 100n) =>
  ev("RideRequested", { id, rider, fare, pickupLat: 12346, pickupLng: 77123, dropLat: 12400, dropLng: 77200 });

function fresh() {
  block = 0n;
  return new ReadModel(":memory:");
}

/** The full lifecycle used by several tests. */
function lifecycle(): IndexedEvent[] {
  block = 0n;
  return [
    ev("MemberJoined", { member: B, stake: 10n }),
    requested(1n, A, 1000n),
    requested(2n, A, 500n),
    ev("RideAccepted", { id: 1n, driver: B }),
    ev("FareSplit", { id: 1n, driver: B, driverAmount: 950n, fee: 50n }),
    ev("RideCompleted", { id: 1n, rider: A, driver: B, claimed: false }),
    ev("TreasuryDeposit", { from: "0x00000000000000000000000000000000000000e5", amount: 50n }),
    ev("RatingSubmitted", { rideId: 1n, rater: A, ratee: B, role: 0, score: 5 }),
    ev("RideCancelled", { id: 2n, rider: A, driver: "0x0000000000000000000000000000000000000000", refund: 500n }),
  ];
}

test("open rides lists only requested rides, oldest first", () => {
  const m = fresh();
  m.apply([requested(1n), requested(2n), ev("RideAccepted", { id: 1n, driver: B }), requested(3n)]);
  assert.deepEqual(m.openRides().map((r) => r.id), ["2", "3"]);
  const r = m.openRides()[0];
  assert.equal(r.rider, A);
  assert.equal(r.fare, "100");
  assert.equal(r.pickupLat, 12346);
});

test("a single ride can be looked up by id", () => {
  const m = fresh();
  m.apply([requested(1n), requested(2n, B, 250n), ev("RideAccepted", { id: 2n, driver: A })]);
  assert.equal(m.ride(1)?.rider, A);
  assert.equal(m.ride(2)?.status, "Accepted");
  assert.equal(m.ride(2)?.fare, "250");
  assert.equal(m.ride(3), undefined);
});

test("cancelled and completed rides leave the open list", () => {
  const m = fresh();
  m.apply(lifecycle());
  assert.deepEqual(m.openRides(), []);
});

test("history lists rides for both rider and driver with outcome and split", () => {
  const m = fresh();
  m.apply(lifecycle());
  const rider = m.history(A);
  assert.deepEqual(rider.map((r) => [r.id, r.status]), [["1", "Completed"], ["2", "Cancelled"]]);
  assert.equal(rider[0].fee, "50");
  assert.equal(rider[0].driverAmount, "950");
  const driver = m.history(B);
  assert.deepEqual(driver.map((r) => r.id), ["1"]);
  assert.deepEqual(m.history(C), []);
});

test("history address match is case-insensitive", () => {
  const m = fresh();
  m.apply(lifecycle());
  assert.equal(m.history(A.toUpperCase().replace("0X", "0x")).length, 2);
});

test("claimed completion is recorded", () => {
  const m = fresh();
  m.apply([requested(1n), ev("RideAccepted", { id: 1n, driver: B }),
    ev("RideCompleted", { id: 1n, rider: A, driver: B, claimed: true })]);
  assert.equal(m.history(B)[0].claimed, true);
});

test("reputation summary: sum, count and x100 average per role, or no ratings", () => {
  const m = fresh();
  m.apply([
    ev("RatingSubmitted", { rideId: 1n, rater: A, ratee: B, role: 0, score: 5 }),
    ev("RatingSubmitted", { rideId: 2n, rater: A, ratee: B, role: 0, score: 4 }),
    ev("RatingSubmitted", { rideId: 3n, rater: A, ratee: B, role: 0, score: 4 }),
    ev("RatingSubmitted", { rideId: 3n, rater: B, ratee: A, role: 1, score: 1 }),
  ]);
  assert.deepEqual(m.reputation(B).driver, { count: 3, sum: 13, averageX100: 433 });
  assert.deepEqual(m.reputation(B).rider, { count: 0, sum: 0, averageX100: null });
  assert.deepEqual(m.reputation(A).rider, { count: 1, sum: 1, averageX100: 100 });
  assert.equal(m.reputation(C).driver.averageX100, null);
});

test("reputation average rounds half-up", () => {
  const m = fresh();
  const scores = [3, 3, 3, 3, 3, 3, 4, 5]; // 27/8 = 3.375
  m.apply(scores.map((s, i) => ev("RatingSubmitted", { rideId: BigInt(i + 1), rater: A, ratee: B, role: 0, score: s })));
  assert.equal(m.reputation(B).driver.averageX100, 338);
});

test("proposals expose tallies, quorum and status", () => {
  const m = fresh();
  m.apply([
    ev("ProposalCreated", { id: 1n, proposer: A, kind: 0, value: 8n, recipient: "0x0000000000000000000000000000000000000000", endTime: 1000n, quorum: 2n }),
    ev("VoteCast", { id: 1n, voter: A, support: true }),
    ev("VoteCast", { id: 1n, voter: B, support: true }),
    ev("VoteCast", { id: 1n, voter: C, support: false }),
  ]);
  const open = m.proposals(900)[0];
  assert.equal(open.kind, "Fee");
  assert.equal(open.forVotes, 2);
  assert.equal(open.againstVotes, 1);
  assert.equal(open.status, "open");
  assert.equal(m.proposals(1000)[0].status, "passed"); // voting ended, quorum met, for > against
  m.apply([ev("ProposalExecuted", { id: 1n }), ev("ParameterChanged", { kind: 0, value: 8n })]);
  assert.equal(m.proposals(2000)[0].status, "executed");
});

test("proposal statuses failed when quorum missed or against wins", () => {
  const m = fresh();
  const zero = "0x0000000000000000000000000000000000000000";
  m.apply([
    ev("ProposalCreated", { id: 1n, proposer: A, kind: 1, value: 5n, recipient: zero, endTime: 10n, quorum: 2n }),
    ev("VoteCast", { id: 1n, voter: A, support: true }),
    ev("ProposalCreated", { id: 2n, proposer: A, kind: 2, value: 5n, recipient: zero, endTime: 10n, quorum: 1n }),
    ev("VoteCast", { id: 2n, voter: A, support: false }),
  ]);
  assert.deepEqual(m.proposals(11).map((p) => p.status), ["failed", "failed"]);
});

test("treasury balance and history follow deposits and spends", () => {
  const m = fresh();
  m.apply([
    ev("TreasuryDeposit", { from: A, amount: 50n }),
    ev("TreasuryDeposit", { from: GOV, amount: 25n }),
    ev("TreasurySpend", { proposalId: 1n, to: B, amount: 30n }),
  ]);
  const t = m.treasury();
  assert.equal(t.balance, "45");
  assert.deepEqual(t.history.map((h) => [h.type, h.amount]), [["deposit", "50"], ["deposit", "25"], ["spend", "30"]]);
});

test("members follow join and exit", () => {
  const m = fresh();
  m.apply([ev("MemberJoined", { member: A, stake: 1n }), ev("MemberJoined", { member: B, stake: 1n }),
    ev("MemberExited", { member: A, stake: 1n })]);
  assert.deepEqual(m.members(), [B]);
});

test("rebuild from scratch by replaying events gives the identical read model", () => {
  const events = lifecycle();
  const a = fresh();
  a.apply(events);
  const before = a.snapshot();
  a.reset();
  assert.deepEqual(a.openRides(), []);
  a.apply(events);
  assert.deepEqual(a.snapshot(), before);
  const b = fresh();
  b.apply(events);
  assert.deepEqual(b.snapshot(), before);
});

test("re-applying already-seen events is a no-op (cursor)", () => {
  const events = lifecycle();
  const m = fresh();
  m.apply(events);
  const before = m.snapshot();
  m.apply(events);
  assert.deepEqual(m.snapshot(), before);
  assert.equal(m.treasury().balance, "50");
});
