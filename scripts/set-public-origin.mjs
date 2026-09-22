#!/usr/bin/env node
/**
 * The public origin lives in exactly one place (site.config.json) and is
 * stamped into the few static files that must carry an absolute URL:
 *
 *   src/index.html    <link rel="canonical">, og:url, og:image, twitter:image
 *   src/robots.txt    Sitemap:
 *   src/sitemap.xml   <loc>
 *
 * USAGE
 *   node scripts/set-public-origin.mjs https://www.example.com   rewrite everything
 *   node scripts/set-public-origin.mjs --check                   verify they agree (run by npm run build)
 *
 * The origin must be scheme + host only, no path, no trailing slash. Nothing
 * else in the repository refers to the hostname: assets are relative, the
 * Supabase and social URLs are third-party origins.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(root, 'site.config.json');
const files = ['src/index.html', 'src/robots.txt', 'src/sitemap.xml'].map((f) => resolve(root, f));

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const current = config.publicOrigin;
const arg = process.argv[2];

if (!arg) {
  console.error('usage: set-public-origin.mjs <https://host> | --check');
  process.exit(2);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

if (arg === '--check') {
  const bad = files.filter((f) => !readFileSync(f, 'utf8').includes(current + '/'));
  const stray = files.filter((f) => /https?:\/\/[a-z0-9.-]*onrender\.com/i.test(readFileSync(f, 'utf8')) && !current.includes('onrender.com'));
  if (bad.length || stray.length) {
    for (const f of bad) console.error(`origin check: ${f} does not carry ${current}`);
    for (const f of stray) console.error(`origin check: ${f} still carries an onrender.com host`);
    process.exit(1);
  }
  console.log(`origin check: all files carry ${current}`);
  process.exit(0);
}

let next;
try {
  const u = new URL(arg);
  if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash) throw new Error();
  next = u.origin;
} catch {
  console.error('the origin must be https://host with no path, e.g. https://www.example.com');
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);
for (const f of files) {
  let text = readFileSync(f, 'utf8');
  const before = text;
  text = text.replace(new RegExp(escapeRe(current), 'g'), next);
  if (f.endsWith('sitemap.xml')) text = text.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`);
  if (text !== before) {
    writeFileSync(f, text);
    console.log(`updated ${f.slice(root.length + 1)}`);
  }
}
config.publicOrigin = next;
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`public origin: ${current} → ${next}`);
