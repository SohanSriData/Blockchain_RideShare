import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

// The single .env.local lives at the repo root (git-ignored). ORS_API_KEY is read only by server routes.
// forceReload: Next already loaded (and cached) env from web/, which would make a plain call a no-op.
loadEnvConfig(resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", console, true);

// Cache Components is deliberately off: it keeps previously visited routes mounted but hidden (React Activity),
// which runs react-leaflet's cleanup (map.remove()) and then re-adds layers to the dead map. Navigating
// Driver -> Rider crashed with "Cannot read properties of undefined (reading 'appendChild')".
const nextConfig: NextConfig = {};

export default nextConfig;
