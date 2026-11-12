import { createServer, type Server } from "node:http";
import type { ReadModel } from "./model.js";

/** Small read-only JSON API over the read model. GET only. */
export function createApi(model: ReadModel, now: () => number = () => Math.floor(Date.now() / 1000)): Server {
  return createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "read-only" }));
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const send = (body: unknown, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    const isAddr = (s: string | undefined): s is string => !!s && /^0x[0-9a-fA-F]{40}$/.test(s);

    if (parts[0] === "health") return send({ ok: true, lastBlock: model.lastBlock().toString() });
    if (parts[0] === "rides" && parts[1] === "open") return send(model.openRides());
    if (parts[0] === "rides" && parts[1] && /^\d+$/.test(parts[1])) {
      const r = model.ride(Number(parts[1]));
      return r ? send(r) : send({ error: "not found" }, 404);
    }
    if (parts[0] === "history" && isAddr(parts[1])) return send(model.history(parts[1]));
    if (parts[0] === "reputation" && isAddr(parts[1])) return send(model.reputation(parts[1]));
    if (parts[0] === "proposals") return send(model.proposals(now()));
    if (parts[0] === "treasury") return send(model.treasury());
    if (parts[0] === "members") return send(model.members());
    return send({ error: "not found" }, 404);
  });
}
