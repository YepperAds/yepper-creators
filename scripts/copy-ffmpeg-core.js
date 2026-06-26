'use strict';

// Self-hosts the ffmpeg.wasm core (single-threaded UMD build) under
// public/ffmpeg/ so the browser-side ad-overlay burn-in (see
// app/(advertiser)/_components/lib/clientAdOverlay.ts) never depends on a
// third-party CDN being up. Re-run automatically via the "postinstall" hook
// in package.json since these are build artifacts, not source — not
// committed to git (see .gitignore).

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destDir = path.join(__dirname, '..', 'public', 'ffmpeg');

if (!fs.existsSync(srcDir)) {
  console.warn('[copy-ffmpeg-core] @ffmpeg/core not installed yet — skipping');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}
console.log('[copy-ffmpeg-core] Copied ffmpeg-core.js/.wasm into public/ffmpeg/');
