// Builds the site into public/: copies site/, adds the fonts and PNG icons,
// stamps the offline cache, then checks the result. Run with: node build.mjs
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const OUT = 'public';
const WORDMARK_WIDTH = 2103; // width of art/wordmark.txt in its own units
const hash = (data, kind = 'sha256') => createHash(kind).update(data).digest('hex');

await rm(OUT, { recursive: true, force: true });
await cp('site', OUT, { recursive: true, filter: (src) => !/(\.png|\.woff2|[\\/]fonts)$/.test(src) });

// Fonts come from pinned npm packages; the checksums make sure they are the files the game was tested with.
const FONTS = [
  ['aref-ruqaa/files/aref-ruqaa-arabic-700-normal.woff2', 'ruqaa-arabic-700.woff2', 'a2d18c431048642fd695211a9466364a3d7287942d701b4f21bce8969ed491ac'],
  ['almarai/files/almarai-arabic-400-normal.woff2', 'almarai-arabic-400.woff2', '530903c9168cfc13d3ef363b71c042d5c887476c4454a91223309465ae89c87f'],
  ['almarai/files/almarai-arabic-700-normal.woff2', 'almarai-arabic-700.woff2', '006fba6fe32a900c60f154cc9e2e142bf075078dc97a94715dd9f1f5d4e4421e'],
  ['almarai/files/almarai-arabic-800-normal.woff2', 'almarai-arabic-800.woff2', '7acac6ae3ea4d4eeb7c9b636856c46274f5904e02caff83a545d75ebb9754faf'],
  ['almarai/files/almarai-latin-400-normal.woff2', 'almarai-latin-400.woff2', '6f289856f002502ea9cc6aa85c2fd509f8aa6c3a17b5adf08f2ccc148cfeea4f'],
  ['almarai/files/almarai-latin-700-normal.woff2', 'almarai-latin-700.woff2', '53706a39de7c9d9b74032b0af6549cf9809e3f98b343ea5b054a25e10b1c2e7a'],
  ['almarai/files/almarai-latin-800-normal.woff2', 'almarai-latin-800.woff2', '7f9acc49f37d11319a44ecf80edb205f11cffddcb3013a0bbbc6af46dcf12b9c'],
];
await mkdir(`${OUT}/fonts`, { recursive: true });
for (const [from, to, sha] of FONTS) {
  const data = await readFile(`node_modules/@fontsource/${from}`);
  if (hash(data) !== sha) throw new Error(`Font file is not the tested one: ${from}`);
  await writeFile(`${OUT}/fonts/${to}`, data);
}
await cp('node_modules/@fontsource/aref-ruqaa/LICENSE', `${OUT}/fonts/OFL-ArefRuqaa.txt`);
await cp('node_modules/@fontsource/almarai/LICENSE', `${OUT}/fonts/OFL-Almarai.txt`);

// PNG icons and the link-preview image are drawn from icon.svg and the wordmark outline.
const iconSvg = await readFile('site/icons/icon.svg', 'utf8');
const squareIcon = iconSvg.replace('rx="112"', 'rx="0"');
const wordmark = (await readFile('art/wordmark.txt', 'utf8')).trim();
const checker = (x, fill) =>
  `<circle cx="${x}" cy="470" r="34" fill="${fill}"/><circle cx="${x}" cy="470" r="25" fill="none" stroke="#1f1a0c" stroke-opacity=".34" stroke-width="3"/>`;
const preview =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#10302a"/>' +
  '<g fill="#9a3028" stroke="#e3b23c" stroke-width="10"><circle cx="0" cy="0" r="120"/><circle cx="1200" cy="0" r="120"/>' +
  '<circle cx="0" cy="630" r="120"/><circle cx="1200" cy="630" r="120"/></g>' +
  `<g transform="translate(600 330) scale(.3) translate(${-WORDMARK_WIDTH / 2} 0)"><path fill="#e3b23c" d="${wordmark}"/></g>` +
  ['#e3b23c', '#d9785a', '#efe6d2', '#7fb2c4', '#9dbb8a'].map((fill, i) => checker(440 + i * 80, fill)).join('') + '</svg>';
const png = (svg, width, height, name) =>
  sharp(Buffer.from(svg), { density: 144 }).resize(width, height).png({ compressionLevel: 9 }).toFile(`${OUT}/icons/${name}`);
await png(iconSvg, 192, 192, 'icon-192.png');
await png(iconSvg, 512, 512, 'icon-512.png');
await png(squareIcon, 512, 512, 'maskable-512.png');
await png(squareIcon, 180, 180, 'apple-touch-icon.png');
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
