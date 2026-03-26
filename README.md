# Overcast

Project site: **[overcast.fi](https://overcast.fi/)**

## Introduction

**Overcast** is a privacy-first stablecoin and settlement protocol on [Aztec](https://aztec.network/). It targets **private, compliant** value transfer and commerce: balances and payment metadata stay off public ledgers, while **ZK-based identity and compliance** (KYC/KYB, selective disclosure, auditability when policy requires it) are enforced inside the private execution layer—not bolted on as opaque off-chain policy alone.

**Purpose:** reduce the “transparency tax” of public chains for merchants, consumers, and (eventually) agents, without giving up the assurances institutions need. The design emphasizes programmable compliance, private settlement, and bridges between **public L1/L2 liquidity** and **Aztec** as the private hub—including patterns like L1 escrow / L2 minting (portal), cross-chain messaging, and high-throughput / agent-friendly payment flows (e.g. x402-oriented commerce).

**Foundations:** this repository is expected to combine **EVM smart contracts** (portals, messaging, public-side escrow and coordination), **Aztec private execution and Noir contracts** (including extensions around the **AIP-20** token model and RWA-oriented controls inspired by standards such as **CMTA**), and **Galactica’s ZK KYC / Identity stack** on Aztec (guardian-led attestations, proofs, and disclosure modules as described in the project docs).

Protocol detail: [`docs/overcast_protocol_architecture.md`](docs/overcast_protocol_architecture.md), [`docs/private_stablecoin_working_doc.md`](docs/private_stablecoin_working_doc.md).

### Monorepo packages

| Package                                      | Path                                                         | Role                                                                 |
| -------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `@galactica-net/overcast-stablecoin-wrapper` | [`packages/stablecoin-wrapper`](packages/stablecoin-wrapper) | Solidity L1 wrapping / portal-style contracts                        |
| `@galactica-net/overcast-private-stablecoin` | [`packages/private-stablecoin`](packages/private-stablecoin) | **All Aztec Noir** — private token, token bridge, shared Noir crates |

[`packages/private-stablecoin`](packages/private-stablecoin) holds every Noir crate (token, bridge, libraries such as portal content hash and helpers under `crates/`). The former top-level `packages/token-bridge` workspace is gone; use that package’s [`README.md`](packages/private-stablecoin/README.md) and [`AGENTS.md`](packages/private-stablecoin/AGENTS.md) for compile, test, and layout.

---

## Installation

This repository uses **[Yarn 4](https://yarnpkg.com/)** (Berry). The required version is declared in root `package.json` as `packageManager` for [Corepack](https://nodejs.org/api/corepack.html).

1. **Node.js** — use a current LTS release (18+ or 20+ recommended).
2. **Enable Corepack** (ships with Node 16.10+):

   ```bash
   corepack enable
   ```

3. **Clone** the repo and **install** from the root (Corepack will pick up Yarn 4 from `packageManager`):

   ```bash
   git clone https://github.com/Galactica-corp/overcast.git
   cd overcast
   yarn install
   ```

If Corepack is disabled or Yarn does not match the repo, run `yarn set version 4` once in the project root, then `yarn install` again.

Per-package toolchains (Foundry, Nargo, Aztec sandbox, etc.) will be documented under each `packages/*` workspace as they are added.

### Development setup

- **Lint & format (Node / shared files):** from the repo root, run `yarn lint` (ESLint + Prettier check) and `yarn format` to apply Prettier. Solidity and Noir use their own tools as well—see [`docs/linting.md`](docs/linting.md).
- **AI / agent tooling:** install the **Aztec** and **Noir** MCP servers for editors that support MCP (code search, docs, examples, version-aware context). Follow Aztec’s guide: **[AI tooling — MCP servers](https://docs.aztec.network/developers/ai_tooling#mcp-servers)**. Repository-level guidance for humans and agents lives in [`AGENTS.md`](AGENTS.md).

---

## Testing

_To be added once unit, integration, and network tests are wired up._

---

## Deployment

_To be added for target environments (local devnet, testnet, production) and contract/circuit deployment steps._
