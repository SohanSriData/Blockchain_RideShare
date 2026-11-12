// Read-only indexer entrypoint. Stores no keys and holds no funds.
// Uses node:sqlite (built in) so there is no native module to compile.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "viem";
import { ReadModel } from "./model.js";
import { Syncer, viemSource } from "./sync.js";
import { createApi } from "./server.js";

const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const deploymentPath = resolve(process.env.DEPLOYMENT ?? "../contracts/deployments/31337.json");
const dbPath = process.env.INDEXER_DB ?? "indexer.db";
const port = Number(process.env.INDEXER_PORT ?? 8787);
const pollMs = Number(process.env.POLL_MS ?? 1000);

function loadAddresses(): Address[] {
  const d = JSON.parse(readFileSync(deploymentPath, "utf8")) as Record<string, string>;
  return [d.membership, d.governance, d.rideServices, d.reputation] as Address[];
}

const model = new ReadModel(dbPath);
const syncer = new Syncer(model, viemSource(rpcUrl, loadAddresses()));

async function tick() {
  try {
    await syncer.sync();
  } catch (err) {
    console.error("sync failed:", (err as Error).message);
  }
}

await tick();
setInterval(tick, pollMs);
createApi(model).listen(port, () => console.log(`indexer: http://localhost:${port} (chain ${rpcUrl})`));
