"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { TxButton } from "@/components/TxButton";
import { RateControl } from "@/components/RateControl";
import { RepBadge } from "@/components/RepBadge";
import { addresses, membershipAbi, rideAbi } from "@/lib/contracts";
import { eth, sameAddress, short } from "@/lib/format";
import { fromMilliDegrees, sortByDistance, type LatLng } from "@/lib/geo";
import { useIndexer, type RideView } from "@/lib/indexer";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const HYDERABAD: LatLng = { lat: 17.385, lng: 78.4867 };

export default function DriverPage() {
  const { address, isConnected } = useConnection();
  const [here, setHere] = useState<LatLng>(HYDERABAD);
  const [selected, setSelected] = useState<string>();

  const stake = useReadContract({ address: addresses.membership, abi: membershipAbi, functionName: "STAKE" });
  const member = useReadContract({
    address: addresses.membership,
    abi: membershipAbi,
    functionName: "isMember",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const open = useIndexer<RideView[]>("/rides/open");
  const history = useIndexer<RideView[]>(address ? `/history/${address}` : null);

  const sorted = useMemo(
    () => sortByDistance((open.data ?? []).filter((r) => !sameAddress(r.rider, address)), here),
    [open.data, here, address],
  );
  const mine = (history.data ?? []).filter((r) => sameAddress(r.driver, address));
  const refresh = () => setTimeout(() => { open.refetch(); history.refetch(); member.refetch(); }, 1500);

  const markers = [
    { id: "me", ...here, color: "#2255cc", label: "You" },
    ...sorted.map((r) => ({
      id: r.id,
      lat: fromMilliDegrees(r.pickupLat),
      lng: fromMilliDegrees(r.pickupLng),
      color: r.id === selected ? "#b3261e" : "#1f5f4a",
      label: `Ride #${r.id} · ${eth(r.fare)}`,
      onClick: () => setSelected(r.id),
    })),
  ];

  return (
    <>
      <h1>Driver</h1>
      {!isConnected && <p className="notice">Connect your wallet to join and accept rides.</p>}
      {open.error && <p className="notice err">{open.error}</p>}

      <section>
        <h2>Membership</h2>
        {member.data ? (
          <p className="row">
            <span className="ok">You are a staked member.</span>
            <TxButton
              label="Leave and recover stake"
              className="ghost"
              request={{ address: addresses.membership, abi: membershipAbi, functionName: "exit" }}
              onDone={refresh}
            />
          </p>
        ) : (
          <p className="row">
            <span>Joining costs exactly {stake.data !== undefined ? eth(stake.data) : "…"} (fully refundable).</span>
            <TxButton
              label="Join the co-op"
              disabled={!isConnected || stake.data === undefined}
              request={{ address: addresses.membership, abi: membershipAbi, functionName: "join", value: stake.data }}
              onDone={refresh}
            />
          </p>
        )}
      </section>

      <section>
        <h2>Open rides</h2>
        <p className="row">
          <button
            className="ghost"
            onClick={() => navigator.geolocation?.getCurrentPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }))}
          >
            Use my location
          </button>
          <span className="muted">or click the map to set where you are. Rides are sorted by distance from you.</span>
        </p>
        <MapView center={here} markers={markers} onMapClick={setHere} />
        {sorted.length === 0 && <p className="muted">No open rides.</p>}
        {sorted.map((r) => (
          <div key={r.id} className="card" style={r.id === selected ? { borderColor: "var(--accent)" } : undefined}>
            <span>
              <strong>#{r.id}</strong> {r.distanceKm.toFixed(1)} km away · {eth(r.fare)} · rider <RepBadge address={r.rider} role="rider" />
            </span>
            <TxButton
              label="Accept"
              disabled={!member.data}
              request={{ address: addresses.rideServices, abi: rideAbi, functionName: "acceptRide", args: [BigInt(r.id)] }}
              onDone={refresh}
            />
          </div>
        ))}
      </section>

      <section>
        <h2>My rides</h2>
        {mine.length === 0 && <p className="muted">No rides yet.</p>}
        {[...mine].reverse().map((r) => (
          <div key={r.id} className="card">
            <span>
              <strong>#{r.id}</strong> {r.status === "Cancelled" ? "Cancelled by rider. Do not drive to this pickup." : r.status} · {eth(r.fare)}
              {r.driverAmount && <> · you received {eth(r.driverAmount)}</>} · rider <span className="mono">{short(r.rider)}</span>
            </span>
            <span className="row">
              {r.status === "Accepted" && <ClaimButton id={r.id} onDone={refresh} />}
              {r.status === "Completed" && <RateControl rideId={r.id} who="rider" />}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function ClaimButton({ id, onDone }: { id: string; onDone: () => void }) {
  const ride = useReadContract({
    address: addresses.rideServices,
    abi: rideAbi,
    functionName: "getRide",
    args: [BigInt(id)],
    query: { refetchInterval: 5000 },
  });
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const claimableAt = ride.data ? Number(ride.data[4]) : undefined;
  const wait = claimableAt !== undefined ? claimableAt - now : undefined;
  return (
    <span className="row">
      <TxButton
        label="Claim fare"
        request={{ address: addresses.rideServices, abi: rideAbi, functionName: "claimFare", args: [BigInt(id)] }}
        onDone={onDone}
      />
      {wait !== undefined && wait > 0 && (
        <small className="muted">Available after {new Date(claimableAt! * 1000).toLocaleTimeString()} if the rider has not confirmed.</small>
      )}
    </span>
  );
}
