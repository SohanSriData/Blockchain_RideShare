"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBalance, useConnection, useReadContract } from "wagmi";
import { ConnectButton } from "./ConnectButton";
import { addresses, CHAIN_ID, membershipAbi } from "@/lib/contracts";
import { ratingText } from "@/lib/format";
import { useIndexer, type ProfileView } from "@/lib/indexer";
import { formatEther } from "viem";

type Role = "rider" | "driver" | "gov";

export function roleOf(pathname: string): Role | undefined {
  if (pathname.startsWith("/rider")) return "rider";
  if (pathname.startsWith("/driver")) return "driver";
  if (pathname.startsWith("/governance")) return "gov";
  return undefined;
}

const LINKS = [
  { href: "/rider", label: "Ride" },
  { href: "/driver", label: "Drive" },
  { href: "/governance", label: "Governance" },
];

/** Sticky header: nav with the current page highlighted, who is acting, and the wallet. Coloured by role. */
export function SiteHeader() {
  const pathname = usePathname();
  const role = roleOf(pathname);
  return (
    <header className={`site-header${role ? ` role-${role}` : ""}`}>
      <div className="site-header-inner">
        <nav>
          <Link href="/" className="brand">Ride Co-op</Link>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "active" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="account">
          <AccountSummary role={role} />
          <ConnectButton />
        </span>
      </div>
    </header>
  );
}

/** Role, balance, membership and rating of the connected account, so the audience always sees who is acting. */
function AccountSummary({ role }: { role?: Role }) {
  const { address, isConnected } = useConnection();
  const balance = useBalance({ address, chainId: CHAIN_ID, query: { enabled: !!address, refetchInterval: 4000 } });
  const member = useReadContract({
    chainId: CHAIN_ID,
    address: addresses.membership,
    abi: membershipAbi,
    functionName: "isMember",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const rep = useIndexer<{ driver: ProfileView; rider: ProfileView }>(address ? `/reputation/${address}` : null, 5000);
  if (!isConnected) return null;

  const label = role === "rider" ? "Rider" : role === "driver" ? "Driver" : member.data ? "Member" : undefined;
  const profile = role === "driver" ? rep.data?.driver : role === "rider" ? rep.data?.rider : undefined;
  return (
    <>
      {label && <span className="chip role">{label}</span>}
      {balance.data && <span className="chip mono">{Number(formatEther(balance.data.value)).toFixed(4)} ETH</span>}
      {/* Riders need no membership, so the chip would only be noise on the Ride page. */}
      {member.data !== undefined && role !== "rider" && (
        <span className={`chip${member.data ? " yes" : ""}`}>{member.data ? "✓ Member" : "Not a member"}</span>
      )}
      {profile && <span className="chip">★ {ratingText(profile.averageX100, profile.count)}</span>}
    </>
  );
}
