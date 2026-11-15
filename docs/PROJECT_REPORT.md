# Project report: Decentralized Ride & Errand Co-op

BITS Pilani blockchain course project. Repository: https://github.com/SohanSriData/Blockchain_RideShare

## 1. Summary

A driver-owned ride co-op on Ethereum. Members stake native test ETH to join. Riders escrow a fare, a member accepts the ride, and when the ride completes the contract splits the fare automatically: a governed fee (5% by default, capped at 20%) goes to a treasury that members control by vote, and the rest goes to the driver. Reputation (1 to 5 stars) is recorded on-chain for drivers and riders separately. There is no owner or admin anywhere in the system.

The project has three parts: four Solidity contracts, a read-only TypeScript indexer that rebuilds state from events, and a Next.js web app with maps. A scripted end-to-end run proves the chain and the indexer agree at every step.

## 2. Requirements and decisions

The full spec is `.scratch/decentralized-ride-coop/spec.md`. Key decisions:

| Topic | Decision |
|---|---|
| Membership | One member, one vote. Stake of 0.01 ETH (set at deploy), refundable on exit. A member cannot exit while in an active ride. |
| Currency | Native test ETH, no token. |
| Fare | The rider offers the escrowed fare. The app suggests distance x governed per-km rate, subject to a governed minimum fare. |
| Completion | The rider confirms. If they do not, the driver may claim after a governed timeout (30 min on testnets, 2 min locally). The timeout is snapshotted when the ride is accepted. |
| Cancellation | Before acceptance only, with a full refund and no fee. |
| Fee | 5% default, 20% cap, integer percent, rounded down; the remainder goes to the driver (ADR 0001). |
| Governance | Proposals: fee, per-km rate, minimum fare, claim timeout, treasury spend. Quorum is 20% of members rounded up (at least 1), fixed when the proposal is created. Only members who joined before the proposal may vote. Anyone may execute a passed proposal, once. |
| Reputation | Ratings 1 to 5 stored as sum and count; average is shown x100. Separate driver and rider profiles. One rating per participant per ride. |
| Privacy and cost | Coordinates are emitted in events only (rounded to 3 decimals, about 110 m) and never stored. |
| Safety rules | A driver cannot accept their own request. Funds move only through the contract rules. |

## 3. Architecture

```
Browser (Next.js, wagmi, viem) --signed txs--> Membership / RideServices / Reputation / Governance
        |                                              |
        | HTTP GET                                      | events
        v                                              v
 Indexer HTTP API <---- SQLite read model <---- Indexer (viem log sync)
```

### 3.1 Contracts (`contracts/src`)

- **Membership**: `join()`, `exit()`, member count, and a monotonic join sequence used to decide vote eligibility (not block numbers). Tracks each member's active rides, which RideServices updates.
- **RideServices**: `requestRide` (payable, escrows the fare, validates the coordinate range and minimum fare), `acceptRide`, `cancelRide`, `completeRide`, `claimFare`, `getRide`. Settlement is atomic and guarded against reentrancy; effects happen before interactions. Events: `RideRequested`, `RideAccepted`, `RideCancelled`, `RideCompleted`, `FareSplit`.
- **Reputation**: `rate(rideId, score)` for completed rides only, with profile views and the x100 average.
- **Governance**: `propose`, `vote`, `execute`, `quorumFor`, treasury balance and spending, parameter storage (fee, cap, per-km rate, minimum fare, claim timeout).

The contracts reference each other through `immutable` addresses computed from the deployer's nonce, so no setter, owner or upgrade path exists (ADR 0002). A shared `Deployer` is used by both the deploy script and the tests.

### 3.2 Indexer (`indexer/src`)

- `ReadModel` (built-in `node:sqlite`) applies decoded events with a (block, log index) cursor, so replays are idempotent. It serves open rides, ride details, per-address history, reputation, proposals, treasury and members.
- `Syncer` polls a `ChainSource`. It stores the last block hash; if the hash no longer matches (a wiped chain or a reorg) it resets and replays everything.
- The model tracks chain time (the latest block timestamp), so a proposal's open or closed status does not depend on the wall clock.
- A GET-only HTTP API serves the web app: `/health`, `/rides/open`, `/rides/:id`, `/history/:addr`, `/reputation/:addr`, `/proposals`, `/treasury`, `/members`.

