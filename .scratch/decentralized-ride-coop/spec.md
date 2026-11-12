Status: ready-for-agent

# Spec: Decentralized Ride & Errand Co-op

## Problem Statement

Drivers on centralized ride-hailing platforms (Uber, Ola) lose 15-30% of every fare to a company that contributes no vehicles, fuel or maintenance. That company also unilaterally decides the fee, route prioritisation and driver standing, and drivers have no recourse when terms change. Riders in rural and semi-urban areas often get no service at all, because matching is tuned for dense urban areas and low-volume routes are treated as unprofitable. Moving the app to a different operator only relocates the trust problem: whoever runs the server still controls the money, sets the fee and can silently favour a party.

## Solution

A driver-owned co-op where the rules are enforced by smart contract code rather than an operator:

- **Drivers** stake a refundable deposit to become **members**.
- **Riders** pay the fare into an on-chain **escrow** when they request a ride.
- On completion the contract automatically splits the fare between the driver and a member-owned **treasury** through a **fee**.
- The fee percentage and all treasury spending change only through a **proposal** passed by a member **vote** (quorum plus majority).
- Every fund movement and state transition is a public on-chain event.
- A read-only **indexer** mirrors on-chain events into a fast-to-read store, and a simple web app with a browser wallet gives riders, drivers and members a UI. Neither the indexer nor the web app can hold funds or change state.
- **Maps and distance-based fares**: riders pick pickup and drop-off on a map and get a suggested fare from the route distance and a member-governed per-km rate. Drivers see open rides on a map sorted by distance. Maps are a convenience read only, never part of the trust or money path.

## User Stories

### Membership (driver-member)
1. As a driver, I want to stake a refundable deposit to join the co-op, so that I can accept rides without KYC or a platform's approval.
2. As a driver, I want the stake amount to be fixed and visible before I join, so that I know exactly what joining costs.
3. As a driver, I want a joining attempt with the wrong stake amount to be rejected, so that I never lock the wrong amount of funds by mistake.
4. As a driver, I want to be prevented from joining twice with one address, so that my stake is not double-counted or stuck.
5. As a driver, I want to leave the co-op and recover my full stake, so that membership is voluntary and not a lock-in.
6. As a driver, I want my exit to be refused while I have a ride in progress, so that I cannot abandon a rider mid-trip.
7. As a driver, I want my membership status to be publicly verifiable, so that riders can trust I am a staked member.
8. As a co-op member, I want each fake identity to cost a full stake, so that outsiders cannot cheaply buy influence over the co-op.
9. As a driver, I want a membership event emitted on join and on exit, so that the indexer and auditors can track the member set.
10. As a driver, I want a non-member address to be unable to accept rides or collect fares, so that unvetted parties cannot perform rides.

### Rides (rider)
11. As a rider, I want to request a ride with the fare held in escrow, so that the driver is guaranteed payment and I am guaranteed a refund if the ride does not happen.
12. As a rider, I want my fare to be locked in the contract, not sent to a person or company, so that no intermediary can take it.
13. As a rider, I want to cancel a ride and get a full refund, so that I am not penalised for changing my mind.
14. As a rider, I want to cancel both before and after a driver accepts, so that I am never stuck if the driver does not show up.
15. As a rider, I want to cancel a ride nobody accepts and recover my funds, so that my money is never stuck.
16. As a rider, I want to confirm that a ride is complete, so that the fare is released only when I have actually been served.
17. As a rider, I want the fare to be split automatically on completion, so that no one can withhold or skim my payment.
18. As a rider, I want to see the state of my ride (requested, accepted, completed, cancelled), so that I know what is happening.
19. As a rider, I want requests with no fare or an invalid fare to be rejected, so that rides are always backed by real escrow.
20. As a rider, I want other people to be unable to cancel or complete my ride, so that only I control my escrow.
21. As a rider in a low-density area, I want my request to be visible to every member, so that I am not excluded by an urban-tuned matching algorithm.
22. As a rider, I want a ride to be completed or cancelled only once, so that funds can never be paid out or refunded twice.

