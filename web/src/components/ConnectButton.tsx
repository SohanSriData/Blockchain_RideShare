"use client";

import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts";
import { short } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  if (!isConnected) {
    return (
      <button onClick={() => connect.mutate({ connector: connect.connectors[0] })} disabled={connect.isPending}>
        {connect.isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  return (
    <span className="row">
      {chainId !== CHAIN_ID && (
        <button className="warn" onClick={() => switchChain.mutate({ chainId: CHAIN_ID })}>
          Switch to local chain
        </button>
      )}
      <span className="mono">{short(address)}</span>
      <button className="ghost" onClick={() => disconnect.mutate()}>
        Disconnect
      </button>
    </span>
  );
}
