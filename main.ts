// Ridgeline Run — the hand-in program (Node 22, standard library only).
//
// The game lives in game/ as plain static files a desktop browser opens
// offline, and its screenshots live in screenshots/. This program copies both
// into the grader's output directory and writes dossier.json there, the
// summary the judge reads, built by the vendored make.fun library.
//
// Run it locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game itself with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a stale file can never leak in.
// Clear only the CONTENTS of outDir: removing outDir itself needs write
// permission on its parent, which the grader's unprivileged user does not
// have (the parent is read-only), so rmSync(outDir) fails with EACCES.
// Deleting each child only needs write permission on outDir itself, which
// the grader provides. (readdirSync is imported below; ESM hoists it.)
mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

const gameSrc = join(repoRoot, 'game');
const shotsSrc = join(repoRoot, 'screenshots');
cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own: the dossier text cap and the screenshot,
// file-count and byte limits the gate enforces on /output.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A one-line receipt: what the grader will see.
import { readdirSync, statSync } from 'node:fs';
const shotDir = join(outDir, 'screenshots');
const shotNames = existsSync(shotDir) ? readdirSync(shotDir).sort() : [];
const shotBytes = shotNames.map((n) => `${n} ${statSync(join(shotDir, n)).size}B`).join(', ');
console.log(`Ridgeline Run handed in: game/ + screenshots/ + dossier.json (${dossier.length} bytes) -> ${outDir}`);
console.log(`screenshots: ${shotNames.length} [${shotBytes}]`);
