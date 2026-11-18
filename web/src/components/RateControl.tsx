"use client";

import { useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { addresses, CHAIN_ID, reputationAbi } from "@/lib/contracts";
import { TxButton } from "./TxButton";

/** 1-5 rating for a completed ride, once per rater. */
export function RateControl({ rideId, who }: { rideId: string; who: "driver" | "rider" }) {
  const { address } = useConnection();
  const [score, setScore] = useState(5);
  const rated = useReadContract({ chainId: CHAIN_ID,
    address: addresses.reputation,
    abi: reputationAbi,
    functionName: "hasRated",
    args: [BigInt(rideId), address!],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  if (rated.data) return <small className="muted">You rated this {who}.</small>;
  return (
    <span className="row">
      <select value={score} onChange={(e) => setScore(Number(e.target.value))} aria-label={`Rate the ${who}`}>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <TxButton
        label={`Rate ${who}`}
        request={{ address: addresses.reputation, abi: reputationAbi, functionName: "rate", args: [BigInt(rideId), score] }}
        onDone={() => rated.refetch()}
      />
    </span>
  );
}
