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
npm run chain             # local Anvil chain on :8545 (chain id 31337)
npm run test:contracts    # forge test
npm run dev:web           # web app
npm run dev:indexer       # indexer
```

## Secrets

`.env*` files are git-ignored except `.env.example`. The OpenRouteService key is read only by the Next.js server route and must never reach the browser. Never commit private keys; the Anvil test keys are public and only valid locally.
