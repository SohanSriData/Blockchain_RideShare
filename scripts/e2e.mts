// Scripted end-to-end run against a live local chain: join, request, accept, complete, rate, propose, vote, execute.
// After every step the indexer read model is synced and cross-checked against on-chain state.
// The whole run is repeated after wiping and restarting the chain, reusing the SAME indexer database,
// to show the read model recovers. Run: npm run e2e
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, type Address } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { ReadModel } from "../indexer/src/model.ts";
import { Syncer, viemSource } from "../indexer/src/sync.ts";

const PORT = 8549;
const RPC = `http://127.0.0.1:${PORT}`;
const root = resolve(import.meta.dirname, "..");
const foundryBin = join(homedir(), ".foundry", "bin");
const env = { ...process.env, PATH: `${foundryBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}` };
// Public Anvil test mnemonic: local-only keys, never valid on a real network.
const MNEMONIC = "test test test test test test test test test test test junk";

const abi = parseAbi([
  "function STAKE() view returns (uint256)",
  "function isMember(address) view returns (bool)",
  "function join() payable",
  "function requestRide(int256,int256,int256,int256) payable returns (uint256)",
  "function acceptRide(uint256)",
  "function completeRide(uint256)",
  "function getRide(uint256) view returns (address,address,uint256,uint8,uint256)",
  "function rate(uint256,uint8)",
  "function driverProfile(address) view returns (uint256 sum, uint256 count)",
  "function propose(uint8,uint256,address) returns (uint256)",
  "function vote(uint256,bool)",
  "function execute(uint256)",
  "function feePercent() view returns (uint256)",
  "function treasuryBalance() view returns (uint256)",
  "function proposals(uint256) view returns (uint8 kind,bool executed,address recipient,uint256 value,uint256 endTime,uint256 snapshotSeq,uint256 quorum,uint256 forVotes,uint256 againstVotes)",
]);

const publicClient = createPublicClient({ chain: anvil, transport: http(RPC) });
const accounts = Array.from({ length: 5 }, (_, i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }));
const [, rider, driver, member2, member3] = accounts;

function assertEq(label: string, actual: unknown, expected: unknown) {
  if (String(actual) !== String(expected)) throw new Error(`MISMATCH ${label}: chain/expected=${expected} indexer/actual=${actual}`);
}

async function waitForAnvil() {
  for (let i = 0; i < 50; i++) {
    try { await publicClient.getBlockNumber(); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("anvil did not start");
}

function startChain(): ChildProcess {
  return spawn("anvil", ["--port", String(PORT), "--chain-id", "31337"], { env, stdio: "ignore", shell: process.platform === "win32" });
}

function stopChain(p: ChildProcess) {
  if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(p.pid), "/t", "/f"], { stdio: "ignore" });
  else p.kill();
}

function deploy(): Record<string, Address> {
  execFileSync(
    "forge",
    ["script", "script/Deploy.s.sol", "--rpc-url", RPC, "--broadcast", "--start-fresh", "--unlocked", "--sender", accounts[0].address],
    { cwd: join(root, "contracts"), env: { ...env, VOTING_PERIOD: "30", CLAIM_TIMEOUT: "60" }, stdio: "ignore", shell: process.platform === "win32" },
  );
  return JSON.parse(readFileSync(join(root, "contracts", "deployments", "31337.json"), "utf8"));
}