### Rides (driver-member)
23. As a member driver, I want to see all open ride requests, so that I can choose which to serve.
24. As a member driver, I want to accept an open ride request, so that I can earn the fare.
25. As a member driver, I want acceptance to be restricted to staked members, so that the co-op's quality guarantees hold.
26. As a member driver, I want only one driver to be able to accept a ride, so that two drivers do not both turn up.
27. As a member driver, I want my share of the fare to be paid automatically at the moment of completion, so that I do not have to trust an operator to pay me.
28. As a member driver, I want the fee taken from my fare to be exactly the currently governed percentage, so that I can predict my earnings.
29. As a member driver, I want to be unable to complete a ride before the claim timeout without the rider's confirmation, so that I cannot claim fares for trips that did not happen.
30. As a member driver, I want to know when a rider cancels a ride I accepted, so that I do not drive to a cancelled pickup.

### Fee and treasury
31. As a co-op member, I want a percentage fee to be collected automatically on every completed ride, so that the co-op has shared income for risk pooling.
32. As a co-op member, I want the fee collection to be atomic with the driver payout, so that neither can be skipped or under-reported.
33. As a co-op member, I want the fee to flow into the treasury, so that the money is owned by members and not by a company.
34. As a co-op member, I want a rounding rule for the fee split that never loses or creates funds, so that every unit of the fare is accounted for.
35. As a co-op member, I want a fee of zero or an upper-bounded fee to be handled predictably, so that a vote cannot take the whole fare.
36. As a co-op member, I want treasury balance and history to be publicly visible, so that I can audit where money came from and went.

### Reputation
37. As a rider, I want to rate the driver after a completed ride, so that good drivers are rewarded and bad ones are visible.
38. As a driver, I want to rate the rider after a completed ride, so that I can signal problematic riders to other members.
39. As a rider or driver, I want ratings to be possible only after the ride is completed, so that ratings cannot be made for rides that never happened.
40. As a rider or driver, I want a rating to be tied to one specific completed ride and to its actual counterparty, so that strangers cannot rate me.
41. As a rider or driver, I want to be able to rate a ride only once, so that ratings cannot be inflated by repetition.
42. As a rider or driver, I want ratings to be immutable once recorded, so that no admin can edit or delete reputation.
43. As a rider, I want to see a driver's reputation before I request a ride, so that I can decide whether to trust them.
44. As a rider or driver, I want ratings outside the integer range 1 to 5 to be rejected, so that the reputation scale stays meaningful.
45. As a driver, I want a rating on a cancelled ride to be rejected, so that my reputation reflects only completed work.

### Governance
46. As a co-op member, I want to propose a change to the fee percentage, so that the people who bear the fee control it.
47. As a co-op member, I want to propose a treasury spend (for example a maintenance grant or an insurance-like payout), so that pooled funds can serve members.
48. As a co-op member, I want to vote for or against an open proposal, so that I have a real say over my money and standing.
49. As a co-op member, I want one vote per member per proposal, so that no member can stack votes.
50. As a co-op member, I want non-members to be unable to propose or vote, so that outsiders cannot steer the co-op.
51. As a co-op member, I want a proposal to pass only with a minimum turnout (quorum) and a real majority, so that a small slice of members cannot decide for everyone.
52. As a co-op member, I want a proposal to fail when turnout is too low, so that apathy cannot be exploited.
53. As a co-op member, I want a proposal to fail when more members vote against than for, so that the majority rule is real.
54. As a co-op member, I want quorum calculation to never round down to zero for small co-ops (for example 20% of 3 members), so that a single vote or no votes cannot pass a proposal.
55. As a co-op member, I want a passed proposal to execute automatically, so that no operator needs to carry out the decision.
56. As a co-op member, I want a failed or expired proposal to never execute, so that rejected spending cannot happen.
57. As a co-op member, I want a proposal to be executable only once, so that a spend cannot be repeated.
58. As a co-op member, I want a treasury spend to be refused if it exceeds the current balance, so that an approved proposal cannot silently overspend funds that are no longer there.
59. As a co-op member, I want the fee to be changeable only through a passed proposal and never by any single address, so that the original unilateral-fee problem cannot return.
60. As a co-op member, I want proposals, votes and executions to be emitted as events, so that decisions are publicly auditable.
61. As a co-op member, I want voting to close after a defined period, so that proposals reach a conclusion.
62. As a member who has left the co-op, I want my vote eligibility to end, so that only current members govern.
62a. As a co-op member, I want only members who joined before a proposal was created to vote on it, so that nobody can stake after the fact to swing a vote.

