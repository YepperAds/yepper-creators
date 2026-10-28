import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.join(scriptDirectory, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destinationDirectory = path.join(scriptDirectory, '..', 'public', 'ffmpeg');
const assets = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

async function copyAssets() {
  await mkdir(destinationDirectory, { recursive: true });
  await Promise.all(assets.map((asset) => copyFile(
    path.join(sourceDirectory, asset),
    path.join(destinationDirectory, asset),
  )));
}

copyAssets().catch((error) => {
  process.stderr.write(`Could not prepare ffmpeg.wasm browser assets: ${error.message}\n`);
  process.exitCode = 1;
});
