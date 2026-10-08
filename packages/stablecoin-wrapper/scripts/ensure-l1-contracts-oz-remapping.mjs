/**
 * Aztec 6 publishes L1 Solidity under `@aztec-foundation/l1-artifacts`
 * (`l1-contracts/src` plus the vendored OpenZeppelin tree). Foundry remappings
 * in `remappings.txt` point at that package. Fail install if the tree is missing.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The package export map does not expose package.json. The main entry is dest/index.js.
const artifactsRoot = path.resolve(path.dirname(require.resolve("@aztec-foundation/l1-artifacts")), "..");
const l1Src = path.join(artifactsRoot, "l1-contracts", "src");
const ozContracts = path.join(
  artifactsRoot,
  "l1-contracts",
  "lib",
  "openzeppelin-contracts",
  "contracts",
);

if (!fs.existsSync(l1Src) || !fs.existsSync(ozContracts)) {
  throw new Error(
    `Expected Aztec L1 sources under ${artifactsRoot}/l1-contracts (src and vendored OpenZeppelin).`,
  );
}
