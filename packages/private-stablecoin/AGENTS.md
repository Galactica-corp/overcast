# `@galactica-net/overcast-private-stablecoin` — agent notes

Monorepo-wide rules (TDD, secrets, Noir hashing, MCP) live in [`AGENTS.md`](../../AGENTS.md) at the repo root. This file only covers **this workspace** (Aztec CLI, TypeScript, Jest), adapted from [AztecProtocol/aztec-starter `AGENTS.md`](https://github.com/AztecProtocol/aztec-starter/blob/next/AGENTS.md) (MIT).

## Setup

- Use **Node.js 24**.
- This repo uses **Yarn 4** from the **monorepo root**: `yarn install`. Do not substitute CDN-hosted packages for declared dependencies; use Yarn so `@aztec/*` versions stay aligned with the lockfile.
- Install the **Aztec CLI** at the same version as **`Nargo.toml` git tag** and **`package.json` `@aztec/*` pins** (see [README.md](./README.md) version triangle).
- Start the local network before E2E: `aztec start --local-network`. Not required for `aztec compile` / `aztec test` (TXE) alone.
- After **restarting** the local network, clear PXE data: `yarn clear-store` in this package or `rm -rf packages/private-stablecoin/store`.

## Development

- **ESM:** `"type": "module"` in [`package.json`](./package.json).
- **Indentation:** use **four spaces** in TypeScript under this package.
- **Compile / codegen** (from repo root — `compile` runs `aztec compile --workspace` at the monorepo root; `codegen` reads `../../target` and writes `src/artifacts/`):

  ```bash
  yarn workspace @galactica-net/overcast-private-stablecoin compile
  yarn workspace @galactica-net/overcast-private-stablecoin codegen
  ```

- **Do not commit** generated trees: `target/` (repo root), `src/artifacts/`, `store/`, `codegenCache.json`.
- **Never hand-edit** generated `src/artifacts/*.ts`; they come from `yarn codegen`. Regenerate after changing Noir contracts under `crates/`.
- **L1 + bridge deploy (local):** compile Solidity in `packages/stablecoin-wrapper` (`yarn exec hardhat compile`), then with `aztec start --local-network` running: `yarn deploy:bridge` (see [`scripts/deploy_token_bridge.ts`](./scripts/deploy_token_bridge.ts)).
- **Devnet:** set `AZTEC_ENV=devnet` (e.g. `yarn workspace @galactica-net/overcast-private-stablecoin deploy::devnet`) to use [`config/devnet.json`](./config/devnet.json).

## Testing

Two separate systems:

- **`yarn test:nr`** — Noir / TXE via `aztec test` (no live network).
- **`yarn test:js`** — Jest; E2E in `src/test/e2e/private_token.test.ts` runs only when **`RUN_AZTEC_E2E=1`** (`yarn test:js:e2e`). The bridge deploy wiring test in `src/test/e2e/token_bridge_deploy.test.ts` runs only when **`RUN_BRIDGE_DEPLOY_E2E=1`** (`yarn test:js:bridge-e2e`; requires L1 + Aztec local network and stablecoin-wrapper artifacts).
- **`yarn test`** runs both `test:js` and `test:nr`.

With `RUN_AZTEC_E2E=1`, start **`aztec start --local-network`** first and clear **`store/`** after network restarts.

## Simulate before send

For state-changing calls, **simulate first**, then **send** (surfaces revert reasons early). Example for this contract:

```typescript
await contract.methods.mint(amount, recipient).simulate({ from: adminAddress });
await contract.methods.mint(amount, recipient).send({
  from: adminAddress,
  fee: { paymentMethod },
  wait: { timeout },
});
```

Deployments: hold the deploy handle, simulate once, then send:

```typescript
const deployRequest = PrivateTokenContract.deploy(wallet, initialAdminBalance, adminAddress);
await deployRequest.simulate({ from: adminAddress });
const token = await deployRequest.send({
  from: adminAddress,
  fee: { paymentMethod: sponsoredPaymentMethod },
  wait: { timeout: deployTimeout },
});
```
