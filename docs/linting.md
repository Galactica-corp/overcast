# Linting and formatting

The monorepo uses **layered** tooling so each language keeps its native linter/formatter while sharing one entry point where possible.

## Node / TypeScript (root and future JS workspaces)

| Tool     | Role                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| ESLint   | Lint for `.js`, `.mjs`, `.cjs` (and later `.ts` / `.tsx` via `typescript-eslint`) |
| Prettier | Format JSON, Markdown, YAML, and JS/TS                                            |

From the repository root:

```bash
yarn lint          # ESLint + Prettier --check
yarn lint:eslint   # ESLint only
yarn format        # Prettier write
yarn format:check  # Prettier check only
```

## Solidity (`packages/stablecoin-wrapper`, future EVM packages)

| Tool     | Role                                                     |
| -------- | -------------------------------------------------------- |
| Solhint  | Solidity style and safety                                |
| Prettier | Optional later via `prettier-plugin-solidity` for `.sol` |

Root config: [`.solhint.json`](../.solhint.json) (shared baseline). When contracts exist (or anytime—no-op if there are no `.sol` files yet):

```bash
yarn lint:solidity
```

Adjust `compiler-version` in `.solhint.json` to match your pragma.

## Noir / Aztec (`packages/private-stablecoin`, `packages/token-bridge`)

| Tool        | Role                                 |
| ----------- | ------------------------------------ |
| `nargo fmt` | Format Noir sources                  |
| Aztec CLI   | Compile/test wrappers per Aztec docs |

ESLint and Prettier do **not** process `.nr` files. Follow Aztec guidance: use **`aztec compile`** / **`aztec test`**, not raw `nargo compile` / `nargo test`, for contract projects that need full artifacts.

Check formatting (once `Nargo.toml` exists under a package):

```bash
cd packages/private-stablecoin && nargo fmt --check
```

## CI

Run `yarn lint` on every change; add `yarn lint:solidity` and Noir checks when those trees contain sources.
