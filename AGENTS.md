# Overcast — agent notes

## Project

**Overcast** is a privacy-oriented stablecoin and settlement stack: public **Ethereum** contracts for wrapping and messaging, **Aztec / Noir** for private token logic and transfers, and **Galactica ZK KYC** for identity and compliance inside the private layer. High-level behavior and architecture live under `docs/` (see `overcast_protocol_architecture.md` and `private_stablecoin_working_doc.md`).

The repo is a **Yarn 4** monorepo (`packageManager` in root `package.json`). Run installs from the repository root.

## Repository layout

| Path                           | Role                                                                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                 | Root workspace manifest: `@galactica-net/overcast`, workspaces `packages/*`.                                                                                                                                                                                    |
| `packages/stablecoin-wrapper/` | Solidity L1 stablecoin wrap / portal-style contracts (placeholder).                                                                                                                                                                                             |
| `packages/token-bridge/`       | Bridge infrastructure from Ethereum toward private Aztec representation; conceptually aligned with Aztec [`token_bridge_contract`](https://github.com/AztecProtocol/aztec-packages/tree/next/noir-projects/noir-contracts/contracts/app/token_bridge_contract). |
| `packages/private-stablecoin/` | Noir Aztec token for private + compliant transfers; baseline aligned with Aztec [`private_token_contract`](https://github.com/AztecProtocol/aztec-packages/tree/next/noir-projects/noir-contracts/contracts/app/private_token_contract).                        |
| `docs/`                        | Protocol and product documentation (source of truth for requirements and architecture).                                                                                                                                                                         |

When adding new components, prefer new folders under `packages/` and register them via the root `workspaces` glob or an explicit entry in root `package.json`.

## MCP servers (Aztec & Noir)

For up-to-date Aztec/Noir context (code search, docs, examples, version alignment), use the official MCP servers in your editor. Install and configure them as described here:

**Aztec documentation — AI tooling / MCP servers**

Typical Cursor-style configuration (see the doc above for your client):

- **Aztec:** `npx -y @aztec/mcp-server@latest`
- **Noir:** `npx -y noir-mcp-server@latest`

Project-level files like this `AGENTS.md` complement MCP: they apply even when a server is not invoked.

## Aztec / Noir conventions (for contract work)

When implementing Aztec smart contracts in this repo:

- **Use the `aztec` CLI**, not raw `nargo`, for **`aztec compile`** and **`aztec test`** (standalone `nargo compile` / `nargo test` can miss required artifact steps). `nargo fmt` and `nargo doc` are fine when appropriate.
- **Hashing in Aztec.nr:** default to **Poseidon2** unless a spec or interoperability requirement says otherwise (e.g. `aztec::protocol::hash::poseidon2_hash`); do not default to Pedersen without reason.
- **Errors:** do not swallow errors, mask missing values with placeholders (`AztecAddress.ZERO`, `0`, `null`, etc.), or add retry/polling unless explicitly requested. Fail fast with clear messages.

## Linting and formatting

Repo-wide conventions and per-language commands (Node, Solidity, Noir) are documented in [`docs/linting.md`](docs/linting.md). Root shortcuts: `yarn lint`, `yarn format`.

## Workflow Rules

- implement in small, testable vertical slices
- if behavior is not specified yet, extend the spec here first and then implement it
- keep docs in sync with behavior in the same change
- test everything as you go
- Prefer reusable and modular code. Do not copy paste large code sections.
- After implementing a feature, take appropriate steps to refactor the codebase to keep it well maintained.

**Required TDD cycle:**

1. write the test first
2. run it and confirm it fails for the expected reason
3. implement the smallest change that should make it pass
4. run the relevant tests again and confirm they pass
5. update docs, examples, or config notes if needed
6. commit only after the change is green

**Definition of done:**

1. behavior is specified
2. tests were added first and seen failing
3. implementation passes the new and nearby relevant tests
4. manual verification steps are documented if needed
5. docs remain consistent with the code

## Configuration Rules

- load secrets and runtime settings from environment variables
- use local `.env` files only for testing and manual development
- do not commit real `.env` files or secrets
- validate required config early
- do not hardcode private keys, mnemonics, or contract addresses
- do not print sensitive values in logs
