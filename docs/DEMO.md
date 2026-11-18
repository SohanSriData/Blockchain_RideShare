# Demo guide

Two ways to demo: the **local demo** (recommended, needs no real accounts or funds) and an **optional Sepolia demo** on a public test network.

## What are Anvil and Sepolia?

- **Anvil** is a fake Ethereum blockchain that runs on your own computer (part of Foundry). It starts instantly, has 10 pre-funded accounts, needs no internet, and disappears when stopped. The local demo uses it.
- **Sepolia** is a real public Ethereum test network. Anyone can see your contracts on a block explorer, its ETH is free from faucets and has no value, and blocks take about 12 seconds. It is only for the optional public demo in section 3.

## 1. Accounts and tools you need

### Required for the local demo

| What | Why | Link |
|---|---|---|
| Node.js 22 | Runs the web app and indexer | https://nodejs.org |
| Foundry 1.9.0 | Provides `anvil`, `forge`, `cast` | https://book.getfoundry.sh/getting-started/installation (then `foundryup --install 1.9.0`) |
| Git | Clone with the submodule | https://git-scm.com |
| MetaMask browser extension | Signs transactions | https://metamask.io/download |

No sign-up is needed for any of these. Windows: use PowerShell for npm and Git Bash for Foundry.

### Optional, free accounts

| What | Why | Link |
|---|---|---|
| OpenRouteService account and API key | Real road routes and address search. Without it the app uses straight-line distance and the demo still works. | https://openrouteservice.org/dev/#/signup |
| Alchemy (or Infura) account | An RPC URL for Sepolia | https://dashboard.alchemy.com |
| A Sepolia faucet | Free test ETH for the Sepolia demo | https://www.alchemy.com/faucets/ethereum-sepolia or https://cloud.google.com/application/web3/faucet/ethereum/sepolia |

### Wallet accounts to create (MetaMask)

Create or import **four** accounts and name them so the demo is easy to follow:

| Name | Role | Needs to join the co-op? |
|---|---|---|
| Rider | Requests and pays for rides | No |
| Driver | Accepts rides and earns the fare | Yes |
| Member 3 | Third voter, so proposals can pass with a clear majority | Yes |
| Deployer | Account 0 from Anvil, used only by the deploy script | No (not imported) |

Local demo: use the **public Anvil test keys** printed when you run `npm run chain`. Import any three of accounts 1 to 9 into MetaMask (Account menu, Import account, paste the private key). These keys are public and only valid on the local chain; never send real funds to them.

Sepolia demo: create three **fresh** MetaMask accounts (do not reuse an account that holds real assets) and fund each from a faucet with roughly 0.05 Sepolia ETH.

## 2. Local demo

### 2.1 One-time setup

```sh
git clone --recurse-submodules https://github.com/SohanSriData/Blockchain_RideShare.git
cd Blockchain_RideShare
npm ci
cp .env.example .env.local        # then add ORS_API_KEY=<your key> (optional)
npm run check:env                 # must print only "ok" lines
```

In MetaMask add a network: name `Anvil Local`, RPC URL `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`.

### 2.2 Start everything (four terminals, repo root, in this order)

```sh
npm run chain            # 1. local chain; prints the test accounts and keys
npm run deploy:local     # 2. deploys the four contracts, syncs addresses to the web app
npm run dev:indexer      # 3. read API on http://127.0.0.1:8787
npm run dev:web          # 4. app on http://localhost:3000
```

Local timings are short for demos: voting lasts 1 minute, the driver claim timeout is 2 minutes, stake is 0.01 ETH, minimum fare 0.001 ETH, per-km rate 0.0005 ETH.

### 2.3 Script

The app has one screen per role, each with its own colour: **Ride** (`/rider`, teal booking screen), **Drive** (`/driver`, amber dashboard) and **Governance** (indigo). The header always shows who is acting: role, ETH balance, membership and rating next to the address. Rides show a step tracker (Requested, Accepted, Completed or Cancelled) with a hint of what happens next.

