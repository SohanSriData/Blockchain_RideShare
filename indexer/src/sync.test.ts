import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadModel } from "./model.js";
import { Syncer, type ChainSource } from "./sync.js";
import type { IndexedEvent } from "./events.js";

const A = "0x00000000000000000000000000000000000000a1";

/** A fake chain: block n holds its events; hash derives from salt + content so a different history differs. */
class FakeChain implements ChainSource {
  blocks: IndexedEvent[][] = [[]]; // block 0 = genesis
  constructor(public salt: string) {}
  mine(...events: Omit<IndexedEvent, "blockNumber" | "logIndex">[]) {
    const n = BigInt(this.blocks.length);
    this.blocks.push(events.map((e, i) => ({ ...e, blockNumber: n, logIndex: i })));
  }
  async head() { return BigInt(this.blocks.length - 1); }
  async blockHash(n: bigint) {
    const b = this.blocks[Number(n)];
    return b ? `${this.salt}:${n}:${JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v))}` : null;
  }
  async logs(from: bigint, to: bigint) { return this.blocks.slice(Number(from), Number(to) + 1).flat(); }
}

const request = (id: bigint) => ({ name: "RideRequested", args: { id, rider: A, fare: 100n, pickupLat: 1, pickupLng: 2, dropLat: 3, dropLng: 4 } });

test("sync catches up to head and then picks up new blocks incrementally", async () => {
  const chain = new FakeChain("x");
  chain.mine(request(1n));
  const model = new ReadModel(":memory:");
  const s = new Syncer(model, chain);
  await s.sync();
  assert.deepEqual(model.openRides().map((r) => r.id), ["1"]);
  chain.mine(request(2n), request(3n));
  await s.sync();
  assert.deepEqual(model.openRides().map((r) => r.id), ["1", "2", "3"]);
  assert.equal(model.lastBlock(), 2n);
});

test("a restart on the same chain resumes without duplicating events", async () => {
  const chain = new FakeChain("x");
  chain.mine(request(1n));
  const model = new ReadModel(":memory:");
  await new Syncer(model, chain).sync();
  await new Syncer(model, chain).sync(); // "restarted" indexer, same database
  assert.equal(model.openRides().length, 1);
});

test("a wiped and restarted chain leaves no stale data", async () => {
  const old = new FakeChain("old");
  old.mine(request(1n));
  old.mine(request(2n));
  old.mine(request(3n));
  const model = new ReadModel(":memory:");
  await new Syncer(model, old).sync();
  assert.equal(model.openRides().length, 3);

  const fresh = new FakeChain("new"); // fresh anvil: shorter, different hashes
  fresh.mine(request(1n));
  await new Syncer(model, fresh).sync();
  assert.deepEqual(model.openRides().map((r) => r.id), ["1"]);
  assert.equal(model.lastBlock(), 1n);
});

test("a restarted chain that grows past the old height is still detected by block hash", async () => {
  const old = new FakeChain("old");
  old.mine(request(1n));
  const model = new ReadModel(":memory:");
  await new Syncer(model, old).sync();

  const fresh = new FakeChain("new");
  fresh.mine(request(7n));
  fresh.mine(request(8n));
  fresh.mine(request(9n));
  await new Syncer(model, fresh).sync();
  assert.deepEqual(model.openRides().map((r) => r.id), ["7", "8", "9"]);
});

test("a same-height reorg replaces the orphaned block's events", async () => {
  const chain = new FakeChain("x");
  chain.mine(request(1n));
  chain.mine(request(2n));
  const model = new ReadModel(":memory:");
  const s = new Syncer(model, chain);
  await s.sync();
  chain.blocks[2] = [{ ...request(5n), blockNumber: 2n, logIndex: 0 }]; // block 2 replaced
  await s.sync();
  assert.deepEqual(model.openRides().map((r) => r.id), ["1", "5"]);
});

test("rebuild-by-replay after the chain restarted equals a clean index of the same chain", async () => {
  const chain = new FakeChain("x");
  chain.mine(request(1n));
  chain.mine({ name: "RideAccepted", args: { id: 1n, driver: A } });
  const live = new ReadModel(":memory:");
  await new Syncer(live, chain).sync();
  const clean = new ReadModel(":memory:");
  await new Syncer(clean, chain).sync();
  assert.deepEqual(live.snapshot(), clean.snapshot());
});
