// A working makefun-frontend-01 entry (Node 22, standard library only): the frontend is this directory's app/
// folder, plain static files a browser opens at app/index.html (ES modules, CSS, no build step), reading make.fun's
// public API at https://make.fun/api. The program hands it in: it copies app/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json, the summary the judge reads (your screenshots, the first load's files
// and bytes, and your source), with the vendored make.fun library. Leave vendor/makefun-frontend.ts as it is: the
// scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Bountyscope lives in app/: a sortable bounty board (click a column, or
// press / to filter from the keyboard), a page per bounty with its rules and
// rewards, live leaderboards, and account profiles — all hash-routed with
// keep-content navigation so no visit ever blanks the page.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 3 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 16 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

/** Every file under dir, relative paths, walking recursively. */
function walk(dir: string, rel = ''): string[] {
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(abs).isDirectory()) found.push(r, ...walk(abs, r));
    else found.push(r);
  }
  return found;
}

/** Pre-flight: refuse here, with a message that names the offending file,
 * anything the scorer would refuse anyway — a screenshot over the cap, one
 * too many, or an app/ tree too big or too numerous to hand in. */
function preflight() {
  const shotsDir = join(here, 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
  if (shots.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/ has ${shots.length} images; the gate takes at most ${CAPS.screenshots.max}.`);
  }
  for (const f of shots) {
    const bytes = statSync(join(shotsDir, f)).size;
    if (bytes > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshots/${f} is ${bytes} bytes; the cap is ${CAPS.screenshots.max_bytes}.`);
    }
  }
  const appDir = join(here, 'app');
  const appFiles = walk(appDir);
  if (appFiles.length > CAPS.app_max_files) {
    throw new Error(`app/ holds ${appFiles.length} entries; the cap is ${CAPS.app_max_files}.`);
  }
  const appBytes = appFiles.reduce((s: number, r: string) => s + statSync(join(appDir, r)).size, 0);
  if (appBytes > CAPS.app_max_bytes) {
    throw new Error(`app/ is ${appBytes} bytes; the cap is ${CAPS.app_max_bytes}.`);
  }
  return { screenshots: shots.length, appFiles: appFiles.length, appBytes };
}

const counts = preflight();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, CAPS),
);

console.log(`dossier written to ${join(out, 'dossier.json')} — ${counts.screenshots} screenshot(s), app/ = ${counts.appFiles} files, ${(counts.appBytes / 1024).toFixed(1)} KiB`);
