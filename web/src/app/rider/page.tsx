"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useConnection, useReadContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import { TxButton } from "@/components/TxButton";
import { RateControl } from "@/components/RateControl";
import { RepBadge } from "@/components/RepBadge";
import { RideTracker } from "@/components/RideTracker";
import { addresses, CHAIN_ID, governanceAbi, rideAbi } from "@/lib/contracts";
import { eth, sameAddress, short } from "@/lib/format";
import { haversineKm, suggestFare, toMicroDegrees, type LatLng } from "@/lib/geo";
import { useIndexer, type RideView } from "@/lib/indexer";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const HYDERABAD: LatLng = { lat: 17.385, lng: 78.4867 };
const PICKUP_COLOR = "#0f766e";
const DROP_COLOR = "#b3261e";

type Hit = { label: string; lat: number; lng: number };
type Place = LatLng & { label?: string };

const placeText = (p?: Place) => (p ? (p.label ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`) : undefined);

export default function RiderPage() {
  const { address, isConnected } = useConnection();
  const [pickup, setPickup] = useState<Place>();
  const [drop, setDrop] = useState<Place>();
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

  function place(p: Place) {
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
    ...(pickup ? [{ id: "p", ...pickup, color: PICKUP_COLOR, label: "Pickup" }] : []),
    ...(drop ? [{ id: "d", ...drop, color: DROP_COLOR, label: "Drop-off" }] : []),
  ];
  const mine = [...(rides.data ?? []).filter((r) => sameAddress(r.rider, address))].reverse();
  const active = mine.filter((r) => r.status === "Requested" || r.status === "Accepted");
  // With nothing in progress, the newest finished ride stays on top (tracker plus rating) until the next request.
  const current = active.length > 0 ? active : mine.slice(0, 1);
  const past = mine.filter((r) => !current.includes(r));
  const refetch = () => setTimeout(rides.refetch, 1500);

  return (
    <div className="role-rider">
      <h1>Where to?</h1>
      {!isConnected && <p className="notice">Connect your wallet to request a ride.</p>}
      {rides.error && <p className="notice err">{rides.error}</p>}

      {current.length > 0 && (
        <section>
          <h2>{active.length === 0 ? "Latest ride" : `Current ride${current.length > 1 ? "s" : ""}`}</h2>
          {current.map((r) => (
            <CurrentRide key={r.id} ride={r} onChange={refetch} />
          ))}
        </section>
      )}

      <section className="split map-tall">
        <div>
          <div className="row" style={{ display: "flex", marginBottom: 8 }}>
            <input
              style={{ flex: 1 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && search()}
              placeholder={`Search the ${mode === "pickup" ? "pickup" : "drop-off"} address`}
              aria-label="Search address"
            />
            <button className="ghost" onClick={search} disabled={!query.trim()}>Search</button>
          </div>
          {searchMsg && <p className="muted">{searchMsg}</p>}
          {hits.length > 0 && (
            <div className="hits">
              {hits.map((h) => (
                <button key={`${h.lat},${h.lng}`} className="ghost" onClick={() => { setCenter({ lat: h.lat, lng: h.lng }); place(h); setHits([]); setQuery(""); }}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
          <MapView center={center} markers={markers} onMapClick={place} />
          <p className="muted" style={{ margin: "6px 0 0" }}>Click the map to set the {mode === "pickup" ? "pickup" : "drop-off"} point.</p>
        </div>

        <aside className="panel stack">
          <h2>Book a ride</h2>
          <button className={`point${mode === "pickup" ? " active" : ""}`} onClick={() => setMode("pickup")}>
            <span className="dot" style={{ background: PICKUP_COLOR }} />
            <span>Pickup<small>{placeText(pickup) ?? "Click the map or search"}</small></span>
          </button>
          <button className={`point${mode === "drop" ? " active" : ""}`} onClick={() => setMode("drop")}>
            <span className="dot" style={{ background: DROP_COLOR }} />
            <span>Drop-off<small>{placeText(drop) ?? "Click the map or search"}</small></span>
          </button>

          {route ? (
            <>
              <div className="kv"><span>Distance</span><span>{route.distanceKm.toFixed(1)} km {route.source !== "route" && <small className="muted">({route.source})</small>}</span></div>
              <div className="kv"><span>Rate</span><span>{rate.data !== undefined ? eth(rate.data) : "…"} / km</span></div>
              <div className="kv"><span>Minimum fare</span><span>{minFare.data !== undefined ? eth(minFare.data) : "…"}</span></div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Choose pickup and drop-off to get a suggested fare.</p>
          )}

          <label>
            Your fare offer (ETH)
            <input value={fareText} onChange={(e) => setFareEdit(e.target.value)} inputMode="decimal" />
          </label>
          {fareEdit !== null && suggested !== undefined && (
            <button className="ghost" onClick={() => setFareEdit(null)}>Use suggested ({formatEther(suggested)})</button>
          )}
          {belowMin && <p className="err" style={{ margin: 0 }}>Below the governed minimum fare.</p>}

          <TxButton
            wide
            label="Request ride"
            disabled={!isConnected || !pickup || !drop || fareWei === undefined || belowMin}
            request={{
              address: addresses.rideServices,
              abi: rideAbi,
              functionName: "requestRide",
              args: pickup && drop ? [toMicroDegrees(pickup.lat), toMicroDegrees(pickup.lng), toMicroDegrees(drop.lat), toMicroDegrees(drop.lng)] : [],
              value: fareWei,
            }}
            onDone={refetch}
          />
          <small className="muted">The fare is held in escrow by the contract until you confirm or cancel.</small>
        </aside>
      </section>

      <section>
        <h2>Past rides</h2>
        {past.length === 0 && <p className="muted">No past rides yet.</p>}
        {past.map((r) => (
          <div key={r.id} className="card">
            <span>
              <strong>#{r.id}</strong> <span className={`status-pill ${r.status}`}>{r.status}</span> · {eth(r.fare)}
              {r.driver && (
                <> · driver <span className="mono">{short(r.driver)}</span> <RepBadge address={r.driver} role="driver" /></>
              )}
            </span>
            {r.status === "Completed" && <RateControl rideId={r.id} who="driver" />}
          </div>
        ))}
      </section>
    </div>
  );
}

function CurrentRide({ ride, onChange }: { ride: RideView; onChange: () => void }) {
  return (
    <div className="panel">
      <div className="row" style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Ride #{ride.id} · {eth(ride.fare)}</strong>
        {ride.driver && (
          <span>driver <span className="mono">{short(ride.driver)}</span> <RepBadge address={ride.driver} role="driver" /></span>
        )}
      </div>
      <RideTracker status={ride.status} who="rider" />
      <span className="row">
        {ride.status === "Accepted" && (
          <TxButton
            label="Confirm completed"
            request={{ address: addresses.rideServices, abi: rideAbi, functionName: "completeRide", args: [BigInt(ride.id)] }}
            onDone={onChange}
          />
        )}
        {(ride.status === "Requested" || ride.status === "Accepted") && (
          <TxButton
            label="Cancel (full refund)"
            className="ghost"
            request={{ address: addresses.rideServices, abi: rideAbi, functionName: "cancelRide", args: [BigInt(ride.id)] }}
            onDone={onChange}
          />
        )}
        {ride.status === "Completed" && <RateControl rideId={ride.id} who="driver" />}
      </span>
    </div>
  );
}
