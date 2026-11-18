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

1. **Join.** Open `/driver` as Driver, click "Join the co-op" (0.01 ETH, refundable) and confirm in MetaMask. Repeat as Member 3. Point out that the stake is returned on exit.
2. **Request.** Switch to Rider, open `/rider`, choose pickup and drop-off (click the map or search an address). Note the suggested fare (distance times per-km rate, never below the minimum). Request the ride and confirm. Your balance drops: the fare is now escrowed in the contract.
3. **Accept.** Switch to Driver, open `/driver`. The ride appears in the open list sorted by distance. Accept it. (If the Driver is also the requester, the contract rejects it; try this to show the rule.)
4. **Complete.** As Rider confirm completion. The driver receives 95% of the fare and 5% goes to the treasury, visible on `/governance`.
5. **Rate.** Rider rates the driver 1 to 5; Driver rates the rider. Reputation badges update.
6. **Govern.** On `/governance` as Driver, propose a fee change (for example 5% to 8%). Vote yes as Driver and as Member 3. Wait about a minute, press Execute (anyone can), and see the new fee. Run another ride to show the new split.
7. **Edge cases (optional).** Cancel a ride before it is accepted (full refund). Accept a ride as Driver, do not confirm, wait 2 minutes, then use Claim fare. Try Claim earlier to see the readable "too early" error.

### 2.4 What to say

- Funds are escrowed and split by code. No admin or owner exists; contracts are wired by immutable addresses.
- Ride coordinates live only in events, which keeps gas low: about 290k gas for request, accept and complete, against about 345k for a baseline that stores everything.
- The indexer is only a convenience. Delete it and it rebuilds from events, including after a chain wipe.

### 2.5 Backup if the live demo breaks

```sh
npm run e2e
```

Runs the entire flow against a real temporary chain, cross-checks the chain and the indexer at every step, then repeats after wiping the chain. It ends with `E2E passed`.

### 2.6 Troubleshooting

| Symptom | Fix |
|---|---|
| Wallet shows the wrong network or "chain mismatch" | Switch MetaMask to chain 31337 |
| Switching account in MetaMask does not change the address in the app | MetaMask only exposes accounts connected to the site: open its site-connection menu on localhost:3000, Edit accounts, and tick Rider, Driver and Member 3 once before the demo |
| Transactions hang or nonce errors after restarting Anvil | Re-run `npm run deploy:local`, restart the indexer, then in MetaMask: Settings, Advanced, Clear activity tab data |
| App shows no rides | Check the indexer terminal is running and `http://127.0.0.1:8787/health` responds |
| "Claim too early" | Anvil's clock can run ahead of the wall clock; wait a little and retry |
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
- Pre-fund and pre-import the MetaMask accounts, and rehearse the wait during voting (use the minute to explain governance).
- Keep `docs/PROJECT_REPORT.md` open for questions about design and limits.