### Transparency and trust
63. As any participant, I want every fund movement and state transition to emit an on-chain event, so that I can audit the co-op without trusting an operator.
64. As any participant, I want no admin, owner or server operator to be able to freeze funds, change the fee or favour a driver, so that the co-op is genuinely decentralised.
65. As any participant, I want no component outside the smart contracts to hold funds, so that the "no trusted middleman" property holds in the supporting infrastructure too.
66. As an auditor, I want contract state to be derivable from events alone, so that I can verify the indexer's picture of the world.

### Indexer (read model)
67. As a rider or driver, I want to list open rides quickly, so that the UI does not need to scan the whole chain.
68. As a user, I want to see an address's ride history, so that I can review past activity.
69. As a rider, I want to see a driver's reputation summary, so that I can choose whom to ride with.
70. As a member, I want to see proposals, vote tallies and outcomes, so that I can follow governance.
71. As a member, I want to see the treasury balance and its history, so that I can see what the fee has funded.
72. As a developer, I want the indexer to be strictly read-only with no keys and no write access, so that it cannot hold funds or alter chain state.
73. As a developer, I want the indexer to recover from a restart or a fresh local chain by replaying events, so that the system can be rebuilt reliably.
74. As a developer, I want the indexer to handle chain reorganisations or a restarted local chain without leaving stale data, so that the displayed state always matches the chain.
75. As a user, I want the indexer's view to catch up within a short delay after a transaction, so that the UI feels responsive.

### Web application
76. As a user, I want to connect a browser wallet, so that I can sign transactions without creating an account.
77. As a visitor, I want a simple home page explaining the co-op, so that I understand what it is.
78. As a driver, I want a driver view where I can join the co-op, accept rides and rate riders, so that all my actions are in one place.
79. As a rider, I want a rider view where I can request, cancel, complete and rate rides, so that the full ride journey is in one place.
80. As a member, I want a governance view where I can propose changes, vote and see the treasury, so that I can participate in the co-op's decisions.
81. As a user, I want clear errors when a transaction would fail (not a member, wrong stake, ride in progress), so that I know how to fix it.
82. As a user, I want to see pending and confirmed transaction states, so that I know whether my action took effect.
83. As a user, I want the app to be usable on a minimal, uncluttered interface, so that it is easy for non-technical riders and drivers.

### Maps, distance fares and claim timeout
91. As a rider, I want to pick my pickup and drop-off on a map, so that I do not have to type coordinates.
92. As a rider, I want to search for an address, so that I can find places by name.
93. As a rider, I want a suggested fare computed from the route distance and the current per-km rate, so that I offer a fair price without guessing.
94. As a rider, I want to be able to edit the suggested fare upward, so that I can attract a driver in a low-demand area.
95. As a rider, I want a request below the governed minimum fare to be rejected, so that the fee on rides cannot be gamed to near zero.
96. As a member, I want the per-km rate to be a governed parameter changed only by a passed proposal, so that members and not a company set pricing.
97. As a member driver, I want to see open rides on a map and sort them by distance from me, so that I can pick nearby jobs.
98. As a rider in a low-density area, I want my request to appear on every member's map, so that no matching algorithm can write my area off.
99. As a member driver, I want to claim the fare after a governed timeout following acceptance if the rider never confirms, so that a rider cannot take a trip and leave me unpaid.
100. As a rider, I want to be able to cancel before the claim timeout elapses, so that a driver cannot claim for a ride that never happened.
101. As a member, I want the claim timeout to be a governed parameter, so that members can tune it.
102. As a rider, I want coordinates published on-chain only at coarse precision (about 110 m), so that my exact location is not permanently public.
103. As a co-op member, I want a driver to be unable to accept a ride requested from their own address, so that rides cannot be self-dealt to farm ratings.
104. As a rider or driver, I want separate reputation profiles for my role as a driver and as a rider, so that a good driver is not judged by their behaviour as a rider.
105. As a rider, I want a driver's average rating shown with two decimal places (for example 4.37), so that small differences in reputation are visible.
106. As a rider, I want a profile with no ratings shown as "no ratings", so that a new driver is not mistaken for a bad one.
107. As a visitor, I want map and routing calls to go through the app's server without exposing an API key in the browser, so that the key is not leaked.
108. As a rider, I want fare suggestion to fall back to straight-line distance if the routing service is unavailable, so that I can still request a ride.

