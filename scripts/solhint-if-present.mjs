import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Run Solhint on all `.sol` files under `packages/`. No-op (exit 0) if none exist.
 */
function* walkSol(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walkSol(p);
    else if (name.endsWith('.sol')) yield p;
  }
}

const files = [...walkSol('packages')];
if (files.length === 0) process.exit(0);

const r = spawnSync('solhint', files, { stdio: 'inherit', shell: false });
process.exit(r.status === null ? 1 : r.status);
