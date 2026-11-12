// Copies the addresses written by `forge script script/Deploy.s.sol` into the web app's config.
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const chainId = process.env.CHAIN_ID ?? "31337";
const src = resolve("contracts", "deployments", `${chainId}.json`);
const dst = resolve("web", "src", "lib", "deployment.json");
if (!existsSync(src)) {
  console.error(`no deployment at ${src}; run npm run deploy:local first`);
  process.exit(1);
}
copyFileSync(src, dst);
console.log(`copied ${src} -> ${dst}`);
