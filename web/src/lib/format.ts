import { formatEther } from "viem";

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const eth = (wei: bigint | string) => `${formatEther(BigInt(wei))} ETH`;

/** Reputation shown with two decimals, or "no ratings" for an empty profile. */
export function ratingText(averageX100: number | null, count: number): string {
  if (averageX100 === null) return "no ratings";
  return `${(averageX100 / 100).toFixed(2)} (${count})`;
}

export const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
