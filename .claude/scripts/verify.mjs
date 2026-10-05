#!/usr/bin/env node
// Static checks for the single-file site (index.html).
//   1. Syntax-check every inline <script> block.
//   2. If Playwright is installed, load the page in headless Chromium and
//      report uncaught errors and console.error output (CDN/network failures
//      are reported separately, since they depend on the environment).
// Usage: node .claude/scripts/verify.mjs [path/to/index.html] [--no-browser]
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const args = process.argv.slice(2);
const file = resolve(args.find(a => !a.startsWith('--')) || 'index.html');
const skipBrowser = args.includes('--no-browser');
const html = readFileSync(file, 'utf8');

let failed = false;

// 1. Inline script syntax
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let m, checked = 0;
while ((m = re.exec(html))) {
  if (/type=["'](?!text\/javascript|module)/i.test(m[1])) continue; // JSON-LD etc.
  checked++;
  const line = html.slice(0, m.index).split('\n').length;
  try {
    new vm.Script(m[2], { filename: `${basename(file)}:${line}` });
  } catch (e) {
    failed = true;
    console.error(`SYNTAX  ${basename(file)} script at line ${line}: ${e.message}`);
  }
}
console.log(`Syntax:  ${checked} inline script(s) checked`);

// 2. Browser smoke test
async function loadPlaywright() {
  for (const from of [process.cwd() + '/', import.meta.url]) {
    try { return createRequire(from)('playwright'); } catch {}
  }
  try {
    const { execSync } = await import('node:child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(import.meta.url)(`${root}/playwright`);
  } catch {}
  return null;
}

if (!skipBrowser) {
  const pw = await loadPlaywright();
  if (!pw) {
    console.log('Browser: skipped (playwright not installed; npm i -g playwright to enable)');
  } else {
    const browser = await pw.chromium.launch().catch(() =>
      pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [], consoleErrors = [], networkErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => {
      // Failed resource loads are already reported via requestfailed below.
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) consoleErrors.push(msg.text());
    });
    page.on('requestfailed', r => networkErrors.push(`${r.url()} (${r.failure()?.errorText})`));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 30000 }).catch(e => pageErrors.push(e.message));
    await page.waitForTimeout(1000);
    const title = await page.title();
    await browser.close();

    console.log(`Browser: loaded "${title}"`);
    for (const e of pageErrors) console.error(`ERROR   ${e}`);
    for (const e of consoleErrors) console.error(`CONSOLE ${e}`);
    for (const e of networkErrors) console.log(`NETWORK ${e}`);
    if (pageErrors.length) failed = true;
  }
}

console.log(failed ? 'VERIFY:  FAIL' : 'VERIFY:  PASS');
process.exit(failed ? 1 : 0);