### Development and verification
84. As a developer, I want the whole system to run on a local test blockchain, so that I can test with no real-value risk.
85. As a developer, I want one automated test per Section 3 requirement, so that each stated rule is verified.
86. As a developer, I want a scripted run of join, request, accept, complete, rate, propose, vote and execute against a local chain, so that end-to-end integrity is demonstrated.
87. As a developer, I want that script to work after wiping and restarting the local chain, so that the system is demonstrably rebuildable and not just working once.
88. As a developer, I want the script to cross-check on-chain state against what the application shows at every step, so that read-model drift is caught.
89. As a developer, I want a static-analysis run with zero unresolved warnings, so that common security issues are fixed or explicitly justified.
90. As a developer, I want gas reports for the money-moving functions, so that I can compare the chosen design against a baseline that stores full ride details on-chain.

## Implementation Decisions

- **Architecture split**: money, membership, ratings and votes live entirely on-chain; fast reads (open-ride lists, reputation, histories, tallies) are served from an off-chain, read-only indexer built from emitted events. The indexer holds no funds and has no write authority.
- **Four contracts**:
  - **Membership**: onboarding, stake registration, exits. Joining requires the exact fixed stake (proposed 1 ETH). Exit refunds the stake and is refused while the member has a ride in progress. Exposes a membership check and an active-ride check to the other contracts.
  - **Ride Services**: ride lifecycle (requested, accepted, completed, cancelled), escrow lock of the fare, acceptance restricted to members, rider-only completion and cancellation, and automatic fare split on completion (fee to treasury, remainder to driver). Full refund on cancellation before or after acceptance.
  - **Reputation**: ratings tied to a specific completed ride and to the actual counterparty, once per rater per ride, immutable, only after completion.
  - **Governance**: owns the treasury balance, fee-parameter proposals, treasury-spend proposals, voting, quorum and majority checks, and execution of passed proposals.
