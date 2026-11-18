"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import { TxButton } from "@/components/TxButton";
import { RateControl } from "@/components/RateControl";
import { RepBadge } from "@/components/RepBadge";
import { addresses, CHAIN_ID, governanceAbi, rideAbi } from "@/lib/contracts";
import { eth, sameAddress, short } from "@/lib/format";
import { haversineKm, suggestFare, toMicroDegrees, type LatLng } from "@/lib/geo";
import { useIndexer, type RideView } from "@/lib/indexer";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const HYDERABAD: LatLng = { lat: 17.385, lng: 78.4867 };

type Hit = { label: string; lat: number; lng: number };

export default function RiderPage() {
  const { address, isConnected } = useConnection();
  const [pickup, setPickup] = useState<LatLng>();
  const [drop, setDrop] = useState<LatLng>();
  const [mode, setMode] = useState<"pickup" | "drop">("pickup");
  const [center, setCenter] = useState<LatLng>(HYDERABAD);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searchMsg, setSearchMsg] = useState("");
  const [route, setRoute] = useState<{ distanceKm: number; source: string }>();
  const [fareEdit, setFareEdit] = useState<string | null>(null);

  const rate = useReadContract({ chainId: CHAIN_ID, address: addresses.governance, abi: governanceAbi, functionName: "perKmRate", query: { refetchInterval: 5000 } });
  const minFare = useReadContract({ chainId: CHAIN_ID, address: addresses.governance, abi: governanceAbi, functionName: "minFare", query: { refetchInterval: 5000 } });
  const rides = useIndexer<RideView[]>(address ? `/history/${address}` : null);

  // Route distance (server route: ORS with straight-line fallback)
  useEffect(() => {
    if (!pickup || !drop) return;
    let cancelled = false;
    fetch(`/api/route?fromLat=${pickup.lat}&fromLng=${pickup.lng}&toLat=${drop.lat}&toLng=${drop.lng}`)
      .then((r) => {
        if (!r.ok) throw new Error(`route ${r.status}`);
        return r.json();
      })
      .then((d) => !cancelled && setRoute(d))
      // Even if our own route handler is down the rider can still request: fall back to straight-line distance.
      .catch(() => !cancelled && setRoute({ distanceKm: haversineKm(pickup, drop), source: "straight-line" }));
    return () => {
      cancelled = true;
    };
  }, [pickup, drop]);

  const suggested = useMemo(
    () => (route && rate.data !== undefined && minFare.data !== undefined ? suggestFare(route.distanceKm, rate.data, minFare.data) : undefined),
    [route, rate.data, minFare.data],
  );
  const fareText = fareEdit ?? (suggested !== undefined ? formatEther(suggested) : "");
  let fareWei: bigint | undefined;
  try {
    fareWei = fareText ? parseEther(fareText) : undefined;
  } catch {
    fareWei = undefined;
  }
  const belowMin = fareWei !== undefined && minFare.data !== undefined && fareWei < minFare.data;

  function place(p: LatLng) {
    if (mode === "pickup") {
      setPickup(p);
      setMode("drop");
    } else setDrop(p);
    setFareEdit(null);
    setRoute(undefined);
  }

  async function search() {
    setSearchMsg("");
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const body = await res.json();
    if (!res.ok) {
      setHits([]);
      setSearchMsg(body.error ?? "Search failed");
      return;
    }
    setHits(body);
    if (body.length === 0) setSearchMsg("No matches");
  }

  const markers = [
    ...(pickup ? [{ id: "p", ...pickup, color: "#1f5f4a", label: "Pickup" }] : []),
    ...(drop ? [{ id: "d", ...drop, color: "#b3261e", label: "Drop-off" }] : []),
  ];
  const mine = (rides.data ?? []).filter((r) => sameAddress(r.rider, address));

  return (
    <>
      <h1>Request a ride</h1>
      {!isConnected && <p className="notice">Connect your wallet to request a ride.</p>}
      {rides.error && <p className="notice err">{rides.error}</p>}

      <section>
        <div className="row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search an address" aria-label="Search address" />
          <button className="ghost" onClick={search} disabled={!query.trim()}>Search</button>
          <button className={mode === "pickup" ? "" : "ghost"} onClick={() => setMode("pickup")}>Set pickup</button>
          <button className={mode === "drop" ? "" : "ghost"} onClick={() => setMode("drop")}>Set drop-off</button>
        </div>
        {searchMsg && <p className="muted">{searchMsg}</p>}
        {hits.map((h) => (
          <div key={`${h.lat},${h.lng}`}>
            <button className="ghost" onClick={() => { setCenter({ lat: h.lat, lng: h.lng }); place({ lat: h.lat, lng: h.lng }); setHits([]); }}>
              {h.label}
            </button>
          </div>
        ))}
        <MapView center={center} markers={markers} onMapClick={place} />
        <p className="muted">Click the map to set the {mode === "pickup" ? "pickup" : "drop-off"} point.</p>
      </section>

      <section>
        <h2>Fare</h2>
        {route ? (
          <p>
            Distance {route.distanceKm.toFixed(1)} km ({route.source}). Rate {rate.data !== undefined ? eth(rate.data) : "…"} per km, minimum fare{" "}
            {minFare.data !== undefined ? eth(minFare.data) : "…"}.
          </p>
        ) : (
          <p className="muted">Choose pickup and drop-off to get a suggested fare.</p>
        )}
        <div className="row">
          <label>
            Fare (ETH) <input value={fareText} onChange={(e) => setFareEdit(e.target.value)} inputMode="decimal" />
          </label>
          {suggested !== undefined && <button className="ghost" onClick={() => setFareEdit(null)}>Use suggested</button>}
        </div>
        {belowMin && <p className="err">Below the governed minimum fare.</p>}
        <p>
          <TxButton
            label="Request ride"
            disabled={!isConnected || !pickup || !drop || fareWei === undefined || belowMin}
            request={{
              address: addresses.rideServices,
              abi: rideAbi,
              functionName: "requestRide",
              args: pickup && drop ? [toMicroDegrees(pickup.lat), toMicroDegrees(pickup.lng), toMicroDegrees(drop.lat), toMicroDegrees(drop.lng)] : [],
              value: fareWei,
            }}
            onDone={() => setTimeout(rides.refetch, 1500)}
          />
        </p>
        <small className="muted">The fare is held in escrow by the contract until you confirm or cancel.</small>
      </section>

      <section>
        <h2>My rides</h2>
        {mine.length === 0 && <p className="muted">No rides yet.</p>}
        {[...mine].reverse().map((r) => (
          <RideRow key={r.id} ride={r} onChange={() => setTimeout(rides.refetch, 1500)} />
        ))}
      </section>
    </>
  );
}

function RideRow({ ride, onChange }: { ride: RideView; onChange: () => void }) {
  return (
    <div className="card">
      <span>
        <strong>#{ride.id}</strong> {ride.status} · {eth(ride.fare)}
        {ride.driver && (
          <>
            {" "}· driver <span className="mono">{short(ride.driver)}</span> <RepBadge address={ride.driver} role="driver" />
          </>
        )}
      </span>
      <span className="row">
        {(ride.status === "Requested" || ride.status === "Accepted") && (
          <TxButton
            label="Cancel (full refund)"
            className="ghost"
            request={{ address: addresses.rideServices, abi: rideAbi, functionName: "cancelRide", args: [BigInt(ride.id)] }}
            onDone={onChange}
          />
        )}
        {ride.status === "Accepted" && (
          <TxButton
            label="Confirm completed"
            request={{ address: addresses.rideServices, abi: rideAbi, functionName: "completeRide", args: [BigInt(ride.id)] }}
            onDone={onChange}
          />
        )}
        {ride.status === "Completed" && <RateControl rideId={ride.id} who="driver" />}
      </span>
    </div>
  );
}
