"use client";

import { useEffect, useState } from "react";
import { useConfig, useConnection, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { simulateContract } from "wagmi/actions";
import { CHAIN_ID, type TxRequest } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";

/** Simulates, then sends a contract write and shows wallet-pending, confirming, confirmed or a readable error. */
export function TxButton({
  label,
  request,
  onDone,
  disabled,
  className,
  wide,
}: {
  label: string;
  request: TxRequest;
  onDone?: () => void;
  disabled?: boolean;
  className?: string;
  /** Full-width primary action with the status underneath. */
  wide?: boolean;
}) {
  const config = useConfig();
  const { address } = useConnection();
  const write = useWriteContract();
  // retry: false: wagmi throws on a reverted receipt, and the default three retries kept "Pending…" up for ~10 s.
  const receipt = useWaitForTransactionReceipt({ hash: write.data, chainId: CHAIN_ID, query: { retry: false } });
  const [checking, setChecking] = useState(false);
  // Tagged with the sender so a switch of account hides it (no setState in the reset effect below).
  const [preflight, setPreflight] = useState<{ error: unknown; from?: string }>();

  // A status or error belongs to the account that sent it: clear it when the wallet switches account.
  useEffect(() => {
    write.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  useEffect(() => {
    if (receipt.isSuccess) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  async function send() {
    write.reset();
    setPreflight(undefined);
    setChecking(true);
    try {
      // Simulate first: a call that would revert (e.g. ClaimTooEarly) shows its readable reason here instead of
      // the wallet broadcasting a doomed transaction and charging gas for it.
      await simulateContract(config, { ...request, account: address, chainId: CHAIN_ID } as never);
    } catch (e) {
      setPreflight({ error: e, from: address });
      return;
    } finally {
      setChecking(false);
    }
    write.mutate({ ...request, chainId: CHAIN_ID } as never);
  }

  const busy = checking || write.isPending || (!!write.data && receipt.isLoading);
  const status = checking
    ? "Checking…"
    : write.isPending
      ? "Confirm in wallet…"
      : receipt.isLoading
        ? "Pending…"
        : receipt.isSuccess
          ? "Confirmed"
          : receipt.isError
            ? "Failed on chain"
            : "";
  const preflightError = preflight && preflight.from === address ? preflight.error : undefined;
  const error = preflightError ?? write.error ?? receipt.error;

  return (
    <span className={wide ? "big-tx" : "tx"}>
      <button className={className} disabled={disabled || busy} onClick={send}>
        {label}
      </button>
      {status && <small className={receipt.isSuccess ? "ok" : "muted"}>{status}</small>}
      {error && <small className="err">{friendlyError(error)}</small>}
    </span>
  );
}
