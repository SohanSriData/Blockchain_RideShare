# 0001: Fare split remainder rule and default pricing

Status: accepted

## Context

The spec left two judgement calls open: which side receives the rounding remainder of the fee split, and the default per-km rate and minimum fare.

## Decision

- **Remainder**: the fee is `fare * feePercent / 100`, rounded **down**. The driver receives `fare - fee`, so the remainder always goes to the driver. Every wei of the fare is paid out exactly once (checked by a fuzz test of conservation of funds). Rounding down also means a very small fare cannot make the fee exceed the fare.
- **Fee percent** is an integer percentage (default 5, cap 20), matching the spec's wording. No basis points.
- **Defaults** (local deploy, overridable by env): per-km rate 0.0005 ETH, minimum fare 0.001 ETH, claim timeout 2 minutes locally. A 20 km ride is 0.01 ETH, small enough for faucet funds. The stake default is 0.01 ETH.
- The claim timeout is **snapshotted at acceptance** (`claimableAt`), so a later vote cannot move the goalposts for a ride already in progress.

- **Timings by network**: chain 31337 defaults to 1 minute voting and a 2 minute claim timeout; any other chain (e.g. Sepolia) defaults to 1 day and 30 minutes, as the spec says. Env vars override both.
- **No bounds on the governed pricing parameters** beyond the fee cap, matching the spec (only the fee is capped). A passed proposal can set the minimum fare to 0 or the claim timeout to 0 (an instant driver claim, leaving the rider one block to cancel). Members own this risk by design; the web app shows the current values on the Governance page.

## Consequences

- Drivers can predict earnings exactly: fare minus the floor of the fee.
- A governed fee of 0 is allowed and pays the driver everything.