- **Fee**: a percentage held as a governed parameter in Governance (or readable from it by Ride Services). It can change only by executing a passed proposal. There is no owner or admin setter. Initial value 5% and a hard cap of 20% (see the settled decisions below).
- **Fare split**: fee and driver payout are computed and transferred in one atomic transaction. Rounding must not lose or create funds (remainder goes to a single defined side).
- **Voting rules**: only current members may propose and vote, one vote per member per proposal, with a voting period. A proposal passes only with both minimum turnout (quorum) and more votes for than against. Quorum calculation must use ceiling or equivalent arithmetic so that small co-ops can never round quorum down to zero. A proposal can be executed once, only if passed.
- **Treasury spend safety**: execution of a spend reverts if the amount exceeds the current treasury balance at execution time.
- **Security**: follow checks-effects-interactions ordering for all payments; protect payout and refund paths against reentrancy; payments go only to addresses recorded in contract state (no arbitrary caller-supplied recipients).
- **Events**: every state transition and fund movement emits an event sufficient to reconstruct state off-chain (join, exit, ride requested/accepted/completed/cancelled, fare split, rating, proposal created, vote cast, proposal executed, treasury deposit/spend).
- **Indexer**: watches events from the four contracts, maintains queryable views (open rides, ride history per address, reputation summary, proposals and tallies, treasury balance and history), and serves them to the web app. It must rebuild from scratch by replaying events and tolerate a restarted local chain.
- **Web app**: four screens (home, rider, driver, governance), browser-wallet signing, reads from the indexer, writes directly to the contracts. Contract addresses are provided through configuration generated at local deployment.
- **Toolchain** (from the report's references): Solidity and Foundry for contracts, tests, gas reports and scripted runs; wagmi and viem with Next.js for the app.
- **Stage order** (from the report): environment and app shell; membership and staking; treasury and voting; ride request/acceptance/payment split; reputation; security review of all four contracts; local deployment and app wiring; indexer; UI stages (wallet and joining, rides and ratings, governance); documentation and clean-restart end-to-end run.
- **Decisions settled with the developer** (these replace the earlier open points):
  - **Voting**: one member, one vote. Only members who joined before a proposal was created may vote, and quorum uses the member count at creation. Any member can create a proposal; anyone can trigger execution of a passed proposal once voting ends. The treasury accepts direct deposits, which are logged.
  - **Governance parameters** (constructor-configured, then changed only by proposal): initial fee 5%, fee cap 20% (a proposal cannot exceed it), quorum 20% of members rounded up with a minimum of 1 vote, majority means more for than against, voting period 1 minute on the local chain and 1 day on a testnet.
  - **Governed pricing parameters**: per-km rate, minimum fare, and driver claim timeout (default 30 minutes on a testnet, shortened locally). The contract stores and exposes the per-km rate for the app to read; it does not verify claimed distance. It only escrows the fare the rider sends and enforces the minimum fare.
  - **Fare**: the rider offers the fare (suggested by the app from route distance times the governed rate, editable) and the full amount is escrowed at request. No on-chain distance check, since distance cannot be verified on-chain.
  - **Completion**: the rider confirms completion. If the rider never does, the driver may claim the fare after the governed timeout following acceptance. The rider can cancel at any time before completion or claim, with a full refund even after acceptance. No cancellation fee in this version. Requests never expire automatically.
  - **Anti-self-dealing**: a driver cannot accept a ride requested from their own address. Two-address farming remains possible but costs the fee and minimum fare each time; this is documented, not prevented.
  - **Reputation**: ratings are integers 1 to 5. Separate profiles for a member's role as driver and as rider. Each profile stores the sum and count of ratings; the contract exposes the average as an integer scaled by 100 (437 means 4.37), rounded half-up, and reports no rating when the count is zero.
  - **Currency and networks**: native test currency for stake and fares. Stake is a deployment parameter (default 0.01 ETH). Automated tests and the scripted end-to-end run use a local Anvil chain; an optional Sepolia deployment funded from a free faucet is for a live demo.
  - **Locations**: pickup and drop-off coordinates are emitted in events only, never kept in contract storage, rounded to 3 decimal places (about 110 m). Exact private location exchange is out of scope.
  - **Maps stack**: Leaflet with OpenStreetMap tiles for display; OpenRouteService with a free API key for address search, routing and distance, called only from a Next.js server route so the key stays on the server and out of the repository. Straight-line (haversine) distance is the fallback when the service is unavailable and the only source in automated tests.
  - **Indexer stack**: a custom TypeScript Node process using viem to read events, SQLite for storage and a small HTTP API, rebuildable from scratch by replaying events.
- **Python tooling** (if any scripts are needed): use uv for Python versioning.

## Testing Decisions

- **What makes a good test**: it exercises only external behaviour (public calls, emitted events, reverts, balances before and after) and never asserts on internal storage layout or private helpers. Each test should map to a requirement or user story and fail for exactly one reason.
- **Seam 1: the deployed four-contract suite's public interface (Foundry).** Deploy all four contracts together on the local chain and drive them through external calls only. One test per Section 3 requirement, including rejection paths. Cases that must be covered:
  - Exact stake required; double join refused; exit refunds stake; exit blocked during an active ride; non-members cannot accept.
  - Escrow on request; full refund on cancellation before and after acceptance; payout and fee split on completion; no double completion or refund; only the rider can complete or cancel.
  - Ratings only after completion, only by the true counterparty, once each, immutable.
  - Governance: passes only with quorum and majority; fails on low turnout; fails when against exceeds for; the small-co-op quorum rounding case (20% of 3 members); one vote per member; no execution twice; fee changes only through a passed proposal; spends never exceed the balance; non-members cannot propose or vote.
  - Conservation of funds: total funds in equals total funds out plus balances for every flow.
  - Event emission for each transition.
  - Driver claim after timeout succeeds only after the timeout, is blocked before it, and loses to a rider cancellation made before the claim.
  - Minimum fare enforced; per-km rate, minimum fare and claim timeout changeable only by passed proposal; fee cap of 20% cannot be exceeded by any proposal.
  - Self-dealing refused (driver accepting own request); voters who joined after proposal creation rejected; quorum uses the member count at creation.
  - Profile rating: sum and count update correctly; average scaled by 100 with half-up rounding (for example ratings 5 and 4 give 450, 5, 4 and 4 give 433); empty profile reports no rating; separate driver and rider profiles do not mix.
  - Emitted coordinates are rounded to 3 decimal places and none are stored in contract state.
- **Seam 2: the indexer's read model against emitted events.** Feed the indexer a stream of contract events (from a local chain) and assert on its query results (open rides, history, reputation summaries, proposals and tallies, treasury balance), plus rebuild-from-scratch equivalence and recovery after a chain restart. Test it through its query interface only.
- **End-to-end scripted run (not a separate seam)**: join, request, accept, complete, rate, propose, vote and execute against a live local chain via command-line tools, run again after a clean chain restart, with indexer and application state cross-checked against on-chain state at each step. This is the demo and regression check, not a place for new assertions.
- **Non-test checks**: static analysis with zero unresolved warnings (fix or justify inline), and gas reports focused on money-moving functions, compared with a baseline design that stores full ride details on-chain.
- **Prior art**: none in this repo (it is empty beyond the source report). The report names Foundry's test framework as the intended tool.
- **Coverage target**: complete coverage across all four contracts before submission.

## Out of Scope

- Dispute resolution (the report names Chainlink VRF only as future work for this).
- Any off-chain payment rail, fiat on/off ramps, or custody by anyone but the contracts.
- KYC or identity verification (sybil resistance relies on the stake).
- Real-time driver location tracking, surge or dynamic pricing, and route optimisation beyond a single suggested route.
- Cancellation fees or penalties after a driver accepts.
- Private location exchange between rider and driver, and any off-chain message channel.
- Dependence on outside services in the money or trust path. Maps and routing are convenience reads only, with a straight-line fallback; the contracts work without them.
- Production or public-network deployment; the target is a local test chain.
- Native mobile apps.
- Stake slashing or penalties for misbehaviour (not described in the report).
- Errand-specific features beyond what the ride flow covers (the title says "Ride & Errand", but the report's scope describes only rides).

## Further Notes

- **Source**: derived from the group's project report (Group 5, BITS Pilani Hyderabad Campus), including the Section 3 requirement tables and Section 5 evaluation parameters, which were images in the docx.
- **Departures from the report** (the report should be updated to match): maps and distance-based fare suggestion are added; the stake is a small configurable amount and not 1 ETH; the driver gets a timeout claim; the line "no dependence on outside services" is narrowed to the money and trust path. The "Ride & Errand" title is kept, but errands are out of scope.
- **Remaining judgement calls** while building: exact default values of the per-km rate and minimum fare (must be small enough for faucet funds), and which remainder rule applies in the fare split. Record both in an ADR.
- **Terminology**: this spec uses co-op, member, stake, escrow, fee, treasury, proposal and vote as the project's glossary. There is no `CONTEXT.md` yet; creating one with these terms is worthwhile before implementation.
- **Evaluation parameters from the report** that this work must demonstrate: functional correctness, fairness and decentralisation (no single vote can pass a proposal), sybil resistance (each fake identity costs the full stake), latency (write path settles in one transaction; read path bounded by block time plus indexer delay), end-to-end integrity, security (static analysis), and gas cost.
