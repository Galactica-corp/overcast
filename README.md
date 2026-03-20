# Overcast

## Introduction

**Overcast** is a privacy-first stablecoin and settlement protocol on [Aztec](https://aztec.network/). It targets **private, compliant** value transfer and commerce: balances and payment metadata stay off public ledgers, while **ZK-based identity and compliance** (KYC/KYB, selective disclosure, auditability when policy requires it) are enforced inside the private execution layer—not bolted on as opaque off-chain policy alone.

**Purpose:** reduce the “transparency tax” of public chains for merchants, consumers, and (eventually) agents, without giving up the assurances institutions need. The design emphasizes programmable compliance, private settlement, and bridges between **public L1/L2 liquidity** and **Aztec** as the private hub—including patterns like L1 escrow / L2 minting (portal), cross-chain messaging, and high-throughput / agent-friendly payment flows (e.g. x402-oriented commerce).

**Foundations:** this repository is expected to combine **EVM smart contracts** (portals, messaging, public-side escrow and coordination), **Aztec private execution and Noir contracts** (including extensions around the **AIP-20** token model and RWA-oriented controls inspired by standards such as **CMTA**), and **Galactica’s ZK KYC / Identity stack** on Aztec (guardian-led attestations, proofs, and disclosure modules as described in the project docs).

---

## Installation

*To be added as the toolchain is pinned (e.g. Node, Aztec sandbox, Foundry/Hardhat, Noir compiler versions).*

---

## Testing

*To be added once unit, integration, and network tests are wired up.*

---

## Deployment

*To be added for target environments (local devnet, testnet, production) and contract/circuit deployment steps.*
