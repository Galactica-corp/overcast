# Linting and formatting

The monorepo uses **layered** tooling so each language keeps its native linter/formatter while sharing one entry point where possible.

## Node / TypeScript (root and workspaces)

| Tool     | Role                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| ESLint   | Lint for `.js`, `.mjs`, `.cjs` and `packages/private-stablecoin/**/*.ts` (typescript-eslint) |
| Prettier | Format JSON, Markdown, YAML, and JS/TS                                                       |

From the repository root:

```bash
yarn lint          # ESLint + Prettier --check
yarn lint:eslint   # ESLint only
yarn format        # Prettier write
yarn format:check  # Prettier check only
```

### `packages/private-stablecoin` (Aztec / TypeScript)

TypeScript in that workspace is linted by the root ESLint config. Useful commands:

```bash
yarn workspace @galactica-net/overcast-private-stablecoin compile
yarn workspace @galactica-net/overcast-private-stablecoin codegen
yarn workspace @galactica-net/overcast-private-stablecoin test
```

Shorter aliases from the repo root: `yarn compile:private-stablecoin`, `yarn codegen:private-stablecoin`, `yarn test:private-stablecoin`.

Opt-in Aztec Jest E2E (requires a running local network): `yarn test:private-stablecoin:e2e` (sets `RUN_AZTEC_E2E=1`). Default `yarn test:js` skips that suite.

Add new TypeScript under `packages/private-stablecoin/` (or extend the ESLint `files` glob in [`eslint.config.mjs`](../eslint.config.mjs) if you introduce TS elsewhere).

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

Generated Aztec outputs (`target/`, `src/artifacts/`, `store/`) are excluded from Prettier/ESLint via ignore patterns; do not hand-edit generated TypeScript.

## CI

Run `yarn lint` on every change; add `yarn lint:solidity` and Noir checks when those trees contain sources.
