"use client";

import { ratingText } from "@/lib/format";
import { useIndexer, type ProfileView } from "@/lib/indexer";

/** A driver's or rider's average rating (two decimals) or "no ratings". */
export function RepBadge({ address, role }: { address: string; role: "driver" | "rider" }) {
  const { data } = useIndexer<{ driver: ProfileView; rider: ProfileView }>(`/reputation/${address}`, 5000);
  const p = data?.[role];
  return <small className="muted">{p ? ratingText(p.averageX100, p.count) : "…"}</small>;
}
