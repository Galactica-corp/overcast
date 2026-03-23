# `@galactica-net/overcast-private-stablecoin`

Aztec **Noir** contract package for the Overcast **private stablecoin prototype**: private balances and transfers, with room to grow toward compliance-aware flows described in `docs/`.

## Upstream fork

- **`src/main.nr`** is derived from Defi-Wonderland's [`token_contract`](https://github.com/defi-wonderland/aztec-standards/tree/dev/src/token_contract). The Nargo crate is named `private_stablecoin`.
- **Tooling layout** (Jest E2E, `config/*.json`, scripts, workspace scripts) is modeled on [AztecProtocol/aztec-starter](https://github.com/AztecProtocol/aztec-starter) (`next`), which is **MIT**-licensed—attribute that repo separately from the Apache-2.0 contract source.

## Version alignment (keep in lockstep)

1. **Aztec CLI** / toolchain — e.g. `VERSION=4.0.0-devnet.2-patch.1` from the [Aztec install script](https://github.com/AztecProtocol/aztec-starter#-getting-started) in aztec-starter’s README.
2. **`aztec-nr` git tag** in [`Nargo.toml`](./Nargo.toml).
3. **`@aztec/*` npm** versions in [`package.json`](./package.json).

Bump all three together when upgrading.

## Node dependencies

Install from the **monorepo root** with Yarn (npm registry; no ad-hoc CDN dependency fetches):

```bash
yarn install
```

## Prerequisites

- **Node.js 22.x** (aztec-starter documents **22.15.0**).
- **Aztec CLI** matching the version triangle above.
- Local development: run **`aztec start --local-network`**, then from the repo root:

```bash
yarn workspace @galactica-net/overcast-private-stablecoin compile
yarn workspace @galactica-net/overcast-private-stablecoin codegen
yarn workspace @galactica-net/overcast-private-stablecoin test
```

If you **restart** the local network, delete PXE state: `yarn workspace @galactica-net/overcast-private-stablecoin clear-store` or remove `packages/private-stablecoin/store`.

## Workspace commands

| Command (from repo root)                                            | Purpose                   |
| ------------------------------------------------------------------- | ------------------------- |
| `yarn workspace @galactica-net/overcast-private-stablecoin compile` | `aztec compile`           |
| `yarn workspace @galactica-net/overcast-private-stablecoin codegen` | Generate `src/artifacts/` |
| `yarn workspace @galactica-net/overcast-private-stablecoin test`    | Jest E2E + `aztec test`   |
| `yarn workspace @galactica-net/overcast-private-stablecoin deploy`  | Example deploy script     |

Shorter aliases: `yarn compile:private-stablecoin`, `yarn test:private-stablecoin` (root `package.json`).

## Agent / contributor docs

See [`AGENTS.md`](./AGENTS.md) for simulate-before-send, testing split, and store cleanup.

## Noir formatting

```bash
cd packages/private-stablecoin && nargo fmt --check
```
