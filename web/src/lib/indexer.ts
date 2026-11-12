"use client";

import { useCallback, useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8787";

export interface RideView {
  id: string;
  rider: string;
  driver: string | null;
  fare: string;
  status: "Requested" | "Accepted" | "Completed" | "Cancelled";
  claimed: boolean;
  fee: string | null;
  driverAmount: string | null;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}

export interface ProfileView {
  count: number;
  sum: number;
  averageX100: number | null;
}

export interface ProposalView {
  id: string;
  proposer: string;
  kind: "Fee" | "PerKmRate" | "MinFare" | "ClaimTimeout" | "Spend";
  value: string;
  recipient: string | null;
  endTime: number;
  quorum: number;
  forVotes: number;
  againstVotes: number;
  executed: boolean;
  status: "open" | "passed" | "failed" | "executed";
}

export interface TreasuryView {
  balance: string;
  history: { type: "deposit" | "spend"; counterparty: string; amount: string; block: number }[];
}

/** Poll a read-only indexer endpoint. `path` null pauses. */
export function useIndexer<T>(path: string | null, intervalMs = 2000) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();

  const refetch = useCallback(async () => {
    if (!path) return;
    try {
      const res = await fetch(`${BASE}${path}`);
      if (!res.ok) throw new Error(`indexer ${res.status}`);
      setData((await res.json()) as T);
      setError(undefined);
    } catch {
      setError("Indexer unreachable. Is `npm run dev:indexer` running?");
    }
  }, [path]);

  useEffect(() => {
    const first = setTimeout(refetch, 0);
    const t = setInterval(refetch, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refetch, intervalMs]);

  return { data, error, refetch };
}