1. **Join.** Open **Drive** as Driver. In the Membership card click "Join the co-op" (0.01 ETH, refundable) and confirm in MetaMask. Repeat as Member 3. Point out that the stake is returned on exit ("Leave and recover stake").
2. **Request.** As Rider open **Ride**. Set pickup and drop-off in the "Book a ride" panel (click the map or search an address). Note the suggested fare (distance times per-km rate, never below the minimum). Click "Request ride" and confirm. The "Current ride" tracker shows Requested: the fare is now escrowed in the contract.
3. **Accept.** As Driver open **Drive**. The ride appears under "Open jobs", nearest first. Accept it; it moves to "Active ride" and the rider's tracker moves to Accepted. A driver never sees their own requests, and the contract also rejects self-acceptance (`SelfDealing`). To show the rule, see section 2.5.
4. **Complete.** As Rider click "Confirm completed". The driver receives 95% of the fare (the Earned card goes up) and 5% goes to the treasury, listed as "Ride fee" on **Governance**.
5. **Rate.** The Rider's tracker stays on "Latest ride" with a rating control: rate the driver 1 to 5. Under "Past rides" on **Drive**, the Driver rates the rider. The ★ ratings in the header and on the cards update.
6. **Govern.** On **Governance** as Driver, propose a fee change (for example Fee, value 8). Vote yes as Driver and as Member 3 within the one-minute window (connect Member 3 to the site beforehand, see the troubleshooting table). Wait for the window to close, press Execute (anyone can), and see the new fee. Run another ride to show the new split.
7. **Edge cases (optional).** Cancel a ride before it is accepted (full refund; cancelling after acceptance also refunds in full, and the driver's screen says not to drive to that pickup). Accept a ride as Driver, do not confirm, and watch the claim countdown on the active ride; after 2 minutes click "Claim fare". Clicking it earlier shows "The claim timeout has not elapsed yet." straight away: the app checks every transaction before opening MetaMask, so nothing is sent and no gas is spent.

### 2.3.1 Running the demo on one laptop without switching accounts

MetaMask has one active account per browser profile, shared by all tabs, so tabs alone do not help. Instead create one Chrome profile per role (profile icon, Add), install MetaMask in each, import only that role's key and add the Anvil network. Put the Rider window (**Ride**) and the Driver window (**Drive**) side by side: a request on the left appears in the Driver's open jobs within about 2 seconds, and accepting on the right moves the rider's tracker. Use a third profile for Member 3, or briefly switch the Driver profile's account for the vote.

### 2.4 What to say

- Funds are escrowed and split by code. No admin or owner exists; contracts are wired by immutable addresses.
- Ride coordinates live only in events, which keeps gas low: about 290k gas for request, accept and complete, against about 345k for a baseline that stores everything.
- The indexer is only a convenience. Delete it and it rebuilds from events, including after a chain wipe.

### 2.5 Backup if the live demo breaks

```sh
npm run e2e
```

Runs the entire flow against a real temporary chain, cross-checks the chain and the indexer at every step, then repeats after wiping the chain. It ends with `E2E passed`.

**Showing the self-accept rule.** The Drive screen never lists your own requests, so show the contract rule from Git Bash (repo root, local chain running). Member 3 requests a ride, a simulated accept by Member 3 reverts with `SelfDealing()` (selector `0x74ca9bd8`), and the ride is then cancelled. Replace `<id>` with the new ride's number from the **Ride** screen or `curl http://127.0.0.1:8787/rides/open`.

```sh
RIDES=$(node -p "require('./web/src/lib/deployment.json').rideServices"); M3=0x90F79bf6EB2c4f870365E785982E1f101E93b906
cast send --unlocked --from $M3 $RIDES "requestRide(int256,int256,int256,int256)" 17400000 78450000 17360000 78520000 --value 0.002ether
cast call --from $M3 $RIDES "acceptRide(uint256)" <id>      # reverts: custom error 0x74ca9bd8 = SelfDealing()
cast send --unlocked --from $M3 $RIDES "cancelRide(uint256)" <id>
```

### 2.6 Troubleshooting

| Symptom | Fix |
|---|---|
| Wallet shows the wrong network or "chain mismatch" | Switch MetaMask to chain 31337 |
| Switching account in MetaMask does not change the address in the app | MetaMask only exposes accounts connected to the site: open its site-connection menu on localhost:3000, Edit accounts, and tick Rider, Driver and Member 3 once before the demo |
| Transactions hang or nonce errors after restarting Anvil | Re-run `npm run deploy:local`, restart the indexer, then in MetaMask: Settings, Advanced, Clear activity tab data |
| App shows no rides | Check the indexer terminal is running and `http://127.0.0.1:8787/health` responds |
| "The claim timeout has not elapsed yet." | The countdown on the active ride uses chain time; wait for it and retry. Nothing was sent |
| "Connect wallet" does nothing | No wallet in this browser (the app says so). Use a browser with MetaMask |
| Maps show straight lines only | `ORS_API_KEY` missing or invalid in `.env.local`; restart `dev:web` after editing |
| `check:env` fails | Install the exact versions named in the README |

## 3. Optional: Sepolia demo

Only do this if you want the demo on a public test network. It needs a funded deployer key, which must never be committed.

1. Create an Alchemy app for **Ethereum Sepolia** and copy its HTTPS URL.
2. Fund a fresh deployer account and the three demo accounts from a faucet.
3. Deploy (from `contracts/`; the key is read from the environment or a Foundry keystore, not a file in the repo):
   ```sh
   forge script script/Deploy.s.sol --rpc-url <ALCHEMY_SEPOLIA_URL> --broadcast --private-key <DEPLOYER_KEY>
   ```
   Non-local chains default to 1 day voting and a 30 minute claim timeout. For a short demo override them: set `VOTING_PERIOD=120` and `CLAIM_TIMEOUT=180` in the environment first.
4. The script writes `contracts/deployments/11155111.json`. Copy it into the web app with `CHAIN_ID=11155111 npm run sync:deployment`, and start the indexer with `RPC_URL=<ALCHEMY_SEPOLIA_URL> DEPLOYMENT=../contracts/deployments/11155111.json npm run dev:indexer`.
5. The web app is currently hard-wired to the local chain: `web/src/lib/wagmi.ts` lists only viem's `anvil` chain and reads `NEXT_PUBLIC_RPC_URL`. To use Sepolia, import `sepolia` from `viem/chains`, use it in `chains` and `transports`, and set `NEXT_PUBLIC_RPC_URL` to your Alchemy URL. This change is **not yet made or tested**.
6. Add the Sepolia network in MetaMask (under "Show test networks") and follow the script in section 2.3.

Sepolia blocks take about 12 seconds, so allow time between steps.

## 4. Before presenting

- Run `npm test` and `npm run e2e` once beforehand.
- Pre-fund and pre-import the MetaMask accounts, connect all of them to `localhost:3000` once, and rehearse the wait during voting (use the minute to explain governance).
- For a clean slate run `npm run deploy:local` and restart the indexer (no Anvil restart, so MetaMask nonces stay valid).
- Keep `docs/PROJECT_REPORT.md` open for questions about design and limits.
