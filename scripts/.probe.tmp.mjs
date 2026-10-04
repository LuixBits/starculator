// Interaction probe for the planner: steppers → auto-pack, worker usage, selection both ways,
// view toggle, URL codec, IndexedDB restore. Usage: node probe.mjs <base-url> <out-dir>
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const [, , base = 'http://127.0.0.1:5176', outDir = '.'] = process.argv;
const preinstalled = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

const browser = await chromium.launch({
	executablePath,
	args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
	if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});
page.on('request', (r) => requests.push(r.url()));

const log = (...a) => console.log(...a);
const status = () => page.locator('.status').first().textContent();

await page.goto(`${base}/cargo/drake-caterpillar/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
log('1. fresh page status:', (await status())?.trim());

// Steppers: two 16s, three 8s. The plan should pack by itself after ~250 ms.
const more = (n) => page.getByRole('button', { name: `More ${n} SCU containers` });
await more(16).click();
await more(16).click();
await more(8).click();
await more(8).click();
await more(8).click();
await page.waitForTimeout(900);
log('2. after steppers status:', (await status())?.trim());
log('   url:', decodeURIComponent(page.url()));
log('   worker loaded:', requests.some((u) => /packer\.worker/.test(u)));
log('   order rows:', await page.locator('.order .line').count());
log('   fill strip / scale:', (await page.locator('.readout .big').textContent())?.trim());

// Selection from the list → 3D highlight (active label + outlined box).
await page.locator('.order .line').nth(2).click();
await page.waitForTimeout(900); // smooth scroll settles before any coordinates are read
log('3. row pressed:', await page.locator('.order .line').nth(2).getAttribute('aria-pressed'));
log('   active hold label:', await page.locator('.hold-label--active').count());
await page.screenshot({ path: `${outDir}/probe-selected-row.png` });

// Selection from the 3D view: click around the canvas centre until a box is hit.
// Scroll the table back into view first: the row click above scrolled the page.
const canvas = page.locator('.hold-scene canvas');
await canvas.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
const box = await canvas.boundingBox();
log('   canvas box in viewport:', JSON.stringify(box));
let hit = null;
for (const [fx, fy] of [
	[0.5, 0.55],
	[0.42, 0.6],
	[0.58, 0.62],
	[0.35, 0.5],
	[0.6, 0.5],
	[0.5, 0.7],
	[0.45, 0.45]
]) {
	await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
	await page.waitForTimeout(250);
	const pressed = await page.locator('.order .line[aria-pressed="true"]').count();
	if (pressed) {
		hit = [fx, fy];
		break;
	}
}
log('4. 3D click selected a box:', hit ? `yes at ${hit}` : 'no');
if (hit) {
	log('   selected row:', (await page.locator('.order .line[aria-pressed="true"]').textContent())?.replace(/\s+/g, ' ').trim());
}
// Click empty space (top-left corner of the canvas) → deselect.
await page.mouse.click(box.x + 20, box.y + 20);
await page.waitForTimeout(300);
log('   after empty click pressed rows:', await page.locator('.order .line[aria-pressed="true"]').count());
// Label overlays must not intercept: the element under a label's centre is the canvas.
const label = await page.locator('.hold-label--grid').first().boundingBox();
const under = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, [label.x + label.width / 2, label.y + label.height / 2]);
log('   element under a grid label:', under);

// View toggle → top view and v=top in the URL.
await page.getByRole('button', { name: 'Top' }).click();
await page.waitForTimeout(600);
log('5. data-view:', await page.locator('.hold-scene').getAttribute('data-view'));
log('   url:', decodeURIComponent(page.url()));
await page.screenshot({ path: `${outDir}/probe-top.png` });
await page.getByRole('button', { name: '3D' }).click();
await page.waitForTimeout(300);

// Add a second contract and change counts: must re-pack automatically.
await page.getByRole('button', { name: 'Add a contract group' }).click();
await page.getByRole('textbox', { name: 'Contract name' }).fill('Red Wind');
await more(1).click();
await more(1).click();
await page.waitForTimeout(900);
log('6. two groups status:', (await status())?.trim());
log('   url:', decodeURIComponent(page.url()));
log('   order rows:', await page.locator('.order .line').count());

// Reload without the query → restored from IndexedDB, same manifest.
const encoded = page.url();
await page.goto(`${base}/cargo/drake-caterpillar/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
log('7. restored url:', decodeURIComponent(page.url()));
log('   restored equals:', page.url() === encoded);
log('   restored status:', (await status())?.trim());

// Variant slug resolves to the representative with a note.
await page.goto(`${base}/cargo/rsi-constellation-andromeda/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
log('8. variant title:', await page.title());
log('   note:', (await page.locator('.variant-note').textContent())?.replace(/\s+/g, ' ').trim());

// Board search by alias.
await page.goto(`${base}/ships/`, { waitUntil: 'networkidle' });
await page.getByRole('searchbox', { name: 'Search ships' }).fill('andromeda');
await page.waitForTimeout(300);
log('9. alias search rows:', await page.locator('.rows a').count(), (await page.locator('.rows a .c-ship').first().textContent())?.replace(/\s+/g, ' ').trim());

// Phone: no horizontal overflow on the planner.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/cargo/drake-caterpillar/?g=Covalex%3A16x6%3BRed%20Wind%3A8x10%2C1x20`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const widths = await page.evaluate(() => ({
	scroll: document.documentElement.scrollWidth,
	client: document.documentElement.clientWidth
}));
log('10. phone scrollWidth/clientWidth:', widths.scroll, widths.client);
const small = await page.evaluate(() =>
	[...document.querySelectorAll('button, a, input, summary')]
		.filter((el) => el.getClientRects().length > 0)
		.map((el) => {
			const r = el.getBoundingClientRect();
			return { tag: el.tagName, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
		})
		.filter((e) => e.h > 0 && e.h < 44 && e.tag !== 'INPUT')
);
log('   controls under 44px:', JSON.stringify(small));

log('errors:', errors.length ? errors : 'none');
await browser.close();
