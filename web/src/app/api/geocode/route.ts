// Server-only proxy for OpenRouteService address search. The API key never reaches the browser.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length > 200) return Response.json({ error: "missing or invalid q" }, { status: 400 });
  const key = process.env.ORS_API_KEY;
  if (!key) return Response.json({ error: "address search unavailable; pick on the map instead" }, { status: 503 });
  try {
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/search?size=5&text=${encodeURIComponent(q)}`,
      { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = (await res.json()) as {
      features: { geometry: { coordinates: [number, number] }; properties: { label: string } }[];
    };
    return Response.json(
      data.features.map((f) => ({ label: f.properties.label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })),
    );
  } catch {
    return Response.json({ error: "address search unavailable; pick on the map instead" }, { status: 502 });
  }
}
