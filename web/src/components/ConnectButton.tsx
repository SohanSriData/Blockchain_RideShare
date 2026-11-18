"use client";

import { useState } from "react";
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/lib/contracts";
import { short } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [noWallet, setNoWallet] = useState(false);

  if (!isConnected) {
    const onClick = () => {
      // Without a browser wallet (e.g. VS Code's built-in browser) the click used to do nothing, silently.
      if (typeof window === "undefined" || !("ethereum" in window)) {
        setNoWallet(true);
        return;
      }
      setNoWallet(false);
      connect.mutate({ connector: connect.connectors[0] });
    };
    return (
      <span className="row">
        <button onClick={onClick} disabled={connect.isPending}>
          {connect.isPending ? "Connecting…" : "Connect wallet"}
        </button>
        {noWallet && (
          <small className="err">
            No wallet found in this browser. Open this page in Chrome, Edge or Firefox with MetaMask installed.
          </small>
        )}
        {connect.error && <small className="err">{connect.error.message.split("\n")[0]}</small>}
      </span>
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
