import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { anvil } from "viem/chains";

const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

/**
 * A fresh config per call. The server must never share one between requests: a module-level config keeps the
 * last visitor's connection state, so the next visitor without a cookie got that address server-rendered and the
 * page failed hydration. Providers creates one per browser session; layout.tsx one per request.
 */
export function getConfig() {
  return createConfig({
    chains: [anvil],
    // shimDisconnect: false skips the forced account-picker (wallet_requestPermissions) on every connect click,
    // which re-prompted endlessly and collided with a still-open prompt ("already pending"). MetaMask then
    // remembers the site's approval; switch roles by changing the selected account in MetaMask.
    connectors: [injected({ shimDisconnect: false })],
    transports: { [anvil.id]: http(rpc) },
    ssr: true,
    // The connection lives in a cookie so the server render (app/layout.tsx) starts in "reconnecting" for a returning
    // user. With the default localStorage the first render was "disconnected" and flashed "Connect wallet".
    storage: createStorage({ storage: cookieStorage }),
  });
}
