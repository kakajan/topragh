#!/usr/bin/env node
/**
 * Build MiniSearch JSON index + by-letter chunks for the static site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const webRoot = path.resolve(__dirname, '..');
const canonDir = path.join(root, 'data/canonical');
const outDir = path.join(webRoot, 'public/data');
const lettersDir = path.join(outDir, 'letters');

const FOLD = {
  ä: 'a',
  ç: 'c',
  ñ: 'n',
  ö: 'o',
  ş: 's',
  ü: 'u',
  ÿ: 'y',
  ž: 'z',
};

function foldTurkmen(input) {
  const nfc = input.normalize('NFC').toLowerCase().trim();
  let out = '';
  for (const ch of nfc) out += FOLD[ch] ?? ch;
  return out.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function loadEntries() {
  const full = path.join(canonDir, 'entries.json');
  const enOnly = path.join(canonDir, 'entries.en.json');
  const file = fs.existsSync(full) ? full : enOnly;
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`source=${file} count=${entries.length}`);
  return entries;
}

fs.mkdirSync(lettersDir, { recursive: true });
const entries = loadEntries();

const docs = entries.map((e) => ({
  id: e.id,
  tk: e.tk,
  tkFold: foldTurkmen(e.tk),
  en: e.en || '',
  fa: e.fa || '',
  letter: e.letter,
}));

const mini = new MiniSearch({
  fields: ['tk', 'tkFold', 'en', 'fa'],
  storeFields: ['tk', 'en', 'fa', 'letter'],
  searchOptions: {
    boost: { tk: 4, tkFold: 3, fa: 2, en: 2 },
    prefix: true,
    fuzzy: 0.15,
  },
});
mini.addAll(docs);

fs.writeFileSync(path.join(outDir, 'search-index.json'), JSON.stringify(mini), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'entries-lite.json'),
  JSON.stringify(
    entries.map((e) => ({
      id: e.id,
      tk: e.tk,
      letter: e.letter,
      en: e.en,
      fa: e.fa,
      fa_status: e.fa_status,
      senses: e.senses,
      tags: e.tags,
    })),
  ),
  'utf8',
);

const byLetter = new Map();
for (const e of entries) {
  const L = e.letter || '?';
  if (!byLetter.has(L)) byLetter.set(L, []);
  byLetter.get(L).push({
    id: e.id,
    tk: e.tk,
    en: e.en,
    fa: e.fa,
    fa_status: e.fa_status,
  });
}

const letterIndex = [...byLetter.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], 'en'))
  .map(([letter, items]) => ({ letter, count: items.length }));

fs.writeFileSync(path.join(outDir, 'letters.json'), JSON.stringify(letterIndex), 'utf8');

for (const [letter, items] of byLetter) {
  // Unicode filenames (ä.json). Do NOT percent-encode the filename —
  // static servers decode URL paths, so "%C3%A4.json" would 404.
  const file = `${letter.normalize('NFC')}.json`;
  fs.writeFileSync(path.join(lettersDir, file), JSON.stringify(items), 'utf8');
}

// Sitemaps (chunked entry URLs)
const site = 'https://topragh.ir';
const staticUrls = [
  '/',
  '/browse/',
  '/about/',
  '/contribute/',
  '/en/',
  '/en/browse/',
  '/en/about/',
  '/en/contribute/',
  '/llms.txt',
];

function urlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
}

fs.writeFileSync(
  path.join(webRoot, 'public/sitemap-static.xml'),
  urlset(staticUrls.map((u) => site + u)),
  'utf8',
);

const chunkSize = 4000;
const entryXmlFiles = [];
for (let i = 0; i < entries.length; i += chunkSize) {
  const chunk = entries.slice(i, i + chunkSize);
  const n = entryXmlFiles.length + 1;
  const name = `sitemap-entries-${n}.xml`;
  const urls = chunk.flatMap((e) => [
    `${site}/w/${encodeURIComponent(e.id)}/`,
    `${site}/en/w/${encodeURIComponent(e.id)}/`,
  ]);
  fs.writeFileSync(path.join(webRoot, 'public', name), urlset(urls), 'utf8');
  entryXmlFiles.push(name);
}

const indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${site}/sitemap-static.xml</loc></sitemap>\n${entryXmlFiles
  .map((f) => `  <sitemap><loc>${site}/${f}</loc></sitemap>`)
  .join('\n')}\n</sitemapindex>\n`;
fs.writeFileSync(path.join(webRoot, 'public/sitemap-index.xml'), indexXml, 'utf8');

console.log(
  JSON.stringify({
    entries: entries.length,
    letters: letterIndex.length,
    indexBytes: fs.statSync(path.join(outDir, 'search-index.json')).size,
    sitemaps: entryXmlFiles.length + 1,
  }),
);