async function runFlow(label: string, model: ReadModel) {
  console.log(`\n== ${label} ==`);
  const d = deploy();
  const syncer = new Syncer(model, viemSource(RPC, [d.membership, d.governance, d.rideServices, d.reputation] as Address[]));
  const send = async (who: (typeof accounts)[number], address: Address, functionName: string, args: unknown[] = [], value?: bigint) => {
    const wallet = createWalletClient({ account: who, chain: anvil, transport: http(RPC) });
    const hash = await wallet.writeContract({ address, abi, functionName, args, value } as never);
    const rc = await publicClient.waitForTransactionReceipt({ hash });
    if (rc.status !== "success") throw new Error(`${functionName} reverted`);
  };
  const read = <T,>(address: Address, functionName: string, args: unknown[] = []) =>
    publicClient.readContract({ address, abi, functionName, args } as never) as Promise<T>;

  async function check(step: string) {
    await syncer.sync();
    for (const a of accounts) {
      assertEq(`${step}: isMember ${a.address}`, model.members().includes(a.address.toLowerCase()), await read(d.membership, "isMember", [a.address]));
    }
    const rides = (await read<readonly [Address, Address, bigint, number, bigint]>(d.rideServices, "getRide", [1n]));
    const view = model.ride(1);    if (rides[3] !== 0) assertEq(`${step}: ride 1 status`, view?.status, ["", "Requested", "Accepted", "Completed", "Cancelled"][rides[3]]);
    const [sum, count] = await read<readonly [bigint, bigint]>(d.reputation, "driverProfile", [driver.address]);
    const rep = model.reputation(driver.address).driver;
    assertEq(`${step}: driver rating sum`, rep.sum, sum);
    assertEq(`${step}: driver rating count`, rep.count, count);
    assertEq(`${step}: treasury`, model.treasury().balance, await publicClient.getBalance({ address: d.governance }));
    const [, executed, , , , , , forVotes, againstVotes] = await read<readonly [number, boolean, Address, bigint, bigint, bigint, bigint, bigint, bigint]>(d.governance, "proposals", [1n]);
    const p = model.proposals(Number.MAX_SAFE_INTEGER)[0];
    if (p) {
      assertEq(`${step}: proposal for`, p.forVotes, forVotes);
      assertEq(`${step}: proposal against`, p.againstVotes, againstVotes);
      assertEq(`${step}: proposal executed`, p.executed, executed);
    }
    console.log(`ok  ${step}`);
  }

  const stake = await read<bigint>(d.membership, "STAKE");
  for (const m of [driver, member2, member3]) await send(m, d.membership, "join", [], stake);
  await check("members join");

  await send(rider, d.rideServices, "requestRide", [17_385_044n, 78_486_671n, 17_440_000n, 78_500_000n], parseEther("0.01"));
  await check("ride requested");
  assertEq("open rides in indexer", model.openRides().length, 1);

  await send(driver, d.rideServices, "acceptRide", [1n]);
  await check("ride accepted");

  const before = await publicClient.getBalance({ address: driver.address });
  await send(rider, d.rideServices, "completeRide", [1n]);
  await check("ride completed");
  assertEq("driver payout (95%)", (await publicClient.getBalance({ address: driver.address })) - before, parseEther("0.0095"));
  assertEq("treasury got the 5% fee", await read<bigint>(d.governance, "treasuryBalance"), parseEther("0.0005"));

  await send(rider, d.reputation, "rate", [1n, 5]);
  await check("driver rated");
  assertEq("average x100", model.reputation(driver.address).driver.averageX100, 500);

  await send(driver, d.governance, "propose", [0, 8n, "0x0000000000000000000000000000000000000000"]);
  for (const m of [driver, member2, member3]) await send(m, d.governance, "vote", [1n, true]);
  await check("proposal voted");

  // End the voting period by advancing CHAIN time. Sleeping on the wall clock is wrong here: Anvil stamps each
  // block at least 1 s after the previous one, so a burst of blocks puts chain time ahead of real time.
  await publicClient.request({ method: "evm_increaseTime" as never, params: [31] as never });
  await publicClient.request({ method: "evm_mine" as never, params: [] as never });
  await send(rider, d.governance, "execute", [1n]); // anyone may execute
  await check("proposal executed");
  assertEq("fee changed by vote", await read<bigint>(d.governance, "feePercent"), 8);
  assertEq("indexer sees proposal executed", model.proposals(Number.MAX_SAFE_INTEGER)[0].status, "executed");
}

// One read model across both runs: the second run starts on a brand-new chain, so the indexer must reset itself.
const model = new ReadModel(":memory:");
let chain = startChain();
try {
  await waitForAnvil();
  await runFlow("run 1: fresh chain", model);
} finally {
  stopChain(chain);
}
await new Promise((r) => setTimeout(r, 1000));
chain = startChain();
try {
  await waitForAnvil();
  await runFlow("run 2: wiped and restarted chain (same indexer database)", model);
} finally {
  stopChain(chain);
}
console.log("\nE2E passed: on-chain state matched the indexer at every step, before and after a clean restart.");
process.exit(0);
