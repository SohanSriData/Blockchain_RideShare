import { DatabaseSync } from "node:sqlite";
import { KIND_NAMES, type IndexedEvent } from "./events.js";

const ZERO = "0x0000000000000000000000000000000000000000";

export interface RideView {
  id: string;
  rider: string;
  driver: string | null;
  fare: string;
  status: "Requested" | "Accepted" | "Completed" | "Cancelled";
  claimed: boolean;
  fee: string | null;
  driverAmount: string | null;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface ProfileView {
  count: number;
  sum: number;
  /** average x100 rounded half-up (437 = 4.37); null when there are no ratings */
  averageX100: number | null;
}

export interface ProposalView {
  id: string;
  proposer: string;
  kind: (typeof KIND_NAMES)[number];
  value: string;
  recipient: string | null;
  endTime: number;
  quorum: number;
  forVotes: number;
  againstVotes: number;
  executed: boolean;
  /** open until endTime; then passed (quorum met and for > against), failed, or executed */
  status: "open" | "passed" | "failed" | "executed";
}

const str = (v: unknown) => String(v as bigint | number | string);
const addr = (v: unknown) => String(v).toLowerCase();

/** Read model rebuilt purely from contract events. It has no keys and no write path to the chain. */
export class ReadModel {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.createTables();
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS members (address TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS rides (
        id INTEGER PRIMARY KEY, rider TEXT, driver TEXT, fare TEXT, status TEXT,
        claimed INTEGER DEFAULT 0, fee TEXT, driver_amount TEXT,
        pickup_lat INTEGER, pickup_lng INTEGER, drop_lat INTEGER, drop_lng INTEGER);
      CREATE TABLE IF NOT EXISTS ratings (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, ride_id INTEGER, rater TEXT, ratee TEXT, role INTEGER, score INTEGER);
      CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY, proposer TEXT, kind INTEGER, value TEXT, recipient TEXT,
        end_time INTEGER, quorum INTEGER, for_votes INTEGER DEFAULT 0, against_votes INTEGER DEFAULT 0,
        executed INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS treasury (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, counterparty TEXT, amount TEXT, block INTEGER);
      CREATE TABLE IF NOT EXISTS params (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, kind INTEGER, value TEXT, block INTEGER);
    `);
  }

  /** Drop everything and start again (fresh local chain, reorg, or full rebuild). */
  reset() {
    this.db.exec(`
      DROP TABLE IF EXISTS meta; DROP TABLE IF EXISTS members; DROP TABLE IF EXISTS rides;
      DROP TABLE IF EXISTS ratings; DROP TABLE IF EXISTS proposals; DROP TABLE IF EXISTS treasury;
      DROP TABLE IF EXISTS params;`);
    this.createTables();
  }

  close() {
    this.db.close();
  }

  private getMeta(key: string): string | undefined {
    return (this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value;
  }

  private setMeta(key: string, value: string) {
    this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  /** Last block fully applied, or -1. */
  lastBlock(): bigint {
    return BigInt(this.getMeta("lastBlock") ?? "-1");
  }

  /** Hash of the last applied block, used to detect a reorg or a restarted chain. */
  lastBlockHash(): string | undefined {
    return this.getMeta("lastBlockHash");
  }

  setCheckpoint(block: bigint, hash: string) {
    this.setMeta("lastBlock", block.toString());
    this.setMeta("lastBlockHash", hash);
  }

  /** Apply events in chain order. Events at or below the stored cursor are ignored, so replays are safe. */
  apply(events: IndexedEvent[]) {
    let cursor = this.getMeta("cursor");
    const cur = cursor ? cursor.split(":").map(BigInt) : [-1n, -1n];
    this.db.exec("BEGIN");
    try {
      for (const e of events) {
        if (e.blockNumber < cur[0] || (e.blockNumber === cur[0] && BigInt(e.logIndex) <= cur[1])) continue;
        this.handle(e);
        cur[0] = e.blockNumber;
        cur[1] = BigInt(e.logIndex);
      }
      this.setMeta("cursor", `${cur[0]}:${cur[1]}`);
      if (cur[0] > this.lastBlock()) this.setMeta("lastBlock", cur[0].toString());
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  private handle(e: IndexedEvent) {
    const a = e.args;
    const db = this.db;
    switch (e.name) {
      case "MemberJoined":
        db.prepare("INSERT OR IGNORE INTO members (address) VALUES (?)").run(addr(a.member));
        break;
      case "MemberExited":
        db.prepare("DELETE FROM members WHERE address = ?").run(addr(a.member));
        break;
      case "RideRequested":
        db.prepare(
          "INSERT OR REPLACE INTO rides (id, rider, fare, status, pickup_lat, pickup_lng, drop_lat, drop_lng) VALUES (?, ?, ?, 'Requested', ?, ?, ?, ?)",
        ).run(Number(a.id), addr(a.rider), str(a.fare), Number(a.pickupLat), Number(a.pickupLng), Number(a.dropLat), Number(a.dropLng));
        break;
      case "RideAccepted":
        db.prepare("UPDATE rides SET status = 'Accepted', driver = ? WHERE id = ?").run(addr(a.driver), Number(a.id));
        break;
      case "RideCancelled":
        db.prepare("UPDATE rides SET status = 'Cancelled' WHERE id = ?").run(Number(a.id));
        break;
      case "RideCompleted":
        db.prepare("UPDATE rides SET status = 'Completed', claimed = ? WHERE id = ?").run(a.claimed ? 1 : 0, Number(a.id));
        break;
      case "FareSplit":
        db.prepare("UPDATE rides SET fee = ?, driver_amount = ? WHERE id = ?").run(str(a.fee), str(a.driverAmount), Number(a.id));
        break;
      case "RatingSubmitted":
        db.prepare("INSERT INTO ratings (ride_id, rater, ratee, role, score) VALUES (?, ?, ?, ?, ?)").run(
          Number(a.rideId), addr(a.rater), addr(a.ratee), Number(a.role), Number(a.score));
        break;
      case "ProposalCreated":
        db.prepare(
          "INSERT OR REPLACE INTO proposals (id, proposer, kind, value, recipient, end_time, quorum) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(Number(a.id), addr(a.proposer), Number(a.kind), str(a.value), addr(a.recipient), Number(a.endTime), Number(a.quorum));
        break;
      case "VoteCast":
        db.prepare(`UPDATE proposals SET ${a.support ? "for_votes = for_votes + 1" : "against_votes = against_votes + 1"} WHERE id = ?`).run(Number(a.id));
        break;
      case "ProposalExecuted":
        db.prepare("UPDATE proposals SET executed = 1 WHERE id = ?").run(Number(a.id));
        break;
      case "ParameterChanged":
        db.prepare("INSERT INTO params (kind, value, block) VALUES (?, ?, ?)").run(Number(a.kind), str(a.value), Number(e.blockNumber));
        break;
      case "TreasuryDeposit":
        db.prepare("INSERT INTO treasury (type, counterparty, amount, block) VALUES ('deposit', ?, ?, ?)").run(addr(a.from), str(a.amount), Number(e.blockNumber));
        break;
      case "TreasurySpend":
        db.prepare("INSERT INTO treasury (type, counterparty, amount, block) VALUES ('spend', ?, ?, ?)").run(addr(a.to), str(a.amount), Number(e.blockNumber));
        break;
    }
  }

  // ---- queries (the public interface of the read model) ----

  private rideRow(r: Record<string, unknown>): RideView {
    return {
      id: String(r.id),
      rider: r.rider as string,
      driver: (r.driver as string | null) ?? null,
      fare: r.fare as string,
      status: r.status as RideView["status"],
      claimed: r.claimed === 1,
      fee: (r.fee as string | null) ?? null,
      driverAmount: (r.driver_amount as string | null) ?? null,
      pickupLat: r.pickup_lat as number,
      pickupLng: r.pickup_lng as number,
      dropLat: r.drop_lat as number,
      dropLng: r.drop_lng as number,
    };
  }

  openRides(): RideView[] {
    return this.db.prepare("SELECT * FROM rides WHERE status = 'Requested' ORDER BY id").all().map((r) => this.rideRow(r));
  }

  ride(id: number): RideView | undefined {
    const r = this.db.prepare("SELECT * FROM rides WHERE id = ?").get(id);
    return r ? this.rideRow(r) : undefined;
  }

  history(address: string): RideView[] {
    const a = address.toLowerCase();
    return this.db.prepare("SELECT * FROM rides WHERE rider = ? OR driver = ? ORDER BY id").all(a, a).map((r) => this.rideRow(r));
  }

  private profile(address: string, role: number): ProfileView {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count, COALESCE(SUM(score), 0) AS sum FROM ratings WHERE ratee = ? AND role = ?")
      .get(address.toLowerCase(), role) as { count: number; sum: number };
    const averageX100 = row.count === 0 ? null : Math.floor((row.sum * 200 + row.count) / (row.count * 2));
    return { count: row.count, sum: row.sum, averageX100 };
  }

  reputation(address: string): { driver: ProfileView; rider: ProfileView } {
    return { driver: this.profile(address, 0), rider: this.profile(address, 1) };
  }

  /** @param now chain/unix seconds used to decide whether voting has ended */
  proposals(now: number = Math.floor(Date.now() / 1000)): ProposalView[] {
    return this.db.prepare("SELECT * FROM proposals ORDER BY id").all().map((r) => {
      const forVotes = r.for_votes as number;
      const againstVotes = r.against_votes as number;
      const executed = r.executed === 1;
      const ended = now >= (r.end_time as number);
      const wins = forVotes + againstVotes >= (r.quorum as number) && forVotes > againstVotes;
      const status = executed ? "executed" : !ended ? "open" : wins ? "passed" : "failed";
      return {
        id: String(r.id),
        proposer: r.proposer as string,
        kind: KIND_NAMES[r.kind as number],
        value: r.value as string,
        recipient: r.recipient === ZERO ? null : (r.recipient as string),
        endTime: r.end_time as number,
        quorum: r.quorum as number,
        forVotes,
        againstVotes,
        executed,
        status,
      } satisfies ProposalView;
    });
  }

  treasury(): { balance: string; history: { type: "deposit" | "spend"; counterparty: string; amount: string; block: number }[] } {
    const rows = this.db.prepare("SELECT * FROM treasury ORDER BY seq").all();
    let balance = 0n;
    const history = rows.map((r) => {
      const amount = BigInt(r.amount as string);
      balance += r.type === "deposit" ? amount : -amount;
      return { type: r.type as "deposit" | "spend", counterparty: r.counterparty as string, amount: amount.toString(), block: r.block as number };
    });
    return { balance: balance.toString(), history };
  }

  members(): string[] {
    return this.db.prepare("SELECT address FROM members ORDER BY address").all().map((r) => r.address as string);
  }

  parameterChanges(): { kind: string; value: string; block: number }[] {
    return this.db.prepare("SELECT * FROM params ORDER BY seq").all().map((r) => ({
      kind: KIND_NAMES[r.kind as number], value: r.value as string, block: r.block as number }));
  }

  /** Everything the model exposes, for equivalence checks. */
  snapshot() {
    return {
      members: this.members(),
      rides: this.db.prepare("SELECT id FROM rides ORDER BY id").all().map((r) => this.ride(r.id as number)),
      ratings: this.db.prepare("SELECT ride_id, rater, ratee, role, score FROM ratings ORDER BY seq").all(),
      proposals: this.proposals(Number.MAX_SAFE_INTEGER),
      treasury: this.treasury(),
      params: this.parameterChanges(),
    };
  }
}
