"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { TxButton } from "@/components/TxButton";
import { RateControl } from "@/components/RateControl";
import { RepBadge } from "@/components/RepBadge";
import { RideTracker } from "@/components/RideTracker";
import { addresses, CHAIN_ID, membershipAbi, rideAbi } from "@/lib/contracts";
import { eth, ratingText, sameAddress, short } from "@/lib/format";
import { fromMilliDegrees, sortByDistance, type LatLng } from "@/lib/geo";
import { useIndexer, type ProfileView, type RideView } from "@/lib/indexer";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const HYDERABAD: LatLng = { lat: 17.385, lng: 78.4867 };

export default function DriverPage() {
  const { address, isConnected } = useConnection();
  const [here, setHere] = useState<LatLng>(HYDERABAD);
  const [selected, setSelected] = useState<string>();

  const stake = useReadContract({ chainId: CHAIN_ID, address: addresses.membership, abi: membershipAbi, functionName: "STAKE" });
  const member = useReadContract({ chainId: CHAIN_ID,
    address: addresses.membership,
    abi: membershipAbi,
    functionName: "isMember",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 3000 },
  });
  const open = useIndexer<RideView[]>("/rides/open");
  const history = useIndexer<RideView[]>(address ? `/history/${address}` : null);
  const rep = useIndexer<{ driver: ProfileView; rider: ProfileView }>(address ? `/reputation/${address}` : null, 5000);

  const sorted = useMemo(
    () => sortByDistance((open.data ?? []).filter((r) => !sameAddress(r.rider, address)), here),
    [open.data, here, address],
  );
  const mine = [...(history.data ?? []).filter((r) => sameAddress(r.driver, address))].reverse();
  const active = mine.filter((r) => r.status === "Accepted");
  const past = mine.filter((r) => r.status !== "Accepted");
  const earned = mine.reduce((sum, r) => sum + BigInt(r.driverAmount ?? "0"), 0n);
  const completed = mine.filter((r) => r.status === "Completed").length;
  const refresh = () => setTimeout(() => { open.refetch(); history.refetch(); member.refetch(); }, 1500);

  const markers = [
    { id: "me", ...here, color: "#2255cc", label: "You" },
    ...sorted.map((r) => ({
      id: r.id,
      lat: fromMilliDegrees(r.pickupLat),
      lng: fromMilliDegrees(r.pickupLng),
      color: r.id === selected ? "#b3261e" : "#b45309",
      label: `Ride #${r.id} · ${eth(r.fare)}`,
      onClick: () => setSelected(r.id),
    })),
  ];

  return (
    <div className="role-driver">
      <h1>Driver dashboard</h1>
      {!isConnected && <p className="notice">Connect your wallet to join and accept rides.</p>}
      {open.error && <p className="notice err">{open.error}</p>}
      {isConnected && member.data === false && (
        <p className="notice">Only staked members can accept rides. Join below; the stake is refunded when you leave.</p>
      )}

      <div className="stats">
        <div className="panel stat">
          <div className="label">Earned</div>
          <div className="value">{eth(earned)}</div>
          <div className="sub">{completed} completed ride{completed === 1 ? "" : "s"}</div>
        </div>
        <div className="panel stat">
          <div className="label">Driver rating</div>
          <div className="value">{rep.data ? (rep.data.driver.averageX100 === null ? "–" : `★ ${(rep.data.driver.averageX100 / 100).toFixed(2)}`) : "…"}</div>
          <div className="sub">{rep.data ? ratingText(rep.data.driver.averageX100, rep.data.driver.count) : " "}</div>
        </div>
        <div className="panel stat">
          <div className="label">Membership</div>
          {member.data ? (
            <>
              <div className="value ok">Staked</div>
              {/* Distinct keys: otherwise React reuses the Join button's instance and its Pending/Confirmed state. */}
              <TxButton
                key="exit"
                label="Leave and recover stake"
                className="ghost"
                request={{ address: addresses.membership, abi: membershipAbi, functionName: "exit" }}
                onDone={refresh}
              />
            </>
          ) : (
            <>
              <div className="value">{stake.data !== undefined ? eth(stake.data) : "…"}</div>
              <TxButton
                key="join"
                label="Join the co-op"
                disabled={!isConnected || stake.data === undefined}
                request={{ address: addresses.membership, abi: membershipAbi, functionName: "join", value: stake.data }}
                onDone={refresh}
              />
              <div className="sub">Stake, fully refundable</div>
            </>
          )}
        </div>
      </div>

      {active.length > 0 && (
        <section>
          <h2>Active ride{active.length > 1 ? "s" : ""}</h2>
          {active.map((r) => (
            <div key={r.id} className="panel">
              <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Ride #{r.id} · {eth(r.fare)}</strong>
                <span>rider <span className="mono">{short(r.rider)}</span> <RepBadge address={r.rider} role="rider" /></span>
              </div>
              <RideTracker status={r.status} who="driver" />
              <ClaimButton id={r.id} onDone={refresh} />
            </div>
          ))}
        </section>
      )}

      <section className="split-even">
        <div>
          <MapView center={here} markers={markers} onMapClick={setHere} />
          <p className="row muted" style={{ marginTop: 6 }}>
            <button
              className="ghost"
              onClick={() => navigator.geolocation?.getCurrentPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }))}
            >
              Use my location
            </button>
            or click the map to set where you are.
          </p>
        </div>
        <div>
          <h2>Open jobs <span className="muted">· nearest first</span></h2>
          {sorted.length === 0 && <p className="muted">No open rides right now. New requests appear here within a few seconds.</p>}
          {sorted.map((r) => (
            <div
              key={r.id}
              className={`card${r.id === selected ? " selected" : ""}`}
              onMouseEnter={() => setSelected(r.id)}
            >
              <span>
                <strong>#{r.id}</strong> · <strong>{eth(r.fare)}</strong>
                <br />
                <small className="muted">{r.distanceKm.toFixed(1)} km away · rider <RepBadge address={r.rider} role="rider" /></small>
              </span>
              <TxButton
                label="Accept"
                disabled={!member.data}
                request={{ address: addresses.rideServices, abi: rideAbi, functionName: "acceptRide", args: [BigInt(r.id)] }}
                onDone={refresh}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Past rides</h2>
        {past.length === 0 && <p className="muted">No past rides yet.</p>}
        {past.map((r) => (
          <div key={r.id} className="card">
            <span>
              <strong>#{r.id}</strong> <span className={`status-pill ${r.status}`}>{r.status}</span> · {eth(r.fare)}
              {r.driverAmount && <> · you received <strong>{eth(r.driverAmount)}</strong></>}
              {r.status === "Cancelled" && <> · <span className="err">cancelled by rider, do not drive to this pickup</span></>}
              {" "}· rider <span className="mono">{short(r.rider)}</span>
            </span>
            {r.status === "Completed" && <RateControl rideId={r.id} who="rider" />}
          </div>
        ))}
      </section>
    </div>
  );
}

function ClaimButton({ id, onDone }: { id: string; onDone: () => void }) {
  const ride = useReadContract({ chainId: CHAIN_ID,
    address: addresses.rideServices,
    abi: rideAbi,
    functionName: "getRide",
    args: [BigInt(id)],
    query: { refetchInterval: 5000 },
  });
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const claimableAt = ride.data ? Number(ride.data[4]) : undefined;
  const wait = claimableAt !== undefined ? claimableAt - now : undefined;
  return (
    <span className="row">
      <TxButton
        label="Claim fare"
        className={wait !== undefined && wait > 0 ? "ghost" : undefined}
        // Not disabled from the wall clock: chain time can differ (Anvil), and the contract enforces the timeout
        // with a readable ClaimTooEarly error.
        request={{ address: addresses.rideServices, abi: rideAbi, functionName: "claimFare", args: [BigInt(id)] }}
        onDone={onDone}
      />
      {wait !== undefined &&
        (wait > 0 ? (
          <small className="muted">If the rider does not confirm, you can claim in {Math.floor(wait / 60)}:{String(wait % 60).padStart(2, "0")}.</small>
        ) : (
          <small className="muted">The rider has not confirmed: you can claim the fare now.</small>
        ))}
    </span>
  );
}
