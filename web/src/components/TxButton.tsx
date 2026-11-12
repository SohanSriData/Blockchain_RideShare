"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { TxRequest } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";

/** Sends a contract write and shows wallet-pending, confirming, confirmed or a readable error. */
export function TxButton({
  label,
  request,
  onDone,
  disabled,
  className,
}: {
  label: string;
  request: TxRequest;
  onDone?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });

  useEffect(() => {
    if (receipt.isSuccess) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const busy = write.isPending || (!!write.data && receipt.isLoading);
  const status = write.isPending
    ? "Confirm in wallet…"
    : receipt.isLoading
      ? "Pending…"
      : receipt.isSuccess
        ? "Confirmed"
        : receipt.isError
          ? "Failed on chain"
          : "";

  return (
    <span className="tx">
      <button
        className={className}
        disabled={disabled || busy}
        onClick={() => {
          write.reset();
          write.mutate(request as never);
        }}
      >
        {label}
      </button>
      {status && <small className={receipt.isSuccess ? "ok" : "muted"}>{status}</small>}
      {write.error && <small className="err">{friendlyError(write.error)}</small>}
    </span>
  );
}
