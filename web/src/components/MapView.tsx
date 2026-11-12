"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLng } from "@/lib/geo";

export interface MapMarker extends LatLng {
  id: string;
  color: string;
  label: string;
  onClick?: () => void;
}

function Clicks({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [map, center.lat, center.lng]);
  return null;
}

/** OpenStreetMap tiles via Leaflet. Display only; no marker image assets needed. */
export default function MapView({
  center,
  markers,
  onMapClick,
}: {
  center: LatLng;
  markers: MapMarker[];
  onMapClick?: (p: LatLng) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={12} className="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} />
      <Clicks onClick={onMapClick} />
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={9}
          pathOptions={{ color: m.color, fillColor: m.color, fillOpacity: 0.7 }}
          eventHandlers={{ click: () => m.onClick?.() }}
        >
          <Tooltip>{m.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
