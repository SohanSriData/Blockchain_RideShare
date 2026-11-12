import { haversineKm } from "@/lib/geo";

// Route distance via OpenRouteService (server-side only). Falls back to straight-line distance on any failure.
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const [fromLat, fromLng, toLat, toLng] = ["fromLat", "fromLng", "toLat", "toLng"].map((k) => Number(p.get(k)));
  const valid = [fromLat, fromLng, toLat, toLng].every(Number.isFinite) &&
    Math.abs(fromLat) <= 90 && Math.abs(toLat) <= 90 && Math.abs(fromLng) <= 180 && Math.abs(toLng) <= 180;
  if (!valid) return Response.json({ error: "invalid coordinates" }, { status: 400 });

  const fallback = () =>
    Response.json({
      distanceKm: haversineKm({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }),
      source: "straight-line",
    });

  const key = process.env.ORS_API_KEY;
  if (!key) return fallback();
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = (await res.json()) as { routes: { summary: { distance: number } }[] };
    const meters = data.routes[0]?.summary.distance;
    if (typeof meters !== "number") throw new Error("no route");
    return Response.json({ distanceKm: meters / 1000, source: "route" });
  } catch {
    return fallback();
  }
}
