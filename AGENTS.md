# Overcast — agent notes

## Project

**Overcast** is a privacy-oriented stablecoin and settlement stack: public **Ethereum** contracts for wrapping and messaging, **Aztec / Noir** for private token logic and transfers, and **Galactica ZK KYC** for identity and compliance inside the private layer. High-level behavior and architecture live under `docs/` (see `overcast_protocol_architecture.md` and `private_stablecoin_working_doc.md`).

The repo is a **Yarn 4** monorepo (`packageManager` in root `package.json`). Run installs from the repository root.

## Repository layout

| Path | Role |
|------|------|
| `package.json` | Root workspace manifest: `@galactica-net/overcast`, workspaces `packages/*`. |
| `packages/stablecoin-wrapper/` | Solidity L1 stablecoin wrap / portal-style contracts (placeholder). |
| `packages/token-bridge/` | Bridge infrastructure from Ethereum toward private Aztec representation; conceptually aligned with Aztec [`token_bridge_contract`](https://github.com/AztecProtocol/aztec-packages/tree/next/noir-projects/noir-contracts/contracts/app/token_bridge_contract). |
| `packages/private-stablecoin/` | Noir Aztec token for private + compliant transfers; baseline aligned with Aztec [`private_token_contract`](https://github.com/AztecProtocol/aztec-packages/tree/next/noir-projects/noir-contracts/contracts/app/private_token_contract). |
| `docs/` | Protocol and product documentation (source of truth for requirements and architecture). |

When adding new components, prefer new folders under `packages/` and register them via the root `workspaces` glob or an explicit entry in root `package.json`.
