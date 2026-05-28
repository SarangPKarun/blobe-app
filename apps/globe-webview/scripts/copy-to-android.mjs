import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../dist/index.html');
const dest = resolve(
  __dirname,
  '../../mobile/android/app/src/main/assets/globe/globe.html',
);

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Copied dist/globe.html → ${dest}`);