### 3.3 Web app (`web`)

Next.js 16, wagmi 3, viem, react-leaflet. Pages: home, `/rider` (map, address search, suggested editable fare, request and cancel, confirm and rate), `/driver` (join and exit, open rides sorted by distance, accept, claim, rate), `/governance` (current parameters, proposals, voting, execution, treasury). Server route handlers proxy OpenRouteService geocoding and routing so the API key never reaches the browser; if routing fails the app falls back to a haversine straight-line distance. Transactions show pending and confirmed states with readable error messages for contract reverts.

## 4. Design choices worth knowing

- **Events instead of storage for ride details.** Only the fields needed for settlement are stored. A baseline that stores full ride details on-chain cost 344,977 gas for request + accept + complete; this design costs 290,702. `requestRide` alone is 113,075 gas versus 233,164 for the baseline.
- **Rounding.** The fee is `fare * feePercent / 100`, rounded down, so every wei is paid out exactly once (fuzz-tested for conservation of funds).
- **Join sequence for voter eligibility.** A counter is more robust than block numbers when several joins and proposals land in the same block.
- **Quorum fixed at proposal creation.** Later joins or exits cannot move the goalposts.
- **Claim timeout snapshot.** A later vote cannot change the terms of a ride already in progress.
- **Indexer is disposable.** All truth is on-chain; the indexer can be deleted and rebuilt.

## 5. Verification

| Check | Result |
|---|---|
| Foundry tests (`forge test`) | 81 passing: Membership 9, Governance 25, RideServices 28 (includes reentrancy attacker and a fuzz conservation test), Reputation, FailurePaths 7, GasComparison |
| Contract line coverage | 98 to 100% per contract |
| Indexer tests | 21 passing (model behaviour and sync, including reorg and wipe) |
| Web unit tests | 7 passing (geometry helpers) |
| Typecheck, lint, `next build` | Clean |
| End-to-end (`npm run e2e`) | Passes: join, request, accept, complete, rate, propose, vote, execute against a live Anvil chain with the model and the HTTP API cross-checked at every step; repeated after wiping and restarting the chain on the same indexer database |
| Secret hygiene | ORS key confirmed absent from the client bundle and from git history |

Tests live at two seams only: the public interface of the deployed four-contract suite, and the indexer read model against emitted events.

### Bugs found by the checks

- A cached chain head in the indexer's client delayed events by up to 4 seconds (fixed with no-cache block number reads).
- Wall-clock proposal status was wrong when Anvil's chain time ran ahead; replaced with chain time.
- Two fee tests recomputed the contract's own formula; they now use literal expected values.
- The ORS key appeared ignored because of a cached environment load; fixed with a forced reload.

## 6. Known limits and open items

- **Static analysis:** Slither (102 detectors) reported 19 results of 7 types, none high or medium. All were reviewed and accepted as intended, false positives or style; see `docs/adr/0003-slither-static-analysis-triage.md`. This is not an audit.
- **No Sepolia deployment** (optional in the spec). Steps are in `docs/DEMO.md`.
- **Two-address farming** is not prevented (a driver requesting from a second address); it costs the fee and minimum fare each time.
- **No dispute resolution or slashing.**
- **Governed pricing parameters other than the fee are unbounded** (for example a minimum fare of 0 or an instant claim timeout), as the spec says. Members own this risk (ADR 0001).
- **Review smells left as judgement calls:** the proposal-kind list exists in three places; the pass rule and rating-average formula are duplicated between contracts and indexer.
- Not audited. Do not use with real funds.

## 7. Repository map

| Path | Contents |
|---|---|
| `contracts/` | Solidity sources, Foundry tests, deploy scripts |
| `indexer/` | Event indexer and read API |
| `web/` | Next.js app |
| `scripts/` | `check-env.mjs`, `e2e.mts`, `sync-deployment.mjs` |
| `docs/adr/` | Architecture decision records |
| `docs/COLLABORATING.md` | Collaborator onboarding |
| `docs/DEMO.md` | Demo guide and accounts |
| `CONTEXT.md` | Domain glossary |
| `.scratch/` | Spec and local tickets |
