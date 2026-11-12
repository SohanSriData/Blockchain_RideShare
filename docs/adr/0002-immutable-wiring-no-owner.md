# 0002: Immutable contract wiring with no owner or admin

Status: accepted

## Context

The four contracts reference each other (Membership must know Ride Services; Ride Services needs Membership and Governance; Reputation reads rides; Governance needs Membership). Wiring them after deployment normally needs an owner-only setter, which contradicts "no admin or owner" (spec story 64).

## Decision

Deploy in a fixed order (Membership, Governance, Ride Services, Reputation) and predict the Ride Services address from the deployer's nonce, so Membership can store it as an `immutable`. A deploy-time check requires the predicted and actual addresses to match. There are no setters, no owner, and no upgrade path.

## Consequences

- No address can freeze funds, change the fee, or re-point a contract.
- Deployment order is part of the contract: `script/Deployer.sol` is the single place that does it, shared by tests and the deploy script.
- A bug cannot be fixed in place; redeploy and migrate. Acceptable for a local-chain and testnet project.

## Other decisions recorded here

- **Voter eligibility** uses a monotonic join sequence, not block numbers or timestamps, so "joined before the proposal" is exact even within one block.
- **Coordinates** are accepted as micro-degrees, rounded on-chain to 3 decimals (half away from zero) and emitted in events only; none is stored.
- **Reading the chain time**: Anvil stamps each block at least 1 s after the previous one, so tests and the end-to-end script advance chain time with `evm_increaseTime`, never by sleeping.
