# Decentralized Ride & Errand Co-op

Driver-owned ride co-op: staked membership, escrowed fares with an automatic fee split, on-chain governance and reputation. Spec: `.scratch/decentralized-ride-coop/spec.md`.

## Layout

- `contracts/` Foundry project (Solidity 0.8.28, the four contracts and their tests)
- `web/` Next.js app (wagmi, viem, Leaflet)
- `indexer/` read-only TypeScript indexer (viem, built-in `node:sqlite`)
- `scripts/check-env.mjs` verifies your toolchain matches the pinned versions

## Pinned toolchain

| Tool | Version | Source of truth |
|---|---|---|
| Node.js | >= 22.13 (22 recommended) | `.nvmrc`, `engines` |
| Foundry (forge, anvil, cast) | 1.9.0 | `.foundry-version` |
| Solidity | 0.8.28 | `contracts/foundry.toml` |
| forge-std | v1.17.0 | git submodule |
| npm packages | exact versions | `package-lock.json`, `.npmrc` |

## Setup

```sh
git clone --recurse-submodules <repo-url>   # or: git submodule update --init --recursive
foundryup --install 1.9.0                   # Windows: use Git Bash, or download the release zip
npm ci
cp .env.example .env.local                  # add ORS_API_KEY for map features
npm run check:env                           # must print only "ok" lines
```

## Everyday commands

```sh
npm run chain             # local Anvil chain on :8545 (chain id 31337, 1 s blocks)
npm run deploy:local      # deploy the four contracts and sync addresses into the web app
npm run dev:indexer       # read-only indexer on :8787
npm run dev:web           # web app on :3000
npm test                  # contracts (forge), indexer and web unit tests
npm run e2e               # scripted end-to-end run, repeated after a chain wipe
```

Run order for a manual demo: `chain`, `deploy:local`, `dev:indexer`, `dev:web`, then connect a wallet
(MetaMask on `http://127.0.0.1:8545`, chain id 31337) using the public Anvil test accounts.

## Extra checks

```sh
cd contracts
forge test --gas-report                                   # gas for money-moving functions
forge test --match-contract GasComparisonTest -vv         # events-only design vs on-chain-storage baseline
forge coverage --report summary                           # coverage
uvx --from slither-analyzer slither . --filter-paths "lib|test|script"   # static analysis
```

Slither has been run: no high or medium findings; the triage is in `docs/adr/0003-slither-static-analysis-triage.md`. It needs uv (set `UV_CACHE_DIR` and `UV_TOOL_DIR` to a drive with space).
Design decisions are in `docs/adr/`; the glossary is `CONTEXT.md`. New collaborators: read `docs/COLLABORATING.md`.

## Known limits

- Two-address farming (a driver requesting from a second address) is not prevented; it costs the fee and the minimum fare each time.
- Fee and treasury rounding: see ADR 0001. There is no dispute resolution or slashing (out of scope).

## Secrets

`.env*` files are git-ignored except `.env.example`. The OpenRouteService key is read only by the Next.js server route and must never reach the browser. Never commit private keys; the Anvil test keys are public and only valid locally.
