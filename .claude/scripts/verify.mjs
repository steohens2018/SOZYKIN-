#!/usr/bin/env node
// Статические проверки сайта (index.html, app.html, accuracy.html и др.).
//   1. Проверка синтаксиса каждого встроенного блока <script> и файла sw.js,
//      разбор manifest.webmanifest.
//   2. Если установлен Playwright — загрузка каждой страницы в headless
//      Chromium и вывод необработанных ошибок и console.error (сбои CDN и сети
//      выводятся отдельно, потому что зависят от окружения).
// Запуск: node .claude/scripts/verify.mjs [страница.html …] [--no-browser]
// Без списка страниц проверяются все *.html в корне репозитория.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const args = process.argv.slice(2);
const skipBrowser = args.includes('--no-browser');
const listed = args.filter(a => !a.startsWith('--'));
const files = (listed.length ? listed : readdirSync('.').filter(f => f.endsWith('.html')).sort())
  .map(f => resolve(f));

let failed = false;

// 1. Синтаксис встроенных скриптов
let checked = 0;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
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
}
console.log(`Синтаксис: страниц ${files.length}, встроенных скриптов — ${checked}`);

if (!listed.length) {
  if (existsSync('sw.js')) {
    try { new vm.Script(readFileSync('sw.js', 'utf8'), { filename: 'sw.js' }); console.log('sw.js:     синтаксис в порядке'); }
    catch (e) { failed = true; console.error(`SYNTAX  sw.js: ${e.message}`); }
  }
  if (existsSync('manifest.webmanifest')) {
    try { JSON.parse(readFileSync('manifest.webmanifest', 'utf8')); console.log('Манифест:  JSON в порядке'); }
    catch (e) { failed = true; console.error(`SYNTAX  manifest.webmanifest: ${e.message}`); }
  }
}

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
    for (const file of files) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const pageErrors = [], consoleErrors = [], networkErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      page.on('console', msg => {
        // Неудачные загрузки ресурсов и так выводятся ниже через requestfailed.
        if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) consoleErrors.push(msg.text());
      });
      page.on('requestfailed', r => networkErrors.push(`${r.url()} (${r.failure()?.errorText})`));
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 30000 }).catch(e => pageErrors.push(e.message));
      await page.waitForTimeout(800);
      const title = await page.title();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await page.close();

      console.log(`Браузер:   ${basename(file)} — «${title}»`);
      for (const e of pageErrors) console.error(`ERROR   ${e}`);
      for (const e of consoleErrors) console.error(`CONSOLE ${e}`);
      for (const e of networkErrors) console.log(`NETWORK ${e}`);
      if (overflow > 0) { console.error(`ERROR   ${basename(file)}: горизонтальная прокрутка на 390px (+${overflow}px)`); failed = true; }
      if (pageErrors.length) failed = true;
    }
    await browser.close();
  }
}

console.log(failed ? 'ПРОВЕРКА: FAIL' : 'ПРОВЕРКА: PASS');
process.exit(failed ? 1 : 0);
