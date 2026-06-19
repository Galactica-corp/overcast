# `@galactica-net/overcast-private-stablecoin`

Aztec **Noir** contract package for the Overcast **private stablecoin prototype**: private balances and transfers, with room to grow toward compliance-aware flows described in `docs/`.

## Upstream fork

 - **`src/main.nr`** is derived from Defi-Wonderland's [`token_contract`](https://github.com/defi-wonderland/aztec-standards/tree/dev/src/token_contract). The Nargo crate is named `private_stablecoin`.
- **Tooling layout** (Jest E2E, `config/*.json`, scripts, workspace scripts) is modeled on [AztecProtocol/aztec-starter](https://github.com/AztecProtocol/aztec-starter) (`next`), which is **MIT**-licensed—attribute that repo separately from the Apache-2.0 contract source.

## Version alignment (keep in lockstep)

This repo follows a “**version triangle**”: keep these three pinned to the **same Aztec release** (otherwise you’ll hit API/ABI mismatches at compile/transpile/test time).

1. **Aztec CLI** / toolchain — e.g. `VERSION=4.2.0` from the [Aztec install script](https://github.com/AztecProtocol/aztec-starter#-getting-started) in aztec-starter’s README.
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


| Command (from repo root)                                                             | Purpose                           |
| ------------------------------------------------------------------------------------ | --------------------------------- |
| `yarn workspace @galactica-net/overcast-private-stablecoin compile`                  | `aztec compile`                   |
| `yarn workspace @galactica-net/overcast-private-stablecoin codegen`                  | Generate `src/artifacts/`         |
| `yarn workspace @galactica-net/overcast-private-stablecoin test`                     | Jest E2E + `aztec test`           |
| `yarn workspace @galactica-net/overcast-private-stablecoin deploy`                   | Example deploy script             |
| `yarn workspace @galactica-net/overcast-private-stablecoin fee-juice:setup::testnet` | Bridge + claim FeeJuice (testnet) |
| `yarn workspace @galactica-net/overcast-private-stablecoin fee-juice:setup::mainnet` | Bridge + claim FeeJuice (mainnet) |


Shorter aliases: `yarn compile:private-stablecoin`, `yarn test:private-stablecoin` (root `package.json`).

## Agent / contributor docs

See `[AGENTS.md](./AGENTS.md)` for simulate-before-send, testing split, and store cleanup.

## Fee Juice setup (PrivateFPC)

This package includes a script to set up FeeJuice for paying Aztec fees using a deterministic PrivateFPC from `@wonderland/aztec-fee-payment@4.2.0`.

### Fee payment selection in scripts

Deployment scripts in this package automatically select the fee payment contract based on `AZTEC_ENV`:

- `AZTEC_ENV=mainnet`: use the deterministic **PrivateFPC** derived from `PRIVATE_FPC_SALT` (no deployment transaction). You must have already deposited/claimed/minted FeeJuice for this FPC (see the setup script below), otherwise deployments will fail when trying to pay fees.
- `AZTEC_ENV=local-network` / `testnet`: use the deterministic **SponsoredFPC** derived from `SPONSORED_FPC_SALT` (no deployment transaction).

### Environment variables

Configure these in `packages/private-stablecoin/.env` (see `.env.example` for placeholders):

- `PRIVATE_FPC_SALT` (required): deterministic salt used to derive the PrivateFPC address.
- `L1_PRIVATE_KEY` (required): L1 depositor key used to mint (testnet only) and deposit to the FeeJuice portal.
- `L1_RPC_URL` (optional): override the L1 RPC URL (otherwise uses `config/<AZTEC_ENV>.json`).
- `FEE_JUICE_AMOUNT_WEI` (optional): wei amount to bridge. Defaults:
  - testnet: `1000 ether`
  - mainnet: `10 ether`

### Run

From the repo root:

```bash
yarn workspace @galactica-net/overcast-private-stablecoin fee-juice:setup::testnet
yarn workspace @galactica-net/overcast-private-stablecoin fee-juice:setup::mainnet
```

The script prints a JSON blob with `secret`, `secretHash`, and `leafIndex` (needed for the L2 claim/mint flow), plus the computed PrivateFPC address.

## Noir formatting

```bash
cd packages/private-stablecoin && nargo fmt --check
```

