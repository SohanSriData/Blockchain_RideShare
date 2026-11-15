# 0003: Slither static analysis triage

Status: accepted

## Context

Slither (slither-analyzer, 102 detectors) was run over `contracts/src` with `--filter-paths "lib|test|script"`:

```sh
cd contracts
uvx --from slither-analyzer slither . --filter-paths "lib|test|script"
```

It reported 19 results across 7 detector types. None is high or medium impact. Each was reviewed against the code.

## Findings and decisions

| Detector | Where | Verdict |
|---|---|---|
| arbitrary-send-eth | `RideServices._send` | **Intended.** The recipient is always the ride's own rider or driver, read from stored ride data, never caller-supplied. Guarded by `nonReentrant`; state is updated before the call. |
| unused-return | `Reputation.rate` ignoring parts of `getRide` | **False positive.** Only the fields needed (rider, driver, status) are used; the tuple is destructured on purpose. |
| missing-zero-check | `Membership` constructor `rideServices` | **Accepted.** The address is predicted from the deployer nonce by the shared `Deployer` and exercised by every test and the e2e run. A wrong value would break every ride call at deploy time, not silently later. No setter exists (ADR 0002). |
| reentrancy-events | `RideServices.acceptRide` emits `RideAccepted` after calling `Membership.rideStarted` | **Accepted.** The callee is the immutable, trusted Membership contract and state is already written. The only effect is event ordering relative to that internal call. |
| timestamp | `Governance.vote`, `Governance.execute`, `RideServices.claimFare` | **Accepted.** Deadlines are minutes to days; a validator's few seconds of timestamp drift cannot change an outcome meaningfully. |
| low-level-calls | `Governance.execute`, `Membership.exit`, `RideServices._send` | **Intended.** `call{value:}` is the recommended way to send ETH (no 2300 gas stipend problem). The return value is checked and failure reverts the whole transaction. |
| naming-convention | `UPPER_CASE` immutables | **Style only.** UPPER_CASE for immutables is a common convention and is kept. |

## Consequences

- No code changes were needed from this run.
- Slither's output is a point-in-time result. Re-run it after any contract change, and record new findings here.
- This is not an audit. The contracts have not been reviewed by a third party and must not hold real funds.
