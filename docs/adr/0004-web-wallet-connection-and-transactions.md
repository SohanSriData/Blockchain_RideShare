# 0004: Web wallet connection and transaction handling

Status: accepted

## Context

A demo run in Chrome with real MetaMask exposed problems that unit tests and `npm run e2e` cannot see, because they only happen between the browser, the wallet and Next.js:

- The page crashed with "Cannot read properties of undefined (reading 'appendChild')" when navigating Driver to Rider.
- "Connect wallet" kept reopening MetaMask's account picker and then failed with "wallet_requestPermissions already pending".
- With the wallet on another network, contract reads failed, so "Join the co-op" stayed disabled.
- An early "Claim fare" was broadcast, reverted on chain and cost gas, and the button showed "Pending…" for a long time before a bare "Failed on chain".
- Every page load flashed a clickable "Connect wallet" before wagmi reconnected.

## Decisions

1. **Cache Components off** (`web/next.config.ts`). It keeps visited routes mounted but hidden (React Activity), which ran react-leaflet's cleanup and then reused the removed map.
2. **`injected({ shimDisconnect: false })`** (`web/src/lib/wagmi.ts`). The shim forced the account picker (`wallet_requestPermissions`) on every connect. Without it MetaMask remembers the site's approval. The cost: changing role means selecting another account in MetaMask, and that account must be connected to the site (documented in `docs/DEMO.md`).
3. **All reads and writes pinned to `CHAIN_ID`** from `deployment.json`. Reads never follow the wallet's network; the header offers "Switch to local chain" only when the wallet really is elsewhere.
4. **Simulate before every write** (`web/src/components/TxButton.tsx`). A call that would revert shows its readable reason (via `friendlyError`) and the wallet never opens. The contract stays the authority; this only avoids sending transactions that are certain to fail.
5. **No retries on the receipt query.** wagmi throws on a reverted receipt, and the default three retries kept "Pending…" on screen. The revert reason is shown at once.
6. **Cookie-backed wagmi state passed to the server render** (`cookieStorage`, `cookieToInitialState` in `app/layout.tsx`). A returning user's first render is "reconnecting" on both server and client, shown as a disabled "Wallet…" placeholder. Reading the cookie makes every page dynamically rendered, which is fine for this app.
7. **Transaction status belongs to its button and account.** Buttons that replace each other get distinct keys, and status and errors reset when the connected account changes.

## Consequences

- Fewer surprises during a live demo: no doomed transactions, no picker loop, no flashes.
- One extra `eth_call` per click (the simulation).
- These behaviours are verified by the manual browser run recorded in `docs/PROJECT_REPORT.md` §5, not by automated tests; re-run the `docs/DEMO.md` script after changing wallet or transaction code.
