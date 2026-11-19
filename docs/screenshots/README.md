# Screenshots

Captured from the running local demo (Anvil, indexer, web app) at 1440x900, 2x scale, with real contract and indexer data. Files 01–12 show each screen; 13–28 show the remaining states and features, produced by real transactions on the local chain (proposals #2 and #3, rides #7 to #9, two donations).

| File | Shows | Suggested slide |
|---|---|---|
| 01-home.png | Landing page with the three role choices | Introduction / the idea |
| 02-rider-booking.png | Rider booking: pickup, drop-off, distance, suggested fare | Rider flow |
| 03-rider-current-rides.png | Rider's ride trackers (Requested, Accepted) with Confirm and Cancel | Escrow and ride lifecycle |
| 04-driver-dashboard.png | Driver stats, active ride with Claim fare, open jobs nearest first | Driver flow |
| 05-driver-full.png | Full driver page including past rides and ratings | Reputation |
| 06-governance.png | Rules, treasury fee income, executed fee proposal | Governance and treasury |
| 07-governance-full.png | Full governance page | Governance (backup) |
| 08–10-*-dark.png | Rider, driver and governance in dark mode | Optional |
| 11-rider-mobile.png | Rider screen on a phone-sized viewport | Responsive UI |
| 12-no-wallet.png | Browser without a wallet: clear message, read-only view | Wallet UX |
| 13-tx-pending.png | A transaction button showing "Pending…" | Wallet UX |
| 14-tx-confirmed.png | "Confirmed" after a treasury donation, with donation and spend lines | Treasury |
| 15-gov-spend-form.png | Filling in a treasury Spend proposal (amount and recipient) | Governance |
| 16-gov-open-proposals.png | Open proposals with Vote for / Vote against | Governance: voting |
| 17-gov-voted.png | "You voted" after casting votes | Governance: voting |
| 18-gov-donation-nonmember.png | Non-member notice and a donation in the treasury | Governance: who may vote |
| 19-rider-rate-and-history.png | Rider's cancelled ride, past rides and "Rate driver" controls | Reputation |
| 20-driver-cancelled-and-rate.png | "Cancelled by rider, do not drive to this pickup", earnings per ride, "Rate rider" | Driver flow, reputation |
| 21-driver-claim-countdown.png | Active ride with the claim countdown (1:56) | Timeout claim |
| 22-preflight-error.png | Early claim stopped before the wallet opens: "The claim timeout has not elapsed yet." | Wallet bugs fixed / safety |
| 23-rider-address-search.png | Address search results (OpenRouteService geocoding) | Rider flow |
| 24-driver-not-member.png | New driver before joining: "Join the co-op", 0.01 ETH refundable stake | Membership |
| 25-wrong-network.png | Header with "Switch to local chain" when the wallet is on another network | Wallet UX |
| 26-gov-not-member.png | Governance for a non-member (propose and vote disabled) | Governance: who may vote |
| 27-gov-passed-execute.png | Passed proposals with the Execute button | Governance: execute |
| 28-gov-spend-executed.png | Spend executed: treasury shows "Spend to" and the proposal is executed | Treasury spending |

Not captured: the MetaMask confirmation pop-up itself. Take it by hand (Win+Shift+S) while a transaction waits for approval.

The wallet in these captures is a test stub that forwards to the local Anvil chain, so the screens show real contract and indexer data without the MetaMask popup.
