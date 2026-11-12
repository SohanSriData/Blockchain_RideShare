# Ride & Errand Co-op: domain glossary

- **Co-op**: the driver-owned system of four contracts; no owner or admin.
- **Member**: an address that has staked and joined. Only members may accept rides, propose and vote.
- **Stake**: the fixed, refundable deposit (deployment parameter, default 0.01 ETH) paid to join; returned in full on exit.
- **Ride**: a request with its escrowed fare. States: Requested, Accepted, Completed, Cancelled.
- **Rider / Driver**: the requester and the accepting member for one ride. Reputation is kept in separate rider and driver profiles.
- **Escrow**: the fare held by Ride Services from request until completion, claim or cancellation.
- **Fare**: the amount the rider offers; at least the governed minimum fare. Suggested off-chain from distance x per-km rate.
- **Fee**: governed percentage (default 5%, cap 20%) of the fare paid to the treasury on completion. Rounds down; the driver gets the remainder.
- **Treasury**: ETH held by Governance, funded by fees and direct deposits, spent only by a passed proposal.
- **Proposal**: a member-created change (fee, per-km rate, minimum fare, claim timeout, or treasury spend). Quorum is 20% of the member count at creation, rounded up, minimum 1; passes with more for than against.
- **Claim timeout**: governed delay after acceptance after which the driver may claim the fare if the rider never confirmed.
- **Indexer**: read-only process that rebuilds a SQLite read model from emitted events.
