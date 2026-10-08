#!/usr/bin/env node
// Статические проверки сайта из одного файла (index.html).
//   1. Проверка синтаксиса каждого встроенного блока <script>.
//   2. Если установлен Playwright — загрузка страницы в headless Chromium и
//      вывод необработанных ошибок и console.error (сбои CDN и сети выводятся
//      отдельно, потому что зависят от окружения).
// Запуск: node .claude/scripts/verify.mjs [путь/к/index.html] [--no-browser]
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

// 1. Синтаксис встроенных скриптов
const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
let m, checked = 0;
while ((m = re.exec(html))) {
  if (/type=["'](?!text\/javascript|module)/i.test(m[1])) continue; // JSON-LD и т. п.
  checked++;
  const line = html.slice(0, m.index).split('\n').length;
  try {
    new vm.Script(m[2], { filename: `${basename(file)}:${line}` });
  } catch (e) {
    failed = true;
    console.error(`SYNTAX  ${basename(file)}, скрипт на строке ${line}: ${e.message}`);
  }
}
console.log(`Синтаксис: проверено встроенных скриптов — ${checked}`);

// 2. Быстрая проверка в браузере
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
    console.log('Браузер:   пропущено (Playwright не установлен; включить: npm i -g playwright)');
  } else {
    const browser = await pw.chromium.launch().catch(() =>
      pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [], consoleErrors = [], networkErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => {
      // Неудачные загрузки ресурсов и так выводятся ниже через requestfailed.
      if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) consoleErrors.push(msg.text());
    });
    page.on('requestfailed', r => networkErrors.push(`${r.url()} (${r.failure()?.errorText})`));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 30000 }).catch(e => pageErrors.push(e.message));
    await page.waitForTimeout(1000);
    const title = await page.title();
    await browser.close();

    console.log(`Браузер:   загружено «${title}»`);
    for (const e of pageErrors) console.error(`ERROR   ${e}`);
    for (const e of consoleErrors) console.error(`CONSOLE ${e}`);
    for (const e of networkErrors) console.log(`NETWORK ${e}`);
    if (pageErrors.length) failed = true;
  }
}

console.log(failed ? 'ПРОВЕРКА: FAIL' : 'ПРОВЕРКА: PASS');
process.exit(failed ? 1 : 0);
