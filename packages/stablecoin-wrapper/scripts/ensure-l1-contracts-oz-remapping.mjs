/**
 * @aztec/l1-contracts maps @oz/ to lib/openzeppelin-contracts/contracts/ (Foundry layout).
 * The npm package does not vendor that tree. Symlink it to hoisted @openzeppelin/contracts
 * so Hardhat + forge remappings resolve @oz/ imports without a custom remappings.txt.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const l1Root = path.dirname(require.resolve("@aztec/l1-contracts/package.json"));
const remappingsPath = path.join(l1Root, "remappings.txt");
const linkDir = path.join(l1Root, "lib", "openzeppelin-contracts");
const linkPath = path.join(linkDir, "contracts");

if (fs.existsSync(remappingsPath)) {
  fs.unlinkSync(remappingsPath);
}

fs.mkdirSync(linkDir, { recursive: true });
if (fs.existsSync(linkPath)) {
  fs.unlinkSync(linkPath);
}
fs.symlinkSync("../../../../@openzeppelin/contracts", linkPath, "dir");
