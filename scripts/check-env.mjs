import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").trim();
let failed = false;
const ok = (m) => console.log(`ok    ${m}`);
const bad = (m) => { failed = true; console.log(`FAIL  ${m}`); };

const [maj, min] = process.versions.node.split(".").map(Number);
(maj > 22 || (maj === 22 && min >= 13)) ? ok(`node ${process.versions.node}`) : bad(`node >=22.13 needed, found ${process.versions.node}`);

const want = read(".foundry-version");
for (const tool of ["forge", "anvil", "cast"]) {
  try {
    const out = execFileSync(tool, ["--version"], { encoding: "utf8" });
    out.includes(want) ? ok(`${tool} ${want}`) : bad(`${tool} should be ${want}: ${out.split("\n")[0]}`);
  } catch { bad(`${tool} not found (install: foundryup --install ${want})`); }
}

existsSync(new URL("../contracts/lib/forge-std/src/Test.sol", import.meta.url))
  ? ok("forge-std present")
  : bad("forge-std missing (run: git submodule update --init --recursive)");

existsSync(new URL("../.env.local", import.meta.url))
  ? ok(".env.local present")
  : console.log("warn  .env.local missing (copy .env.example; ORS_API_KEY needed only for map features)");

process.exit(failed ? 1 : 0);
