# Collaborator guide

Start here if you are new to the project. For the product spec see `.scratch/decentralized-ride-coop/spec.md`; for vocabulary see `CONTEXT.md`; for design decisions see `docs/adr/`.

## What this is

A driver-owned ride co-op on an Ethereum test network. Members stake 0.01 ETH, riders escrow the fare, and the contract splits it automatically (5% fee to a member-governed treasury by default, 20% cap). Members vote on the fee, per-km rate, minimum fare, claim timeout and treasury spending. Reputation is stored on-chain.

## Architecture in one picture

```
Browser (Next.js + wagmi)  --writes (signed txs)-->  4 contracts on chain
        |                                                  |
        |  reads (HTTP GET)                                | events
        v                                                  v
   Indexer HTTP API  <----- SQLite read model <----- Indexer (viem log sync)
```

- **contracts/**: `Membership`, `RideServices`, `Reputation`, `Governance`. No owner or admin; they are wired by immutable addresses predicted at deploy (ADR 0002). Ride details (coordinates etc.) live in **events only**, not storage, to save gas.
- **indexer/**: rebuilds a read model from events. Replays are idempotent; a wiped chain or reorg is detected by block hash and triggers a full resync. The API is GET-only.
- **web/**: rider, driver and governance pages. The OpenRouteService key is used only in server route handlers (`web/src/app/api/`) and must never reach the browser.
- **scripts/e2e.mts**: scripted run against a real local chain that cross-checks the chain against the indexer at each step.

## Getting running

Follow `README.md` (Setup, then Everyday commands). Windows notes:

- Use PowerShell for Node/npm and Git Bash for Foundry; if disk space is tight, point the npm cache elsewhere (`npm_config_cache`).
- `npm run check:env` must print only `ok` lines before you start.
- Copy `.env.example` to `.env.local` and add your own free [OpenRouteService](https://openrouteservice.org/) key. Without a key, maps still work (straight-line distance fallback).
- Demo accounts are the public Anvil test accounts. Never put a real private key in the repo.

## Status

| Area | State |
|---|---|
| Four contracts | Done. 81 Foundry tests, 98-100% line coverage per contract |
| Indexer | Done. 21 tests including reorg/wipe recovery |
| Web app | Done. Rider booking screen, driver dashboard, governance; 7 unit tests; `next build` passes; full demo run with real MetaMask (see PROJECT_REPORT §5) |
| End-to-end script | Done. `npm run e2e` |
| Static analysis (Slither) | Done. No high or medium findings; triage in ADR 0003 |
| Sepolia deployment | **Not done** (optional) |

## Open work you can pick up

1. **Re-run Slither** after any contract change and update ADR 0003.
2. **Deploy to Sepolia** (`forge script script/Deploy.s.sol --rpc-url <url> --broadcast` with a funded key supplied via env or keystore, never committed). Non-local chains default to 1 day voting and a 30 minute claim timeout. Then point `web/src/lib/deployment.json` at the new addresses (`npm run sync:deployment`).
3. **Refactors flagged in review** (judgement calls, not bugs):
   - The proposal-kind list is defined in three places (contracts, indexer `events.ts`, web `contracts.ts`).
   - The "proposal passed" rule and the rating-average formula are duplicated between the contracts and the indexer.
   - `ReadModel.snapshot()` exists mainly as a test hook.
4. **Known limits** (see README): two-address farming is not prevented; there is no dispute resolution or slashing; governed pricing parameters other than the fee have no bounds (ADR 0001).

## Working agreements

- **Tests at two seams only**: the public interface of the deployed four-contract suite (Foundry, using only public calls and events) and the indexer read model against emitted events. Avoid tests that reach into internals.
- **TDD in vertical slices**: one failing test, the minimal code to pass it, repeat. Expected values in tests must come from literals or the spec, never from re-running the code's own formula.
- **Before opening a PR** run `npm test`, `npm run typecheck`, and `npm run e2e` if you touched contracts or the indexer. CI runs the Foundry tests and typecheck on every push.
- **Tickets and specs** are local markdown under `.scratch/<feature>/` (see `docs/agents/issue-tracker.md`); triage labels are in `docs/agents/triage-labels.md`.
- **Record non-obvious decisions** as a new ADR in `docs/adr/` and add new domain terms to `CONTEXT.md`.
- **Secrets**: `.env*` is git-ignored except `.env.example`. Do not commit keys, `contracts/deployments/*.json`, or databases.
