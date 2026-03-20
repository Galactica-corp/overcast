import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';

/** Enough for Node scripts without pulling `eslint-plugin-n` yet */
const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  exports: 'readonly',
  global: 'readonly',
  module: 'readonly',
  process: 'readonly',
  require: 'readonly',
};

/**
 * Root ESLint flat config for Node/TS workspaces.
 * - Solidity: use `yarn lint:solidity` (Solhint) in this repo.
 * - Noir: use `nargo fmt` / Aztec CLI; ESLint does not apply to `.nr` files.
 */
export default [
  {
    ignores: [
      '**/.pnp.cjs',
      '**/.pnp.loader.mjs',
      '**/node_modules/**',
      '.yarn/**',
      '**/coverage/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/artifacts/**',
      '**/typechain-types/**',
      '**/target/**',
    ],
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  // When TypeScript workspaces land, extend with typescript-eslint, e.g.:
  // import tseslint from 'typescript-eslint';
  // ...tseslint.configs.recommended,
  // { files: ['**/*.{ts,tsx}'], ... }
];
