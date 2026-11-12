// Builds the site into public/: copies site/, adds the fonts and PNG icons,
// stamps the offline cache, then checks the result. Run with: node build.mjs
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const OUT = 'public';
const hash = (data, kind = 'sha256') => createHash(kind).update(data).digest('hex');

await rm(OUT, { recursive: true, force: true });
await cp('site', OUT, { recursive: true, filter: (src) => !/(\.png|\.woff2|[\\/]fonts)$/.test(src) });

// Fonts come from pinned npm packages; the checksums make sure they are the files the game was tested with.
const FONTS = [
  ['@fontsource-variable/marhey/files/marhey-arabic-wght-normal.woff2', 'marhey-arabic.woff2',
    '20389b17106ed2ca92ef4f36e785e521a617dc13865d7c6e63a47c7ad37afff3'],
  ['@fontsource-variable/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-wght-normal.woff2', 'baloo-arabic.woff2',
    '643bd83b53ec8f25db2428e338673ddc85c345b976c449ccdad4d2b394f719e7'],
  ['@fontsource-variable/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-wght-normal.woff2', 'baloo-latin.woff2',
    '332a4fc624d786925f03d480df6eb051aca5fb9f2a8f105f8300dcfac201425c'],
];
await mkdir(`${OUT}/fonts`, { recursive: true });
for (const [from, to, sha] of FONTS) {
  const data = await readFile(`node_modules/${from}`);
  if (hash(data) !== sha) throw new Error(`Font file is not the tested one: ${from}`);
  await writeFile(`${OUT}/fonts/${to}`, data);
}
await cp('node_modules/@fontsource-variable/marhey/LICENSE', `${OUT}/fonts/OFL-Marhey.txt`);
await cp('node_modules/@fontsource-variable/baloo-bhaijaan-2/LICENSE', `${OUT}/fonts/OFL-BalooBhaijaan2.txt`);

// PNG icons and the link-preview image are drawn from the mascot in icon.svg.
const iconSvg = await readFile('site/icons/icon.svg', 'utf8');
const face = iconSvg.match(/<g transform="[^"]*">([\s\S]*?)<\/g>/)[1];
const wordmark = (await readFile('art/wordmark.txt', 'utf8')).trim();
const fullBleed = (scale, x, y) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1a1530"/>' +
  `<circle cx="420" cy="70" r="190" fill="#8f73ff" opacity=".28"/><g transform="translate(${x} ${y}) scale(${scale})">${face}</g></svg>`;
const preview =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>' +
  '<radialGradient id="a" cx="1140" cy="0" r="940" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8f73ff" stop-opacity=".42"/>' +
  '<stop offset="1" stop-color="#8f73ff" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="b" cx="0" cy="630" r="800" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff5d73" stop-opacity=".3"/>' +
  '<stop offset="1" stop-color="#ff5d73" stop-opacity="0"/></radialGradient></defs>' +
  '<rect width="1200" height="630" fill="#130f20"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#b)"/>' +
  `<g transform="translate(704 130) scale(2.9)">${face}</g>` +
  `<g transform="translate(100 392) scale(.196)"><path fill="#ffd447" d="${wordmark}"/></g></svg>`;
const png = (svg, width, height, name) =>
  sharp(Buffer.from(svg), { density: 144 }).resize(width, height).png({ compressionLevel: 9 }).toFile(`${OUT}/icons/${name}`);
await png(iconSvg, 192, 192, 'icon-192.png');
await png(iconSvg, 512, 512, 'icon-512.png');
await png(fullBleed(2.3, 108, 104), 512, 512, 'maskable-512.png');
await png(fullBleed(2.9, 72, 60), 180, 180, 'apple-touch-icon.png');
await png(preview, 1200, 630, 'og.png');

// The offline cache is named after the content, so a changed file always means a fresh cache.
const files = (await readdir(OUT, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll('\\', '/'))
  .sort();
const digest = createHash('sha1');
for (const file of files) digest.update(file).update(await readFile(file));
const sw = await readFile(`${OUT}/sw.js`, 'utf8');
if (!sw.includes('__BUILD__')) throw new Error('sw.js lost its __BUILD__ marker');
await writeFile(`${OUT}/sw.js`, sw.replace('__BUILD__', digest.digest('hex').slice(0, 12)));

// Checks: everything the offline cache lists exists, every script parses, the rules still hold.
for (const [, file] of sw.matchAll(/^ {2}'([^']+)',$/gm)) {
  if (file !== './') await access(`${OUT}/${file}`);
}
for (const file of files.filter((name) => name.endsWith('.js'))) execFileSync(process.execPath, ['--check', file]);
execFileSync(process.execPath, ['--test', 'tests/game.test.mjs'], { stdio: 'inherit' });
console.log(`Built ${files.length} files into ${OUT}/`);
