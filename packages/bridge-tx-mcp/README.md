# `@galactica-net/overcast-bridge-tx-mcp`

Small [Model Context Protocol](https://modelcontextprotocol.io/) server that builds **Markdown** for the Overcast **StablecoinWrapper** bridge on Ethereum: `bridgeToAztec` (deposit) and `withdrawFromL2ToL1` (withdrawal). It mirrors the encoding and UI mapping described in [`packages/private-stablecoin/src/utils/bridge/stablecoin_cross_chain.ts`](../private-stablecoin/src/utils/bridge/stablecoin_cross_chain.ts) and the contracts in [`packages/stablecoin-wrapper`](../stablecoin-wrapper/).

## Behavior

- **No RPC**: gas limits are **fixed, generous** offline defaults (not `estimateGas`). You can replace them later with live estimation when an RPC URL is wired in.
- **Deposit** (`deposit` tool): builds `MarkdownComponentRawTransactionWithPermit` for the bridge call, optional approval-style markdown (same shape as the reference flow’s “permit” mapping), and **claim data** (`claimSecret`, `claimAmount`). `messageHash` / `messageLeafIndex` are **not** available without an L1 receipt — they are omitted until the deposit transaction is mined and `DepositToAztec` can be read.
- **Withdrawal** (`withdrawal` tool): parses a JSON string shaped like `L2ToL1MembershipWitness` (`epochNumber`, `leafIndex`, `siblingPath`, optional `root`) and encodes `withdrawFromL2ToL1`. The L1 **recipient** is the **user EVM address** input; **caller on L1** must match what was used in `exit_to_l1_private` on L2 (typically the wrapper address).

## Setup

From the **repository root**:

```bash
yarn install
yarn workspace @galactica-net/overcast-bridge-tx-mcp build
```

## Run (stdio)

```bash
yarn workspace @galactica-net/overcast-bridge-tx-mcp start
```

Configure your MCP client to launch that command (or `node packages/bridge-tx-mcp/dist/index.js` after `build`).

## Test

```bash
yarn workspace @galactica-net/overcast-bridge-tx-mcp test
```

From the monorepo root:

```bash
yarn test:bridge-tx-mcp
```

## Inputs

Shared:

| Field              | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| `tokenAddress`     | Underlying ERC-20                                                   |
| `wrapperAddress`   | `StablecoinWrapper`                                                 |
| `userEvmAddress`   | L1 address (also used as withdraw **recipient** on-chain)           |
| `userAztecAddress` | Aztec address (validated as non-empty; not used in calldata today)  |
| `amount`           | Decimal string, e.g. `2.0`                                          |
| `chainId`          | Decimal string, e.g. `31337`                                        |
| `tokenDecimals`    | Optional, default `18` (use `6` for USDC-style tokens)              |
| `permitSymbol`     | Optional, default `UNKNOWN` (token ticker for the permit UI fields) |

Withdrawal only:

| Field        | Description                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------- |
| `witness`    | JSON string: `L2ToL1MembershipWitness`-shaped (`epochNumber`, `leafIndex`, `siblingPath`, …) |
| `callerOnL1` | L1 `caller_on_l1` from `exit_to_l1_private`                                                  |
