#!/usr/bin/env node
// Usage: node scripts/screenshot.mjs <url> <out.png> [--width 1440] [--height 900] [--full] [--wait 800] [--dark]
// Takes a screenshot with Playwright's Chromium (preinstalled binary when present).
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , url, out, ...rest] = process.argv;
if (!url || !out) {
	console.error(
		'usage: screenshot.mjs <url> <out.png> [--width N] [--height N] [--full] [--wait ms]'
	);
	process.exit(2);
}
const opt = (name, fallback) => {
	const i = rest.indexOf(`--${name}`);
	return i >= 0 ? rest[i + 1] : fallback;
};
const width = Number(opt('width', 1440));
const height = Number(opt('height', 900));
const wait = Number(opt('wait', 800));
const full = rest.includes('--full');
const preinstalled = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

const browser = await chromium.launch({
	executablePath,
	args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(wait);
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log(`saved ${out} (${width}x${height}${full ? ', full page' : ''})`);
if (errors.length) {
	console.log('browser errors:');
	for (const e of errors) console.log('  ' + e);
}
